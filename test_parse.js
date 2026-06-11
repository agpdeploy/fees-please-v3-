const url = 'https://www.playhq.com/cricket-australia/org/ferny-districts-cricket-club/462e4428/senior-competition-winter-2026/teams/ferny-districts-sun-a3n/ddf73203';
const { URL } = require('url');
const parsed = new URL(url);
const pathParts = parsed.pathname.split('/').filter(Boolean);
const teamIdIndex = pathParts.indexOf('teams') + 2;
const teamId = pathParts[teamIdIndex];
const tenant = pathParts[0];
const orgIdIndex = pathParts.indexOf('org') + 2;
const orgId = pathParts[orgIdIndex];
const seasonSlug = pathParts[pathParts.indexOf('teams') - 1];

console.log({ teamId, tenant, orgId, seasonSlug });
