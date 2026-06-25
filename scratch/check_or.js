const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split('\n').forEach(line => {
  if (line.trim().startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '');
  if (line.trim().startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '');
});

const supabase = createClient(url, key);

async function check() {
  const email = 'ashleygpitt+p1@gmail.com';
  const userId = 'd1ecf137-3f68-4940-88c1-c6875766a4fb';
  const clubId = '147db7ed-a73b-44ed-b83b-3dc4bf032ac3';

  // Test 1: using .or with unencoded +
  let q1 = supabase.from('players').select('id, email').eq('club_id', clubId).or(`email.eq.${email},user_id.eq.${userId}`);
  const { data: d1 } = await q1;
  console.log("Test 1 (unencoded or):", d1);

  // Test 2: using .or with encoded +
  const encodedEmail = encodeURIComponent(email);
  let q2 = supabase.from('players').select('id, email').eq('club_id', clubId).or(`email.eq.${encodedEmail},user_id.eq.${userId}`);
  const { data: d2 } = await q2;
  console.log("Test 2 (encoded or):", d2);
}

check();
