const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split('\n').forEach(line => {
  if (line.trim().startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/['"]/g, '').trim();
  if (line.trim().startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/['"]/g, '').trim();
});

const supabase = createClient(url, key);

async function run() {
  try {
    const tables = ['clubs', 'teams', 'players', 'fixtures', 'public_team_profiles', 'sponsor_analytics'];
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.error(`Error fetching ${table}:`, error.message);
      } else {
        console.log(`\n--- TABLE: ${table} ---`);
        if (data && data.length > 0) {
          console.log(Object.keys(data[0]));
          console.log("Row:", JSON.stringify(data[0], null, 2));
        } else {
          console.log(`No rows in ${table}`);
        }
      }
    }
  } catch (e) {
    console.error("Failed:", e);
  }
}
run();
