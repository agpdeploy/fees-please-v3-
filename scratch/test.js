const fetch = require('node-fetch');
async function run() {
  const tenant = 'ca';
  const orgId = '462e4428';
  const ORG_DETAILS_QUERY = `
  query getOrg($code: String!) {
    discoverOrganisation(code: $code) {
      name
      email
      websiteUrl
    }
  }`;
  
  const response = await fetch('https://api.playhq.com/graphql', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'tenant': tenant, 
      'Origin': 'https://www.playhq.com',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    body: JSON.stringify({ query: ORG_DETAILS_QUERY, variables: { code: orgId } })
  });
  const text = await response.text();
  console.log(text.substring(0, 500));
}
run();
