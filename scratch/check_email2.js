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
  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers();
  const users = authData.users.filter(u => u.email.includes('ashleygpitt'));
  console.log("Auth Users:", users.map(u => u.email));

  const { data: players, error: playersErr } = await supabase.from('players').select('*').ilike('email', 'ashleygpitt%');
  console.log("Players:", players);
}

check();
