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
  const { data: clubData } = await supabase.from('clubs').insert([{
    name: 'Test Club',
    owner_id: user.id,
    slug: 'test-club-slug-' + Math.random(),
    is_club: false,
    club_cat: 'PlayHQ',
    entity_type: 'Team',
    sport_type: 'Other'
  }]).select().single();

  const { data: teamData } = await supabase.from('teams').insert([{
    name: 'Test Team',
    club_id: clubData.id,
    owner_id: user.id,
    slug: 'test-team-slug-' + Math.random()
  }]).select().single();

  console.log('Testing user_roles insert...');
  const { data: roleData, error: rolesError } = await supabase.from('user_roles').insert([
    { user_id: user.id, email: user.email, club_id: clubData.id, role: 'club_admin' },
    { user_id: user.id, email: user.email, club_id: clubData.id, team_id: teamData.id, role: 'team_admin' }
  ]).select();

  console.log('Roles Result:', roleData, rolesError);

  if (clubData) {
     await supabase.from('clubs').delete().eq('id', clubData.id);
  }
}
run();
