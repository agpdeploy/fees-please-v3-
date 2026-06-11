const teamId = "b7cf852d"; 
const query = `
query discoverTeam($teamID: ID!) {
  discoverTeam(teamID: $teamID) {
    id
    name
    logo {
      sizes {
        url
      }
    }
  }
}
`;

const tenants = [
  "cricket-australia",
  "ca",
  "cricketaustralia",
  "afl",
  "bv"
];

async function testHeader(headerName, headerVal) {
  try {
    console.log(`Testing with ${headerName}: "${headerVal}"`);
    const res = await fetch("https://api.playhq.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [headerName]: headerVal,
        "Origin": "https://www.playhq.com"
      },
      body: JSON.stringify({
        query: query,
        variables: { teamID: teamId }
      })
    });
    console.log("Status:", res.status);
    const json = await res.json();
    console.log("Response:", JSON.stringify(json));
  } catch (err) {
    console.error("Error:", err);
  }
}

async function run() {
  for (const t of tenants) {
    await testHeader("x-phq-tenant", t);
    await testHeader("x-tenant-slug", t);
    console.log("\n-------------------\n");
  }
}

run();
