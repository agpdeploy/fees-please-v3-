import { NextResponse } from 'next/server';

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

const TEAM_FIXTURE_QUERY = `
query teamFixture($teamID: ID!) {
  discoverTeamFixture(teamID: $teamID) {
    id
    name
    fixture {
      games {
        id
        date
        allocation {
          time
          court {
            id
            name
            venue {
              id
              name
            }
          }
        }
        home {
          ... on ProvisionalTeam {
            name
          }
          ... on DiscoverTeam {
            id
            name
            logo {
              sizes {
                url
              }
            }
          }
        }
        away {
          ... on ProvisionalTeam {
            name
          }
          ... on DiscoverTeam {
            id
            name
            logo {
              sizes {
                url
              }
            }
          }
        }
      }
    }
}
}
`;

const ORG_DETAILS_QUERY = `
query getOrg($code: String!) {
  discoverOrganisation(code: $code) {
    name
    email
    websiteUrl
    address {
      suburb
      state
      postcode
    }
  }
}
`;

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string' || !url.includes('playhq.com')) {
      return NextResponse.json({ error: 'Invalid PlayHQ URL' }, { status: 400 });
    }

    // Parse the URL
    // e.g. https://www.playhq.com/cricket-australia/org/ferny-districts-cricket-club/462e4428/senior-competition-winter-2026/teams/ferny-districts-sunday-c-grade/b7cf852d
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);

    // [tenant_slug, 'org', org_slug, org_id, season_slug, 'teams', team_slug, team_id]
    const tenantSlug = pathParts[0];
    const orgIndex = pathParts.indexOf('org');
    const orgId = orgIndex !== -1 && orgIndex + 2 < pathParts.length ? pathParts[orgIndex + 2] : null;
    const teamIdIndex = pathParts.indexOf('teams') + 2;
    const teamId = pathParts[teamIdIndex];
    const seasonSlug = pathParts[pathParts.indexOf('teams') - 1];
    const seasonName = seasonSlug ? seasonSlug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : 'Current Season';

    if (!tenantSlug || !teamId) {
      return NextResponse.json({ error: 'Could not extract tenant or team ID from URL' }, { status: 400 });
    }

    const tenant = TENANT_MAP[tenantSlug] || tenantSlug; // Fallback to slug if not mapped

    // Fetch team fixtures from PlayHQ
    const response = await fetch("https://api.playhq.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "tenant": tenant,
        "Origin": "https://www.playhq.com"
      },
      body: JSON.stringify({
        query: TEAM_FIXTURE_QUERY,
        variables: { teamID: teamId }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('PlayHQ API error:', response.status, errorText);
      return NextResponse.json({ error: 'Failed to fetch data from PlayHQ API', details: errorText }, { status: 500 });
    }

    const data = await response.json();
    if (data.errors) {
      console.error('PlayHQ GraphQL errors:', data.errors);
      return NextResponse.json({ error: 'PlayHQ returned an error', details: data.errors }, { status: 400 });
    }

    const rounds = data?.data?.discoverTeamFixture;
    if (!rounds || !Array.isArray(rounds)) {
      return NextResponse.json({ error: 'Team not found or has no fixture data' }, { status: 404 });
    }

    const allGames = rounds.flatMap((round: any) => round.fixture?.games || []);
    
    let clubName = 'Unknown Team';
    let logoUrl = null;

    for (const game of allGames) {
      if (game.home?.id === teamId) {
        clubName = game.home.name;
        if (game.home.logo?.sizes?.[0]?.url) logoUrl = game.home.logo.sizes[0].url;
      }
      if (game.away?.id === teamId) {
        clubName = game.away.name;
        if (game.away.logo?.sizes?.[0]?.url) logoUrl = game.away.logo.sizes[0].url;
      }
    }

    const fixtures = allGames.map((game: any) => {
      const isHome = game.home?.id === teamId;
      const opponent = isHome ? game.away?.name : game.home?.name;
      const opponentLogo = (isHome ? game.away?.logo?.sizes?.[0]?.url : game.home?.logo?.sizes?.[0]?.url) || null;

      const venueName = game.allocation?.court?.venue?.name || '';
      const courtName = game.allocation?.court?.name || '';
      const location = [venueName, courtName].filter(Boolean).join(', ');

      return {
        opponent: opponent || 'Unknown Opponent',
        opponent_logo_url: opponentLogo,
        match_date: game.date || null,
        start_time: game.allocation?.time || null,
        location: location || null
      };
    }) || [];

    const validDates = fixtures
      .map((f: any) => f.match_date)
      .filter(Boolean)
      .map((d: string) => new Date(d).getTime())
      .filter((t: number) => !isNaN(t));

    let seasonStart = null;
    let seasonEnd = null;

    if (validDates.length > 0) {
      seasonStart = new Date(Math.min(...validDates)).toISOString().split('T')[0];
      seasonEnd = new Date(Math.max(...validDates)).toISOString().split('T')[0];
    }

    let orgDetails = null;
    if (orgId) {
      try {
        const orgRes = await fetch("https://api.playhq.com/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "tenant": tenant,
            "Origin": "https://www.playhq.com"
          },
          body: JSON.stringify({
            query: ORG_DETAILS_QUERY,
            variables: { code: orgId }
          })
        });
        if (orgRes.ok) {
          const orgData = await orgRes.json();
          const org = orgData?.data?.discoverOrganisation;
          if (org) {
            const addressParts = [org.address?.suburb, org.address?.state, org.address?.postcode].filter(Boolean);
            const addressStr = addressParts.length > 0 ? addressParts.join(', ') : null;

            orgDetails = {
              email: org.email || null,
              website: org.websiteUrl || null,
              address: addressStr
            };
          }
        }
      } catch (e) {
        console.error("Failed to fetch org details:", e);
      }
    }

    return NextResponse.json({
      clubName,
      logoUrl,
      seasonName,
      seasonStart,
      seasonEnd,
      fixtures,
      orgDetails
    });

  } catch (error: any) {
    console.error('PlayHQ sync error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
