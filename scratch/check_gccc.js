const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkGCCC() {
  const { data: sponsors } = await supabaseAdmin.from('team_sponsors').select('*').ilike('name', '%gccc%');
  if (sponsors.length === 0) {
      console.log("No sponsor found matching GCCC");
      return;
  }
  const teamIds = sponsors.map(s => s.team_id);
  const { data: teams } = await supabaseAdmin.from('teams').select('id, name, club_id').in('id', teamIds);
  console.log("Teams using GCCC:");
  console.log(teams);
  
  const clubIds = [...new Set(teams.map(t => t.club_id))];
  const { data: clubs } = await supabaseAdmin.from('clubs').select('id, name').in('id', clubIds);
  console.log("Clubs using GCCC:");
  console.log(clubs);

  const { data: analytics } = await supabaseAdmin.from('sponsor_analytics').select('*').in('team_id', teamIds);
  console.log(`Analytics count for GCCC teams: ${analytics.length}`);
}

checkGCCC();
