require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fix() {
  console.log('Fixing missing season names for fixtures...');
  const { data: clubs } = await supabase.from('clubs').select('id, season_name');
  for (const club of (clubs || [])) {
    if (club.season_name) {
      const { data: teams } = await supabase.from('teams').select('id').eq('club_id', club.id);
      const teamIds = teams.map(t => t.id);
      if (teamIds.length > 0) {
        const { error, count } = await supabase
          .from('fixtures')
          .update({ season_name: club.season_name })
          .is('season_name', null)
          .in('team_id', teamIds);
        
        console.log(`Club ${club.id}: Fixed missing season names.`);
      }
    }
  }
  console.log('Done.');
}
fix();
