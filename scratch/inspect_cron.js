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
    const { data, error } = await supabase.rpc('get_cron_jobs');
    if (error) {
      // If RPC doesn't exist, try direct SQL query via a custom function if available, or just log
      console.error("RPC Error:", error.message);
    } else {
      console.log("Cron Jobs:", data);
    }
  } catch (e) {
    console.error("Failed:", e);
  }
}
run();
