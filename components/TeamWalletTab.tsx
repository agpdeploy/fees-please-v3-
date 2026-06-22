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
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ name: 'Team Jerseys', costPerPlayer: 25, type: 'expense' as 'expense' | 'reward' });
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);

  // Role Checks
  const isSuperAdmin = profile?.role === 'super_admin';
  const isClubAdmin = roles?.some(r => r.club_id === clubId && (r.role === 'club_admin' || r.role === 'super_admin')) || isSuperAdmin;
  const manageableTeams = isClubAdmin ? teams : teams.filter(t => roles?.some(r => r.team_id === t.id && r.role === 'team_admin'));

  useEffect(() => {
    if (manageableTeams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(manageableTeams[0].id);
    }
  }, [manageableTeams]);

  const fetchData = async () => {
    if (!clubId || !selectedTeamId) return;
    setIsLoading(true);

    const [txRes, playersRes] = await Promise.all([
      supabase.from("transactions").select("*, players(first_name, last_name, nickname, is_active)").eq("club_id", clubId).eq("team_id", selectedTeamId),
      supabase.from("players").select("*").eq("club_id", clubId).eq("default_team_id", selectedTeamId)
    ]);

    const txs = txRes.data || [];
    const players = playersRes.data || [];

    const balances: Record<string, any> = {};
    players.forEach(p => {
      balances[p.id] = { 
        id: p.id, 
        name: p.nickname || `${p.first_name} ${p.last_name?.charAt(0) || ''}.`.trim(), 
        total_paid: 0, 
        expected_cost: 0,
        surplus: 0
      };
    });

    let totalCashIn = 0;
    let totalCardIn = 0;
    let totalExpenses = 0;

    txs.forEach(tx => {
      if (tx.transaction_type === 'payment') {
        if (tx.payment_method?.toLowerCase().includes('card') || tx.payment_method?.toLowerCase().includes('square')) totalCardIn += Number(tx.amount);
        else totalCashIn += Number(tx.amount);
      }
      if (tx.transaction_type === 'expense') {
        totalExpenses += Number(tx.amount);
      }

      if (tx.player_id && tx.players) {
        if (!balances[tx.player_id]) {
          balances[tx.player_id] = { 
            id: tx.player_id, 
            name: tx.players.nickname || `${tx.players.first_name} ${tx.players.last_name?.charAt(0) || ''}.`.trim(), 
            total_paid: 0, 
            expected_cost: 0,
            surplus: 0
          };
        }
        if (tx.transaction_type === 'fee') balances[tx.player_id].expected_cost += Number(tx.amount);
        if (tx.transaction_type === 'payment') balances[tx.player_id].total_paid += Number(tx.amount);
      }
    });

    let totalDebts = 0;
    Object.values(balances).forEach(b => {
      b.surplus = b.total_paid - b.expected_cost;
      if (b.surplus < 0) totalDebts += Math.abs(b.surplus);
    });

    const sortedBalances = Object.values(balances).sort((a: any, b: any) => b.surplus - a.surplus);
    setPlayerContributions(sortedBalances);
    setSelectedPlayerIds(sortedBalances.map(p => p.id));

    const totalKitty = (totalCashIn + totalCardIn) - totalExpenses;
    setTeamWalletInfo({ totalKitty, totalDebts, netBalance: totalKitty });
    
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [clubId, selectedTeamId]);

  const handleLogExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPlayerIds.length === 0) return showToast("Select at least one player.", "error");
    setIsSaving(true);

    try {
      const totalExpenseCost = expenseForm.costPerPlayer * selectedPlayerIds.length;
      const txsToInsert: any[] = [];
      
      // 1. Log the team expense to reduce the Kitty
      txsToInsert.push({
        club_id: clubId,
        team_id: selectedTeamId,
        amount: totalExpenseCost,
        transaction_type: 'expense',
        description: expenseForm.name,
        payment_method: 'kitty'
      });

      // 2. Add individual transactions for players
      selectedPlayerIds.forEach(playerId => {
         txsToInsert.push({
            club_id: clubId,
            team_id: selectedTeamId,
            player_id: playerId,
            amount: expenseForm.costPerPlayer,
            transaction_type: expenseForm.type === 'expense' ? 'fee' : 'payment',
            payment_method: expenseForm.type === 'expense' ? null : 'kitty',
            description: expenseForm.name
         });
      });

      const { error } = await supabase.from('transactions').insert(txsToInsert);
      if (error) throw error;
      
      showToast("Expense logged successfully! Balances updated.");
      setIsExpenseModalOpen(false);
      fetchData(); // Reload data
    } catch(err: any) {
      showToast(err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const togglePlayerSelection = (id: string) => {
    setSelectedPlayerIds(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

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

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => { setExpenseForm({ name: 'Team Jerseys', costPerPlayer: 25, type: 'expense' }); setIsExpenseModalOpen(true); }}
              className="w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs text-white bg-zinc-900 dark:bg-white dark:text-zinc-900 shadow-md hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-shirt"></i> Log Team Expense
            </button>
            <button 
              onClick={() => { setExpenseForm({ name: 'Free Game Reward', costPerPlayer: 20, type: 'reward' }); setIsExpenseModalOpen(true); }}
              className="w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs text-emerald-900 bg-emerald-400 shadow-md hover:bg-emerald-300 transition-all flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-gift"></i> Reward Player
            </button>
          </div>

          {/* Middle Section: Player Contribution Breakdown */}
          <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800/50">
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white">Player Contribution Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-bold whitespace-nowrap">
                <thead>
                  <tr className="text-[10px] text-zinc-500 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800/50 bg-zinc-50 dark:bg-zinc-900/50">
                    <th className="px-5 py-3">Player</th>
                    <th className="px-5 py-3 text-center">Total Paid</th>
                    <th className="px-5 py-3 text-center">Expected Cost</th>
                    <th className="px-5 py-3 text-center">Net Contribution</th>
                    <th className="px-5 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {playerContributions.map(p => (
                    <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                      <td className="px-5 py-4 text-zinc-900 dark:text-white">{p.name}</td>
                      <td className="px-5 py-4 text-center text-zinc-600 dark:text-zinc-400">${p.total_paid.toFixed(0)}</td>
                      <td className="px-5 py-4 text-center text-zinc-600 dark:text-zinc-400">${p.expected_cost.toFixed(0)}</td>
                      <td className={`px-5 py-4 text-center font-black ${p.surplus > 0 ? 'text-emerald-500' : p.surplus < 0 ? 'text-red-500' : 'text-zinc-500'}`}>
                        {p.surplus > 0 ? '+' : ''}{p.surplus === 0 ? '$0' : `$${p.surplus.toFixed(0)}`}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {p.surplus >= 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 text-[10px] uppercase tracking-widest">
                            <i className="fa-solid fa-circle-check text-[8px]"></i> Surplus
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 text-[10px] uppercase tracking-widest">
                            <i className="fa-solid fa-circle-exclamation text-[8px]"></i> Owes ${Math.abs(p.surplus).toFixed(0)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {playerContributions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-zinc-500 uppercase tracking-widest text-[10px]">No players found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden">
            <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white mb-1">
              {expenseForm.type === 'expense' ? 'Log Team Expense' : 'Reward Player'}
            </h3>
            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-6 leading-relaxed">
              {expenseForm.type === 'expense' 
                ? 'This will deduct from the team kitty and assign the cost to selected players. Players with a surplus will have their surplus reduced.' 
                : 'This will deduct from the team kitty and CREDIT the selected players, effectively paying for their next game in advance.'}
            </p>

            <form onSubmit={handleLogExpense} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-black tracking-widest text-emerald-600 dark:text-emerald-500 block mb-1.5 ml-1">Expense Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Team Jerseys"
                  value={expenseForm.name}
                  onChange={(e) => setExpenseForm({...expenseForm, name: e.target.value})}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none font-bold"
                />
              </div>
              
              <div>
                <label className="text-[10px] uppercase font-black tracking-widest text-emerald-600 dark:text-emerald-500 block mb-1.5 ml-1">Cost Per Player ($)</label>
                <input 
                  type="number" 
                  required
                  min="0"
                  step="0.01"
                  value={expenseForm.costPerPlayer}
                  onChange={(e) => setExpenseForm({...expenseForm, costPerPlayer: parseFloat(e.target.value) || 0})}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-black tracking-widest text-emerald-600 dark:text-emerald-500 block mb-2 ml-1">Included Players</label>
                <div className="max-h-40 overflow-y-auto bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 space-y-1">
                  {playerContributions.map(p => (
                    <label key={p.id} className="flex items-center gap-3 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        checked={selectedPlayerIds.includes(p.id)}
                        onChange={() => togglePlayerSelection(p.id)}
                        className="w-4 h-4 rounded border-zinc-300 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-bold text-zinc-900 dark:text-white flex-1">{p.name}</span>
                      <span className={`text-[10px] font-black ${p.surplus > 0 ? 'text-emerald-500' : 'text-zinc-500'}`}>
                        {p.surplus > 0 ? `Surplus: $${p.surplus}` : ''}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="flex-1 py-3.5 rounded-xl font-black uppercase tracking-widest text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="flex-1 py-3.5 rounded-xl font-black uppercase tracking-widest text-[11px] bg-emerald-600 text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-500 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {isSaving ? <i className="fa-solid fa-spinner fa-spin"></i> : "Log Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
