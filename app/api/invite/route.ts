import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server config error: Missing Supabase keys' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { 
      auth: { autoRefreshToken: false, persistSession: false } 
    });

    const body = await req.json();
    const { email, role, club_id, team_id } = body;

    if (!email || !role || !club_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    let userId = null;
    let isNewUser = false;

    // 1. Check if this user already exists in our system
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', cleanEmail)
      .single();

    if (existingProfile) {
      // User exists! Grab their ID.
      userId = existingProfile.id;
    } else {
      // User is brand new. Fire the welcome/invite email.
      const { data: authData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(cleanEmail);
      if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 400 });
      
      userId = authData.user.id;
      isNewUser = true;

      // Ensure their base profile is created
      await supabaseAdmin.from('profiles').upsert({ id: userId, email: cleanEmail }, { onConflict: 'id' });
    }

    // 2. Map their specific role into the junction table for THIS specific club
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        email: cleanEmail,
        role: role,
        club_id: club_id,
        team_id: role === 'team_admin' ? team_id : null
      });

    if (roleError) {
      return NextResponse.json({ error: roleError.message }, { status: 400 });
    }

    // 3. The BULLETPROOF Roster Auto-Merge
    const namePart = cleanEmail.split('@')[0];
    const firstNameFallback = namePart.charAt(0).toUpperCase() + namePart.slice(1);

    // Look for an existing player matching the exact email OR the first name fallback
    const { data: existingPlayer } = await supabaseAdmin.from('players')
      .select('id')
      .eq('club_id', club_id)
      .is('user_id', null) 
      .or(`email.eq.${cleanEmail},first_name.ilike.%${firstNameFallback}%`)
      .limit(1)
      .single();
      
    if (existingPlayer) {
      // MATCH FOUND: Link the auth user to this historical player profile
      await supabaseAdmin.from('players')
        .update({ 
          user_id: userId,
          default_team_id: role === 'team_admin' ? team_id : undefined 
        })
        .eq('id', existingPlayer.id);
    } else if (role === 'team_admin' && team_id) {
      // NO MATCH: They are brand new. Create a new player record for the captain.
      await supabaseAdmin.from('players').insert({
        user_id: userId,
        email: cleanEmail,
        first_name: firstNameFallback,
        last_name: "(Captain)",
        club_id: club_id,
        default_team_id: team_id,
        is_member: true
      });
    }

    return NextResponse.json({ 
      success: true, 
      isNewUser, 
      message: isNewUser ? 'Invited and granted access' : 'Access granted to existing user' 
    }, { status: 200 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}