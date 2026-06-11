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

const urls = [
  "https://api.playhq.com/graphql",
  "https://spectator.playhq.com/graphql"
];

const tenants = [
  "cricket-australia",
  "ca"
];

async function run() {
  for (const url of urls) {
    for (const t of tenants) {
      try {
        console.log(`Testing ${url} with header 'tenant': "${t}"`);
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "tenant": t,
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
      console.log("\n-------------------\n");
    }
  }
}

run();
