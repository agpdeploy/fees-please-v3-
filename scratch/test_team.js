const fetch = require('node-fetch');

const COMBINED_QUERY = `
query teamFixture($teamID: ID!) {
  discoverTeam(teamID: $teamID) {
    id
    name
    logo {
      sizes {
        url
      }
    }
  }
  discoverTeamFixture(teamID: $teamID) {
    id
    name
    fixture {
      games {
        id
      }
    }
  }
}
`;

async function test() {
  const teamId = '4eb82ae8';
  const tenant = 'ca';
  
  const response = await fetch("https://api.playhq.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "tenant": tenant,
      "Origin": "https://www.playhq.com",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    },
    body: JSON.stringify({
      query: COMBINED_QUERY,
      variables: { teamID: teamId }
    })
  });

  const text = await response.text();
  console.log(text);
}

test();
