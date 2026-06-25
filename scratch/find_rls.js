const fs = require('fs');
const path = require('path');

const migrationsDir = 'supabase/migrations';
const files = fs.readdirSync(migrationsDir);

files.forEach(file => {
  const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  if (content.includes('CREATE POLICY') && content.includes('transactions')) {
    console.log('--- FOUND IN', file, '---');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('transactions')) {
        console.log(`L${i}: ${line.trim()}`);
        for(let j = i; j < i + 10 && j < lines.length; j++) {
            if (lines[j].includes('CREATE POLICY')) {
                console.log(lines.slice(j, j+15).join('\n'));
                break;
            }
        }
      }
    });
  }
});
