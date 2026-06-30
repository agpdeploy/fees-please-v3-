import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clubId = searchParams.get('clubId');

  if (!clubId) {
    return NextResponse.json({ error: 'Missing clubId' }, { status: 400 });
  }

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { data: serviceTeams, error: serviceTeamsErr } = await serviceClient.from('teams').select('id, name').eq('club_id', clubId);
    const teamIds = serviceTeams?.map(t => t.id) || [];

    const { data: serviceAnalytics, error: serviceAnalyticsErr } = await serviceClient.from('sponsor_analytics').select('*').in('team_id', teamIds);
    const { data: teamSponsors, error: teamSponsorsErr } = await serviceClient.from('team_sponsors').select('*').in('team_id', teamIds);

    return NextResponse.json({
      service_teams: serviceTeams?.length,
      service_teams_error: serviceTeamsErr,
      team_ids: teamIds,
      service_analytics: serviceAnalytics?.length,
      service_analytics_error: serviceAnalyticsErr,
      team_sponsors: teamSponsors,
      team_sponsors_error: teamSponsorsErr
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
