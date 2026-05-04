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

  // Aggregated Data States
  const [financials, setFinancials] = useState({ collected: 0, cash: 0, card: 0, outstanding: 0 });
  const [topDebtors, setTopDebtors] = useState<any[]>([]);
  const [topCredits, setTopCredits] = useState<any[]>([]);
  const [sponsorStats, setSponsorStats] = useState({ impressions: 0, clicks: 0, ctr: 0 });
  const [fixtureAvail, setFixtureAvail] = useState<any[]>([]);
  
  // UI States
  const [expandedFixtureId, setExpandedFixtureId] = useState<string | null>(null);

  // Modal States for "Select Team"
  const [isSquadModalOpen, setIsSquadModalOpen] = useState(false);
  const [activeSquadFixture, setActiveSquadFixture] = useState<any>(null);
  const [squadPlayerIds, setSquadPlayerIds] = useState<string[]>([]);
  const [modalAvailData, setModalAvailData] = useState<any[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const isClubAdmin = profile?.role === 'super_admin' || roles?.some((r: any) => r.role === 'club_admin' && r.club_id === activeClubId);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Helper to format names cleanly
  const formatName = (p: any) => p.nickname ? p.nickname : `${p.first_name} ${p.last_name?.charAt(0) || ''}.`;

  useEffect(() => {
    async function fetchDashboardData() {
      if (!profile || !activeClubId) return;
      setIsLoading(true);

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
  }, [profile, activeClubId, selectedTeamId, roles, isClubAdmin]);

  // --- MODAL LOGIC ---
  async function openSquadModal(fixture: any) { 
    setActiveSquadFixture(fixture); 
    setPlayerSearch(""); 
    
    const { data: squadData } = await supabase.from("match_squads").select("player_id").eq("fixture_id", fixture.id); 
    setSquadPlayerIds(squadData ? squadData.map(row => row.player_id) : []); 

    const { data: availData } = await supabase.from("availability").select("player_id, status").eq("fixture_id", fixture.id);
    setModalAvailData(availData || []);

    setIsSquadModalOpen(true); 
  }

  function toggleSquadPlayer(playerId: string) { 
    setSquadPlayerIds(prev => prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]); 
  }
  
  async function saveSquad() { 
    setIsSaving(true); 
    await supabase.from("match_squads").delete().eq("fixture_id", activeSquadFixture.id); 
    if (squadPlayerIds.length > 0) { 
      const inserts = squadPlayerIds.map(playerId => ({ fixture_id: activeSquadFixture.id, player_id: playerId })); 
      const { error } = await supabase.from("match_squads").insert(inserts); 
      if (error) showToast(error.message, "error"); 
      else showToast("Match Team Locked In!"); 
    } else {
      showToast("Match Team Cleared!");
    }
    setIsSaving(false); 
    setIsSquadModalOpen(false); 
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

                     {/* Expanded Roster Lists & Select Team Action */}
                     {isExpanded && (
                        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111] animate-in slide-in-from-top-2 fade-in duration-200">
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
                           
                           {/* 👇 THE NEW SELECT TEAM BUTTON */}
                           <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 mt-2">
                             <button 
                               onClick={(e) => { e.stopPropagation(); openSquadModal(f); }} 
                               className="w-full py-3.5 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 transition-colors flex items-center justify-center gap-2"
                             >
                               <i className="fa-solid fa-clipboard-check text-xs"></i> Select Team
                             </button>
                           </div>
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

      {/* SQUAD SELECTION MODAL */}
      {isSquadModalOpen && activeSquadFixture && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 transition-colors">
          <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 w-full max-w-[440px] rounded-3xl overflow-hidden flex flex-col max-h-[85vh] shadow-2xl animate-in slide-in-from-bottom-8 transition-colors">
            <div className="p-5 flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 transition-colors">
              <h2 className="text-lg font-black italic text-emerald-600 dark:text-emerald-500 uppercase tracking-tighter">SELECT TEAM</h2>
              <button onClick={() => setIsSquadModalOpen(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1 space-y-6 pb-24">
              <input 
                type="text" 
                placeholder="Search across club..." 
                value={playerSearch || ""} 
                onChange={(e) => setPlayerSearch(e.target.value)} 
                className="w-full bg-zinc-50 dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors font-bold" 
              />

              {['yes', 'maybe', 'no_reply', 'no'].map((section) => {
                const sectionPlayers = clubPlayers.filter(p => {
                  const avail = modalAvailData.find(a => a.player_id === p.id);
                  const status = avail ? avail.status : 'no_reply';
                  const isRelevant = p.default_team_id === activeSquadFixture.team_id || squadPlayerIds.includes(p.id) || avail !== undefined;
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

                return (
                  <div key={section}>
                    <h3 className={`text-[10px] font-black uppercase tracking-widest ${config.color} mb-3 flex items-center gap-2`}>
                      <i className={`fa-solid ${config.icon}`}></i> {config.label}
                    </h3>
                    <div className="flex flex-wrap gap-2.5">
                      {sectionPlayers.map(p => {
                        const isSelected = squadPlayerIds.includes(p.id);
                        return (
                          <button 
                            key={p.id} 
                            onClick={() => toggleSquadPlayer(p.id)} 
                            disabled={isSaving} 
                            className={`px-4 py-3 rounded-xl font-black text-[11px] uppercase transition-all flex items-center gap-2 ${isSelected ? 'text-white bg-emerald-600 dark:bg-emerald-500 scale-[1.02] shadow-[0_0_15px_rgba(16,185,129,0.3)] border-transparent' : 'bg-white dark:bg-[#1A1A1A] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-400 dark:hover:border-zinc-600'} disabled:opacity-50`}
                          >
                            {formatName(p)}
                            {isSelected ? <i className="fa-solid fa-check text-[10px]"></i> : <i className="fa-solid fa-plus text-[10px] opacity-50"></i>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="p-5 border-t border-zinc-100 dark:border-zinc-800 flex gap-3 bg-zinc-50 dark:bg-[#111] transition-colors">
              <button onClick={() => setIsSquadModalOpen(false)} className="flex-1 py-4 rounded-xl text-xs font-black uppercase text-zinc-600 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-900 hover:bg-zinc-300 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
              <button onClick={saveSquad} disabled={isSaving} className="flex-1 py-4 rounded-xl text-xs font-black uppercase text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-md">
                {isSaving ? 'Saving...' : 'Save Match Squad'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}