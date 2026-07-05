const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkNullTeamId() {
  const { data: analytics, error } = await supabaseAdmin.from('sponsor_analytics').select('id, team_id, club_id, sponsor_index, sponsor_id').is('team_id', null);
  console.log(`Found ${analytics ? analytics.length : 0} records with null team_id`);
  if (analytics && analytics.length > 0) {
      console.log(analytics.slice(0, 3));
  }
}

checkNullTeamId();
