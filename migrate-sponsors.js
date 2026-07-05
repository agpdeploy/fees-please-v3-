const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateSponsors() {
  console.log("Fetching team profiles...");
  const { data: profiles, error } = await supabaseAdmin
    .from('public_team_profiles')
    .select('*');

  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }

  console.log(`Found ${profiles.length} profiles. Migrating sponsors...`);
  
  let totalInserted = 0;

  for (const p of profiles) {
    const sponsorsToInsert = [];
    
    // Check sponsor 1
    if (p.sponsor_1_logo || p.sponsor_1_name || p.sponsor_1_url) {
      sponsorsToInsert.push({
        team_id: p.team_id,
        name: p.sponsor_1_name || 'Sponsor 1',
        logo_url: p.sponsor_1_logo,
        url: p.sponsor_1_url,
        is_active: true
      });
    }
    // Check sponsor 2
    if (p.sponsor_2_logo || p.sponsor_2_name || p.sponsor_2_url) {
      sponsorsToInsert.push({
        team_id: p.team_id,
        name: p.sponsor_2_name || 'Sponsor 2',
        logo_url: p.sponsor_2_logo,
        url: p.sponsor_2_url,
        is_active: true
      });
    }
    // Check sponsor 3
    if (p.sponsor_3_logo || p.sponsor_3_name || p.sponsor_3_url) {
      sponsorsToInsert.push({
        team_id: p.team_id,
        name: p.sponsor_3_name || 'Sponsor 3',
        logo_url: p.sponsor_3_logo,
        url: p.sponsor_3_url,
        is_active: true
      });
    }
    // Check sponsor 4
    if (p.sponsor_4_logo || p.sponsor_4_name || p.sponsor_4_url) {
      sponsorsToInsert.push({
        team_id: p.team_id,
        name: p.sponsor_4_name || 'Sponsor 4',
        logo_url: p.sponsor_4_logo,
        url: p.sponsor_4_url,
        is_active: true
      });
    }

    if (sponsorsToInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('team_sponsors')
        .insert(sponsorsToInsert);

      if (insertError) {
        console.error(`Error inserting sponsors for team ${p.team_id}:`, insertError);
      } else {
        totalInserted += sponsorsToInsert.length;
      }
    }
  }

  console.log(`Migration complete! Migrated ${totalInserted} sponsors.`);
}

migrateSponsors();
