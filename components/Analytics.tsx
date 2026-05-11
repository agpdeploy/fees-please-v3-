"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { useActiveClub } from "@/contexts/ClubContext";

export default function Analytics() {
  const { profile, roles } = useProfile();
  const { activeClubId } = useActiveClub();

  const [isLoading, setIsLoading] = useState(true);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("all");
  const [clubPlayers, setClubPlayers] = useState<any[]>([]);
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Aggregated Data States
  const [financials, setFinancials] = useState({ collected: 0, cash: 0, card: 0, outstanding: 0 });
  const [topDebtors, setTopDebtors] = useState<any[]>([]);
  const [topCredits, setTopCredits] = useState<any[]>([]);
  const [sponsorStats, setSponsorStats] = useState({ impressions: 0, clicks: 0, ctr: 0 });
  const [fixtureAvail, setFixtureAvail] = useState<any[]>([]);
  
  // UI States
  const [expandedFixtureId, setExpandedFixtureId] = useState<string | null>(null);

  // Inline "Manage Team" States
  const [managingFixtureId, setManagingFixtureId] = useState<string | null>(null);
  const [squadPlayerIds, setSquadPlayerIds] = useState<string[]>([]);
  const [modalAvailData, setModalAvailData] = useState<any[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [expandedPoolSections, setExpandedPoolSections] = useState<Record<string, boolean>>({ yes: true, maybe: true, no_reply: false, no: false });
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const isClubAdmin = profile?.role === 'super_admin' || roles?.some((r: any) => r.role === 'club_admin' && r.club_id === activeClubId);

  const canManageTeam = (teamId: string) => {
    return isClubAdmin || roles?.some((r: any) => r.role === 'team_admin' && r.team_id === teamId);
  };

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Helper to format names cleanly
  const formatName = (p: any) => p.nickname ? p.nickname : `${p.first_name} ${p.last_name?.charAt(0) || ''}.`;

  useEffect(() => {
    async function fetchDashboardData() {
      if (!profile || !activeClubId) return;
      if (refreshTrigger === 0) setIsLoading(true); // Only show full loader on initial mount

      // 1. Determine Teams
      let teamQuery = supabase.from("teams").select("id, name").eq("club_id", activeClubId);
      if (!isClubAdmin) {
        const allowedTeamIds = roles?.filter((r: any) => r.role === 'team_admin' && r.club_id === activeClubId).map((r: any) => r.team_id) || [];
        if (allowedTeamIds.length === 0) { setIsLoading(false); return; }
        teamQuery = teamQuery.in('id', allowedTeamIds);
      }
      
      const { data: teamData } = await teamQuery;
      const validTeams = teamData || [];
      setTeams(validTeams);
      const targetTeamIds = selectedTeamId === "all" ? validTeams.map(t => t.id) : [selectedTeamId];

      if (targetTeamIds.length === 0) { setIsLoading(false); return; }

      // Fetch all players
      const { data: playersData } = await supabase.from("players").select("id, first_name, last_name, nickname, default_team_id").eq("club_id", activeClubId);
      const allPlayers = playersData || [];
      setClubPlayers(allPlayers);

      // 2. Fetch Financials (Transactions)
      const { data: txData } = await supabase
        .from("transactions")
        .select("amount, transaction_type, payment_method, player_id")
        .in("team_id", targetTeamIds);

      let collected = 0, cash = 0, card = 0;
      const playerBalances: Record<string, { name: string, balance: number }> = {};

      if (txData) {
        txData.forEach(tx => {
          if (tx.transaction_type === 'payment') {
            collected += Number(tx.amount);
            if (tx.payment_method === 'card') card += Number(tx.amount);
            else cash += Number(tx.amount);
          }
          
          if (tx.player_id) {
            const player = allPlayers.find(p => p.id === tx.player_id);
            const name = player ? formatName(player) : "Unknown Player";
            if (!playerBalances[tx.player_id]) playerBalances[tx.player_id] = { name, balance: 0 };
            
            if (tx.transaction_type === 'fee') playerBalances[tx.player_id].balance += Number(tx.amount);
            if (tx.transaction_type === 'payment') playerBalances[tx.player_id].balance -= Number(tx.amount);
          }
        });
      }

      const totalOutstanding = Object.values(playerBalances).reduce((sum, p) => sum + (p.balance > 0 ? p.balance : 0), 0);
      const sortedBalances = Object.values(playerBalances).sort((a, b) => b.balance - a.balance);
      setTopDebtors(sortedBalances.filter(p => p.balance > 0).slice(0, 5));
      
      const sortedCredits = Object.values(playerBalances).filter(p => p.balance < 0).sort((a, b) => a.balance - b.balance);
      setTopCredits(sortedCredits.slice(0, 5));

      setFinancials({ collected, cash, card, outstanding: totalOutstanding });

      // 3. Fetch Sponsor Analytics
      const { data: sponsorData } = await supabase.from("sponsor_analytics").select("event_type").in("team_id", targetTeamIds);
      let imp = 0, clk = 0;
      if (sponsorData) {
        sponsorData.forEach(s => {
          if (s.event_type === 'impression') imp++;
          if (s.event_type === 'click') clk++;
        });
      }
      setSponsorStats({ impressions: imp, clicks: clk, ctr: imp > 0 ? (clk / imp) * 100 : 0 });

      // 4. Fetch Availability for Upcoming Matches
      const today = new Date().toISOString();
      const { data: fixtures } = await supabase
        .from("fixtures")
        .select("id, opponent, match_date, team_id")
        .in("team_id", targetTeamIds)
        .gte("match_date", today)
        .order("match_date", { ascending: true })
        .limit(5);

      if (fixtures && fixtures.length > 0) {
        const fixtureIds = fixtures.map(f => f.id);
        const { data: availData } = await supabase.from("availability").select("fixture_id, player_id, status").in("fixture_id", fixtureIds);

        const formattedAvail = fixtures.map(f => {
          const lists: Record<string, string[]> = { yes: [], maybe: [], no: [], pending: [] };
          const teamRoster = allPlayers.filter(p => p.default_team_id === f.team_id);
          const respondedPlayerIds = new Set();
          
          const fixtureAvails = availData?.filter(a => a.fixture_id === f.id) || [];
          
          fixtureAvails.forEach(a => {
            const player = allPlayers.find(p => p.id === a.player_id);
            if (player) {
               lists[a.status]?.push(formatName(player));
               respondedPlayerIds.add(player.id);
            }
          });

          teamRoster.forEach(p => {
             if (!respondedPlayerIds.has(p.id)) {
                lists.pending.push(formatName(p));
             }
          });

          const total = lists.yes.length + lists.maybe.length + lists.no.length + lists.pending.length;

          return { ...f, lists, total };
        });
        setFixtureAvail(formattedAvail);
      } else {
        setFixtureAvail([]);
      }

      setIsLoading(false);
    }

    fetchDashboardData();
  }, [profile, activeClubId, selectedTeamId, roles, isClubAdmin, refreshTrigger]);

  // --- INLINE SQUAD LOGIC ---
  async function toggleManageTeam(fixture: any) { 
    if (managingFixtureId === fixture.id) {
      setManagingFixtureId(null);
      return;
    }
    
    setIsProcessing(true);
    setPlayerSearch(""); 
    
    const { data: squadData } = await supabase.from("match_squads").select("player_id").eq("fixture_id", fixture.id); 
    setSquadPlayerIds(squadData ? squadData.map(row => row.player_id) : []); 

    const { data: availData } = await supabase.from("availability").select("player_id, status").eq("fixture_id", fixture.id);
    setModalAvailData(availData || []);

    setManagingFixtureId(fixture.id);
    setIsProcessing(false);
  }

  function toggleSquadPlayer(playerId: string) { 
    setSquadPlayerIds(prev => prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]); 
  }
  
  async function createAndAddPlayer(fullName: string, fixtureId: string) {
    if (!fixtureId) return;
    setIsSaving(true);
    try {
      const parts = fullName.trim().split(' ');
      const firstName = parts[0];
      const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '(Casual)';

      const { data: newPlayer, error: playerError } = await supabase
        .from('players')
        .insert([{
          first_name: firstName,
          last_name: lastName,
          club_id: activeClubId,
          is_member: false 
        }])
        .select()
        .single();

      if (playerError) throw playerError;

      if (newPlayer) {
        const { error: squadError } = await supabase.from("match_squads").insert([{ fixture_id: fixtureId, player_id: newPlayer.id }]);
        if (squadError) throw squadError;
        
        showToast("Player Created & Added");
        setPlayerSearch("");
        
        const { data } = await supabase.from("players").select("id, first_name, last_name, nickname, default_team_id").eq("club_id", activeClubId);
        if (data) setClubPlayers(data);
        
        setSquadPlayerIds(prev => [...prev, newPlayer.id]);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to create player", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveSquad(fixtureId: string) { 
    setIsSaving(true); 
    await supabase.from("match_squads").delete().eq("fixture_id", fixtureId); 
    if (squadPlayerIds.length > 0) { 
      const inserts = squadPlayerIds.map(playerId => ({ fixture_id: fixtureId, player_id: playerId })); 
      const { error } = await supabase.from("match_squads").insert(inserts); 
      if (error) showToast(error.message, "error"); 
      else showToast("Match Team Locked In!"); 
    } else {
      showToast("Match Team Cleared!");
    }
    
    setManagingFixtureId(null);
    setRefreshTrigger(prev => prev + 1); // Triggers a re-fetch to update the Dashboard numbers
    setIsSaving(false); 
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Crunching Data...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 space-y-6 pb-20 relative">
      
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-lg z-[100] animate-in slide-in-from-bottom-5 fade-in ${toast.type === 'success' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'} font-black uppercase tracking-widest text-[10px] whitespace-nowrap flex items-center gap-2`}>
          <i className={`fa-solid ${toast.type === 'success' ? 'fa-check' : 'fa-triangle-exclamation'}`}></i> {toast.msg}
        </div>
      )}

      {/* HEADER */}
      <div className="flex justify-between items-center bg-white dark:bg-[#111] p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative">
        <h1 className="text-lg font-black italic uppercase tracking-tighter text-emerald-600 dark:text-emerald-500">Insights</h1>
        {teams.length > 1 && (
          <select 
            value={selectedTeamId} 
            onChange={(e) => setSelectedTeamId(e.target.value)} 
            className="bg-zinc-50 dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors cursor-pointer"
          >
            <option value="all">Club Overview</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>

      {/* SECTION: FINANCIALS */}
      <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col gap-6">
         <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800/50 pb-3">
            <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 flex items-center justify-center">
               <i className="fa-solid fa-wallet text-sm"></i>
            </div>
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">Financial Health</h2>
         </div>

         <div className="grid grid-cols-2 gap-4">
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Fees Collected</p>
               <p className="text-3xl font-black text-emerald-600 dark:text-emerald-500">${financials.collected.toFixed(2)}</p>
               <div className="flex flex-col sm:flex-row gap-1 sm:gap-3 mt-2 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                  <span>Cash: ${financials.cash.toFixed(2)}</span>
                  <span className="hidden sm:inline">•</span>
                  <span>Card: ${financials.card.toFixed(2)}</span>
               </div>
            </div>
            <div className="border-l border-zinc-100 dark:border-zinc-800/80 pl-4">
               <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1">To Be Collected</p>
               <p className="text-3xl font-black text-red-500">${financials.outstanding.toFixed(2)}</p>
            </div>
         </div>

         {/* Debtors & Credits Breakdowns */}
         <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
                  <i className="fa-solid fa-triangle-exclamation text-red-500"></i> Top Debtors
               </p>
               {topDebtors.length === 0 ? (
                  <p className="text-xs font-bold text-zinc-400 italic">No outstanding debts.</p>
               ) : (
                  <div className="space-y-2">
                     {topDebtors.map((d, i) => (
                        <div key={i} className="flex justify-between text-xs font-bold bg-zinc-50 dark:bg-[#1A1A1A] p-2 rounded-lg border border-zinc-100 dark:border-zinc-800/50">
                           <span className="text-zinc-700 dark:text-zinc-300">{d.name}</span>
                           <span className="text-red-500">${d.balance.toFixed(2)}</span>
                        </div>
                     ))}
                  </div>
               )}
            </div>

            <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
                  <i className="fa-solid fa-piggy-bank text-emerald-500"></i> In Credit
               </p>
               {topCredits.length === 0 ? (
                  <p className="text-xs font-bold text-zinc-400 italic">No players in credit.</p>
               ) : (
                  <div className="space-y-2">
                     {topCredits.map((c, i) => (
                        <div key={i} className="flex justify-between text-xs font-bold bg-zinc-50 dark:bg-[#1A1A1A] p-2 rounded-lg border border-zinc-100 dark:border-zinc-800/50">
                           <span className="text-zinc-700 dark:text-zinc-300">{c.name}</span>
                           <span className="text-emerald-500 font-black">+${Math.abs(c.balance).toFixed(2)}</span>
                        </div>
                     ))}
                  </div>
               )}
            </div>
         </div>
      </div>

      {/* SECTION: PLAYER AVAILABILITY */}
      <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col gap-4">
         <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800/50 pb-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500 flex items-center justify-center">
               <i className="fa-solid fa-users-rays text-sm"></i>
            </div>
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">Player Availability</h2>
         </div>

         {fixtureAvail.length === 0 ? (
            <p className="text-xs font-bold text-zinc-500 text-center py-6">No upcoming fixtures found.</p>
         ) : (
            fixtureAvail.map(f => {
               const date = new Date(f.match_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
               const yesPct = f.total > 0 ? (f.lists.yes.length / f.total) * 100 : 0;
               const maybePct = f.total > 0 ? (f.lists.maybe.length / f.total) * 100 : 0;
               const noPct = f.total > 0 ? (f.lists.no.length / f.total) * 100 : 0;
               const isExpanded = expandedFixtureId === f.id;
               const isManaging = managingFixtureId === f.id;

               return (
                  <div key={f.id} className="bg-zinc-50 dark:bg-[#1A1A1A] rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-all">
                     <button 
                        onClick={() => setExpandedFixtureId(isExpanded ? null : f.id)}
                        className="w-full text-left p-4 focus:outline-none hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                     >
                        <div className="flex justify-between items-end mb-3">
                           <span className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wide">VS {f.opponent}</span>
                           <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{date}</span>
                        </div>
                        
                        {/* Interactive Stacked Progress Bar */}
                        <div className="w-full h-3.5 bg-zinc-200 dark:bg-zinc-900 rounded-full overflow-hidden flex shadow-inner">
                           <div style={{ width: `${yesPct}%` }} className="bg-emerald-500 h-full transition-all"></div>
                           <div style={{ width: `${maybePct}%` }} className="bg-amber-500 h-full transition-all"></div>
                           <div style={{ width: `${noPct}%` }} className="bg-red-500 h-full transition-all"></div>
                        </div>
                        
                        <div className="flex justify-between items-center mt-2">
                           <div className="flex gap-2 sm:gap-3 text-[9px] font-black uppercase tracking-widest">
                              <span className="text-emerald-600 dark:text-emerald-500">{f.lists.yes.length} IN</span>
                              <span className="text-amber-500">{f.lists.maybe.length} MAYBE</span>
                              <span className="text-red-500">{f.lists.no.length} OUT</span>
                              <span className="text-zinc-500">{f.lists.pending.length} PENDING</span>
                           </div>
                           <i className={`fa-solid fa-chevron-down text-zinc-400 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}></i>
                        </div>
                     </button>

                     {/* Expanded Roster Lists & Manage Team Inline Tool */}
                     {isExpanded && (
                        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111] animate-in slide-in-from-top-2 fade-in duration-200">
                           
                           {/* ROSTER DISPLAY */}
                           <div className="grid grid-cols-2 gap-4 mb-5">
                              {f.lists.yes.length > 0 && (
                                 <div>
                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-2 border-b border-emerald-500/20 pb-1">Playing</p>
                                    <ul className="text-xs font-bold text-zinc-700 dark:text-zinc-300 space-y-1">
                                       {f.lists.yes.map((name: string, i: number) => <li key={i}>{name}</li>)}
                                    </ul>
                                 </div>
                              )}
                              {f.lists.maybe.length > 0 && (
                                 <div>
                                    <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-2 border-b border-amber-500/20 pb-1">Maybe</p>
                                    <ul className="text-xs font-bold text-zinc-700 dark:text-zinc-300 space-y-1">
                                       {f.lists.maybe.map((name: string, i: number) => <li key={i}>{name}</li>)}
                                    </ul>
                                 </div>
                              )}
                              {f.lists.no.length > 0 && (
                                 <div>
                                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-2 border-b border-red-500/20 pb-1">Unavailable</p>
                                    <ul className="text-xs font-bold text-zinc-700 dark:text-zinc-300 space-y-1 line-through opacity-70">
                                       {f.lists.no.map((name: string, i: number) => <li key={i}>{name}</li>)}
                                    </ul>
                                 </div>
                              )}
                              {f.lists.pending.length > 0 && (
                                 <div>
                                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2 border-b border-zinc-200 dark:border-zinc-800 pb-1">No Reply</p>
                                    <ul className="text-xs font-bold text-zinc-500 dark:text-zinc-500 space-y-1">
                                       {f.lists.pending.map((name: string, i: number) => <li key={i}>{name}</li>)}
                                    </ul>
                                 </div>
                              )}
                           </div>
                           
                           {/* INLINE MANAGE TEAM BUTTON */}
                           {canManageTeam(f.team_id) && (
                             <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 mt-2">
                               <button 
                                 onClick={(e) => { e.stopPropagation(); toggleManageTeam(f); }} 
                                 disabled={isProcessing}
                                 className={`w-full py-2.5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl transition-all disabled:opacity-50 ${isManaging ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'border border-emerald-200 dark:border-emerald-500/20'}`}
                               >
                                 {isProcessing && managingFixtureId === f.id ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className={`fa-solid ${isManaging ? 'fa-chevron-up' : 'fa-user-plus'}`}></i>}
                                 {isManaging ? 'Hide Team' : 'Manage Team'}
                               </button>
                             </div>
                           )}

                           {/* INLINE MANAGE TEAM CONTENT */}
                           {isManaging && canManageTeam(f.team_id) && (
                             <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-top-2 overflow-hidden">
                               <input 
                                 type="text" 
                                 placeholder="Search or add a player..." 
                                 value={playerSearch || ""} 
                                 onChange={(e) => setPlayerSearch(e.target.value)} 
                                 className="w-full bg-zinc-50 dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors mb-4 shadow-sm" 
                               />

                               <div className="space-y-3">
                                 {/* CREATE ON THE FLY BUTTON */}
                                 {playerSearch.trim().length > 0 && !clubPlayers.some(p => `${p.first_name} ${p.last_name}`.toLowerCase() === playerSearch.trim().toLowerCase()) && (
                                   <button 
                                     onClick={() => createAndAddPlayer(playerSearch, f.id)}
                                     disabled={isSaving}
                                     className="w-full flex justify-between items-center bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors text-left group disabled:opacity-50"
                                   >
                                     <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                                       + Add "{playerSearch}"
                                     </span>
                                     <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/70 bg-emerald-200 dark:bg-emerald-900 px-2 py-1 rounded-md">New Casual</span>
                                   </button>
                                 )}

                                 {/* Categorized Sections */}
                                 {['yes', 'maybe', 'no_reply', 'no'].map((section) => {
                                   const sectionPlayers = clubPlayers.filter(p => {
                                     const avail = modalAvailData.find(a => a.player_id === p.id);
                                     const status = avail ? avail.status : 'no_reply';
                                     const isRelevant = p.default_team_id === f.team_id || squadPlayerIds.includes(p.id) || avail !== undefined;
                                     const matchesSearch = playerSearch ? `${p.first_name} ${p.last_name} ${p.nickname || ''}`.toLowerCase().includes(playerSearch.toLowerCase()) : true;

                                     return playerSearch ? (status === section && matchesSearch) : (status === section && isRelevant);
                                   });

                                   if (sectionPlayers.length === 0) return null;

                                   const config = {
                                     yes: { label: "Available", color: "text-emerald-500", icon: "fa-circle-check" },
                                     maybe: { label: "Maybe", color: "text-amber-500", icon: "fa-circle-question" },
                                     no_reply: { label: "No Reply", color: "text-zinc-400 dark:text-zinc-500", icon: "fa-circle" },
                                     no: { label: "Unavailable", color: "text-red-500", icon: "fa-circle-xmark" }
                                   }[section as 'yes' | 'maybe' | 'no_reply' | 'no'];

                                   const isSecExpanded = expandedPoolSections[section] || playerSearch.trim().length > 0;
                                   const toggleSec = () => setExpandedPoolSections(prev => ({...prev, [section]: !prev[section]}));

                                   return (
                                     <div key={section} className="mb-2">
                                       <button onClick={toggleSec} className="w-full flex items-center justify-between py-2 text-left group">
                                         <h3 className={`text-[10px] font-black uppercase tracking-widest ${config.color} flex items-center gap-2`}>
                                           <i className={`fa-solid ${config.icon}`}></i> {config.label} ({sectionPlayers.length})
                                         </h3>
                                         <i className={`fa-solid fa-chevron-${isSecExpanded ? 'up' : 'down'} text-[10px] text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors`}></i>
                                       </button>
                                       
                                       {isSecExpanded && (
                                         <div className="flex flex-wrap gap-2.5 pt-2 pb-1 animate-in fade-in">
                                           {sectionPlayers.map(p => {
                                             const isSelected = squadPlayerIds.includes(p.id);
                                             return (
                                               <button 
                                                 key={p.id} 
                                                 onClick={() => toggleSquadPlayer(p.id)} 
                                                 disabled={isSaving} 
                                                 className={`px-4 py-3 rounded-xl font-black text-[11px] uppercase transition-all flex items-center gap-2 ${isSelected ? 'text-white bg-emerald-600 dark:bg-emerald-500 scale-[1.02] shadow-[0_0_15px_rgba(16,185,129,0.3)] border-transparent' : 'bg-zinc-50 dark:bg-[#1A1A1A] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-400 dark:hover:border-zinc-600'} disabled:opacity-50`}
                                               >
                                                 {formatName(p)}
                                                 {isSelected ? <i className="fa-solid fa-check text-[10px]"></i> : <i className="fa-solid fa-plus text-[10px] opacity-50"></i>}
                                               </button>
                                             );
                                           })}
                                         </div>
                                       )}
                                     </div>
                                   );
                                 })}
                               </div>
                               
                               <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex gap-3">
                                 <button onClick={() => setManagingFixtureId(null)} className="flex-1 py-3 rounded-xl text-xs font-black uppercase text-zinc-600 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-900 hover:bg-zinc-300 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
                                 <button onClick={() => saveSquad(f.id)} disabled={isSaving} className="flex-1 py-3 rounded-xl text-xs font-black uppercase text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-md">
                                   {isSaving ? 'Saving...' : 'Save Team'}
                                 </button>
                               </div>
                             </div>
                           )}
                        </div>
                     )}
                  </div>
               );
            })
         )}
      </div>

      {/* SECTION: SPONSOR IMPACT */}
      <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col gap-6">
         <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800/50 pb-3">
            <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-500 flex items-center justify-center">
               <i className="fa-solid fa-bullhorn text-sm"></i>
            </div>
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">Sponsorship Impact</h2>
         </div>

         <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-50 dark:bg-[#1A1A1A] p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
               <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 flex items-center gap-2">
                  <i className="fa-solid fa-eye"></i> Impressions
               </p>
               <p className="text-2xl font-black text-zinc-900 dark:text-white">{sponsorStats.impressions}</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-500/10 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
               <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 mb-1 flex items-center gap-2">
                  <i className="fa-solid fa-hand-pointer"></i> CTR
               </p>
               <p className="text-2xl font-black text-emerald-600 dark:text-emerald-500">{sponsorStats.ctr.toFixed(1)}%</p>
               <p className="text-[9px] font-bold text-emerald-600/70 dark:text-emerald-500/70 mt-1 uppercase tracking-widest">{sponsorStats.clicks} Total Clicks</p>
            </div>
         </div>
      </div>
    </div>
  );
}