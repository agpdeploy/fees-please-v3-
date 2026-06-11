const url = 'https://www.playhq.com/cricket-australia/org/ferny-districts-cricket-club/462e4428/senior-competition-winter-2026/teams/ferny-districts-sun-a3n/ddf73203';
const { URL } = require('url');

const TENANT_MAP = {
  'cricket-australia': 'cricket-australia',
  'afl': 'afl',
  'netball-australia': 'netball-australia',
  'basketball-victoria': 'basketball-victoria'
};

const urlObj = new URL(url);
const pathParts = urlObj.pathname.split('/').filter(Boolean);

const tenantSlug = pathParts[0];
const teamIdIndex = pathParts.indexOf('teams') + 2;
const teamId = pathParts[teamIdIndex];
const seasonSlug = pathParts[pathParts.indexOf('teams') - 1];

const tenant = TENANT_MAP[tenantSlug] || tenantSlug;

console.log("tenant:", tenant);
console.log("teamId:", teamId);
console.log("seasonSlug:", seasonSlug);

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

async function run() {
  const payload = {
    query: TEAM_FIXTURE_QUERY,
    variables: { teamID: teamId }
  };

  try {
    const res = await fetch("https://api.playhq.com/graphql", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'tenant': tenant,
        'Origin': 'https://www.playhq.com'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    
    if (data.errors) {
       console.log("ERRORS:", data.errors);
       return;
    }
    
    const rounds = data?.data?.discoverTeamFixture;
    if (!rounds || !Array.isArray(rounds)) {
      console.log("No rounds found!");
      return;
    }
    
    const allGames = rounds.flatMap((round) => round.fixture?.games || []);
    console.log("Found games:", allGames.length);
  } catch (e) {
    console.error(e);
  }
}
run();
