const queries = [
  "address { street suburb state postcode country }",
  "address { line1 suburb state postcode country }",
  "address { physical { line1 } }",
  "locations { address { street } }"
];

async function run() {
  for (let q of queries) {
    console.log("Trying:", q);
    const QUERY = `
      query getOrg($code: String!) {
        discoverOrganisation(code: $code) {
          ${q}
        }
      }
    `;
    const r = await fetch('https://api.playhq.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'tenant': 'ca' },
      body: JSON.stringify({ query: QUERY, variables: { code: "462e4428" } })
    });
    const d = await r.json();
    if (!d.errors) {
      console.dir(d, {depth: null});
      break;
    } else {
      console.log(d.errors[0].message);
    }
  }
}
run();
