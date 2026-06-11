const fs = require('fs');

const code = `"use client";

import React, { useState, useEffect, Fragment } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { useActiveClub } from "@/contexts/ClubContext";

export default function SeasonHistory() {
  const { profile, roles } = useProfile();
  const { activeClubId } = useActiveClub();

  const [isLoading, setIsLoading] = useState(true);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [availableSeasons, setAvailableSeasons] = useState<string[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  
  const [expandedFixtureId, setExpandedFixtureId] = useState<string | null>(null);
  const [squadData, setSquadData] = useState<Record<string, any[]>>({});
  const [allPlayers, setAllPlayers] = useState<any[]>([]);

  // Financial Stats
  const [seasonWallet, setSeasonWallet] = useState({ cash: 0, card: 0 });
  const [overallNet, setOverallNet] = useState(0);
  const [seasonAudit, setSeasonAudit] = useState<any[]>([]);
  const [playerBalances, setPlayerBalances] = useState<any[]>([]);
  const [isWalletExpanded, setIsWalletExpanded] = useState(false);

  // 1. Fetch accessible teams
  useEffect(() => {
    async function fetchTeams() {
      if (!profile || !activeClubId) return;
      setIsLoading(true);
      
      const isClubAdmin = profile.role === 'super_admin' || roles?.some((r: any) => r.role === 'club_admin' && r.club_id === activeClubId);
      
      let query = supabase.from("teams").select("id, name");
      if (isClubAdmin) {
        query = query.eq('club_id', activeClubId);
      } else {
        const teamIds = roles?.filter((r: any) => r.role === 'team_admin' && r.club_id === activeClubId).map((r: any) => r.team_id).filter(Boolean) || [];
        if (teamIds.length > 0) {
          query = query.in('id', teamIds);
        } else {
          setTeams([]);
          setIsLoading(false);
          return; 
        }
      }

      const { data, error } = await query;
      if (!error && data) {
        setTeams(data);
        if (data.length > 0) {
          setSelectedTeamId(data[0].id);
        }
      }
    }
    fetchTeams();
  }, [profile, roles, activeClubId]);

  // 2. Fetch players for the club
  useEffect(() => {
    if (activeClubId) {
      supabase.from('players').select('id, first_name, last_name, nickname, is_active, default_team_id').eq('club_id', activeClubId).then(({data}) => {
        if (data) setAllPlayers(data);
      });
    }
  }, [activeClubId]);

  // 3. Fetch fixtures and transactions
  useEffect(() => {
    async function fetchHistory() {
      if (!selectedTeamId || !activeClubId || allPlayers.length === 0) return;
      setIsLoading(true);

      const [fixRes, clubRes, txRes] = await Promise.all([
        supabase.from("fixtures").select("*").eq("team_id", selectedTeamId).in("status", ["completed", "forfeited", "abandoned"]).order("match_date", { ascending: false }),
        supabase.from("clubs").select("season_name").eq("id", activeClubId).single(),
        supabase.from("transactions").select("*, players(first_name, last_name, nickname, is_active)").eq("club_id", activeClubId)
      ]);

      const clubSeason = clubRes.data?.season_name || null;
      let allFixtures = fixRes.data || [];
      let allTx = txRes.data || [];

      // Determine available seasons
      const seasonsSet = new Set<string>();
      allFixtures.forEach(f => {
        if (f.season_name) seasonsSet.add(f.season_name);
        else if (clubSeason) {
          f.season_name = clubSeason;
          seasonsSet.add(clubSeason);
        }
      });
      allTx.forEach(t => {
        if (t.season_name) seasonsSet.add(t.season_name);
        else if (clubSeason) {
          t.season_name = clubSeason;
          seasonsSet.add(clubSeason);
        }
      });
      
      const uniqueSeasons = Array.from(seasonsSet).sort((a, b) => b.localeCompare(a));
      setAvailableSeasons(uniqueSeasons);

      let activeViewSeason = selectedSeason;
      if (!activeViewSeason) {
        if (uniqueSeasons.includes(clubSeason)) activeViewSeason = clubSeason;
        else if (uniqueSeasons.length > 0) activeViewSeason = uniqueSeasons[0];
        else activeViewSeason = null;
        
        setSelectedSeason(activeViewSeason);
      }

      const filteredFixtures = activeViewSeason === 'all' 
        ? allFixtures 
        : allFixtures.filter(f => f.season_name === activeViewSeason);
      
      const filteredTx = activeViewSeason === 'all'
        ? allTx
        : allTx.filter(t => t.season_name === activeViewSeason);

      setFixtures(filteredFixtures);

      // Financial Math
      let totalCashIn = 0;
      let totalCardIn = 0;
      let totalExpenses = 0;

      const auditMap: Record<string, any> = {};
      filteredFixtures.forEach(f => {
        auditMap[f.id] = { id: f.id, opponent: f.opponent, match_date: f.match_date, fee: 0, cash: 0, card: 0, net: 0 };
      });

      const balances: Record<string, any> = {};
      const teamPlayersData = allPlayers.filter(p => p.default_team_id === selectedTeamId);

      teamPlayersData.forEach(p => {
        balances[p.id] = { 
          id: p.id, 
          name: p.nickname || \`\${p.first_name} \${p.last_name?.charAt(0) || ''}.\`.trim(), 
          full_name: \`\${p.first_name} \${p.last_name}\`, 
          is_active: p.is_active,
          owed: 0,
          total_paid: 0,
          total_fees: 0
        };
      });

      filteredTx.forEach(tx => {
        // Global Tracking for Season Wallet Math
        if (tx.team_id === selectedTeamId) {
            if (tx.transaction_type === 'payment') {
              if (tx.payment_method?.toLowerCase().includes('card') || tx.payment_method?.toLowerCase().includes('square')) totalCardIn += Number(tx.amount);
              else totalCashIn += Number(tx.amount);
          }
          if (tx.transaction_type === 'expense') {
            totalExpenses += Number(tx.amount);
          }
        }

        // Match Specific Math
        if (tx.fixture_id && auditMap[tx.fixture_id]) {
            if (tx.transaction_type === 'payment') {
              if (tx.payment_method?.toLowerCase().includes('cash')) auditMap[tx.fixture_id].cash += Number(tx.amount);
              if (tx.payment_method?.toLowerCase().includes('card') || tx.payment_method?.toLowerCase().includes('square')) auditMap[tx.fixture_id].card += Number(tx.amount);
            }
          if (tx.transaction_type === 'expense') auditMap[tx.fixture_id].fee += Number(tx.amount);
        }

        // Player Math
        if (tx.player_id && tx.players) {
          if (!balances[tx.player_id]) {
            balances[tx.player_id] = { 
              id: tx.player_id, 
              name: tx.players.nickname || \`\${tx.players.first_name} \${tx.players.last_name?.charAt(0) || ''}.\`.trim(), 
              full_name: \`\${tx.players.first_name} \${tx.players.last_name}\`, 
              is_active: tx.players.is_active,
              owed: 0,
              total_paid: 0,
              total_fees: 0
            };
          }
          if (tx.transaction_type === 'fee') {
            balances[tx.player_id].owed += Number(tx.amount);
            balances[tx.player_id].total_fees += Number(tx.amount);
          }
          if (tx.transaction_type === 'payment') {
            balances[tx.player_id].owed -= Number(tx.amount);
            balances[tx.player_id].total_paid += Number(tx.amount);
          }
        }
      });

      const auditArray = Object.values(auditMap).map(m => {
        m.net = m.cash + m.card - m.fee;
        return m;
      }).sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime());

      setSeasonAudit(auditArray);
      
      setSeasonWallet({ cash: totalCashIn - totalExpenses, card: totalCardIn });
      setOverallNet((totalCashIn + totalCardIn) - totalExpenses);
      
      const teamFeedTransactions = filteredTx.filter(tx => tx.team_id === selectedTeamId || (tx.player_id && !tx.fixture_id));
      const activeTeamPlayerIds = new Set(teamFeedTransactions.filter(tx => tx.player_id).map(tx => tx.player_id));
      const filteredBalances = Object.values(balances).filter((b: any) => {
          const isDefaultTeam = allPlayers.find(p => p.id === b.id)?.default_team_id === selectedTeamId;
          return isDefaultTeam || activeTeamPlayerIds.has(b.id);
      });

      const sortedBalances = filteredBalances.sort((a: any, b: any) => {
        if (b.owed !== a.owed) return b.owed - a.owed;
        return a.name.localeCompare(b.name);
      });
      setPlayerBalances(sortedBalances);

      setIsLoading(false);
    }

    fetchHistory();
  }, [selectedTeamId, activeClubId, selectedSeason, allPlayers]);

  // Fetch match squad when a fixture is expanded
  const handleExpand = async (fixtureId: string) => {
    if (expandedFixtureId === fixtureId) {
      setExpandedFixtureId(null);
      return;
    }
    
    setExpandedFixtureId(fixtureId);
    
    if (!squadData[fixtureId]) {
      const { data } = await supabase.from("match_squads").select("player_id").eq("fixture_id", fixtureId);
      if (data) {
        const squadPlayers = data.map(s => {
          const p = allPlayers.find(pl => pl.id === s.player_id);
          return p ? (p.nickname || \`\${p.first_name} \${p.last_name?.charAt(0) || ''}.\`.trim()) : "Unknown Player";
        });
        setSquadData(prev => ({ ...prev, [fixtureId]: squadPlayers }));
      }
    }
  };

  if (isLoading && fixtures.length === 0 && allPlayers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Loading History...</p>
      </div>
    );
  }

  if (teams.length === 0 && !isLoading) {
    return (
      <div className="p-10 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl mt-6 shadow-sm mx-4">
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">You are not assigned to manage any teams yet.</p>
      </div>
    );
  }

  const totalOutstanding = playerBalances.reduce((sum: number, p: any) => sum + (p.owed > 0 ? p.owed : 0), 0);
  const totalCollected = playerBalances.reduce((sum: number, p: any) => sum + p.total_paid, 0);

  return (
    <div className="animate-in fade-in duration-300 space-y-6 pb-20 relative">
      
      {/* Filters Header */}
      <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm flex flex-col gap-4 mt-2 mx-1">
         <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800/50 pb-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 flex items-center justify-center">
               <i className="fa-solid fa-clock-rotate-left text-sm"></i>
            </div>
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">Season History</h2>
         </div>

         <div className="grid grid-cols-2 gap-3">
            {teams.length > 1 && (
               <div>
                  <label className="text-[10px] uppercase font-black tracking-widest text-emerald-600 dark:text-emerald-500 block mb-1.5 ml-1">Team</label>
                  <select 
                     value={selectedTeamId} 
                     onChange={(e) => setSelectedTeamId(e.target.value)}
                     className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-zinc-900 dark:text-white outline-none font-bold transition-colors cursor-pointer"
                  >
                     {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
               </div>
            )}
            
            <div className={teams.length === 1 ? "col-span-2" : ""}>
               <label className="text-[10px] uppercase font-black tracking-widest text-emerald-600 dark:text-emerald-500 block mb-1.5 ml-1">Season Filter</label>
               <select 
                  value={selectedSeason || ""} 
                  onChange={(e) => setSelectedSeason(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-zinc-900 dark:text-white outline-none font-bold transition-colors cursor-pointer"
               >
                  <option value="all">All Seasons</option>
                  {availableSeasons.map(s => <option key={s} value={s}>{s}</option>)}
               </select>
            </div>
         </div>
      </div>

      {/* Financial Health Box */}
      {!isLoading && fixtures.length > 0 && (
         <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm mx-1">
            <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800/50 pb-3 mb-5">
               <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 flex items-center justify-center">
                  <i className="fa-solid fa-heart-pulse text-sm"></i>
               </div>
               <h2 className="text-sm font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">Financial Health</h2>
            </div>
            
            <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-zinc-100 dark:divide-zinc-800 border-b border-zinc-100 dark:border-zinc-800/50 pb-5 mb-5">
               <div className="flex-1 text-center py-4 sm:py-0">
                  <div className="text-4xl font-black text-emerald-500 mb-1">$\{(totalCollected + seasonWallet.cash + seasonWallet.card).toFixed(0)}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500">Fees Collected</div>
                  <div className="text-[10px] text-zinc-500 font-bold mt-1">\${seasonWallet.cash.toFixed(0)} Cash | \${seasonWallet.card.toFixed(0)} Card</div>
               </div>
               <div className="flex-1 text-center py-4 sm:py-0">
                  <div className="text-4xl font-black text-red-500 mb-1">\${totalOutstanding.toFixed(0)}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-500">Outstanding Debts</div>
                  <div className="text-[10px] text-zinc-500 font-bold mt-1">\{playerBalances.filter(p => p.owed > 0).length} Players Owe</div>
               </div>
            </div>

            <div className="flex justify-between items-start mb-2 px-1">
               <h2 className="text-[11px] font-black uppercase italic tracking-widest text-emerald-600 dark:text-emerald-500">Season Audit</h2>
               <div className="flex flex-col items-end">
                  <button 
                     onClick={() => setIsWalletExpanded(!isWalletExpanded)}
                     className={\`bg-zinc-50 dark:bg-zinc-800/50 rounded-xl px-3 py-1.5 text-[11px] font-black border border-zinc-200 dark:border-zinc-700 transition-colors flex items-center gap-2 \${overallNet >= 0 ? 'text-emerald-500' : 'text-red-500'}\`}
                  >
                     \${overallNet.toFixed(0)} NET
                     <i className={\`fa-solid fa-chevron-\${isWalletExpanded ? 'up' : 'down'} text-[10px] text-zinc-400\`}></i>
                  </button>
               </div>
            </div>

            {isWalletExpanded && (
               <div className="pb-4 animate-in slide-in-from-top-2">
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/50 grid grid-cols-2 gap-4">
                     <div>
                        <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">CASH</div>
                        <div className={\`text-xl font-black \${seasonWallet.cash < 0 ? 'text-red-500' : 'text-emerald-500'}\`}>\${seasonWallet.cash.toFixed(0)}</div>
                     </div>
                     <div>
                        <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">CARD</div>
                        <div className={\`text-xl font-black \${seasonWallet.card < 0 ? 'text-red-500' : 'text-blue-500'}\`}>\${seasonWallet.card.toFixed(0)}</div>
                     </div>
                  </div>
               </div>
            )}

            <div className="w-full overflow-x-auto">
               <table className="w-full text-left text-[11px] font-bold">
                  <thead>
                     <tr className="text-zinc-500 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800">
                        <th className="pb-3 w-[40%]">VS</th>
                        <th className="pb-3 text-center">FEE</th>
                        <th className="pb-3 text-center">CASH</th>
                        <th className="pb-3 text-center">CARD</th>
                        <th className="pb-3 text-right">NET</th>
                     </tr>
                  </thead>
                  <tbody>
                     {seasonAudit.map((audit) => {
                        const isExpanded = expandedFixtureId === audit.id;

                        return (
                           <Fragment key={audit.id}>
                              <tr onClick={() => handleExpand(audit.id)} className={\`border-b transition-colors cursor-pointer \${isExpanded ? 'border-transparent bg-zinc-50 dark:bg-zinc-800/50' : 'border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 last:border-0'}\`}>
                                 <td className="py-4 text-zinc-900 dark:text-white flex items-center gap-2 pr-2">
                                    <i className={\`fa-solid fa-chevron-\${isExpanded ? 'up' : 'down'} text-[9px] text-zinc-400 shrink-0\`}></i>
                                    <span className="truncate max-w-[100px] sm:max-w-none">{audit.opponent}</span>
                                 </td>
                                 <td className="py-4 text-center text-zinc-500 dark:text-zinc-400">\${audit.fee}</td>
                                 <td className="py-4 text-center text-emerald-500">\${audit.cash}</td>
                                 <td className="py-4 text-center text-blue-500 dark:text-blue-400">\${audit.card}</td>
                                 <td className={\`py-4 text-right \${audit.net < 0 ? 'text-red-500' : 'text-emerald-500'}\`}>\${audit.net}</td>
                              </tr>

                              {isExpanded && (
                                 <tr className="bg-zinc-50/50 dark:bg-[#111] border-b border-zinc-200 dark:border-zinc-800">
                                    <td colSpan={5} className="p-0">
                                       <div className="p-4 animate-in slide-in-from-top-2 fade-in duration-200">
                                          <div className="bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 p-4 rounded-xl shadow-sm mb-4">
                                             <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 border-b border-zinc-100 dark:border-zinc-700/50 pb-2">Where's the Money?</h4>
                                             <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                   <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">CASH</div>
                                                   <div className={\`text-lg font-black \${(audit.cash - audit.fee) < 0 ? 'text-red-500' : 'text-emerald-500'}\`}>\${audit.cash - audit.fee}</div>
                                                   <div className="text-[9px] text-zinc-500 font-bold mt-0.5">(\${audit.cash} Cash - \${audit.fee} Fee)</div>
                                                </div>
                                                <div>
                                                   <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">CARD</div>
                                                   <div className="text-lg font-black text-blue-500">\${audit.card}</div>
                                                </div>
                                             </div>
                                          </div>

                                          <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 mb-3 flex items-center gap-2">
                                             <i className="fa-solid fa-clipboard-check"></i> Match Squad ({squadData[audit.id]?.length || 0})
                                          </h4>
                                          
                                          {!squadData[audit.id] ? (
                                             <div className="text-center py-4">
                                                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                             </div>
                                          ) : squadData[audit.id].length === 0 ? (
                                             <p className="text-xs text-zinc-500 italic">No squad recorded for this match.</p>
                                          ) : (
                                             <div className="flex flex-wrap gap-2">
                                                {squadData[audit.id].map((playerName: string, idx: number) => (
                                                   <span key={idx} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm">
                                                      {playerName}
                                                   </span>
                                                ))}
                                             </div>
                                          )}
                                       </div>
                                    </td>
                                 </tr>
                              )}
                           </Fragment>
                        );
                     })}
                  </tbody>
               </table>
            </div>
         </div>
      )}
    </div>
  );
}
`;

fs.writeFileSync('C:/Users/ashle/fees-please-v3/components/SeasonHistory.tsx', code);
console.log('Successfully wrote SeasonHistory.tsx');
