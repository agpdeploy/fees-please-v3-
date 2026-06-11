import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkClub() {
  const clubId = 'eead69a9-d59b-45c6-8840-2fc9f3f59756';
  const { data: club } = await supabase.from('clubs').select('name, season_name').eq('id', clubId).single();
  console.log("CLUB:", club);

  const { data: tx } = await supabase.from('transactions').select('season_name, amount, created_at, transaction_type').eq('club_id', clubId).order('created_at', { ascending: false });
  
  const seasons = new Set();
  tx.forEach(t => seasons.add(t.season_name));
  console.log("TX SEASONS:", Array.from(seasons));
  console.log("TX COUNT:", tx.length);

  const { data: teams } = await supabase.from('teams').select('id').eq('club_id', clubId);
  const teamIds = teams.map(t => t.id);

  const { data: fix } = await supabase.from('fixtures').select('season_name, opponent, match_date').in('team_id', teamIds).order('match_date', { ascending: false });
  const fixSeasons = new Set();
  fix.forEach(f => fixSeasons.add(f.season_name));
  console.log("FIXTURE SEASONS:", Array.from(fixSeasons));
  console.log("FIXTURE COUNT:", fix.length);
  if (fix.length > 0) {
     console.log("Sample fixtures:", fix.slice(0, 3));
  }
}
checkClub();
