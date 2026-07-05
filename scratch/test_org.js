const tenant = 'ca';
const orgId = '462e4428';

const ORG_DETAILS_QUERY = `
query getOrg($code: String!) {
  discoverOrganisation(code: $code) {
    name
    email
    websiteUrl
    address {
      suburb
      state
      postcode
    }
  }
}
`;

async function run() {
  try {
    const orgRes = await fetch("https://api.playhq.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "tenant": tenant,
        "Origin": "https://www.playhq.com"
      },
      body: JSON.stringify({
        query: ORG_DETAILS_QUERY,
        variables: { code: orgId }
      })
    });
    console.log("Status:", orgRes.status);
    const orgData = await orgRes.json();
    console.log("Data:", JSON.stringify(orgData, null, 2));
  } catch (e) {
    console.error("Failed:", e);
  }
}
run();
