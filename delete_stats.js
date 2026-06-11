const fs = require('fs');
const path = 'components/Team.tsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

// We are going to null out the lines we want to delete, then filter them out.
// Line numbers are 1-indexed, array is 0-indexed.

// 1. Availability button (772-786)
for (let i = 771; i <= 785; i++) {
    lines[i] = null;
}

// 2. Availability ternary block (788-868)
// Line 788 is index 787.
// Line 869 is index 868, which contains ") : ("
// We delete 788 through 868. We will keep 869.
for (let i = 787; i <= 867; i++) {
    lines[i] = null;
}

// 3. Squad button (1198-1211)
for (let i = 1197; i <= 1210; i++) {
    lines[i] = null;
}

// 4. Squad ternary block (1219-1310)
// Line 1219 is index 1218
// Line 1311 is index 1310, which contains ") : ("
for (let i = 1218; i <= 1309; i++) {
    lines[i] = null;
}

const newContent = lines.filter(l => l !== null).join('\n');
fs.writeFileSync(path, newContent);
console.log('Deleted blocks by line numbers successfully');
