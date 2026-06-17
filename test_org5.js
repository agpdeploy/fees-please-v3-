const QUERY = `
query getOrg($code: String!) {
  discoverOrganisation(code: $code) {
    id
    name
    email
    websiteUrl
    contacts {
      email
      phone
    }
    address {
      address1
      address2
      suburb
      state
      postcode
      country
    }
  }
}
`;
fetch('https://api.playhq.com/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'tenant': 'ca',
    'Origin': 'https://www.playhq.com'
  },
  body: JSON.stringify({
    query: QUERY,
    variables: { code: "462e4428" }
  })
}).then(r => r.json()).then(d => {
  console.log("Result:");
  console.dir(d, {depth: null});
}).catch(console.error);
