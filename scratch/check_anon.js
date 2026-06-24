const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split('\n').forEach(line => {
  if (line.trim().startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '');
  if (line.trim().startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) key = line.split('=')[1].replace(/"/g, '');
});

const supabase = createClient(url, key);

async function check() {
  const email = 'ashleygpitt+p1@gmail.com';
  
  // Login as Axel
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: 'password123' // Is this a known password? Probably not.
  });

  if (error) {
    console.log("Login failed:", error.message);
  }

  // Actually, we can't login without password unless we use service_role to generate a token or just test RLS.
}

check();
