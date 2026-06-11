import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixSeasons() {
  const clubId = 'eead69a9-d59b-45c6-8840-2fc9f3f59756';

  console.log("Updating old transactions to Summer 2026...");
  const { data: txUpdate, error: txError } = await supabase
    .from('transactions')
    .update({ season_name: 'Summer 2026' })
    .eq('club_id', clubId)
    .is('season_name', null);
  
  if (txError) console.error("TX Update Error:", txError);
  else console.log("Transactions updated successfully.");

  const { data: teams } = await supabase.from('teams').select('id').eq('club_id', clubId);
  const teamIds = teams.map(t => t.id);

  console.log("Updating new fixtures to Winter 2026...");
  const { data: fixUpdate, error: fixError } = await supabase
    .from('fixtures')
    .update({ season_name: 'Winter 2026' })
    .in('team_id', teamIds)
    .is('season_name', null);
    
  if (fixError) console.error("Fixture Update Error:", fixError);
  else console.log("Fixtures updated successfully.");

  console.log("Setting active club season to Winter 2026...");
  const { error: clubError } = await supabase
    .from('clubs')
    .update({ season_name: 'Winter 2026' })
    .eq('id', clubId);

  if (clubError) console.error("Club Update Error:", clubError);
  else console.log("Club updated successfully.");
}

fixSeasons();
