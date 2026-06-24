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
  const { data, error } = await supabase.rpc('get_policies', { table_name: 'transactions' }).catch(() => ({}));
  if (data) {
    console.log("Policies via RPC:", data);
  } else {
    // If no RPC, let's query pg_policies
    const { data: policies, error: err2 } = await supabase.from('pg_policies').select('*').eq('tablename', 'transactions').catch(() => ({}));
    console.log("Policies:", policies || "No access to pg_policies");
  }
}

check();
