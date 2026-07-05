import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testInsert() {
  // Try to find a valid team id
  const { data: teamData, error: teamError } = await supabase.from('teams').select('id').limit(1);
  if (teamError || !teamData || teamData.length === 0) {
    console.error('Error fetching team', teamError);
    return;
  }
  const teamId = teamData[0].id;
  
  const payload = {
    team_id: teamId,
    sponsor_index: 1,
    event_type: 'impression'
  };
  
  console.log('Inserting payload:', payload);
  
  const { data, error } = await supabase.from('sponsor_analytics').insert([payload]).select();
  
  if (error) {
    console.error('Insert Error:', error);
  } else {
    console.log('Insert Success:', data);
  }
}

testInsert();
