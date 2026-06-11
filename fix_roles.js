const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const email = 'ashleygpitt+suna3@gmail.com';
  console.log('Checking for user:', email);
  
  const { data: users, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) { console.error(authErr); return; }
  const user = users.users.find(u => u.email === email);
  if (!user) { console.log('User not found in auth.users'); return; }

  const { data: clubs, error: cErr } = await supabase.from('clubs').select('*').eq('owner_id', user.id);
  console.log('Clubs owned by user:', clubs.map(c => ({ id: c.id, name: c.name })));
  
  const { data: roles, error: rErr } = await supabase.from('user_roles').select('*').eq('user_id', user.id);
  console.log('Roles for user:', roles);

  if (clubs.length > 0 && roles.length === 0) {
    console.log('User has clubs but no roles. Fixing...');
    const club = clubs[0];
    const { data: teams } = await supabase.from('teams').select('id').eq('club_id', club.id).limit(1);
    
    if (teams && teams.length > 0) {
      const { data: newRoles, error: nrErr } = await supabase.from('user_roles').insert([
        { user_id: user.id, email: user.email, club_id: club.id, role: 'club_admin' },
        { user_id: user.id, email: user.email, club_id: club.id, team_id: teams[0].id, role: 'team_admin' }
      ]).select();
      console.log('Inserted roles:', newRoles, nrErr);
    } else {
       console.log('No teams found for club, cannot insert team_admin role');
    }
  }
}
run();
