const dotenv = require('dotenv');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TENANT_MAP = {
  'cricket-australia': 'ca',
  'afl': 'afl',
  'netball': 'netball',
  'basketball-victoria': 'bv',
  'basketball-nsw': 'bnsw',
  'basketball-qld': 'bq',
  'basketball-sa': 'bsa',
  'basketball-tas': 'bt',
  'basketball-wa': 'bwa',
  'basketball-act': 'bact',
  'basketball-nt': 'bnt'
};

const DISCOVER_COMPETITIONS_QUERY = `
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
  }
}
`;

function getSeasonSlug(competitionName, seasonName) {
  const combined = `${competitionName} ${seasonName}`;
  return combined
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

async function run() {
  try {
    // Get all PlayHQ clubs
    const { data: clubs, error: clubsError } = await supabase
      .from('clubs')
      .select('id, name, settings, club_cat')
      .eq('club_cat', 'PlayHQ');

    if (clubsError) throw clubsError;

    console.log(`Found ${clubs.length} PlayHQ clubs to process.`);

    for (const club of clubs) {
      console.log(`\nProcessing club: ${club.name} (${club.id})`);
      const settings = club.settings || {};
      const playhqOrgId = settings.playhq_org_id;
      const playhqTenant = settings.playhq_tenant || 'ca';
      const ignoredCompetitions = settings.ignored_playhq_competition_ids || [];
      const notifiedSeasonIds = settings.notified_playhq_season_ids || [];

      console.log(`- Org ID: ${playhqOrgId}`);
      console.log(`- Tenant: ${playhqTenant}`);
      console.log(`- Ignored Competitions:`, ignoredCompetitions);
      console.log(`- Notified Seasons:`, notifiedSeasonIds);

      if (!playhqOrgId) {
        console.log(`- Skipping (No PlayHQ Org ID)`);
        continue;
      }

      const tenant = TENANT_MAP[playhqTenant] || playhqTenant;
      const response = await fetch("https://api.playhq.com/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "tenant": tenant,
          "Origin": "https://www.playhq.com"
        },
        body: JSON.stringify({
          query: DISCOVER_COMPETITIONS_QUERY,
          variables: { organisationID: playhqOrgId }
        })
      });

      if (!response.ok) {
        console.error(`- Failed to fetch PlayHQ competitions: status ${response.status}`);
        continue;
      }

      const gqlResult = await response.json();
      if (gqlResult.errors) {
        console.error(`- GraphQL errors:`, gqlResult.errors);
        continue;
      }

      const competitions = gqlResult?.data?.discoverCompetitions || [];
      console.log(`- Found ${competitions.length} competitions in PlayHQ.`);

      const { data: teams } = await supabase
        .from('teams')
        .select('id, name, settings')
        .eq('club_id', club.id);

      const mappedSeasonSlugs = new Set();
      for (const team of teams || []) {
        const teamUrl = team.settings?.playhq_url;
        if (teamUrl) {
          try {
            const parsedUrl = new URL(teamUrl);
            const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
            const teamIndex = pathParts.indexOf('teams');
            if (teamIndex !== -1 && teamIndex > 0) {
              const seasonSlug = pathParts[teamIndex - 1];
              if (seasonSlug) mappedSeasonSlugs.add(seasonSlug.toLowerCase());
            }
          } catch (e) {}
        }
      }
      console.log(`- Mapped season slugs in Fees Please:`, Array.from(mappedSeasonSlugs));

      const clubUnmapped = [];
      for (const comp of competitions) {
        const isIgnored = ignoredCompetitions.includes(comp.id);
        console.log(`  * Competition: ${comp.name} (${comp.id}) ${isIgnored ? '[IGNORED]' : ''}`);
        if (isIgnored) continue;

        for (const season of comp.seasons || []) {
          const statusVal = season.status?.value;
          const expectedSlug = getSeasonSlug(comp.name, season.name);
          const isMapped = mappedSeasonSlugs.has(expectedSlug);
          console.log(`    - Season: ${season.name} (${season.id}) [status: ${statusVal}] [slug: ${expectedSlug}] [mapped: ${isMapped}]`);
          
          if (statusVal !== 'ACTIVE' && statusVal !== 'UPCOMING') continue;
          if (isMapped) continue;

          clubUnmapped.push({
            competitionId: comp.id,
            competitionName: comp.name,
            seasonId: season.id,
            seasonName: season.name,
            seasonSlug: expectedSlug
          });
        }
      }

      console.log(`- Unmapped seasons detected:`, clubUnmapped);
    }
  } catch (err) {
    console.error("Error running test:", err);
  }
}

run();
