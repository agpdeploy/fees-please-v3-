const fs = require('fs');
const file = fs.readFileSync('components/Setup.tsx', 'utf8');
const lines = file.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('activeTab === "access"') || line.includes('role === "club_admin"') || line.includes('invite') || line.includes('user_roles')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
