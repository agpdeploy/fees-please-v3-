const teamId = "b7cf852d"; 
const query = `
query discoverTeam($teamID: ID!) {
  discoverTeam(teamID: $teamID) {
    id
    name
  }
}
`;

const endpoints = [
  "https://spectator.playhq.com/graphql",
  "https://api.playhq.com/graphql",
  "https://search.playhq.com/graphql"
];

async function testEndpoint(url, tenantHeader) {
  try {
    console.log(`Testing ${url} with x-phq-tenant: "${tenantHeader}"`);
    const res = await fetch(url, {
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
    const text = await res.text();
    console.log("Response text:", text.substring(0, 1000));
  } catch (err) {
    console.error("Error for " + url + ":", err);
  }
}

async function run() {
  for (const url of endpoints) {
    await testEndpoint(url, "ca");
    console.log("\n-------------------\n");
  }
}

run();
