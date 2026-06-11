const fetch = require('node-fetch');

async function testTeamQuery() {
  const tenant = 'ca'; // cricket-australia
  const orgID = '462e4428-1549-410a-b31c-b2586a11e1ee'; // ferny districts (maybe) wait, let's use the season id.
  
  // We need to know what queries are available for season/teams.
  // PlayHQ website URL structure: /org/[org]/[orgID]/[competitionSlug]/[seasonID]/teams
  // Wait, the season ID is usually a uuid. Let's see if we can query teams inside a season.
  const query = `
    query discoverTeams($organisationID: ID!) {
      discoverCompetitions(organisationID: $organisationID) {
        id
        seasons(organisationID: $organisationID) {
          id
          name
          grades {
            id
            name
            teams {
              id
              name
            }
          }
        }
      }
    }
  `;

  // Let's just introspection query to find how to get teams.
  const introspectionQuery = `
    query IntrospectionQuery {
      __schema {
        types {
          name
          fields {
            name
            args {
              name
            }
          }
        }
      }
    }
  `;

  const response = await fetch("https://api.playhq.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "tenant": tenant,
      "Origin": "https://www.playhq.com"
    },
    body: JSON.stringify({
      query: introspectionQuery
    })
  });

  const json = await response.json();
  // Filter types to find something related to Season or Team
  if (json.data && json.data.__schema) {
    const types = json.data.__schema.types;
    const seasonType = types.find(t => t.name === 'Season');
    if (seasonType) console.log("Season fields:", seasonType.fields.map(f => f.name));
    
    const discoverTeamsType = types.find(t => t.name === 'Query' || t.name === 'RootQuery').fields.find(f => f.name.toLowerCase().includes('team'));
    console.log("Query fields with team:", discoverTeamsType);
  } else {
    console.log(json);
  }
}

testTeamQuery();
