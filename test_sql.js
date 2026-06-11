const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/['"]/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/['"]/g, '').trim();
});
const postgres = require('postgres');
async function run() {
  const sql = postgres(`postgres://postgres.${url.split('//')[1].split('.')[0]}:${key}@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres`);
  try {
    const res = await sql`SELECT 1 as test`;
    console.log(res);
  } catch(e) { console.log(e); }
  process.exit(0);
}
run();
