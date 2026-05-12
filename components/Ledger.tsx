"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { useActiveClub } from "@/contexts/ClubContext";

export default function Ledger() {
  const { profile, roles } = useProfile();
  const { activeClubId } = useActiveClub();

  const [teams, setTeams] = useState<any[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string>("");
  
  const [allPlayers, setAllPlayers] = useState<any[]>([]); 
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  
  const [seasonAudit, setSeasonAudit] = useState<any[]>([]);
  const [playerBalances, setPlayerBalances] = useState<any[]>([]);
  const [overallNet, setOverallNet] = useState(0);
  const [seasonWallet, setSeasonWallet] = useState({ cash: 0, card: 0 });
  const [isLoading, setIsLoading] = useState(false);

  // Player Accounts & Feed States
  const [viewMode, setViewMode] = useState<'debts' | 'all'>('debts');
  const [isListExpanded, setIsListExpanded] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [showAllAudit, setShowAllAudit] = useState(false); 
  const [searchTerm, setSearchTerm] = useState(""); 
  const [visibleFeedCount, setVisibleFeedCount] = useState(10);

  // Accordion States (Replacing Modals)
  const [expandedFixtureId, setExpandedFixtureId] = useState<string | null>(null);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [isInlineManualFormOpen, setIsInlineManualFormOpen] = useState(false);
  const [isWalletExpanded, setIsWalletExpanded] = useState(false);
  
  // Global Manual Log State
  const [isGlobalManualFormOpen, setIsGlobalManualFormOpen] = useState(false);
  const [globalSelectedPlayerId, setGlobalSelectedPlayerId] = useState("team");
  
  // Form States
  const [manualType, setManualType] = useState<'payment' | 'fee'>('payment');
  const [manualFixtureId, setManualFixtureId] = useState("");
  const [manualAmount, setManualAmount] = useState<number | "">("");
  const [manualNote, setManualNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000); 
  };

  useEffect(() => {
    if (activeClubId) {
      supabase.from('players').select('id, first_name, last_name, nickname, default_team_id').eq('club_id', activeClubId).order('first_name').then(({data}) => {
        if (data) setAllPlayers(data);
      });
    }
  }, [activeClubId]);

  useEffect(() => {
    async function fetchTeams() {
      if (!profile) return;
      setIsLoading(true);
      let query = supabase.from("teams").select("*");
      
      if (profile.role === 'club_admin' || profile.role === 'super_admin') {
        if (activeClubId) query = query.eq('club_id', activeClubId);
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
        if (data.length === 1) setActiveTeamId(data[0].id);
        else if (data.length > 0 && !data.find(t => t.id === activeTeamId)) setActiveTeamId(""); 
      }
      setIsLoading(false);
    }
    fetchTeams();
  }, [profile, roles, activeClubId]);

  async function fetchLedger() {
    if (!activeTeamId) return;
    setIsLoading(true);
    
    const [fixRes, txRes, playersRes] = await Promise.all([
      supabase.from("fixtures").select("*").eq("team_id", activeTeamId).order("match_date", { ascending: false }),
      supabase.from("transactions").select(`*, players ( id, first_name, last_name, nickname ), fixtures ( opponent )`).eq("team_id", activeTeamId).order("created_at", { ascending: false }),
      supabase.from("players").select('id, first_name, last_name, nickname').eq("default_team_id", activeTeamId)
    ]);

    const fixData = fixRes.data || [];
    const txData = txRes.data || [];
    const teamPlayersData = playersRes.data || [];

    setFixtures(fixData);
    setTransactions(txData);

    let totalCashIn = 0;
    let totalCardIn = 0;
    let totalExpenses = 0;

    const auditMap: Record<string, any> = {};
    fixData.forEach(f => { auditMap[f.id] = { ...f, cash: 0, card: 0, fee: 0, net: 0 }; });

    const balances: Record<string, any> = {};

    teamPlayersData.forEach(p => {
      balances[p.id] = { 
        id: p.id, 
        name: p.nickname || `${p.first_name} ${p.last_name?.charAt(0) || ''}.`.trim(), 
        full_name: `${p.first_name} ${p.last_name}`, 
        owed: 0,
        total_paid: 0,
        total_fees: 0
      };
    });

    txData.forEach(tx => {
      // Global Tracking for Season Wallet Math
      if (tx.transaction_type === 'payment') {
        if (tx.payment_method === 'card') totalCardIn += Number(tx.amount);
        else totalCashIn += Number(tx.amount);
      }
      if (tx.transaction_type === 'expense') {
        totalExpenses += Number(tx.amount);
      }

      if (tx.fixture_id && auditMap[tx.fixture_id]) {
        if (tx.transaction_type === 'payment') {
          if (tx.payment_method === 'cash') auditMap[tx.fixture_id].cash += Number(tx.amount);
          if (tx.payment_method === 'card') auditMap[tx.fixture_id].card += Number(tx.amount);
        }
        if (tx.transaction_type === 'expense') auditMap[tx.fixture_id].fee += Number(tx.amount);
      }

      if (tx.player_id && tx.players) {
        if (!balances[tx.player_id]) {
          balances[tx.player_id] = { 
            id: tx.player_id, 
            name: tx.players.nickname || `${tx.players.first_name} ${tx.players.last_name?.charAt(0) || ''}.`.trim(), 
            full_name: `${tx.players.first_name} ${tx.players.last_name}`, 
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
    
    // Set actual overall wallet position (captures global txs as well as fixture txs)
    setSeasonWallet({ cash: totalCashIn - totalExpenses, card: totalCardIn });
    setOverallNet((totalCashIn + totalCardIn) - totalExpenses);
    
    setPlayerBalances(Object.values(balances).sort((a: any, b: any) => {
      if (b.owed !== a.owed) return b.owed - a.owed;
      return a.name.localeCompare(b.name);
    }));
    
    setIsLoading(false);
  }

  useEffect(() => { fetchLedger(); }, [activeTeamId]);

  // --- DERIVED GROUPED FEED ---
  const groupedFeed = useMemo(() => {
    const map = new Map();
    const groups: any[] = [];
    
    transactions.forEach(tx => {
      const dateObj = new Date(tx.created_at);
      const dateKey = dateObj.toLocaleDateString('en-GB'); 
      const isPlayer = !!tx.player_id;
      const groupKey = isPlayer ? `${dateKey}_${tx.player_id}` : `${dateKey}_expense_${tx.id}`;

      if (!map.has(groupKey)) {
        const newGroup = {
          id: groupKey,
          date: dateObj,
          dateString: dateKey,
          player_id: tx.player_id,
          player_name: tx.players ? (tx.players.nickname || `${tx.players.first_name} ${tx.players.last_name?.charAt(0) || ''}.`.trim()) : (tx.description || 'Club Expense'),
          paid: 0,
          fee: 0,
          expense: 0,
          isPlayer: isPlayer,
        };
        map.set(groupKey, newGroup);
        groups.push(newGroup);
      }

      const g = map.get(groupKey);
      if (tx.transaction_type === 'payment') g.paid += Number(tx.amount);
      if (tx.transaction_type === 'fee') g.fee += Number(tx.amount);
      if (tx.transaction_type === 'expense') g.expense += Number(tx.amount);
    });

    return groups.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [transactions]);

  // --- DERIVED EXPANDED FIXTURE DATA ---
  const expandedFixtureTx = expandedFixtureId ? transactions.filter(tx => tx.fixture_id === expandedFixtureId) : [];
  const fixturePlayerMap = new Map();
  const fixtureOtherTx: any[] = [];
  
  expandedFixtureTx.forEach(tx => {
    if (tx.player_id) {
      if (!fixturePlayerMap.has(tx.player_id)) {
        fixturePlayerMap.set(tx.player_id, {
          id: tx.player_id,
          name: tx.players ? (tx.players.nickname || `${tx.players.first_name} ${tx.players.last_name?.charAt(0) || ''}.`.trim()) : 'Unknown Player',
          paid: 0,
          fee: 0
        });
      }
      const p = fixturePlayerMap.get(tx.player_id);
      if (tx.transaction_type === 'payment') p.paid += Number(tx.amount);
      if (tx.transaction_type === 'fee') p.fee += Number(tx.amount);
    } else {
      fixtureOtherTx.push(tx);
    }
  });

  const groupedFixturePlayers = Array.from(fixturePlayerMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  // --- SMOOTH SCROLL FROM FEED ---
  const scrollToPlayer = (playerId: string) => {
    setViewMode('all');
    setAccountSearch("");
    setIsListExpanded(true);
    setExpandedPlayerId(playerId);
    setIsInlineManualFormOpen(false);
    setTimeout(() => {
      const el = document.getElementById(`player-acc-${playerId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  async function handleManualSave(e: React.FormEvent, targetPlayerId: string, isGlobal: boolean) {
    e.preventDefault();
    if (!manualAmount || isSaving || !activeClubId) return;
    setIsSaving(true);

    const pId = targetPlayerId === 'team' || !targetPlayerId ? null : targetPlayerId;
    const txType = !pId && manualType === 'fee' ? 'expense' : manualType;

    const payload = {
      player_id: pId,
      team_id: activeTeamId,
      club_id: activeClubId,
      fixture_id: manualFixtureId || null,
      amount: Number(manualAmount),
      transaction_type: txType,
      payment_method: txType === 'payment' ? (manualNote.toLowerCase().includes('card') ? 'card' : 'cash') : null,
      description: manualNote || `Manual ${txType}`
    };

    const { error } = await supabase.from("transactions").insert([payload]);
    
    if (error) {
      showToast("Error saving transaction: " + error.message, 'error');
    } else {
      await fetchLedger();
      setManualAmount("");
      setManualNote("");
      setManualFixtureId("");
      setVisibleFeedCount(10); 
      
      if (isGlobal) {
        setIsGlobalManualFormOpen(false);
        setGlobalSelectedPlayerId("team");
      } else {
        setIsInlineManualFormOpen(false);
      }
      showToast("Transaction Recorded!");
    }
    setIsSaving(false);
  }

  // --- UI FILTER LOGIC ---
  const filteredAccounts = playerBalances.filter(p => {
    if (viewMode === 'debts' && p.owed <= 0.01) return false;
    if (accountSearch) {
      const term = accountSearch.toLowerCase();
      return p.full_name.toLowerCase().includes(term) || p.name.toLowerCase().includes(term);
    }
    return true;
  });

  const displayedAccounts = (!isListExpanded && !accountSearch) ? filteredAccounts.slice(0, 3) : filteredAccounts;
  const hiddenAccountsCount = filteredAccounts.length - displayedAccounts.length;

  const filteredFeed = groupedFeed.filter(g => g.player_name.toLowerCase().includes(searchTerm.toLowerCase()));
  const displayedFeed = filteredFeed.slice(0, visibleFeedCount);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pastGames = seasonAudit
    .filter(a => ['completed', 'forfeited', 'abandoned'].includes(a.status) || new Date(a.match_date + 'T00:00:00').getTime() < today.getTime())
    .sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime());

  const futureGames = seasonAudit
    .filter(a => !['completed', 'forfeited', 'abandoned'].includes(a.status) && new Date(a.match_date + 'T00:00:00').getTime() >= today.getTime())
    .sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime());

  const nextGame = futureGames.length > 0 ? futureGames[0] : null;
  const relevantAudit = nextGame ? [nextGame, ...pastGames] : pastGames;
  const displayedAudit = showAllAudit ? relevantAudit : relevantAudit.slice(0, 4);

  if (!activeClubId) return <div className="p-4 text-center text-zinc-500 uppercase tracking-widest text-xs font-black">Loading Ledger...</div>;

  return (
    <div className="animate-in fade-in duration-300 space-y-6 pb-20 relative">
      
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-lg z-[100] animate-in slide-in-from-bottom-5 fade-in ${toast.type === 'success' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'} font-black uppercase tracking-widest text-[10px] whitespace-nowrap flex items-center gap-2`}>
          <i className={`fa-solid ${toast.type === 'success' ? 'fa-check' : 'fa-triangle-exclamation'}`}></i>
          {toast.msg}
        </div>
      )}

      {teams.length > 1 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm transition-colors">
          <label className="text-[10px] uppercase font-black tracking-widest text-emerald-600 dark:text-emerald-500 block mb-2 ml-1">Viewing Ledger As</label>
          <select value={activeTeamId} onChange={(e) => setActiveTeamId(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none font-bold transition-colors">
            <option value="" disabled>-- Select a Team --</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {activeTeamId && !isLoading ? (
        <>
          {/* --- SEASON AUDIT --- */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm relative overflow-hidden transition-colors">
            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-600 dark:bg-emerald-500 z-10"></div>
            
            <div className="flex justify-between items-center p-5 mb-2">
              <h2 className="text-sm font-black uppercase italic tracking-widest text-emerald-600 dark:text-emerald-500">Season Audit</h2>
              <div className="flex flex-col items-end">
                <button 
                  onClick={() => setIsWalletExpanded(!isWalletExpanded)}
                  className={`bg-zinc-50 dark:bg-zinc-800 rounded-xl px-3 py-1.5 text-sm font-black border border-zinc-200 dark:border-zinc-700 transition-colors flex items-center gap-2 ${overallNet >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
                >
                  ${overallNet.toFixed(0)} NET
                  <i className={`fa-solid fa-chevron-${isWalletExpanded ? 'up' : 'down'} text-[10px] text-zinc-400`}></i>
                </button>
              </div>
            </div>

            {/* EXPANDABLE SEASON WALLET MATH */}
            {isWalletExpanded && (
              <div className="px-5 pb-4 animate-in slide-in-from-top-2">
                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/50 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Cash in Tin</div>
                    <div className={`text-xl font-black ${seasonWallet.cash < 0 ? 'text-red-500' : 'text-emerald-500'}`}>${seasonWallet.cash.toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Square / Card</div>
                    <div className={`text-xl font-black ${seasonWallet.card < 0 ? 'text-red-500' : 'text-blue-500'}`}>${seasonWallet.card.toFixed(0)}</div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="w-full overflow-x-auto px-5 pb-5">
              <table className="w-full text-left text-[11px] font-bold">
                <thead>
                  <tr className="text-zinc-500 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 transition-colors">
                    <th className="pb-3 w-[40%]">VS</th>
                    <th className="pb-3 text-center">FEE</th>
                    <th className="pb-3 text-center">CASH</th>
                    <th className="pb-3 text-center">CARD</th>
                    <th className="pb-3 text-right">NET</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedAudit.map((audit) => {
                    const isNextGame = nextGame && audit.id === nextGame.id;
                    const isExpanded = expandedFixtureId === audit.id;

                    return (
                      <Fragment key={audit.id}>
                        <tr onClick={() => setExpandedFixtureId(isExpanded ? null : audit.id)} className={`border-b transition-colors cursor-pointer ${isExpanded ? 'border-transparent bg-zinc-50 dark:bg-zinc-800/50' : 'border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 last:border-0'}`}>
                          <td className="py-4 text-zinc-900 dark:text-white flex items-center gap-2 pr-2">
                            <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-[9px] text-zinc-400 shrink-0`}></i>
                            <span className="truncate max-w-[100px] sm:max-w-none">{audit.opponent}</span>
                            {isNextGame && (
                              <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[8px] px-1.5 py-0.5 rounded-md uppercase tracking-widest font-black shrink-0">Next</span>
                            )}
                          </td>
                          <td className="py-4 text-center text-zinc-500 dark:text-zinc-400">${audit.fee}</td>
                          <td className="py-4 text-center text-emerald-500">${audit.cash}</td>
                          <td className="py-4 text-center text-blue-500 dark:text-blue-400">${audit.card}</td>
                          <td className={`py-4 text-right ${audit.net < 0 ? 'text-red-500' : 'text-emerald-500'}`}>${audit.net}</td>
                        </tr>

                        {/* INLINE FIXTURE AUDIT ACCORDION */}
                        {isExpanded && (
                          <tr className="bg-zinc-50/50 dark:bg-[#111] border-b border-zinc-200 dark:border-zinc-800">
                            <td colSpan={5} className="p-0">
                              <div className="p-4 animate-in slide-in-from-top-2 fade-in duration-200">
                                
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 px-1">Player Breakdown</h4>
                                <div className="space-y-2">
                                  {groupedFixturePlayers.map(p => {
                                    const net = p.paid - p.fee;
                                    return (
                                      <div key={p.id} className="bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 p-3 rounded-xl flex justify-between items-center shadow-sm transition-colors">
                                        <div>
                                          <div className="text-xs font-bold text-zinc-900 dark:text-white">{p.name}</div>
                                          <div className="text-[9px] font-black uppercase tracking-widest mt-1 flex gap-2">
                                            <span className="text-emerald-600 dark:text-emerald-500">Paid: ${p.paid}</span>
                                            <span className="text-zinc-300 dark:text-zinc-700">•</span>
                                            <span className="text-red-500/80">Fee: ${p.fee}</span>
                                          </div>
                                        </div>
                                        <span className={`text-sm font-black ${net >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                          {net > 0 ? '+' : ''}${net}
                                        </span>
                                      </div>
                                    );
                                  })}
                                  
                                  {fixtureOtherTx.map(tx => (
                                    <div key={tx.id} className="bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700/50 p-3 rounded-xl flex justify-between items-center transition-colors">
                                      <div>
                                        <div className="text-xs font-bold text-zinc-900 dark:text-white">{tx.description || 'Match Expense'}</div>
                                        <div className="text-[9px] font-black uppercase tracking-widest mt-1 text-zinc-500">Other / Umpire</div>
                                      </div>
                                      <span className="text-sm font-black text-red-500">-${tx.amount}</span>
                                    </div>
                                  ))}

                                  {groupedFixturePlayers.length === 0 && fixtureOtherTx.length === 0 && (
                                    <div className="text-center py-4 text-zinc-400 dark:text-zinc-500 text-[10px] uppercase font-bold tracking-widest">
                                      No activity recorded
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              {relevantAudit.length === 0 && (
                <div className="text-center py-6 text-zinc-400 dark:text-zinc-500 text-[10px] uppercase font-bold tracking-widest">
                  No fixtures found
                </div>
              )}
            </div>

            {relevantAudit.length > 4 && (
              <button 
                onClick={() => setShowAllAudit(!showAllAudit)}
                className="w-full pb-5 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                {showAllAudit ? 'Show Less' : `Show All History (${pastGames.length})`}
              </button>
            )}
          </div>

          {/* --- PLAYER ACCOUNTS / ROSTER HUB --- */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm overflow-hidden transition-colors" id="player-accounts-section">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[11px] font-black uppercase italic tracking-widest text-zinc-800 dark:text-zinc-200">
                Player Accounts
              </h2>
              <button 
                onClick={() => { 
                  setViewMode(prev => prev === 'debts' ? 'all' : 'debts'); 
                  setIsListExpanded(false);
                  setAccountSearch(""); 
                }} 
                className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
              >
                {viewMode === 'debts' ? 'Show All Accounts' : 'Show Debts Only'}
              </button>
            </div>

            {viewMode === 'all' && (
              <div className="mb-4 animate-in slide-in-from-top-2 fade-in">
                <div className="relative w-full">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs"></i>
                  <input 
                    type="text" 
                    placeholder="Search player..." 
                    value={accountSearch} 
                    onChange={(e) => setAccountSearch(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-9 pr-4 py-3 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              {displayedAccounts.length === 0 ? (
                <p className="text-xs text-zinc-500 font-bold uppercase text-center py-6 tracking-widest">
                  {viewMode === 'all' ? "No players found." : "All clear! No debts."}
                </p>
              ) : (
                displayedAccounts.map((player) => {
                  const isExpanded = expandedPlayerId === player.id;
                  
                  return (
                    <div key={player.id} id={`player-acc-${player.id}`} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm transition-all group">
                      <button 
                        onClick={() => {
                          setExpandedPlayerId(isExpanded ? null : player.id);
                          setIsInlineManualFormOpen(false);
                        }} 
                        className="w-full flex justify-between items-center p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-emerald-500 transition-colors">
                            {player.name}
                          </div>
                          <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mt-1 flex gap-2">
                            <span className="text-emerald-600 dark:text-emerald-500">Paid: ${player.total_paid.toFixed(0)}</span>
                            <span className="text-zinc-300 dark:text-zinc-700">•</span>
                            <span className="text-red-500/80">Fees: ${player.total_fees.toFixed(0)}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right flex items-center gap-3">
                          <div>
                            {player.owed > 0.01 ? (
                              <span className="text-sm font-black text-red-500">-${player.owed.toFixed(0)}</span>
                            ) : player.owed < -0.01 ? (
                              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Credit +${Math.abs(player.owed).toFixed(0)}</span>
                            ) : (
                              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Settled</span>
                            )}
                          </div>
                          <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-[10px] text-zinc-400`}></i>
                        </div>
                      </button>

                      {/* INLINE PLAYER HISTORY ACCORDION */}
                      {isExpanded && (
                        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#111] animate-in slide-in-from-top-2 fade-in duration-200">
                          {isInlineManualFormOpen ? (
                            <form onSubmit={(e) => handleManualSave(e, player.id, false)} className="space-y-4 animate-in slide-in-from-right-4">
                              <div className="flex bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-1 transition-colors">
                                <button type="button" onClick={() => setManualType('payment')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${manualType === 'payment' ? 'bg-emerald-600 dark:bg-emerald-500 text-white shadow-sm' : 'text-zinc-500'}`}>Payment (+)</button>
                                <button type="button" onClick={() => setManualType('fee')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${manualType === 'fee' ? 'bg-white dark:bg-zinc-700 text-red-500 shadow-sm' : 'text-zinc-500'}`}>Charge (-)</button>
                              </div>

                              <select value={manualFixtureId} onChange={e => setManualFixtureId(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none font-bold transition-colors">
                                <option value="">-- Optional: Assign to Match --</option>
                                {fixtures.map(f => (
                                  <option key={f.id} value={f.id}>vs {f.opponent} ({new Date(f.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})</option>
                                ))}
                              </select>

                              <input type="number" placeholder="Amount ($)" value={manualAmount} onChange={e => setManualAmount(Number(e.target.value))} className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-4 text-center text-xl font-black text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" required />
                              <input type="text" placeholder="Method / Note (e.g. Fine, Cash, Refund)" value={manualNote} onChange={e => setManualNote(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                              
                              <button type="submit" disabled={isSaving} className="w-full bg-emerald-600 dark:bg-emerald-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs transition-all active:scale-95 shadow-md disabled:opacity-50 mt-2">
                                {isSaving ? 'Saving...' : 'Confirm Transaction'}
                              </button>
                              <button type="button" onClick={() => setIsInlineManualFormOpen(false)} className="w-full text-[10px] text-zinc-500 hover:text-zinc-900 dark:hover:text-white uppercase font-black py-2 tracking-widest transition-colors">Back to History</button>
                            </form>
                          ) : (
                            <div className="space-y-3">
                              <button onClick={() => { setIsInlineManualFormOpen(true); setManualAmount(""); setManualNote(""); setManualFixtureId(""); }} className="w-full bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 mb-2">
                                <i className="fa-solid fa-plus text-sm"></i> Add Manual Transaction
                              </button>
                              
                              {groupedFeed.filter(g => g.player_id === player.id).map(group => {
                                const net = group.paid - group.fee;
                                return (
                                  <div key={group.id} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-3.5 rounded-xl flex justify-between items-center transition-colors">
                                    <div className="flex-1">
                                      <div className="text-[10px] font-black uppercase text-zinc-900 dark:text-white">
                                          {group.dateString}
                                      </div>
                                      <div className="text-[9px] font-black uppercase tracking-widest mt-1 text-zinc-500 flex gap-2">
                                         <span className="text-emerald-500">Paid: ${group.paid}</span>
                                         <span>•</span>
                                         <span className="text-red-500/80">Fee: ${group.fee}</span>
                                      </div>
                                    </div>
                                    <span className={`text-sm font-black shrink-0 ml-4 ${net >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {net > 0 ? '+' : ''}${net.toFixed(0)}
                                    </span>
                                  </div>
                                );
                              })}

                              {groupedFeed.filter(g => g.player_id === player.id).length === 0 && (
                                  <p className="text-center text-zinc-400 dark:text-zinc-600 text-[10px] uppercase font-black py-6 transition-colors">No history found.</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              
              {hiddenAccountsCount > 0 && (
                <button 
                  onClick={() => setIsListExpanded(true)}
                  className="w-full py-3 mt-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  Show {hiddenAccountsCount} More {viewMode === 'debts' ? 'Debts' : 'Accounts'}
                </button>
              )}
            </div>
          </div>

          {/* --- RECENT TRANSACTIONS (PAGINATED & CONDENSED) --- */}
          <div className="space-y-4">
            
            <button
              onClick={() => {
                setIsGlobalManualFormOpen(!isGlobalManualFormOpen);
                setManualType('payment');
                setManualAmount("");
                setManualNote("");
                setManualFixtureId("");
                setGlobalSelectedPlayerId("team");
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"
            >
              <i className={`fa-solid ${isGlobalManualFormOpen ? 'fa-chevron-up' : 'fa-plus'} text-sm`}></i>
              {isGlobalManualFormOpen ? 'Hide Manual Transaction' : 'Log Manual Transaction'}
            </button>

            {/* INLINE GLOBAL MANUAL FORM */}
            {isGlobalManualFormOpen && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm animate-in slide-in-from-top-2 fade-in">
                <form onSubmit={(e) => handleManualSave(e, globalSelectedPlayerId, true)} className="space-y-4">
                   <div className="flex bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-1 transition-colors">
                     <button type="button" onClick={() => setManualType('payment')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${manualType === 'payment' ? 'bg-emerald-600 dark:bg-emerald-500 text-white shadow-sm' : 'text-zinc-500'}`}>Money In (+)</button>
                     <button type="button" onClick={() => setManualType('fee')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${manualType === 'fee' ? 'bg-white dark:bg-zinc-700 text-red-500 shadow-sm' : 'text-zinc-500'}`}>Money Out (-)</button>
                   </div>

                   <select value={globalSelectedPlayerId} onChange={e => setGlobalSelectedPlayerId(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none font-bold transition-colors">
                     <option value="team">-- No Player (Team Expense / Revenue) --</option>
                     {allPlayers.map(p => (
                       <option key={p.id} value={p.id}>{p.nickname || `${p.first_name} ${p.last_name}`}</option>
                     ))}
                   </select>

                   <select value={manualFixtureId} onChange={e => setManualFixtureId(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none font-bold transition-colors">
                     <option value="">-- Optional: Assign to Match --</option>
                     {fixtures.map(f => (
                       <option key={f.id} value={f.id}>vs {f.opponent} ({new Date(f.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})</option>
                     ))}
                   </select>

                   <input type="number" placeholder="Amount ($)" value={manualAmount} onChange={e => setManualAmount(Number(e.target.value))} className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-4 text-center text-xl font-black text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" required />
                   <input type="text" placeholder="Method / Note (e.g. Bunnings Sausage Sizzle, Cash)" value={manualNote} onChange={e => setManualNote(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                   
                   <button type="submit" disabled={isSaving} className="w-full bg-emerald-600 dark:bg-emerald-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs transition-all active:scale-95 shadow-md disabled:opacity-50 mt-2">
                     {isSaving ? 'Saving...' : 'Confirm Transaction'}
                   </button>
                </form>
              </div>
            )}

            <div className="flex justify-between items-end px-1 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-600 italic">Recent Activity</h2>
              <div className="relative w-1/2">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 text-[10px]"></i>
                <input 
                  type="text" 
                  placeholder="Filter Ledger..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full pl-8 pr-3 py-1.5 text-[10px] text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-700 transition-colors shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              {displayedFeed.map(group => {
                const net = group.paid - group.fee;
                return (
                  <div 
                    key={group.id} 
                    onClick={() => group.isPlayer ? scrollToPlayer(group.player_id) : null} 
                    className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex justify-between items-center shadow-sm transition-colors ${group.isPlayer ? 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50' : ''}`}
                  >
                    <div className="flex-1">
                      <div className="font-bold text-zinc-900 dark:text-white text-sm">
                        {group.player_name}
                      </div>
                      <div className="text-[9px] font-black uppercase tracking-widest mt-1 text-zinc-500 flex items-center gap-2">
                        <span>{group.dateString}</span>
                        {group.isPlayer && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-500">Paid: ${group.paid}</span>
                            <span>•</span>
                            <span className="text-red-500/80">Fee: ${group.fee}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right ml-4">
                      {group.isPlayer ? (
                        <span className={`text-sm font-black ${net >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {net > 0 ? '+' : ''}${net.toFixed(0)}
                        </span>
                      ) : (
                        <span className="text-sm font-black text-red-500">
                          -${group.expense.toFixed(0)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {displayedFeed.length === 0 && (
                <p className="text-center text-zinc-400 dark:text-zinc-600 text-[10px] uppercase font-black py-8 transition-colors">No activity found.</p>
              )}
            </div>

            {visibleFeedCount < filteredFeed.length && (
              <button 
                onClick={() => setVisibleFeedCount(prev => prev + 10)}
                className="w-full py-4 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400 transition-colors shadow-sm"
              >
                Load More History
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="text-center p-10 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/50 rounded-xl transition-colors">
          <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">{teams.length === 0 ? "No teams available" : "Select a team above"}</p>
        </div>
      )}
    </div>
  );
}