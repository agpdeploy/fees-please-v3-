"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";

interface TeamWalletTabProps {
  clubId: string;
  teams: any[];
  showToast: (msg: string, type?: "success" | "error") => void;
  planTier: string;
}

export default function TeamWalletTab({ clubId, teams, showToast, planTier }: TeamWalletTabProps) {
  const { profile, roles } = useProfile();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [playerContributions, setPlayerContributions] = useState<any[]>([]);
  const [teamWalletInfo, setTeamWalletInfo] = useState({ totalKitty: 0, totalDebts: 0, netBalance: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [inlineAction, setInlineAction] = useState<{ playerId: string, type: 'expense' | 'reward' } | null>(null);
  const [inlineForm, setInlineForm] = useState<{ name: string, amount: string }>({ name: '', amount: '' });
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc'|'desc' }>({ key: 'nkc', direction: 'desc' });

  // Role Checks
  const isSuperAdmin = profile?.role === 'super_admin';
  const isClubAdmin = roles?.some(r => r.club_id === clubId && (r.role === 'club_admin' || r.role === 'super_admin')) || isSuperAdmin;
  const manageableTeams = isClubAdmin ? teams : teams.filter(t => roles?.some(r => r.team_id === t.id && r.role === 'team_admin'));

  useEffect(() => {
    if (manageableTeams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(manageableTeams[0].id);
    }
  }, [manageableTeams]);

  const fetchData = async (silent = false) => {
    if (!clubId || !selectedTeamId) return;
    if (!silent) setIsLoading(true);

    const [txRes, playersRes] = await Promise.all([
      supabase.from("transactions").select("*, players(first_name, last_name, nickname, is_active)").eq("club_id", clubId).eq("team_id", selectedTeamId),
      supabase.from("players").select("*").eq("club_id", clubId).eq("default_team_id", selectedTeamId)
    ]);

    const txs = txRes.data || [];
    const players = playersRes.data || [];

    // 1. Calculate Match Costs
    // Map of fixture_id -> { expense: number, player_count: number }
    const fixtureStats: Record<string, { expense: number, player_count: number }> = {};
    
    txs.forEach(tx => {
      if (tx.fixture_id) {
        if (!fixtureStats[tx.fixture_id]) fixtureStats[tx.fixture_id] = { expense: 0, player_count: 0 };
        if (tx.transaction_type === 'expense') fixtureStats[tx.fixture_id].expense += Number(tx.amount);
        if (tx.transaction_type === 'fee' && Number(tx.amount) >= 0) fixtureStats[tx.fixture_id].player_count += 1;
      }
    });

    const balances: Record<string, any> = {};
    players.forEach(p => {
      balances[p.id] = { 
        id: p.id, 
        name: p.nickname || `${p.first_name} ${p.last_name?.charAt(0) || ''}.`.trim(), 
        real_paid: 0, 
        expected_cost: 0,
        games_played: 0,
        match_cost_share: 0,
        kitty_expenses: 0,
        kitty_rewards: 0,
        surplus: 0,
        nkc: 0
      };
    });

    let totalRealIncome = 0;
    let totalAllExpenses = 0;

    txs.forEach(tx => {
      if (tx.transaction_type === 'payment' && tx.payment_method !== 'kitty') totalRealIncome += Number(tx.amount);
      if (tx.transaction_type === 'expense') totalAllExpenses += Number(tx.amount);

      if (tx.player_id && tx.players) {
        if (!balances[tx.player_id]) {
          balances[tx.player_id] = { 
            id: tx.player_id, 
            name: tx.players.nickname || `${tx.players.first_name} ${tx.players.last_name?.charAt(0) || ''}.`.trim(), 
            real_paid: 0, expected_cost: 0, games_played: 0, match_cost_share: 0, kitty_expenses: 0, kitty_rewards: 0, surplus: 0, nkc: 0
          };
        }
        
        const b = balances[tx.player_id];
        
        if (tx.transaction_type === 'fee') {
            b.expected_cost += Number(tx.amount);
            if (tx.fixture_id && Number(tx.amount) >= 0) {
                b.games_played += 1;
                const stats = fixtureStats[tx.fixture_id];
                if (stats && stats.player_count > 0) {
                    b.match_cost_share += (stats.expense / stats.player_count);
                }
            }
        }
        
        if (tx.transaction_type === 'payment') {
            if (tx.payment_method === 'kitty') b.kitty_rewards += Number(tx.amount);
            else b.real_paid += Number(tx.amount);
        }

        if (tx.transaction_type === 'expense' && tx.payment_method === 'kitty') {
            b.kitty_expenses += Number(tx.amount);
        }
      }
    });

    let totalDebts = 0;
    Object.values(balances).forEach(b => {
      b.surplus = (b.real_paid + b.kitty_rewards) - b.expected_cost;
      b.nkc = b.real_paid - b.match_cost_share - b.kitty_expenses;
      if (b.surplus < 0) totalDebts += Math.abs(b.surplus);
    });

    const dataArr = Object.values(balances);
    setPlayerContributions(dataArr);

    const totalKitty = totalRealIncome - totalAllExpenses;
    setTeamWalletInfo({ totalKitty, totalDebts, netBalance: totalKitty });
    
    if (!silent) setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [clubId, selectedTeamId]);

  const handleSaveInlineAction = async (playerId: string) => {
    if (!inlineForm.name || !inlineForm.amount) return showToast("Please fill in all fields", "error");
    setIsSaving(true);

    try {
      const txsToInsert: any[] = [];
      const amount = parseFloat(inlineForm.amount.toString());
      
      if (inlineAction?.type === 'expense') {
          txsToInsert.push({
              club_id: clubId,
              team_id: selectedTeamId,
              player_id: playerId,
              amount: amount,
              transaction_type: 'expense',
              payment_method: 'kitty',
              description: inlineForm.name
          });
      } else if (inlineAction?.type === 'reward') {
          const descName = inlineForm.name || 'Reward';
          txsToInsert.push({
              club_id: clubId,
              team_id: selectedTeamId,
              player_id: playerId,
              amount: amount,
              transaction_type: 'expense',
              payment_method: 'kitty',
              description: `${descName} (Cost)`
          });
          txsToInsert.push({
              club_id: clubId,
              team_id: selectedTeamId,
              player_id: playerId,
              amount: amount,
              transaction_type: 'payment',
              payment_method: 'kitty',
              description: `${descName} (Credit)`
          });
      }

      const { error } = await supabase.from('transactions').insert(txsToInsert);
      if (error) throw error;
      
      showToast("Logged successfully! Balances updated.");
      setInlineAction(null);
      fetchData(true);
    } catch(err: any) {
      showToast(err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSort = (key: string) => {
      if (sortConfig.key === key) {
          setSortConfig({ key, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' });
      } else {
          setSortConfig({ key, direction: 'desc' });
      }
  };

  const sortedContributions = [...playerContributions].sort((a, b) => {
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];
    if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
    }
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  if (planTier === 'free') {
    return (
      <div className="p-10 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
        <div className="w-12 h-12 mx-auto bg-amber-100 dark:bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mb-4">
          <i className="fa-solid fa-wallet text-xl"></i>
        </div>
        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white mb-2">Team Wallet Locked</h3>
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-6">Upgrade to Plus to manage team funds and player contributions.</p>
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('navigate-setup', { detail: 'billing' }))}
          className="mx-auto py-3 px-6 rounded-xl font-black uppercase tracking-widest text-xs text-amber-900 bg-amber-400 hover:bg-amber-300 shadow-md transition-all flex items-center justify-center gap-2"
        >
          <i className="fa-solid fa-lock"></i> Upgrade to Plus
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">Team Wallet</h2>
          <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Manage team kitty & surplus</p>
        </div>
        
        {manageableTeams.length > 1 && (
          <select 
            value={selectedTeamId} 
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-900 dark:text-white outline-none font-bold transition-colors cursor-pointer min-w-[200px]"
          >
            {manageableTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="p-10 flex justify-center"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
        <>
          {/* Top Section: The Big Picture */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500">Team Kitty</p>
                <p className="text-3xl font-black text-emerald-600 dark:text-emerald-500 mt-1">${teamWalletInfo.totalKitty.toFixed(0)}</p>
              </div>
              <i className="fa-solid fa-piggy-bank absolute -right-4 -bottom-4 text-7xl opacity-10 text-emerald-600"></i>
            </div>
            
            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-500">Outstanding Debts</p>
                <p className="text-3xl font-black text-zinc-900 dark:text-white mt-1">${teamWalletInfo.totalDebts.toFixed(0)}</p>
              </div>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Net Team Balance</p>
                <p className="text-3xl font-black text-zinc-900 dark:text-white mt-1">${teamWalletInfo.netBalance.toFixed(0)}</p>
              </div>
            </div>
          </div>

          {/* Middle Section: Player Contribution Breakdown */}
          <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800/50 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white">Player Breakdown</h3>
            </div>

            {/* Sort Headers */}
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/50 bg-white dark:bg-[#111] flex text-[10px] uppercase font-black tracking-widest text-zinc-500 overflow-x-auto hide-scrollbar">
                <div className="flex-1 min-w-[100px] flex items-center gap-1 cursor-pointer hover:text-zinc-900 dark:hover:text-white" onClick={() => handleSort('name')}>
                    Player {sortConfig.key === 'name' && <i className={`fa-solid fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'}`}></i>}
                </div>
                <div className="w-16 text-center flex items-center justify-center gap-1 cursor-pointer hover:text-zinc-900 dark:hover:text-white" onClick={() => handleSort('games_played')}>
                    Games {sortConfig.key === 'games_played' && <i className={`fa-solid fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'}`}></i>}
                </div>
                <div className="w-20 text-center flex items-center justify-center gap-1 cursor-pointer hover:text-zinc-900 dark:hover:text-white" onClick={() => handleSort('real_paid')}>
                    Paid {sortConfig.key === 'real_paid' && <i className={`fa-solid fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'}`}></i>}
                </div>
                <div className="w-20 text-center flex items-center justify-center gap-1 cursor-pointer hover:text-zinc-900 dark:hover:text-white" onClick={() => handleSort('nkc')}>
                    NKC {sortConfig.key === 'nkc' && <i className={`fa-solid fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'}`}></i>}
                </div>
                <div className="w-24 text-right flex items-center justify-end gap-1 cursor-pointer hover:text-zinc-900 dark:hover:text-white" onClick={() => handleSort('surplus')}>
                    Status {sortConfig.key === 'surplus' && <i className={`fa-solid fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'}`}></i>}
                </div>
            </div>

            {/* Player Rows */}
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                {sortedContributions.map(p => (
                    <div key={p.id} className="flex flex-col hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                        <div 
                            className="px-4 py-4 flex items-center cursor-pointer select-none"
                            onClick={() => setExpandedPlayerId(expandedPlayerId === p.id ? null : p.id)}
                        >
                            <div className="flex-1 min-w-[100px] text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                <i className={`fa-solid fa-chevron-${expandedPlayerId === p.id ? 'down' : 'right'} text-[10px] text-zinc-400 w-3`}></i>
                                <span className="truncate">{p.name}</span>
                            </div>
                            <div className="w-16 text-center text-xs text-zinc-500 font-bold">{p.games_played}</div>
                            <div className="w-20 text-center text-xs text-zinc-600 dark:text-zinc-400 font-bold">${p.real_paid.toFixed(0)}</div>
                            <div className={`w-20 text-center text-xs font-black ${p.nkc > 0 ? 'text-emerald-500' : p.nkc < 0 ? 'text-red-500' : 'text-zinc-500'}`}>
                                {p.nkc > 0 ? '+' : ''}{p.nkc === 0 ? '$0' : `$${p.nkc.toFixed(2)}`}
                            </div>
                            <div className="w-24 text-right flex justify-end">
                              {p.surplus >= 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 text-[9px] uppercase font-black tracking-widest">
                                      Surplus
                                  </span>
                              ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 text-[9px] uppercase font-black tracking-widest">
                                      Owes ${Math.abs(p.surplus).toFixed(0)}
                                  </span>
                              )}
                            </div>
                        </div>

                        {expandedPlayerId === p.id && (
                            <div className="px-10 pb-5 pt-1 text-xs animate-in slide-in-from-top-2 duration-200">
                                <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 space-y-2 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                                    <div className="flex justify-between text-zinc-600 dark:text-zinc-400 font-bold">
                                        <span>Real Money Paid</span>
                                        <span className="text-zinc-900 dark:text-white">${p.real_paid.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-zinc-600 dark:text-zinc-400 font-bold">
                                        <span>Match Cost Share</span>
                                        <span className="text-zinc-900 dark:text-white">-${p.match_cost_share.toFixed(2)}</span>
                                    </div>
                                    {p.kitty_rewards > 0 && (
                                      <div className="flex justify-between text-zinc-600 dark:text-zinc-400 font-bold">
                                          <span>Kitty Rewards (Credit)</span>
                                          <span className="text-emerald-500">+${p.kitty_rewards.toFixed(2)}</span>
                                      </div>
                                    )}
                                    {p.kitty_expenses > 0 && (
                                      <div className="flex justify-between text-zinc-600 dark:text-zinc-400 font-bold">
                                          <span>Kitty Expenses (Cost)</span>
                                          <span className="text-red-500">-${p.kitty_expenses.toFixed(2)}</span>
                                      </div>
                                    )}
                                    <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-2"></div>
                                    <div className="flex justify-between text-[11px] font-black uppercase tracking-widest mb-4">
                                        <span className="text-zinc-500">Net Contribution</span>
                                        <span className={`${p.nkc > 0 ? 'text-emerald-500' : p.nkc < 0 ? 'text-red-500' : 'text-zinc-500'}`}>
                                            {p.nkc > 0 ? '+' : ''}${p.nkc.toFixed(2)}
                                        </span>
                                    </div>

                                    {inlineAction?.playerId === p.id ? (
                                      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 border border-zinc-200 dark:border-zinc-700 animate-in fade-in slide-in-from-top-1">
                                        <p className="text-[10px] font-bold text-zinc-500 mb-3 leading-relaxed">
                                          {inlineAction.type === 'expense' 
                                            ? 'Deducts from kitty and lowers net contribution. Does not increase personal debt.'
                                            : 'Deducts from kitty and credits player. Lowers net contribution, raises personal surplus.'}
                                        </p>
                                        <div className="flex flex-col gap-3">
                                          <div className="flex gap-2">
                                            <input 
                                              type="text" 
                                              placeholder={inlineAction.type === 'expense' ? "e.g. Team Jerseys" : "e.g. Free Game"}
                                              value={inlineForm.name}
                                              onChange={e => setInlineForm({...inlineForm, name: e.target.value})}
                                              className="flex-1 min-w-0 bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs outline-none font-bold"
                                            />
                                            <div className="relative w-24 shrink-0">
                                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-bold">$</span>
                                              <input 
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder="0.00"
                                                value={inlineForm.amount}
                                                onChange={e => setInlineForm({...inlineForm, amount: e.target.value})}
                                                className="w-full bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-lg pl-6 pr-3 py-2 text-xs outline-none font-bold"
                                              />
                                            </div>
                                          </div>
                                          <div className="flex gap-2">
                                            <button 
                                              onClick={() => handleSaveInlineAction(p.id)}
                                              disabled={isSaving || !inlineForm.name || !inlineForm.amount}
                                              className="flex-1 bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-emerald-600 disabled:opacity-50 transition-colors flex justify-center items-center h-9"
                                            >
                                              {isSaving ? <i className="fa-solid fa-spinner fa-spin"></i> : "Save"}
                                            </button>
                                            <button 
                                              onClick={() => setInlineAction(null)}
                                              className="flex-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-lg text-xs font-bold hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors flex justify-center items-center h-9"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex gap-2">
                                        <button 
                                          onClick={() => {
                                            setInlineAction({ playerId: p.id, type: 'expense' });
                                            setInlineForm({ name: '', amount: '' });
                                          }}
                                          className="flex-1 py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-widest text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2"
                                        >
                                          <i className="fa-solid fa-shirt"></i> Log Team Expense
                                        </button>
                                        <button 
                                          onClick={() => {
                                            setInlineAction({ playerId: p.id, type: 'reward' });
                                            const avgCost = p.games_played > 0 ? Math.floor(p.match_cost_share / p.games_played).toString() : '';
                                            setInlineForm({ name: '', amount: avgCost });
                                          }}
                                          className="flex-1 py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-widest text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors flex items-center justify-center gap-2"
                                        >
                                          <i className="fa-solid fa-gift"></i> Reward Player
                                        </button>
                                      </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {sortedContributions.length === 0 && (
                    <div className="px-5 py-8 text-center text-zinc-500 uppercase font-black tracking-widest text-[10px]">No players found.</div>
                )}
            </div>
          </div>
        </>
      )}


    </div>
  );
}
