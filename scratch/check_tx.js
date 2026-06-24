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
  const email = 'ashleygpitt+p1@gmail.com';
  // Get Broncos club ID
  const { data: clubs } = await supabase.from('clubs').select('id, name').ilike('name', '%Bronco%');
  const clubId = clubs[0].id;
  console.log("Club:", clubs[0].name, clubId);

  // Get Profile
  const { data: profile } = await supabase.from('profiles').select('id, email').eq('email', email).maybeSingle();
  console.log("Profile:", profile);

  // Get Players
  let query = supabase.from('players').select('id, email, user_id').eq('club_id', clubId);
  query = query.or(`email.eq.${profile.email},user_id.eq.${profile.id}`);
  const { data: players } = await query;
  console.log("Players:", players);

  if (players && players.length > 0) {
    const playerIds = players.map(p => p.id);
    const { data: txs } = await supabase.from('transactions').select('id, amount').in('player_id', playerIds).eq('club_id', clubId);
    console.log("Transactions for these players:", txs);
  } else {
    // See if players exist for Broncos anyway
    const { data: allPlayers } = await supabase.from('players').select('id, email, first_name, user_id').eq('club_id', clubId).ilike('email', '%ashleygpitt%');
    console.log("All players matching email in club:", allPlayers);
  }
}

check();
