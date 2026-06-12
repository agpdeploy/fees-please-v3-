const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase.rpc('get_policies', { table_name: 'user_roles' });
  if (error) {
    // If get_policies function doesn't exist, query pg_policies directly
    const { data: pgData, error: pgError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'user_roles');
    if (pgError) {
      // Let's run a raw sql query via standard postgrest or inspect pg_catalog
      const { data: sqlData, error: sqlError } = await supabase.rpc('exec_sql', {
        sql_query: "SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'user_roles'"
      });
      if (sqlError) {
        console.error('Failed to get policies:', sqlError);
      } else {
        console.log('Policies from exec_sql:', sqlData);
      }
    } else {
      console.log('Policies from pg_policies:', pgData);
    }
  } else {
    console.log('Policies from RPC:', data);
  }
}
run();
