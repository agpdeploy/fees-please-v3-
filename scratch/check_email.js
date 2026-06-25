const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split('\n').forEach(line => {
  if (line.trim().startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '');
  if (line.trim().startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) key = line.split('=')[1].replace(/"/g, '');
});

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('profiles').select('*').ilike('email', 'ashleygpitt%');
  console.log("Profiles matching ashleygpitt:", data);
  if (error) console.error(error);
}

check();
