const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const { data: tx, error } = await supabase.from('transactions').insert({ 
    player_id: '00000000-0000-0000-0000-000000000000', 
    team_id: '00000000-0000-0000-0000-000000000000', 
    club_id: '00000000-0000-0000-0000-000000000000', 
    amount: 10, 
    transaction_type: 'payment', 
    payment_method: 'write_off' 
  });
  console.log('Test tx insert error:', error);
}

test();
