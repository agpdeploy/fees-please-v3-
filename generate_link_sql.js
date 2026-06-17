const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function generateSQL() {
  const { data: affiliate } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', 'ashleygpitt+p1@gmail.com')
    .single();

  const { data: referredUser } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', 'ashleygpitt+axlf1@gmail.com')
    .single();

  if (affiliate && referredUser) {
    console.log(`UPDATE profiles SET referred_by = '${affiliate.id}' WHERE id = '${referredUser.id}';`);
  } else {
    console.log("Could not find one of the users.");
  }
}

generateSQL();
