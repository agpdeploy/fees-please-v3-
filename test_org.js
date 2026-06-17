const QUERY = `
query getOrg($id: ID!) {
  discoverOrganisation(id: $id) {
    id
    name
    email
    website
    contacts {
      name
      email
      phone
      role
    }
    location {
      name
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
    variables: { id: "462e4428" }
  })
}).then(r => r.json()).then(d => console.dir(d, {depth: null})).catch(console.error);
