const { createClient } = require('@supabase/supabase-js');
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
    const res = await sql`
      SELECT
        column_name, data_type, character_maximum_length, column_default, is_nullable
      FROM
        information_schema.columns
      WHERE
        table_name = 'email_logs';
    `;
    console.log(res);
  } catch (e) {
    console.log("Failed:", e.message);
  }
}
run();
