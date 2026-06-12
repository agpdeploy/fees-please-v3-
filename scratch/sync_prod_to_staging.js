const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

// Command line arguments helper
const args = process.argv.slice(2);
if (args.length < 4) {
  console.log(`
Usage:
  node scratch/sync_prod_to_staging.js <PROD_URL> <PROD_SERVICE_KEY> <STAGING_URL> <STAGING_SERVICE_KEY>

Example:
  node scratch/sync_prod_to_staging.js https://prod.supabase.co prod-key https://staging.supabase.co staging-key
`);
  process.exit(1);
}

const [PROD_URL, PROD_KEY, STAGING_URL, STAGING_KEY] = args;

const prodSupabase = createClient(PROD_URL, PROD_KEY, {
  auth: { persistSession: false }
});

const stagingSupabase = createClient(STAGING_URL, STAGING_KEY, {
  auth: { persistSession: false }
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const TABLES_IN_ORDER = [
  'profiles',
  'clubs',
  'user_roles',
  'teams',
  'players',
  'seasons',
  'team_seasons',
  'fixtures',
  'availability',
  'transactions'
];

async function main() {
  console.log('📡 Verifying database connections...');
  
  try {
    const { data: prodClubs, error: prodErr } = await prodSupabase.from('clubs').select('count');
    if (prodErr) throw new Error(`Prod DB connection failed: ${prodErr.message}`);
    
    const { data: stagingClubs, error: stagingErr } = await stagingSupabase.from('clubs').select('count');
    if (stagingErr) throw new Error(`Staging DB connection failed: ${stagingErr.message}`);
    
    console.log('✅ Connections verified successfully!');
  } catch (e) {
    console.error('❌ Connection error:', e.message);
    process.exit(1);
  }

  rl.question('⚠️ WARNING: This will overwrite data in your STAGING database. Are you sure you want to continue? (yes/no): ', async (answer) => {
    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Sync aborted.');
      rl.close();
      process.exit(0);
    }

    try {
      console.log('\n🚀 Starting sync process...');

      for (const table of TABLES_IN_ORDER) {
        console.log(`\n⏳ Syncing table: "${table}"...`);

        // 1. Fetch all records from Prod (using pagination)
        let allRecords = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await prodSupabase
            .from(table)
            .select('*')
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (error) {
            console.error(`❌ Error fetching from prod table "${table}":`, error.message);
            throw error;
          }

          if (data && data.length > 0) {
            allRecords = allRecords.concat(data);
            page++;
            if (data.length < pageSize) {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        }

        console.log(`📦 Fetched ${allRecords.length} records from production.`);

        if (allRecords.length === 0) {
          console.log(`ℹ️ Table "${table}" is empty on prod. Skipping write.`);
          continue;
        }

        // 2. Write/Upsert records to Staging in chunks
        const chunkSize = 100;
        let writtenCount = 0;

        for (let i = 0; i < allRecords.length; i += chunkSize) {
          const chunk = allRecords.slice(i, i + chunkSize);
          const { error } = await stagingSupabase
            .from(table)
            .upsert(chunk, { onConflict: 'id' });

          if (error) {
            console.error(`❌ Error writing chunk to staging table "${table}":`, error.message);
            throw error;
          }
          writtenCount += chunk.length;
          console.log(`✏️ Progress: ${writtenCount}/${allRecords.length} records written.`);
        }

        console.log(`✅ Table "${table}" sync complete.`);
      }

      console.log('\n🎉 Database data sync completed successfully!');
    } catch (e) {
      console.error('\n❌ Sync process failed:', e.message);
    } finally {
      rl.close();
    }
  });
}

main();
