const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const email = 'ashleygpitt+suna3@gmail.com';
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email === email);

  console.log('Testing club insert...');
  const { data, error } = await supabase.from('clubs').insert([{
    name: 'Test Club',
    owner_id: user.id,
    slug: 'test-club-slug-' + Math.random(),
    is_club: false,
    club_cat: 'PlayHQ',
    entity_type: 'Team',
    sport_type: 'Other',
    logo_url: null
  }]).select().single();

  console.log('Result:', data, error);
  if (data) {
     await supabase.from('clubs').delete().eq('id', data.id);
  }
}
run();
