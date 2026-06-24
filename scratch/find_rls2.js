const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split('\n').forEach(line => {
  if (line.trim().startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '');
  if (line.trim().startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '');
});

const supabase = createClient(url, key);

async function check() {
  // Let's use standard API to get the schema dump.
  // Actually, we can just look at `transactions` policies by downloading the schema dump from supabase using `psql` if we had the connection string, but we only have URL and KEY.
  // Wait, I can just use execute_sql if it was defined, but it wasn't.

  // Instead, let's look at `supabase/migrations` again. Let's just run a script to print ALL lines with `CREATE POLICY` and `ON "public"."transactions"`.
  const path = require('path');
  const migrationsDir = 'supabase/migrations';
  const files = fs.readdirSync(migrationsDir);

  files.forEach(file => {
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    if (content.includes('public"."transactions"') || content.includes('public.transactions')) {
      const lines = content.split('\n');
      for(let i=0; i<lines.length; i++) {
        if (lines[i].includes('CREATE POLICY') && (lines[i].includes('transactions') || lines[i+1]?.includes('transactions'))) {
          console.log(`\n--- ${file} ---`);
          for(let j=i; j<i+10 && j<lines.length; j++) {
            console.log(lines[j].trim());
            if (lines[j].includes(');')) break;
          }
        }
      }
    }
  });
}

check();
