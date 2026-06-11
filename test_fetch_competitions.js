const query = `
query discoverCompetitions($organisationID: ID!) {
  discoverCompetitions(organisationID: $organisationID) {
    id
    name
    seasons(organisationID: $organisationID) {
      id
      name
      startDate
      endDate
      status {
        name
        value
      }
    }
    organisation {
      id
      name
    }
  }
}
`;

async function run() {
  try {
    const res = await fetch("https://api.playhq.com/graphql", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'tenant': 'ca',
        'Origin': 'https://www.playhq.com'
      },
      body: JSON.stringify({
        query,
        variables: { organisationID: '462e4428' }
      })
    });

    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}
run();
