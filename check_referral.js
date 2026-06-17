const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUser() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, referred_by, full_name')
    .eq('email', 'ashleygpitt+axlf1@gmail.com')
    .single();
    
  if (error) {
    console.error("Error fetching referred user:", error);
  } else {
    console.log("Referred user profile:", data);
  }

  // Also check the affiliate profile
  const { data: affiliate, error: err2 } = await supabase
    .from('profiles')
    .select('id, email, referral_code')
    .eq('email', 'ashleygpitt+p1@gmail.com');
  
  if (err2) {
    console.error("Error fetching affiliate:", err2);
  } else {
    console.log("Affiliate profiles (p1 or similar):", affiliate);
  }
}

checkUser();
