const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve('.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const clubIds = ['bacf6b4a-d6cb-4f6d-b5e6-27f6b4bdf329', '147db7ed-a73b-44ed-b83b-3dc4bf032ac3'];
  const { data: clubsData, error } = await supabase
    .from('clubs')
    .select('id, name, logo_url, is_active, plan_tier')
    .in('id', clubIds);
  console.log("Anon Query for specific Clubs:", { clubsData, error });
}
run();
