import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const fixtureId = '3355d0db-01c3-4395-a7ed-9adc4dad60e9'; // from user's sql
  
  // Get all players in the squad for this fixture
  const { data: squads } = await supabase.from('match_squads').select('player_id').eq('fixture_id', fixtureId);
  if (!squads) {
    console.log("No squad found"); return;
  }
  const squadPlayerIds = squads.map(s => s.player_id);
  
  // Get players to check
  const { data: players } = await supabase.from('players').select('id, nickname, first_name, is_member').in('id', squadPlayerIds);
  
  // Get all fees for this fixture
  const { data: fees } = await supabase.from('transactions').select('*').eq('fixture_id', fixtureId).eq('transaction_type', 'fee');
  
  // For each player, if they don't have a fee > 0, they need one!
  const missing = [];
  for (const player of players) {
    const playerFees = fees.filter(f => f.player_id === player.id);
    const hasPositiveFee = playerFees.some(f => f.amount > 0);
    
    if (!hasPositiveFee) {
       missing.push(player);
    }
  }
  console.log(JSON.stringify(missing, null, 2));
}
run();
