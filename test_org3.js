const QUERY = `
query getOrg($code: String!) {
  discoverOrganisation(code: $code) {
    id
    name
    about
    email
    websiteUrl
    contacts {
      email
      phone
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
  console.log("With ID:");
  console.dir(d, {depth: null});
  
  return fetch('https://api.playhq.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'tenant': 'ca',
      'Origin': 'https://www.playhq.com'
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { code: "ferny-districts-cricket-club" }
    })
  });
}).then(r => r.json()).then(d => {
  console.log("\nWith Slug:");
  console.dir(d, {depth: null});
}).catch(console.error);
