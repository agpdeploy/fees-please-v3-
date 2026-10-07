const TEAM_FIXTURE_QUERY = `
query teamFixture($teamID: ID!) {
  discoverTeamFixture(teamID: $teamID) {
    fixture {
      games {
        date
        home {
          ... on ProvisionalTeam { name }
          ... on DiscoverTeam { id name }
        }
        away {
          ... on ProvisionalTeam { name }
          ... on DiscoverTeam { id name }
        }
      }
    }
  }
}
`;

async function run() {
  const teamId = '9bc7a3b3';
  const tenant = 'ca';

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
  
  const data = await response.json();
  const games = data.data.discoverTeamFixture.flatMap(r => r.fixture?.games || []);
  console.log("Total games:", games.length);
  games.forEach(g => {
     console.log(g.date, "vs", g.home?.id === teamId ? g.away?.name : g.home?.name);
  });
}
run();
