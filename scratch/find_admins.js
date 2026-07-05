const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const clubId = 'eead69a9-d59b-45c6-8840-2fc9f3f59756';
  
  // 1. Get user roles for this club
  const { data: roles, error: rolesError } = await supabase
    .from('user_roles')
    .select('user_id, role')
    .eq('club_id', clubId);
    
  if (rolesError) {
    console.error('Error fetching roles:', rolesError);
    return;
  }
  
  console.log('Admins/Users for this club:', roles);
  
  // 2. Fetch user profiles or emails
  const { data: users } = await supabase.auth.admin.listUsers();
  
  roles.forEach(role => {
    const user = users.users.find(u => u.id === role.user_id);
    if (user) {
      console.log(`User ID: ${role.user_id} | Email: ${user.email} | Role: ${role.role}`);
    }
  });
}
run();
