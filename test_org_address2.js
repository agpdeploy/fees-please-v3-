async function run() {
  const QUERY = `
    query getOrg($code: String!) {
      discoverOrganisation(code: $code) {
        address {
          street
          suburb
          state
          postcode
          country
        }
      }
    }
  `;
  const r = await fetch('https://api.playhq.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'tenant': 'ca', 'Origin': 'https://www.playhq.com' },
    body: JSON.stringify({ query: QUERY, variables: { code: "462e4428" } })
  });
  const text = await r.text();
  console.log(text);
}
run();
