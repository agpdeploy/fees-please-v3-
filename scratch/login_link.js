const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const email = 'ashleygpitt+sum26@gmail.com';
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: email,
    options: {
      redirectTo: 'http://localhost:3000'
    }
  });
  
  if (error) {
    console.error('Error generating link:', error);
  } else {
    console.log('LOGIN_LINK:', data.properties.action_link);
  }
}
run();
