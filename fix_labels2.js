const fs = require('fs');
const file = 'components/Setup.tsx';

const replacements = [
  ['Account Name</label>', 'Name</label>'],
  ['Public Account Email</label>', 'Email</label>'],
  ['Public Account Website</label>', 'Website</label>'],
  ['Public Account Address</label>', 'Address</label>']
];

let content = fs.readFileSync(file, 'utf8');
for (const [find, replace] of replacements) {
  content = content.split(find).join(replace);
}
fs.writeFileSync(file, content);
console.log(`Replaced strings in ${file}`);
