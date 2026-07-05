const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://jmayrdgouacskgarwltv.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptYXlyZGdvdWFjc2tnYXJ3bHR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMzQyNDYsImV4cCI6MjA5MTcxMDI0Nn0.R23F6zT7Y9t9rG3F1T4sT_B2Y1w8K6oH_bX0uO0I4');

async function check() {
  const { data, error } = await supabase.from('clubs').select('*').eq('id', '9a94642c-c491-45cb-a9a1-7fa2a0d2132c');
  console.log(data, error);
}
check();
