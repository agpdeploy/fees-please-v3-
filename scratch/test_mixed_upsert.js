const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testUpsert() {
  const upserts = [
    { id: '11111111-1111-1111-1111-111111111111', team_id: '6e1400f6-b390-4297-bcd5-d3328529f775', name: 'Test 1' },
    { team_id: '6e1400f6-b390-4297-bcd5-d3328529f775', name: 'Test 2' } // No ID
  ];

  const { error } = await supabaseAdmin.from('team_sponsors').upsert(upserts);
  console.log("Error:", error);
}

testUpsert();
