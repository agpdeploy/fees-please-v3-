import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRLS() {
  const { data, error } = await supabase.rpc('get_policies_for_table', { target_table: 'email_reports' });
  if (error) {
    // fallback if rpc doesn't exist
    const { data: dbData, error: dbError } = await supabase.from('pg_policies').select('*').eq('tablename', 'email_reports');
    console.log("Policies:", dbData || dbError);
  } else {
    console.log("Policies:", data);
  }
}

checkRLS();
