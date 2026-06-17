const fs = require('fs');
const files = ['components/Setup.tsx', 'app/page.tsx'];

const replacements = [
  ['Register New Club', 'Register New Account'],
  ['Create a brand new workspace for your club or team.', 'Create a brand new workspace for your account or team.'],
  ['Create Club', 'Create Account'],
  ['God Mode: Active Club', 'God Mode: Active Account'],
  ['Create New Club', 'Create New Account'],
  ['Club Name</label>', 'Account Name</label>'],
  ['Public Club Email', 'Public Account Email'],
  ['Public Club Website', 'Public Account Website'],
  ['Public Club Address', 'Public Account Address'],
  ['Club Status</div>', 'Account Status</div>'],
  ['Deactivate Club', 'Deactivate Account'],
  ['Reactivate Club', 'Reactivate Account'],
  ['Save Club First', 'Save Account First'],
  ['Club Logo</label>', 'Account Logo</label>'],
  ['Save Club Settings', 'Save Account Settings'],
  ['Club Sponsors (Public Page)', 'Account Sponsors (Public Page)'],
  ['save your club configuration first.', 'save your account configuration first.'],
  ['Manual Payment Fallback (Club Level)', 'Manual Payment Fallback (Account Level)'],
  ['Active Club Announcement', 'Active Account Announcement'],
  ['Your club has no active season.', 'Your account has no active season.'],
  ['for this club. Square wholesale', 'for this account. Square wholesale'],
  ['Select Club', 'Select Account'],
  ['Switch Club', 'Switch Account'],
  ['Club Logo"', 'Account Logo"'],
  ['admin@club.com', 'admin@account.com']
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  for (const [find, replace] of replacements) {
    content = content.split(find).join(replace);
  }
  fs.writeFileSync(file, content);
  console.log(`Replaced strings in ${file}`);
}
