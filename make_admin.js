require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkClient() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'daivefeesplease@gmail.com',
    password: 'password' // I don't know the password...
  });
}
