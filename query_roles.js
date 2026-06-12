const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: roles, error } = await supabase
    .from('user_roles')
    .select('*');
    
  if (error) {
    console.error('Error fetching roles:', error);
    return;
  }
  
  console.log('--- ROLES WITH NULL USER_ID ---');
  const nullUserRoles = roles.filter(r => !r.user_id);
  console.log(`Found ${nullUserRoles.length} roles with null user_id:`);
  nullUserRoles.forEach(role => {
    console.log(JSON.stringify(role, null, 2));
  });

  console.log('\n--- NON-TEST EMAIL ROLES ---');
  roles.forEach(role => {
    const email = (role.email || '').toLowerCase();
    if (!email.includes('ashleygpitt') && !email.includes('daive') && !email.includes('ashleyemily')) {
      console.log(JSON.stringify(role, null, 2));
    }
  });
}
run();
