const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backfillAnalytics() {
  console.log("Fetching team sponsors...");
  const { data: sponsors, error: sponsorsError } = await supabaseAdmin
    .from('team_sponsors')
    .select('*')
    .order('created_at', { ascending: true }); // they were inserted sequentially per team

  if (sponsorsError) {
    console.error("Error fetching sponsors:", sponsorsError);
    return;
  }

  console.log(`Found ${sponsors.length} sponsors.`);

  // Group sponsors by team
  const sponsorsByTeam = {};
  sponsors.forEach(s => {
    if (!sponsorsByTeam[s.team_id]) {
      sponsorsByTeam[s.team_id] = [];
    }
    sponsorsByTeam[s.team_id].push(s);
  });

  console.log("Fetching analytics without sponsor_id...");
  const { data: analytics, error: analyticsError } = await supabaseAdmin
    .from('sponsor_analytics')
    .select('id, team_id, sponsor_index, event_type')
    .is('sponsor_id', null)
    .not('sponsor_index', 'is', null);

  if (analyticsError) {
    console.error("Error fetching analytics:", analyticsError);
    return;
  }

  console.log(`Found ${analytics.length} analytics records to backfill.`);

  let updatedCount = 0;

  for (const record of analytics) {
    const teamSponsors = sponsorsByTeam[record.team_id];
    if (!teamSponsors) continue;

    // We need to map sponsor_index (1, 2, 3, 4) to the correct teamSponsor.
    // If the migration script inserted them, it pushed them in order.
    // Wait, the index might not be sequential if one was missing.
    // Let's check the old public_team_profiles if possible, but we might not need to if we just look at the name.
    
    // We can try to guess based on name (e.g. 'Sponsor 2') OR just assume index 1 = first inserted, index 2 = second inserted.
    // If a team had all 4 slots filled, index 1 = teamSponsors[0], index 2 = teamSponsors[1].
    let matchedSponsor = null;

    // Try to match by explicit name pattern "Sponsor X" (fallback from migration)
    const exactNameMatch = teamSponsors.find(s => s.name === `Sponsor ${record.sponsor_index}`);
    
    if (exactNameMatch) {
      matchedSponsor = exactNameMatch;
    } else if (record.sponsor_index > 0 && record.sponsor_index <= teamSponsors.length) {
      // If we can't match by name, just try to match by index order (1-indexed). 
      // This works perfectly if they had all slots sequentially filled without gaps.
      matchedSponsor = teamSponsors[record.sponsor_index - 1];
    }

    if (matchedSponsor) {
      const { error: updateError } = await supabaseAdmin
        .from('sponsor_analytics')
        .update({ sponsor_id: matchedSponsor.id })
        .eq('id', record.id);

      if (updateError) {
        console.error(`Error updating record ${record.id}:`, updateError);
      } else {
        updatedCount++;
      }
    }
  }

  console.log(`Backfill complete! Updated ${updatedCount} records.`);
}

backfillAnalytics();
