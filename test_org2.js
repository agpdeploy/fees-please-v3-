const QUERY = `
query Introspection {
  __type(name: "DiscoverOrganisation") {
    name
    fields {
      name
      type {
        name
        kind
        ofType {
          name
        }
      }
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
    query: QUERY
  })
}).then(r => r.json()).then(d => console.dir(d, {depth: null})).catch(console.error);
