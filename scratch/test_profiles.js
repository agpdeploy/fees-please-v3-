const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '', dbpass = '';
env.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/['"\r]/g, '').trim();
  if (line.startsWith('SUPABASE_DB_PASSWORD=')) dbpass = line.split('=')[1].replace(/['"\r]/g, '').trim();
});
const postgres = require('postgres');
async function run() {
  const sql = postgres(`postgres://postgres.${url.split('//')[1].split('.')[0]}:${dbpass}@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres`);
  try {
    const res = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles'`;
    console.log(res);
  } catch (e) {
    console.log("Failed:", e.message);
  }
  process.exit(0);
}
run();
