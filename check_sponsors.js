import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('teams').select('*').limit(1);
  if (error) console.error(error);
  else console.log(Object.keys(data[0]).filter(k => k.includes('sponsor')));
}
run();
