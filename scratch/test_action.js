const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/['"\r]/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/['"\r]/g, '').trim();
});

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('referral_code', '7eafd65e')
    .single();
  
  console.log("DATA:", data);
  console.log("ERROR:", error);
}
run();
