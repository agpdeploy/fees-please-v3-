const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSponsors() {
  const { data: clubs } = await supabaseAdmin.from('clubs').select('id, name');
  const targetClub = clubs.find(c => c.name.toLowerCase().includes("bowl movements"));
  
  const { data: teams } = await supabaseAdmin.from('teams').select('id, name').eq('club_id', targetClub.id);
  const teamIds = teams.map(t => t.id);

  const { data: sponsors } = await supabaseAdmin.from('team_sponsors').select('*').in('team_id', teamIds);
  console.log("Team Sponsors:");
  console.log(sponsors.map(s => ({ id: s.id, name: s.name, team: s.team_id })));

  const { data: analytics } = await supabaseAdmin.from('sponsor_analytics').select('*').in('team_id', teamIds);
  console.log(`\nAnalytics count: ${analytics.length}`);
  
  // Simulate the Setup.tsx logic exactly
  const sponsorNameMap = {};
  sponsors.forEach(s => {
    if (s.name) sponsorNameMap[s.id] = s.name;
  });

  console.log("Sponsor Name Map:");
  console.log(sponsorNameMap);

  let details = {};
  analytics.forEach(s => {
     let sKey = s.sponsor_id ? (sponsorNameMap[s.sponsor_id] || s.sponsor_id) : s.sponsor_index?.toString();
     if (!sKey) return;
     if (!details[sKey]) details[sKey] = { imp: 0, clk: 0 };
     
     if (s.event_type === 'impression') details[sKey].imp++;
     if (s.event_type === 'click') details[sKey].clk++;
  });

  console.log("\nSimulated Details Object:");
  console.log(details);
}

checkSponsors();
