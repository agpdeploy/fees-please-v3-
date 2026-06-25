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
  const { data: clubs } = await supabase.from('clubs').select('id, name').ilike('name', '%Bronco%');
  console.log("All Broncos clubs:", clubs);
  for (const c of clubs) {
    const { data: players } = await supabase.from('players').select('id, first_name, email, user_id').eq('club_id', c.id);
    console.log(`Players in ${c.name}:`, players);
  }
}

check();
