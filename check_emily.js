require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  console.log("Checking ALL profiles with 'emily' in email...");
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('email', '%emily%');

  if (error) {
    console.error("Profile Error:", error);
  } else {
    console.log("Profiles found:", profiles);
  }
}

check();
