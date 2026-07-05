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
    
    // Add columns to sponsor_analytics
    await client.query(`ALTER TABLE public.sponsor_analytics ADD COLUMN IF NOT EXISTS source text;`);
    
    // Add columns to public_team_profiles
    await client.query(`ALTER TABLE public.public_team_profiles ADD COLUMN IF NOT EXISTS sponsor_4_logo text;`);
    await client.query(`ALTER TABLE public.public_team_profiles ADD COLUMN IF NOT EXISTS sponsor_4_url text;`);
    
    console.log("Migration successful");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}
run();
