import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error("Auth Error:", authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use service role to bypass RLS so users can see their referrals' profiles
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, onboarding_completed, updated_at')
      .eq('referred_by', user.id)
      .order('updated_at', { ascending: false })

    if (profilesError) {
      console.error("Supabase Admin Error:", profilesError);
      return NextResponse.json({ error: profilesError.message }, { status: 500 })
    }

    // Now let's find the true referral status for each of these users.
    // A user reaches 'Actual' when their club hits 2 matches and the cron job creates a referral record.
    
    // First, find all clubs these users belong to as admins
    const userIds = profiles?.map(p => p.id) || [];
    let userRoles: any[] = [];
    if (userIds.length > 0) {
      const { data: roles } = await supabaseAdmin
        .from('user_roles')
        .select('user_id, club_id')
        .in('user_id', userIds)
        .eq('role', 'club_admin');
      if (roles) userRoles = roles;
    }

    // Now fetch the actual referrals that exist for this referrer
    const { data: referrals } = await supabaseAdmin
      .from('referrals')
      .select('referred_club_id, status, rewarded_at')
      .eq('referrer_user_id', user.id);

    // Map the true status back to the profiles
    const mappedReferrals = profiles?.map(profile => {
      // Find their club
      const role = userRoles.find(r => r.user_id === profile.id);
      const clubId = role?.club_id;
      
      // Check if a referral record exists for this club
      const refRecord = clubId ? referrals?.find(r => r.referred_club_id === clubId) : null;
      
      return {
        ...profile,
        // If there is a referral record, it means they hit 2 matches (active_free) or paid.
        has_reached_reward_status: !!refRecord,
        referral_status: refRecord ? refRecord.status : 'pending',
      };
    });

    return NextResponse.json({ referrals: mappedReferrals || [] })
  } catch (err: any) {
    console.error("Referral Route Exception:", err);
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
