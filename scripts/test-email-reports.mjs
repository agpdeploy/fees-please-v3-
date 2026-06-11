import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkReports() {
  const { data, error } = await supabase
    .from('email_reports')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("Email Reports:");
  console.log(JSON.stringify(data, null, 2));
}

checkReports();
