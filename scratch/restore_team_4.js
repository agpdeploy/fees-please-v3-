const fs = require('fs');

let code = fs.readFileSync('components/Team.tsx', 'utf8');

const target = `      setClubPlayers(allPlayers);
      const today = new Date();`;

const replacement = `      setClubPlayers(allPlayers);

      // Initialize Player Stats for those assigned to the current team
      const statsMap: Record<string, any> = {};
      let membersCount = 0;
      let casualsCount = 0;

      allPlayers.forEach(p => {
        if (p.default_team_id === targetTeamId) {
          statsMap[p.id] = {
            id: p.id,
            name: formatName(p),
            full_name: \`\${p.first_name} \${p.last_name}\`,
            email: p.email,
            is_member: p.is_member,
            is_active: p.is_active !== false,
            balance: 0,
            gamesPlayed: 0
          };
          if (p.is_member) membersCount++; else casualsCount++;
        }
      });

      // 2. Fetch Transactions to calculate balances
      const { data: txData } = await supabase
        .from("transactions")
        .select("amount, transaction_type, player_id, season_name")
        .eq("club_id", activeClubId);

      if (txData) {
        txData.forEach(tx => {
          if (tx.player_id && (clubSeasonName ? tx.season_name === clubSeasonName : !tx.season_name)) {
            // We only track balance if they exist in our statsMap, otherwise we add them if they played for this team
            if (!statsMap[tx.player_id]) {
                const p = allPlayers.find(pl => pl.id === tx.player_id);
                if (p) {
                   statsMap[p.id] = { id: p.id, name: formatName(p), full_name: \`\${p.first_name} \${p.last_name}\`, email: p.email, is_member: p.is_member, is_active: p.is_active !== false, balance: 0, gamesPlayed: 0 };
                }
            }
            if (statsMap[tx.player_id]) {
               if (tx.transaction_type === 'fee' || tx.transaction_type === 'expense') statsMap[tx.player_id].balance += Number(tx.amount);
               if (tx.transaction_type === 'payment') statsMap[tx.player_id].balance -= Number(tx.amount);
            }
          }
        });
      }

      // 3. Fetch Matches and Squads for gamesPlayed
      const { data: rawAllFixtures } = await supabase.from("fixtures").select("id, match_date, season_name").eq("team_id", targetTeamId);
      let totalGames = 0;
      if (rawAllFixtures && rawAllFixtures.length > 0) {
        const allFixtures = rawAllFixtures.filter((f: any) => clubSeasonName ? f.season_name === clubSeasonName : !f.season_name);
        const fixIds = allFixtures.map((f: any) => f.id);
        const { data: allSquads } = await supabase.from("match_squads").select("player_id").in("fixture_id", fixIds);
        
        if (allSquads) {
          allSquads.forEach(s => {
            if (statsMap[s.player_id]) {
              statsMap[s.player_id].gamesPlayed += 1;
            } else {
               const p = allPlayers.find(pl => pl.id === s.player_id);
               if (p) {
                 statsMap[p.id] = { id: p.id, name: formatName(p), full_name: \`\${p.first_name} \${p.last_name}\`, email: p.email, is_member: p.is_member, is_active: p.is_active !== false, balance: 0, gamesPlayed: 1 };
               }
            }
            totalGames++;
          });
        }
      }

      setPlayerStats(statsMap);

      const today = new Date();`;

code = code.replace(target, replacement);

fs.writeFileSync('components/Team.tsx', code);
console.log('Fixed correctly via exact string replacement');
