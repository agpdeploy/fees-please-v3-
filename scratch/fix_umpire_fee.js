const fs = require('fs');

let code = fs.readFileSync('components/GameDay.tsx', 'utf8');

// Replace standard activeFixture.umpire_fee
code = code.replace(/activeFixture\.umpire_fee/g, "(activeFixture.umpire_fee || clubInfo?.default_umpire_fee || 0)");

// Replace optional chained activeFixture?.umpire_fee
code = code.replace(/activeFixture\?\.umpire_fee/g, "(activeFixture?.umpire_fee || clubInfo?.default_umpire_fee || 0)");

// There is one edge case: activeFixture?.umpire_fee || 0
// It might become (activeFixture?.umpire_fee || clubInfo?.default_umpire_fee || 0) || 0
// Which is totally fine and valid JS

fs.writeFileSync('components/GameDay.tsx', code);
console.log('Fixed umpire fee fallback correctly');
