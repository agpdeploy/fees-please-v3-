import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { activeClubId, oldSeasonName, newSeasonName, teamIds } = await req.json();

    if (!activeClubId || !oldSeasonName || !newSeasonName || !teamIds || teamIds.length === 0) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // AUTHENTICATION SECURITY CHECK
    const cookieStore = await cookies();
    const supabaseSecure = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
    );

    const { data: { user } } = await supabaseSecure.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ensure the user actually has admin rights to this specific club
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('club_id', activeClubId);

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isClubAdmin = roles?.some(r => r.role === 'club_admin' || r.role === 'super_admin');
    const isGlobalSuperAdmin = profile?.role === 'super_admin';

    if (!isClubAdmin && !isGlobalSuperAdmin) {
      return NextResponse.json({ error: 'Permission Denied. You do not own this club.' }, { status: 403 });
    }

    // Update all fixtures
    const { error: fixturesError } = await supabaseAdmin
      .from('fixtures')
      .update({ season_name: newSeasonName })
      .in('team_id', teamIds)
      .eq('season_name', oldSeasonName);

    if (fixturesError) {
      console.error('Failed to rename fixtures:', fixturesError);
      return NextResponse.json({ error: fixturesError.message }, { status: 500 });
    }

    // Update all transactions
    const { error: txError } = await supabaseAdmin
      .from('transactions')
      .update({ season_name: newSeasonName })
      .in('team_id', teamIds)
      .eq('season_name', oldSeasonName);

    if (txError) {
      console.error('Failed to rename transactions:', txError);
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in rename-season:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
