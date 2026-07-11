const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split('\n').forEach(line => {
  if (line.trim().startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/['"]/g, '').trim();
  if (line.trim().startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/['"]/g, '').trim();
});

const supabaseAdmin = createClient(url, key);

async function checkQueue() {
    console.log("Checking availability_queue...");
    const { data: queue, error: qErr } = await supabaseAdmin.from('availability_queue').select('*');
    if (qErr) {
        console.error("Queue fetch error:", qErr);
    } else {
        console.log(`Found ${queue.length} items in queue:`, queue);
    }

    console.log("Checking instant_event email_reports...");
    const { data: reports, error: rErr } = await supabaseAdmin.from('email_reports').select('*').eq('report_type', 'availability_report').eq('frequency', 'instant_event');
    if (rErr) {
        console.error("Reports fetch error:", rErr);
    } else {
        console.log(`Found ${reports.length} reports configuring instant_event:`, reports);
    }
}

checkQueue();
