const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim().replace(/['"]/g, '');
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim().replace(/['"]/g, '');
});
const supabase = createClient(url, key);

async function run() {
  const teamId = "6e1400f6-b390-4297-bcd5-d3328529f775";
  const { data: players, error } = await supabase
    .from('players')
    .select('id, first_name, nickname, email, unsubscribed')
    .eq('default_team_id', teamId)
    .not('email', 'is', null);

  if (error) {
    console.error(error);
    return;
  }
  
  console.log("Found players:", players.length);
  
  const tony = players.find(p => p.email === 'cervo07@gmail.com');
  console.log("Is Tony in the query results?", !!tony);
  if (tony) console.log(tony);
}
run();
