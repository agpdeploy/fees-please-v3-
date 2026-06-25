const fs = require('fs');

const content = fs.readFileSync('supabase/migrations/20260414021755_remote_schema.sql', 'utf8');
const lines = content.split('\n');
for (let i=0; i<lines.length; i++) {
  if (lines[i].includes('CREATE POLICY') && lines[i].includes('transactions"')) {
    console.log(`\n--- Line ${i} ---`);
    for (let j=i; j<i+10 && j<lines.length; j++) {
      console.log(lines[j]);
      if (lines[j].includes(');')) break;
    }
  }
}
