const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split('\n').forEach(line => {
  if (line.trim().startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/['"]/g, '').trim();
  if (line.trim().startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/['"]/g, '').trim();
});

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('user_roles').select('*').limit(1);
  if (error) {
    console.error(error);
  } else {
    console.log("columns:", Object.keys(data[0]));
    console.log("sample record:", data[0]);
  }
}
run();
