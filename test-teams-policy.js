const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://jmayrdgouacskgarwltv.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptYXlyZGdvdWFjc2tnYXJ3bHR2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjEzNDI0NiwiZXhwIjoyMDkxNzEwMjQ2fQ.wrYCLoUsDbSUuWF7NugOhpj6OK7r79nITQuc8vi_u5Y');

async function check() {
  const { data, error } = await supabase.from('teams').select('id, name, club_id').eq('club_id', '6f776fde-69b1-4c29-ae8e-97b69799a7d4');
  console.log(data, error);
}
check();
