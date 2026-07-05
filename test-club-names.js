const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://jmayrdgouacskgarwltv.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptYXlyZGdvdWFjc2tnYXJ3bHR2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjEzNDI0NiwiZXhwIjoyMDkxNzEwMjQ2fQ.wrYCLoUsDbSUuWF7NugOhpj6OK7r79nITQuc8vi_u5Y');

async function check() {
  const { data: teams } = await supabase.from('teams').select('*').eq('name', 'Bowl Movements');
  console.log('Bowl Movements Teams:', teams.map(t => ({ id: t.id, club_id: t.club_id })));
  
  for (const t of teams) {
    const { data: club } = await supabase.from('clubs').select('id, name, season_name').eq('id', t.club_id).single();
    console.log('Club for team:', club);
  }
}
check();
