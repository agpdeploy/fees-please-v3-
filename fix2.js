const fs = require('fs');
const path = 'components/Team.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove Email Stats button for availability
content = content.replace(/\{\(f as any\)\.reminder_sent && \([\s\S]*?setAvailabilityMode\('email_stats'\)[\s\S]*?<\/button>\s*\)\}/, '');
console.log('Removed availability email stats button');

// 2. Remove Email Stats view for availability
const availViewRegex = /\)\s*:\s*availabilityMode === 'email_stats' \? \([\s\S]*?<\/div>\s*\)\s*:\s*\(/;
let match1 = content.match(availViewRegex);
if (match1) {
    content = content.replace(availViewRegex, ') : (');
    console.log('Removed availability email stats view (regex)');
} else {
    const availViewStr = "availabilityMode === 'email_stats' ? (";
    let availViewStart = content.indexOf(availViewStr);
    if (availViewStart !== -1) {
       let nextElse = content.indexOf(') : (', availViewStart);
       if (nextElse !== -1) {
          let startReplace = content.lastIndexOf(':', availViewStart);
          content = content.substring(0, startReplace) + ' : ' + content.substring(nextElse + 4);
          console.log('Removed availability email stats view (fallback)');
       }
    }
}

// 3. Remove Email Stats button for squad
content = content.replace(/\{\(f as any\)\.squad_published && \([\s\S]*?setSquadMode\('squad_email_stats'\)[\s\S]*?<\/button>\s*\)\}/, '');
console.log('Removed squad email stats button');

// 4. Remove Email Stats view for squad
const squadViewStr = "squadMode === 'squad_email_stats' ? (";
let squadViewStart = content.indexOf(squadViewStr);
if (squadViewStart !== -1) {
   let nextElse = content.indexOf(') : (', squadViewStart);
   if (nextElse !== -1) {
      let startReplace = content.lastIndexOf(':', squadViewStart);
      content = content.substring(0, startReplace) + ' : ' + content.substring(nextElse + 4);
      console.log('Removed squad email stats view (fallback)');
   }
}

fs.writeFileSync(path, content);
