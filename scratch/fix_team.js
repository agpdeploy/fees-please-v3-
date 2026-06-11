const fs = require('fs');

let code = fs.readFileSync('components/Team.tsx', 'utf8');

// 1. Insert fetch for club season name
const fetchClubSeason = `
      // Fetch club info to get season_name for filtering
      const { data: clubData } = await supabase.from('clubs').select('season_name').eq('id', activeClubId).single();
      const clubSeasonName = clubData?.season_name || null;

      // 1. Determine Teams`;

code = code.replace('// 1. Determine Teams', fetchClubSeason);

// 2. Replace clubInfo?.season_name with clubSeasonName
code = code.replace(/clubInfo\?\.season_name \? f\.season_name === clubInfo\.season_name : !f\.season_name/g, 'clubSeasonName ? f.season_name === clubSeasonName : !f.season_name');
code = code.replace(/!\clubInfo\?\.season_name \|\| tx\.season_name === clubInfo\.season_name/g, 'clubSeasonName ? tx.season_name === clubSeasonName : !tx.season_name');

fs.writeFileSync('components/Team.tsx', code);
console.log('Fixed Team.tsx');
