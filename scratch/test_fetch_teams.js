const fetch = require('node-fetch');

const queries = [
  `query { discoverTeams(seasonID: "5eb3dc88") { id name } }`,
  `query { season(id: "5eb3dc88") { id name grades { teams { id name } } } }`,
  `query { season(id: "5eb3dc88") { id name teams { id name } } }`,
  `query { discoverSeason(id: "5eb3dc88") { id name teams { id name } } }`,
  `query { discoverSeason(id: "5eb3dc88") { id name grades { teams { id name } } } }`,
];

async function run() {
  for (let i = 0; i < queries.length; i++) {
    console.log("Trying query", i+1);
    try {
      const res = await fetch("https://api.playhq.com/graphql", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'tenant': 'ca',
          'Origin': 'https://www.playhq.com'
        },
        body: JSON.stringify({
          query: queries[i]
        })
      });
      const data = await res.json();
      if (data.errors) {
        console.log("Error:", data.errors[0].message);
      } else {
        console.log("SUCCESS:", JSON.stringify(data, null, 2));
      }
    } catch (e) {
      console.log("Fetch error:", e.message);
    }
    console.log("---");
  }
}
run();
