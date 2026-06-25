const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split('\n').forEach(line => {
  if (line.trim().startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '');
  if (line.trim().startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '');
});

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('transactions').select('*').limit(1);
  console.log("Tx Data:", data);

  // Directly ask postgres for RLS on transactions
  const { data: pol, error: e } = await supabase.rpc('execute_sql', {
    sql_query: "SELECT polname, polcmd, polqual, polwithcheck FROM pg_policy WHERE polrelid = 'public.transactions'::regclass;"
  }).catch(() => ({}));
  
  console.log("Policies:", pol);
}

check();
