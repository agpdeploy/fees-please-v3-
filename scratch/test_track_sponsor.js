const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testTrack() {
  const { error } = await supabaseAdmin.from('sponsor_analytics').insert({
      team_id: '6e1400f6-b390-4297-bcd5-d3328529f775',
      sponsor_id: '36646a92-90bb-417e-835b-b701411473a4', // The UUID from staging just to test
      event_type: 'impression',
      source: 'hub'
  });
  console.log("Error:", error);
}

testTrack();
