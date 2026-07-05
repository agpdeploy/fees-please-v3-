const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkNulls() {
  const { data, error } = await supabaseAdmin
    .from('sponsor_analytics')
    .select('id, team_id, sponsor_index')
    .is('sponsor_id', null)
    .not('sponsor_index', 'is', null);

  if (error) console.error(error);
  else console.log(`Found ${data.length} records STILL missing sponsor_id!`);
}

checkNulls();
