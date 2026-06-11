const teamId = "b7cf852d"; // from: https://www.playhq.com/cricket-australia/org/ferny-districts-cricket-club/462e4428/senior-competition-winter-2026/teams/ferny-districts-sunday-c-grade/b7cf852d
const tenantSlug = "cricket-australia"; // we can also try "ca"

const query = `
query discoverTeam($teamID: ID!) {
  discoverTeam(teamID: $teamID) {
    id
    name
    logo {
      sizes {
        url
        dimensions {
          width
          height
        }
      }
    }
    organisation {
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
`;

async function testQuery(tenantHeader) {
  try {
    console.log(`Testing query with x-phq-tenant: "${tenantHeader}"`);
    const res = await fetch("https://spectator.playhq.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-phq-tenant": tenantHeader,
        "Origin": "https://www.playhq.com"
      },
      body: JSON.stringify({
        query: query,
        variables: { teamID: teamId }
      })
    });
    console.log("Status:", res.status);
    const json = await res.json();
    console.log("Response JSON:", JSON.stringify(json, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

async function run() {
  await testQuery(tenantSlug);
  console.log("\n-------------------\n");
  await testQuery("ca");
}

run();
