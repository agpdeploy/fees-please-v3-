const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://jmayrdgouacskgarwltv.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptYXlyZGdvdWFjc2tnYXJ3bHR2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjEzNDI0NiwiZXhwIjoyMDkxNzEwMjQ2fQ.wrYCLoUsDbSUuWF7NugOhpj6OK7r79nITQuc8vi_u5Y');

async function check() {
  const { data: bmc } = await supabase.from('clubs').select('id, name, season_name').eq('id', '9a94642c-c491-45cb-a9a1-7fa2a0d2132c').single();
  console.log('Bowl Movements Club:', bmc);
  
  const { data: fdcc } = await supabase.from('clubs').select('id, name, season_name').eq('id', '6f776fde-69b1-4c29-ae8e-97b69799a7d4').single();
  console.log('Ferny Districts Club:', fdcc);
}
check();
