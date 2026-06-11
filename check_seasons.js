import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSeasons() {
  const { data: clubs } = await supabase.from('clubs').select('id, name, season_name');
  console.log("CLUBS:", clubs);

  const { data: tx } = await supabase.from('transactions').select('season_name, amount, transaction_type').limit(10);
  console.log("Sample TX seasons:", tx);

  const { data: fix } = await supabase.from('fixtures').select('season_name').limit(10);
  console.log("Sample Fixture seasons:", fix);
}
checkSeasons();
