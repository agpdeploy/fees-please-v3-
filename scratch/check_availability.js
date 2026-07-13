const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split('\n').forEach(line => {
  if (line.trim().startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/['"]/g, '').trim();
  if (line.trim().startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/['"]/g, '').trim();
});

const supabaseAdmin = createClient(url, key);

async function checkAvailability() {
    console.log("Fetching recent availability updates...");
    
    // Join with players and fixtures to get readable names
    const { data: updates, error } = await supabaseAdmin
        .from('availability')
        .select(`
            id,
            status,
            updated_at,
            players!inner ( first_name, last_name, nickname ),
            fixtures!inner ( opponent, match_date )
        `)
        .order('updated_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error fetching availability:", error);
        return;
    }

    if (!updates || updates.length === 0) {
        console.log("No availability records found.");
        return;
    }

    const tableData = updates.map(u => ({
        Player: u.players.nickname || `${u.players.first_name} ${u.players.last_name || ''}`.trim(),
        Fixture: `${u.fixtures.opponent} (${new Date(u.fixtures.match_date).toLocaleDateString()})`,
        Status: u.status,
        Updated_At: new Date(u.updated_at).toLocaleString()
    }));

    console.table(tableData);
}

checkAvailability();
