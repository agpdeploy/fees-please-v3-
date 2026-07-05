const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAnalytics() {
  console.log("Fetching clubs...");
  const { data: clubs } = await supabaseAdmin.from('clubs').select('id, name');
  const targetClub = clubs.find(c => c.name.toLowerCase().includes("bowl movements") || c.name.toLowerCase().includes("bowl"));
  
  if (!targetClub) {
     console.log("Could not find club with name 'bowl movements'. Here are the clubs:");
     console.log(clubs.map(c => c.name));
     return;
  }
  
  console.log("Found club:", targetClub.name);

  const { data: teams } = await supabaseAdmin.from('teams').select('id, name').eq('club_id', targetClub.id);
  const teamIds = teams.map(t => t.id);
  console.log(`Found ${teams.length} teams for this club.`);

  const { data: analytics } = await supabaseAdmin.from('sponsor_analytics').select('*').in('team_id', teamIds);
  console.log(`Total analytics records for this club: ${analytics.length}`);
  
  if (analytics.length > 0) {
      console.log("Sample analytics records:", analytics.slice(0, 3));
  }
}

checkAnalytics();
