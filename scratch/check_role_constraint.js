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
  // Let's check if there is an active check constraint or enum for "role" on user_roles
  const { data, error } = await supabase.rpc('get_roles_structure');
  if (error) {
    // If no RPC, let's try a dummy insert for a non-existent club
    const testId = '00000000-0000-0000-0000-000000000000';
    const { data: insertData, error: insertError } = await supabase
      .from('user_roles')
      .insert({
        email: 'test_dummy_player_role@feesplease.com',
        role: 'player',
        club_id: null
      })
      .select();
    
    if (insertError) {
      console.error("Insert failed:", insertError.message);
    } else {
      console.log("Insert succeeded!", insertData);
      // clean it up
      await supabase.from('user_roles').delete().eq('id', insertData[0].id);
    }
  } else {
    console.log(data);
  }
}
run();
