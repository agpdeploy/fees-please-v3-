const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPolicies() {
  const { data, error } = await supabaseAdmin.rpc('get_policies_for_table', { table_name: 'sponsor_analytics' });
  if (error) {
     // fallback if RPC doesn't exist
     const { data: policies } = await supabaseAdmin.from('pg_policies').select('*').eq('tablename', 'sponsor_analytics');
     console.log(policies);
  } else {
     console.log(data);
  }
}

checkPolicies();
