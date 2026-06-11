const url = 'https://www.playhq.com/cricket-australia/org/ferny-districts-cricket-club/462e4428/senior-competition-winter-2026/teams/ferny-districts-sun-a3n/ddf73203';
const { URL } = require('url');
const parsed = new URL(url);
const pathParts = parsed.pathname.split('/').filter(Boolean);
const teamIdIndex = pathParts.indexOf('teams') + 2;
const teamId = pathParts[teamIdIndex];
const tenant = pathParts[0];

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
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}
run();
