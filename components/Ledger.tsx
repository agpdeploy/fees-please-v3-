"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { useActiveClub } from "@/contexts/ClubContext";

export default function Ledger() {
  const { profile, loading: profileLoading } = useProfile(); 
  const { activeClubId } = useActiveClub();
  
  const isClient = typeof window !== 'undefined';
  const localClubId = isClient ? localStorage.getItem("captainClubId") : null;
  const localTeamId = isClient ? localStorage.getItem("captainTeamId") : null;
  const captainClubId = profile?.role === 'super_admin' ? activeClubId : (profile?.club_id || localClubId);
  const captainTeamId = profile ? null : localTeamId;

  const [adminTeams, setAdminTeams] = useState<any[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(captainTeamId);
  
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState(""); 
  
  const [seasonAudit, setSeasonAudit] = useState<any[]>([]);
  const [playerBalances, setPlayerBalances] = useState<any[]>([]);
  const [overallNet, setOverallNet] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showAllDebts, setShowAllDebts] = useState(false);
  const [selectedFixture, setSelectedFixture] = useState<any>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
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
    if (!profileLoading && !profile && localTeamId) setActiveTeamId(localTeamId);
  }, [profileLoading, profile, localTeamId]);

  useEffect(() => {
    if (!captainTeamId && captainClubId) {
      supabase.from("teams").select("*").eq("club_id", captainClubId).order("name").then(({ data }) => {
        if (data) setAdminTeams(data);
      });
    }
  }, [captainTeamId, captainClubId]);

  async function fetchLedger() {
    if (!activeTeamId) return;
    setIsLoading(true);
    const { data: fixData } = await supabase.from("fixtures").select("*").eq("team_id", activeTeamId).order("match_date", { ascending: false });
    const { data: txData } = await supabase.from("transactions").select(`*, players ( id, first_name, last_name ), fixtures ( opponent )`).eq("team_id", activeTeamId).order("created_at", { ascending: false });

    if (txData && fixData) {
      setTransactions(txData);
      setFixtures(fixData);
      let netTotal = 0;
      const auditMap: Record<string, any> = {};
      fixData.forEach(f => { auditMap[f.id] = { ...f, cash: 0, card: 0, fee: 0, net: 0 }; });
      const balances: Record<string, { id: string, name: string, owed: number }> = {};
      
      txData.forEach(tx => {
        if (tx.fixture_id && auditMap[tx.fixture_id]) {
          if (tx.transaction_type === 'payment') {
            if (tx.payment_method === 'cash') auditMap[tx.fixture_id].cash += Number(tx.amount);
            if (tx.payment_method === 'card') auditMap[tx.fixture_id].card += Number(tx.amount);
          }
          if (tx.transaction_type === 'expense') auditMap[tx.fixture_id].fee += Number(tx.amount);
        }
        if (tx.player_id && tx.players) {
          if (!balances[tx.player_id]) balances[tx.player_id] = { id: tx.player_id, name: `${tx.players.first_name} ${tx.players.last_name}`, owed: 0 };
          if (tx.transaction_type === 'fee') balances[tx.player_id].owed += Number(tx.amount);
          if (tx.transaction_type === 'payment') balances[tx.player_id].owed -= Number(tx.amount);
        }
      });
      const auditArray = Object.values(auditMap).map(m => { m.net = m.cash + m.card - m.fee; netTotal += m.net; return m; }).sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime());
      setSeasonAudit(auditArray);
      setOverallNet(netTotal);
      setPlayerBalances(Object.values(balances).filter(b => b.owed > 0.01).sort((a, b) => b.owed - a.owed));
    }
    setIsLoading(false);
  }

  useEffect(() => { fetchLedger(); }, [activeTeamId]);

  const openPlayerDetails = (player: any) => {
    setSelectedPlayer(player);
    setIsManualModalOpen(false);
    setManualAmount(""); 
    setManualNote(""); 
    setManualFixtureId("");
  };

  async function handleManualSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlayer || !manualAmount || isSaving) return;
    setIsSaving(true);
    const { error } = await supabase.from("transactions").insert([{
      player_id: selectedPlayer.id, 
      team_id: activeTeamId, 
      club_id: captainClubId, 
      fixture_id: manualFixtureId || null,
      amount: Number(manualAmount), 
      transaction_type: manualType, 
      payment_method: manualType === 'payment' ? 'cash' : null,
      description: manualNote || `Manual ${manualType}`
    }]);
    if (!error) { 
      await fetchLedger(); 
      setSelectedPlayer(null); 
      showToast("Transaction Recorded!"); 
    }
    setIsSaving(false);
  }

  const filteredTransactions = transactions.filter(tx => {
    const nameMatch = tx.players ? `${tx.players.first_name} ${tx.players.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    const opponentMatch = tx.fixtures ? tx.fixtures.opponent.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    const noteMatch = tx.description ? tx.description.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    return nameMatch || opponentMatch || noteMatch || searchTerm === "";
  });

  const displayedDebtors = showAllDebts ? playerBalances : playerBalances.slice(0, 3);

  if (profileLoading) return <div className="p-20 text-center animate-pulse">Verifying...</div>;
  if (!captainClubId) return <div className="p-4 text-center text-zinc-500">Log in required.</div>;

  return (
    <div className="animate-in fade-in duration-300 space-y-6 pb-20 relative">
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl z-[100] animate-in slide-in-from-bottom-5 ${toast.type === 'success' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'} font-black uppercase text-[10px] flex items-center gap-2`}>
          <i className={`fa-solid ${toast.type === 'success' ? 'fa-check' : 'fa-triangle-exclamation'}`}></i> {toast.msg}
        </div>
      )}

      {!captainTeamId && adminTeams.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-3xl shadow-lg">
          <label className="text-[10px] text-brand uppercase font-black tracking-widest block mb-2 ml-1">Viewing Ledger As</label>
          <select value={activeTeamId || ""} onChange={(e) => setActiveTeamId(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white outline-none font-bold">
            <option value="">-- Select a Team --</option>
            {adminTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {activeTeamId && !isLoading && (
        <>
          <div className="bg-[#1A1A1A] border border-zinc-800 rounded-3xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-brand"></div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-sm font-black uppercase italic text-brand tracking-widest">Season Audit</h2>
              <div className={`bg-zinc-800 rounded-xl px-3 py-1.5 text-sm font-black border border-zinc-700 ${overallNet >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>${overallNet.toFixed(0)} NET</div>
            </div>
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-[11px] font-bold">
                <thead><tr className="text-zinc-500 uppercase tracking-widest border-b border-zinc-800"><th className="pb-3">VS</th><th className="pb-3 text-center">FEE</th><th className="pb-3 text-center">CASH</th><th className="pb-3 text-center">CARD</th><th className="pb-3 text-right">NET</th></tr></thead>
                <tbody>
                  {seasonAudit.map((audit) => (
                    <tr key={audit.id} onClick={() => setSelectedFixture(audit)} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/50 cursor-pointer transition-colors">
                      <td className="py-4 text-white">{audit.opponent}</td>
                      <td className="py-4 text-center text-zinc-400">${audit.fee}</td>
                      <td className="py-4 text-center text-emerald-500">${audit.cash}</td>
                      <td className="py-4 text-center text-blue-500">${audit.card}</td>
                      <td className={`py-4 text-right ${audit.net < 0 ? 'text-red-500' : 'text-emerald-500'}`}>${audit.net}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[#1A1A1A] border border-zinc-800 rounded-3xl p-5 shadow-lg overflow-hidden">
            <h2 className="text-[11px] font-black uppercase italic text-red-500 tracking-widest mb-4">Outstanding Debts</h2>
            <div className="space-y-2">
              {playerBalances.length === 0 ? (
                <p className="text-xs text-zinc-500 font-bold uppercase text-center py-4 tracking-widest">All clear!</p>
              ) : (
                <>
                  {displayedDebtors.map((player) => (
                    <button key={player.id} onClick={() => openPlayerDetails(player)} className="w-full flex justify-between items-center bg-zinc-900 border border-zinc-800 hover:border-zinc-700 p-4 rounded-2xl transition-all group">
                      <span className="text-sm font-bold text-white transition-colors">{player.name}</span>
                      <span className="text-sm font-black text-red-500">${player.owed.toFixed(2)}</span>
                    </button>
                  ))}
                  {playerBalances.length > 3 && <button onClick={() => setShowAllDebts(!showAllDebts)} className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">{showAllDebts ? 'Show Less' : `Show ${playerBalances.length - 3} More`}</button>}
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-end px-1">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-600 italic">Recent Activity</h2>
              <div className="relative w-1/2">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700 text-[10px]"></i>
                <input type="text" placeholder="Filter..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-full pl-8 pr-3 py-1.5 text-[10px] text-white outline-none focus:border-brand transition-colors"/>
              </div>
            </div>

            <div className="space-y-2">
              {filteredTransactions.slice(0, 30).map(tx => (
                <div key={tx.id} onClick={() => { setSelectedPlayer({ id: tx.player_id, name: tx.players ? `${tx.players.first_name} ${tx.players.last_name}` : 'Club Expense', owed: 0 }); setIsManualModalOpen(false); }} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex justify-between items-center cursor-pointer hover:bg-zinc-800/50 transition-colors">
                  <div>
                    <div className="font-bold text-white text-sm">
                      {tx.players ? `${tx.players.first_name} ${tx.players.last_name}` : (tx.description || 'Club Expense')}
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-widest mt-1 text-zinc-500 flex items-center gap-2">
                      <span>{new Date(tx.created_at).toLocaleDateString('en-GB')}</span>
                      <span>•</span>
                      <span className={tx.transaction_type === 'payment' ? 'text-emerald-500' : 'text-red-500/80'}>
                        {tx.transaction_type === 'fee' ? 'Match Fee' : tx.transaction_type.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className={`text-sm font-black ${tx.transaction_type === 'payment' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {tx.transaction_type === 'payment' ? '+' : '-'}${tx.amount}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {selectedFixture && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#111] border border-zinc-800 w-full max-w-[440px] rounded-3xl overflow-hidden flex flex-col max-h-[85vh] shadow-2xl animate-in slide-in-from-bottom-8">
            <div className="p-5 flex justify-between items-start border-b border-zinc-800">
              <div>
                <h2 className="text-xl font-black italic text-brand uppercase tracking-tighter">VS {selectedFixture.opponent}</h2>
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-1 flex gap-3">
                  <span>Cash: ${selectedFixture.cash}</span>
                  <span>Card: ${selectedFixture.card}</span>
                  <span className={selectedFixture.net < 0 ? 'text-red-500' : 'text-emerald-500'}>Net: ${selectedFixture.net}</span>
                </div>
              </div>
              <button onClick={() => setSelectedFixture(null)} className="text-zinc-500 hover:text-white"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-2">
              {transactions.filter(tx => tx.fixture_id === selectedFixture.id).map(tx => (
                <div key={tx.id} className="bg-[#1A1A1A] border border-zinc-800 p-4 rounded-xl flex justify-between items-center">
                   <span className="text-sm font-bold text-white">{tx.players ? `${tx.players.first_name} ${tx.players.last_name?.charAt(0)}.` : tx.description}</span>
                   <span className={`text-sm font-black ${tx.transaction_type === 'payment' ? 'text-emerald-500' : 'text-red-500'}`}>{tx.transaction_type === 'payment' ? '+' : '-'}${tx.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedPlayer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#111] border border-zinc-800 w-full max-w-[440px] rounded-3xl overflow-hidden flex flex-col max-h-[85vh] shadow-2xl animate-in slide-in-from-bottom-8">
            <div className="p-5 flex justify-between items-start border-b border-zinc-800">
              <div>
                <h2 className="text-xl font-black italic text-brand uppercase tracking-tighter">{selectedPlayer.name}</h2>
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-1">Transaction History</div>
              </div>
              <button onClick={() => {setSelectedPlayer(null); setIsManualModalOpen(false);}} className="text-zinc-500 hover:text-white"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            
            {isManualModalOpen ? (
              <form onSubmit={handleManualSave} className="p-5 space-y-4">
                <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1">
                  <button type="button" onClick={() => setManualType('payment')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-lg transition-colors ${manualType === 'payment' ? 'bg-emerald-600 text-white' : 'text-zinc-500'}`}>Payment (+)</button>
                  <button type="button" onClick={() => setManualType('fee')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-lg transition-colors ${manualType === 'fee' ? 'bg-zinc-800 text-red-500' : 'text-zinc-500'}`}>Charge (-)</button>
                </div>
                <input type="number" placeholder="Amount ($)" value={manualAmount} onChange={e => setManualAmount(Number(e.target.value))} className="w-full bg-[#1A1A1A] border border-zinc-800 rounded-xl px-4 py-4 text-center text-emerald-500 text-xl font-black outline-none focus:border-brand" required />
                <input type="text" placeholder="Note (e.g. Fine, Cash, Refund)" value={manualNote} onChange={e => setManualNote(e.target.value)} className="w-full bg-[#1A1A1A] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-brand" />
                <button type="submit" disabled={isSaving} className="w-full bg-brand text-zinc-950 font-black py-4 rounded-xl uppercase tracking-widest text-xs transition-all active:scale-95 disabled:opacity-50 shadow-lg">
                  {isSaving ? 'Saving...' : 'Confirm'}
                </button>
              </form>
            ) : (
              <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto flex-1">
                <button onClick={() => setIsManualModalOpen(true)} className="w-full py-4 border border-zinc-800 bg-zinc-900 rounded-2xl text-[10px] font-black uppercase text-emerald-500 flex items-center justify-center gap-2 mb-2 hover:border-emerald-900 transition-colors">
                  <i className="fa-solid fa-plus"></i> Add Manual Transaction
                </button>
                {transactions.filter(tx => tx.player_id === selectedPlayer.id).map(tx => (
                  <div key={tx.id} className="bg-[#1A1A1A] border border-zinc-800 p-4 rounded-xl flex justify-between items-center">
                    <div>
                      <div className="text-[8px] font-black uppercase text-zinc-500">{tx.transaction_type.toUpperCase()}</div>
                      <div className="text-xs font-bold text-white">{tx.fixtures?.opponent ? `Match: ${tx.fixtures.opponent}` : (tx.description || 'Manual')}</div>
                    </div>
                    <span className={`text-sm font-black ${tx.transaction_type === 'payment' ? 'text-emerald-500' : 'text-red-500'}`}>{tx.transaction_type === 'payment' ? '+' : '-'}${tx.amount}</span>
                  </div>
                ))}
                {transactions.filter(tx => tx.player_id === selectedPlayer.id).length === 0 && (
                    <p className="text-center text-zinc-600 text-[10px] uppercase font-black py-8">No history found.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}