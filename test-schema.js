const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://jmayrdgouacskgarwltv.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptYXlyZGdvdWFjc2tnYXJ3bHR2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjEzNDI0NiwiZXhwIjoyMDkxNzEwMjQ2fQ.wrYCLoUsDbSUuWF7NugOhpj6OK7r79nITQuc8vi_u5Y');

async function check() {
  const { data: user, error } = await supabase.from('profiles').select('club_id').eq('email', 'ashleyemily2013@gmail.com').single();
  console.log('User Profile club_id:', user, error);
}
check();
