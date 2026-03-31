"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { useActiveClub } from "@/contexts/ClubContext";

export default function GameDay() {
  const { profile, loading: profileLoading } = useProfile(); 
  const { activeClubId } = useActiveClub();
  
  const isClient = typeof window !== 'undefined';
  const localClubId = isClient ? localStorage.getItem("captainClubId") : null;
  const localTeamId = isClient ? localStorage.getItem("captainTeamId") : null;
  
  const captainClubId = profile?.role === 'super_admin' ? activeClubId : (profile?.club_id || localClubId);
  const captainTeamId = profile ? null : localTeamId;

  const [adminTeams, setAdminTeams] = useState<any[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(captainTeamId);

  useEffect(() => {
    if (!profileLoading && !profile && localTeamId) setActiveTeamId(localTeamId);
  }, [profileLoading, profile, localTeamId]);
  
  const [activeFixture, setActiveFixture] = useState<any>(null);
  const [squad, setSquad] = useState<any[]>([]);
  const [teamFees, setTeamFees] = useState({ member: 10, casual: 25 });
  const [playerDebts, setPlayerDebts] = useState<Record<string, number>>({});
  const [paidPlayerIds, setPaidPlayerIds] = useState<string[]>([]); 
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [paymentData, setPaymentData] = useState<Record<string, { amount: number, method: 'cash' | 'card' }>>({});
  const [payUmpire, setPayUmpire] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000); 
  };

  useEffect(() => {
    if (!captainTeamId && captainClubId) {
      supabase.from("teams").select("*").eq("club_id", captainClubId).order("name").then(({ data }) => {
        if (data) setAdminTeams(data);
      });
    }
  }, [captainTeamId, captainClubId]);

  useEffect(() => {
    if (!activeTeamId) return;
    async function loadTeamData() {
      const { data: teamData } = await supabase.from("teams").select("member_fee, casual_fee").eq("id", activeTeamId).single();
      if (teamData) setTeamFees({ member: teamData.member_fee || 10, casual: teamData.casual_fee || 25 });
      const today = new Date().toISOString().split('T')[0];
      const { data: fixData } = await supabase.from("fixtures").select("*").eq("team_id", activeTeamId).gte("match_date", today).order("match_date", { ascending: true }).limit(1).maybeSingle();
      setActiveFixture(fixData || null);
    }
    loadTeamData();
  }, [activeTeamId]);

  async function loadSquadData() {
    if (!activeFixture) { setSquad([]); return; }
    setIsLoading(true);
    const { data: squadRows } = await supabase.from("match_squads").select("player_id").eq("fixture_id", activeFixture.id);
    if (squadRows && squadRows.length > 0) {
      const playerIds = squadRows.map(row => row.player_id);
      const { data: playerDetails } = await supabase.from("players").select("*").in("id", playerIds);
      if (playerDetails) {
        setSquad(playerDetails.sort((a, b) => a.first_name.localeCompare(b.first_name)));
        const { data: txData } = await supabase.from("transactions").select("player_id, amount, transaction_type, fixture_id").in("player_id", playerIds);
        const debts: Record<string, number> = {}; const paidToday: string[] = []; 
        playerIds.forEach(id => debts[id] = 0);
        if (txData) {
          txData.forEach(tx => {
            if (tx.transaction_type === 'fee') debts[tx.player_id] += Number(tx.amount);
            if (tx.transaction_type === 'payment') {
              debts[tx.player_id] -= Number(tx.amount);
              if (tx.fixture_id === activeFixture.id && !paidToday.includes(tx.player_id)) paidToday.push(tx.player_id);
            }
          });
        }
        setPlayerDebts(debts); setPaidPlayerIds(paidToday);
      }
    } else setSquad([]);
    setIsLoading(false);
  }

  useEffect(() => { loadSquadData(); }, [activeFixture]);

  function togglePlayerSelection(id: string) {
    if (selectedPlayerIds.includes(id)) {
      setSelectedPlayerIds(prev => prev.filter(pId => pId !== id));
      setPaymentData(prev => { const newData = { ...prev }; delete newData[id]; return newData; });
    } else {
      const player = squad.find(p => p.id === id);
      if (!player) return;
      const matchFee = player.is_member ? teamFees.member : teamFees.casual;
      const debt = Math.max(0, playerDebts[id] || 0);
      setSelectedPlayerIds(prev => [...prev, id]);
      setPaymentData(prev => ({ ...prev, [id]: { amount: matchFee + debt, method: 'cash' } }));
    }
  }

  const collectedCash = selectedPlayerIds.reduce((sum, id) => sum + (paymentData[id]?.amount || 0), 0);
  const umpireDeduction = (payUmpire && activeFixture?.umpire_fee) ? activeFixture.umpire_fee : 0;
  const grandTotal = collectedCash - umpireDeduction;

  async function processBatchPayments() {
    if (selectedPlayerIds.length === 0 || !activeFixture) return;
    setIsProcessing(true);

    for (const id of selectedPlayerIds) {
      const player = squad.find(p => p.id === id);
      const data = paymentData[id];
      const matchFee = player.is_member ? teamFees.member : teamFees.casual;
      await supabase.from("transactions").insert([{ player_id: id, team_id: activeTeamId, fixture_id: activeFixture.id, club_id: captainClubId, amount: matchFee, transaction_type: 'fee' }]);
      if (data && data.amount > 0) {
        await supabase.from("transactions").insert([{ player_id: id, team_id: activeTeamId, fixture_id: activeFixture.id, club_id: captainClubId, amount: data.amount, transaction_type: 'payment', payment_method: data.method }]);
      }
    }

    if (payUmpire && activeFixture.umpire_fee > 0) {
      await supabase.from("transactions").insert([{ team_id: activeTeamId, fixture_id: activeFixture.id, club_id: captainClubId, amount: activeFixture.umpire_fee, transaction_type: 'expense', payment_method: 'cash', description: 'Umpire Payment' }]);
    }

    await loadSquadData();
    setSelectedPlayerIds([]);
    setPaymentData({});
    setPayUmpire(false);
    setIsProcessing(false);
    showToast(`Saved ${selectedPlayerIds.length} payments!`);
  }

  if (profileLoading) return <div className="p-20 text-center animate-pulse">Verifying...</div>;
  if (!captainClubId) return <div className="p-20 text-center text-zinc-500">Log in required.</div>;

  return (
    <div className="animate-in fade-in duration-300 space-y-6 pb-20 relative">
      
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl z-[100] bg-emerald-500 text-black font-black uppercase text-[10px]`}>
          <i className="fa-solid fa-check"></i> {toast.msg}
        </div>
      )}

      {!captainTeamId && adminTeams.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-3xl shadow-lg">
          <label className="text-[10px] text-brand uppercase font-black block mb-2 ml-1 tracking-widest">Admin View</label>
          <select value={activeTeamId || ""} onChange={(e) => setActiveTeamId(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white outline-none font-bold">
            <option value="">-- Select a Team --</option>
            {adminTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {activeTeamId && activeFixture ? (
        <div className="bg-[#111] border border-zinc-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-brand"></div>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-black italic text-brand uppercase tracking-tighter">vs {activeFixture.opponent}</h2>
              <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest mt-1">{new Date(activeFixture.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
            </div>
            <button onClick={() => { supabase.from("players").select("*").eq("club_id", captainClubId).then(({data}) => { if(data) setAvailablePlayers(data.filter(p => !squad.some(s => s.id === p.id))); setIsQuickAddOpen(true); }) }} className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 text-brand flex items-center justify-center transition-colors"><i className="fa-solid fa-user-plus"></i></button>
          </div>
        </div>
      ) : activeTeamId ? (
        <div className="text-center py-10 bg-zinc-900 rounded-3xl border border-zinc-800">
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">No upcoming fixtures found.</p>
        </div>
      ) : null}

      {activeFixture && (
        <div className="mb-4">
          <h2 className="text-[11px] font-black uppercase italic text-brand tracking-widest mb-4 px-1">To Pay ({squad.filter(p => !paidPlayerIds.includes(p.id)).length})</h2>
          <div className="flex flex-wrap gap-2.5">
            {squad.filter(p => !paidPlayerIds.includes(p.id)).map(player => {
              const isSelected = selectedPlayerIds.includes(player.id);
              {/* FIX: Forced the selected state to be bg-white text-black instead of bg-brand text-black */}
              return (
                <button key={player.id} onClick={() => togglePlayerSelection(player.id)} className={`px-4 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all relative ${isSelected ? 'bg-white text-black shadow-lg scale-105' : 'bg-[#1A1A1A] text-zinc-300 border border-zinc-800/50 hover:border-zinc-600'}`}>
                  {player.first_name} {player.last_name?.charAt(0)}.
                  {Math.max(0, playerDebts[player.id] || 0) > 0 && !isSelected && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-zinc-950"></div>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedPlayerIds.length > 0 && (
        <div className="space-y-4 animate-in slide-in-from-bottom-6">
          {selectedPlayerIds.map(id => {
            const player = squad.find(p => p.id === id);
            const data = paymentData[id];
            return (
              <div key={id} className="bg-[#1A1A1A] border border-zinc-800 rounded-3xl p-5 shadow-lg relative">
                <button onClick={() => togglePlayerSelection(id)} className="absolute top-4 right-4 text-zinc-600 hover:text-zinc-400"><i className="fa-solid fa-xmark"></i></button>
                <div className="flex justify-between items-start mb-4 pr-6">
                  <div>
                    {/* FIX: Forced text-white instead of text-brand for player name */}
                    <h3 className="text-white font-black text-sm uppercase tracking-wide">{player?.first_name} {player?.last_name}</h3>
                    <div className="text-[9px] font-black uppercase tracking-widest mt-1 text-emerald-500">Fee: ${player?.is_member ? teamFees.member : teamFees.casual}</div>
                  </div>
                  <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1">
                    <button onClick={() => setPaymentData(p => ({...p, [id]: {...p[id], method: 'cash'}}))} className={`w-10 h-8 rounded-lg flex items-center justify-center text-xs transition-colors ${data.method === 'cash' ? 'bg-emerald-500 text-black' : 'text-zinc-500 hover:text-white'}`}><i className="fa-solid fa-money-bill-wave"></i></button>
                    <button onClick={() => setPaymentData(p => ({...p, [id]: {...p[id], method: 'card'}}))} className={`w-10 h-8 rounded-lg flex items-center justify-center text-xs transition-colors ${data.method === 'card' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-white'}`}><i className="fa-solid fa-credit-card"></i></button>
                  </div>
                </div>
                <div className="bg-[#111] border border-zinc-800 rounded-2xl p-3 flex justify-between items-center">
                  <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Amount Paid</span>
                  <input type="number" value={data.amount} onChange={(e) => setPaymentData(p => ({...p, [id]: {...p[id], amount: Number(e.target.value)}}))} className="bg-transparent text-right text-2xl font-black text-emerald-500 outline-none w-24" />
                </div>
              </div>
            );
          })}
          
          <div className="pt-4 space-y-4">
            {activeFixture?.umpire_fee > 0 && (
              <div className="bg-[#1A1A1A] border border-zinc-800 rounded-2xl p-4 flex justify-between items-center cursor-pointer" onClick={() => setPayUmpire(!payUmpire)}>
                <span className="text-xs font-black uppercase text-zinc-300 flex items-center gap-2"><i className="fa-solid fa-ticket"></i> Pay Umpire (${activeFixture.umpire_fee})</span>
                <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${payUmpire ? 'bg-emerald-500' : 'bg-zinc-800'}`}><div className={`w-4 h-4 rounded-full bg-white transition-transform ${payUmpire ? 'translate-x-4' : ''}`}></div></div>
              </div>
            )}
            <div className="flex justify-between items-end px-2">
              <span className="text-xs font-black italic text-zinc-500 uppercase">Cash on Hand:</span>
              <span className="text-4xl font-black italic text-emerald-500">${grandTotal.toFixed(2)}</span>
            </div>
            <button onClick={processBatchPayments} disabled={isProcessing} className="w-full bg-brand text-zinc-950 font-black py-5 rounded-2xl uppercase tracking-widest text-sm shadow-lg active:scale-95 disabled:opacity-50 transition-all">
              Save {selectedPlayerIds.length} Payments
            </button>
          </div>
        </div>
      )}

      {isQuickAddOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-zinc-800 w-full max-w-[440px] rounded-3xl overflow-hidden flex flex-col max-h-[80vh] shadow-2xl">
            <div className="p-5 flex justify-between items-center border-b border-zinc-800">
              <h2 className="text-lg font-black italic text-brand uppercase tracking-tighter">Quick Add</h2>
              <button onClick={() => setIsQuickAddOpen(false)} className="text-zinc-500"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <input type="text" placeholder="Search..." value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)} className="w-full bg-[#1A1A1A] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-brand" />
              <div className="space-y-2">
                {availablePlayers.filter(p => `${p.first_name} ${p.last_name}`.toLowerCase().includes(playerSearch.toLowerCase())).map(p => (
                  <button key={p.id} onClick={async () => { await supabase.from("match_squads").insert([{ fixture_id: activeFixture.id, player_id: p.id }]); setIsQuickAddOpen(false); loadSquadData(); }} className="w-full flex justify-between items-center bg-[#1A1A1A] p-4 rounded-2xl hover:bg-zinc-800 text-left"><span className="font-bold text-white text-sm">{p.first_name} {p.last_name}</span><i className="fa-solid fa-plus text-brand"></i></button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}