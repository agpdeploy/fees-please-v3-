const fs = require('fs');

function fixFile(filePath, varName, isObj) {
  let code = fs.readFileSync(filePath, 'utf8');
  
  if (isObj) {
    // Replace !clubData?.season_name || f.season_name === clubData.season_name
    // With: clubData?.season_name ? f.season_name === clubData.season_name : !f.season_name
    code = code.replace(
      new RegExp(`!${varName}\\?\\.season_name \\|\\| f\\.season_name === ${varName}\\.season_name`, 'g'),
      `${varName}?.season_name ? f.season_name === ${varName}.season_name : !f.season_name`
    );
    // Also handle non-optional chaining just in case
    code = code.replace(
      new RegExp(`!${varName}\\.season_name \\|\\| f\\.season_name === ${varName}\\.season_name`, 'g'),
      `${varName}?.season_name ? f.season_name === ${varName}.season_name : !f.season_name`
    );
  } else {
    // Replace !clubInfo?.season_name || f.season_name === clubInfo.season_name
    code = code.replace(
      new RegExp(`!${varName}\\?\\.season_name \\|\\| f\\.season_name === ${varName}\\.season_name`, 'g'),
      `${varName}?.season_name ? f.season_name === ${varName}.season_name : !f.season_name`
    );
    code = code.replace(
      new RegExp(`!${varName}\\.season_name \\|\\| f\\.season_name === ${varName}\\.season_name`, 'g'),
      `${varName}?.season_name ? f.season_name === ${varName}.season_name : !f.season_name`
    );
  }

  fs.writeFileSync(filePath, code);
  console.log('Fixed', filePath);
}

fixFile('components/GameDay.tsx', 'clubInfo', false);
fixFile('components/Team.tsx', 'clubInfo', false);
fixFile('components/Setup.tsx', 'clubData', true);

// Let's also check if there are other occurrences.
