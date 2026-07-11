const { Client } = require('pg');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split('\n').forEach(line => {
  if (line.trim().startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/['"]/g, '').trim();
  if (line.trim().startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/['"]/g, '').trim();
});

const dbHost = 'aws-0-ap-southeast-2.pooler.supabase.com';
const dbPort = 6543;
const dbUser = `postgres.${url.split('//')[1].split('.')[0]}`;
const dbPassword = key;
const dbName = 'postgres';

const connectionString = `postgres://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    await client.query(`ALTER TABLE "public"."email_reports" DROP CONSTRAINT IF EXISTS "email_reports_frequency_check";`);
    await client.query(`ALTER TABLE "public"."email_reports" ADD CONSTRAINT "email_reports_frequency_check" CHECK ((frequency = ANY (ARRAY['weekly'::text, 'fortnightly'::text, 'instant_event'::text])));`);
    
    console.log("Migration successful");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}
run();
