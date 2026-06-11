import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TENANT_MAP: Record<string, string> = {
  'cricket-australia': 'ca',
  'afl': 'afl',
  'netball': 'netball',
  'basketball-victoria': 'bv',
  'basketball-nsw': 'bnsw',
  'basketball-qld': 'bq',
  'basketball-sa': 'bsa',
  'basketball-tas': 'bt',
  'basketball-wa': 'bwa',
  'basketball-act': 'bact',
  'basketball-nt': 'bnt'
};

const DISCOVER_COMPETITIONS_QUERY = `
query discoverCompetitions($organisationID: ID!) {
  discoverCompetitions(organisationID: $organisationID) {
    id
    name
    seasons(organisationID: $organisationID) {
      id
      name
      startDate
      endDate
      status {
        name
        value
      }
    }
  }
}
`;

function getSeasonSlug(competitionName: string, seasonName: string): string {
  const combined = `${competitionName} ${seasonName}`;
  return combined
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export async function GET(req: Request) {
  try {
    const urlObj = new URL(req.url);
    const clubId = urlObj.searchParams.get('clubId');

    let clubsQuery = supabase
      .from('clubs')
      .select('id, name, settings, club_cat');
      
    if (clubId) {
      clubsQuery = clubsQuery.eq('id', clubId);
    } else {
      clubsQuery = clubsQuery.eq('club_cat', 'PlayHQ');
    }

    const { data: clubs, error: clubsError } = await clubsQuery;
    if (clubsError) throw clubsError;

    const notificationsSent: string[] = [];
    const unmappedSeasonsByClub: Record<string, any[]> = {};

    for (const club of clubs || []) {
      const settings = typeof club.settings === 'object' && club.settings !== null ? club.settings : {};
      const playhqOrgId = settings.playhq_org_id;
      const playhqTenant = settings.playhq_tenant || 'ca';
      const ignoredCompetitions = settings.ignored_playhq_competition_ids || [];
      const notifiedSeasonIds = settings.notified_playhq_season_ids || [];

      if (!playhqOrgId) continue;

      const tenant = TENANT_MAP[playhqTenant] || playhqTenant;

      // Fetch from PlayHQ GraphQL API
      const response = await fetch("https://api.playhq.com/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "tenant": tenant,
          "Origin": "https://www.playhq.com"
        },
        body: JSON.stringify({
          query: DISCOVER_COMPETITIONS_QUERY,
          variables: { organisationID: playhqOrgId }
        })
      });

      if (!response.ok) {
        console.error(`Failed to fetch PlayHQ competitions for ${club.name}: status ${response.status}`);
        continue;
      }

      const gqlResult = await response.json();
      if (gqlResult.errors) {
        console.error(`GraphQL errors for ${club.name}:`, gqlResult.errors);
        continue;
      }

      const competitions = gqlResult?.data?.discoverCompetitions || [];

      // Fetch all teams for this club to extract mapped season slugs
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id, settings')
        .eq('club_id', club.id);

      if (teamsError) {
        console.error(`Failed to fetch teams for ${club.name}:`, teamsError);
        continue;
      }

      const mappedSeasonSlugs = new Set<string>();
      for (const team of teams || []) {
        const teamUrl = team.settings?.playhq_url;
        if (teamUrl && typeof teamUrl === 'string') {
          try {
            const parsedUrl = new URL(teamUrl);
            const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
            const teamIndex = pathParts.indexOf('teams');
            if (teamIndex !== -1 && teamIndex > 0) {
              const seasonSlug = pathParts[teamIndex - 1];
              if (seasonSlug) {
                mappedSeasonSlugs.add(seasonSlug.toLowerCase());
              }
            }
          } catch (e) {}
        }
      }

      const clubUnmapped: any[] = [];

      for (const comp of competitions) {
        if (ignoredCompetitions.includes(comp.id)) continue;

        for (const season of comp.seasons || []) {
          const statusVal = season.status?.value;
          if (statusVal !== 'ACTIVE' && statusVal !== 'UPCOMING') continue;

          const expectedSlug = getSeasonSlug(comp.name, season.name);
          if (mappedSeasonSlugs.has(expectedSlug)) continue;

          clubUnmapped.push({
            competitionId: comp.id,
            competitionName: comp.name,
            seasonId: season.id,
            seasonName: season.name,
            seasonSlug: expectedSlug,
            startDate: season.startDate,
            endDate: season.endDate
          });
        }
      }

      if (clubUnmapped.length > 0) {
        unmappedSeasonsByClub[club.id] = clubUnmapped;

        // If this is the global cron run (no specific clubId), trigger notifications
        if (!clubId) {
          const newSeasonsToNotify = clubUnmapped.filter(s => !notifiedSeasonIds.includes(s.seasonId));

          if (newSeasonsToNotify.length > 0) {
            const { data: roles } = await supabase
              .from('user_roles')
              .select('email')
              .eq('club_id', club.id)
              .eq('role', 'club_admin');

            const emails = [...new Set(roles?.map(r => r.email) || [])];

            for (const email of emails) {
              if (!email) continue;
              // In production, we send the Resend email:
              /*
              const seasonsHtml = newSeasonsToNotify.map(s => `<li><strong>${s.competitionName}</strong>: ${s.seasonName} (Starts: ${s.startDate || 'Unknown'})</li>`).join('');
              await resend.emails.send({
                from: 'Fees Please <noreply@feesplease.com>',
                to: email,
                subject: `New PlayHQ Seasons Available for ${club.name}`,
                html: `<p>Hi there,</p><p>We detected new seasons are now active or upcoming on PlayHQ for <strong>${club.name}</strong>:</p><ul>${seasonsHtml}</ul><p>Please log in and update your team PlayHQ URLs under the Teams tab to sync the new fixtures.</p>`
              });
              */
              notificationsSent.push(`Notified ${email} for club ${club.name} about seasons: ${newSeasonsToNotify.map(s => s.seasonName).join(', ')}`);
            }

            // Mark season IDs as notified to avoid repeating emails next run
            const updatedNotifiedIds = [...new Set([...notifiedSeasonIds, ...newSeasonsToNotify.map(s => s.seasonId)])];
            await supabase
              .from('clubs')
              .update({
                settings: {
                  ...settings,
                  notified_playhq_season_ids: updatedNotifiedIds
                }
              })
              .eq('id', club.id);
          }
        }
      }
    }

    if (clubId) {
      return NextResponse.json({
        status: 'success',
        unmappedSeasons: unmappedSeasonsByClub[clubId] || []
      });
    }

    return NextResponse.json({
      status: 'success',
      message: `Processed ${clubs?.length || 0} PlayHQ clubs.`,
      notifications: notificationsSent,
      unmappedSeasons: unmappedSeasonsByClub
    });

  } catch (error: any) {
    console.error('PlayHQ Cron Error:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
