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
  const clubId = '147db7ed-a73b-44ed-b83b-3dc4bf032ac3';
  const playerId = '72de8f99-8ad8-411f-b497-6d9bdc8deb13';
  
  const { data: txs, error } = await supabase.from('transactions').select('*').eq('player_id', playerId).eq('club_id', clubId);
  console.log("Transactions:", txs);
  if (error) console.error(error);
}

check();
