const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function linkReferral() {
  console.log("Fetching affiliate (+p1)...");
  const { data: affiliate, error: err1 } = await supabase
    .from('profiles')
    .select('id, email, referral_code')
    .eq('email', 'ashleygpitt+p1@gmail.com')
    .single();

  if (err1 || !affiliate) {
    console.error("Failed to fetch affiliate:", err1);
    return;
  }
  
  console.log("Found affiliate:", affiliate.email, affiliate.id);

  console.log("Fetching referred user (+axlf1)...");
  const { data: referredUser, error: err2 } = await supabase
    .from('profiles')
    .select('id, email, referred_by')
    .eq('email', 'ashleygpitt+axlf1@gmail.com')
    .single();

  if (err2 || !referredUser) {
    console.error("Failed to fetch referred user:", err2);
    return;
  }

  console.log("Found referred user:", referredUser.email, referredUser.id);

  console.log("Linking users...");
  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ referred_by: affiliate.id })
    .eq('id', referredUser.id);

  if (updateErr) {
    console.error("Failed to update referred_by:", updateErr);
  } else {
    console.log("Successfully linked!");
  }
}

linkReferral();
