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
  const clubId = '3a75be05-1722-492b-8a26-f42c104c2d9f';
  const { data: axels } = await supabase.from('players').select('id, first_name, last_name, email, user_id').eq('club_id', clubId).ilike('first_name', '%Axel%');
  console.log("Axel players in Broncos:", axels);
}

check();
