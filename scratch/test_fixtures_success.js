const teamId = "b7cf852d"; 

const query = `
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
  try {
    const res = await fetch("https://api.playhq.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "tenant": "ca",
        "Origin": "https://www.playhq.com"
      },
      body: JSON.stringify({
        query: query,
        variables: { teamID: teamId }
      })
    });
    console.log("Status:", res.status);
    const json = await res.json();
    console.log("Response:", JSON.stringify(json, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
