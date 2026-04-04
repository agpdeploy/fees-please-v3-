"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { useActiveClub } from "@/contexts/ClubContext";

export default function GameDay() {
  const { profile } = useProfile();
  const { activeClubId } = useActiveClub();

  // Team Selection State
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Fixture & Squad State
  const [activeFixture, setActiveFixture] = useState<any>(null);
  const [squad, setSquad] = useState<any[]>([]);
  const [teamFees, setTeamFees] = useState({ member: 10, casual: 25 });
  
  // Payment & Selection Logic State
  const [playerDebts, setPlayerDebts] = useState<Record<string, number>>({});
  const [paidPlayerIds, setPaidPlayerIds] = useState<string[]>([]); 
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [paymentData, setPaymentData] = useState<Record<string, { amount: number, method: 'cash' | 'card' }>>({});
  const [payUmpire, setPayUmpire] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Quick Add State
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000); 
  };

  // 1. Fetch Teams (RBAC & Multi-tenant)
  useEffect(() => {
    async function fetchTeams() {
      if (!profile) return;
      setLoading(true);

      let query = supabase.from("teams").select("*");
      
      if (profile.role === 'club_admin' || profile.role === 'super_admin') {
        if (activeClubId) query = query.eq('club_id', activeClubId);
      } else {
        const { data: roles } = await supabase.from('user_roles').select('team_id').eq('user_id', profile.id).eq('role', 'team_admin');
        const teamIds = roles?.map(r => r.team_id).filter(Boolean) || [];
        if (teamIds.length > 0) {
          query = query.in('id', teamIds);
        } else {
          setTeams([]);
          setLoading(false);
          return; 
        }
      }

      const { data, error } = await query;
      if (!error && data) {
        setTeams(data);
        if (data.length === 1) setSelectedTeamId(data[0].id);
        else if (data.length > 0 && !data.find(t => t.id === selectedTeamId)) setSelectedTeamId(""); 
      }
      setLoading(false);
    }
    fetchTeams();
  }, [profile, activeClubId]);

  // 2. Fetch Team Settings & Current Fixture
  useEffect(() => {
    if (!selectedTeamId) return;
    async function loadTeamData() {
      const { data: teamData } = await supabase.from("teams").select("member_fee, casual_fee").eq("id", selectedTeamId).single();
      if (teamData) setTeamFees({ member: teamData.member_fee || 10, casual: teamData.casual_fee || 25 });

      const today = new Date().toISOString().split('T')[0];
      const { data: fixData } = await supabase
        .from('fixtures') 
        .select('*')
        .eq('team_id', selectedTeamId)
        .gte('match_date', today)
        .order('match_date', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (fixData) setActiveFixture(fixData);
      else setActiveFixture(null);
    }
    loadTeamData();
  }, [selectedTeamId]);

  // 3. Load Squad Data, Debts, and Payment Status
  async function loadSquadData() {
    if (!activeFixture) { setSquad([]); return; }
    
    // Using the explicit join fix from today to avoid relationship errors
    const { data: squadRows, error: squadError } = await supabase
        .from('match_squads')
        .select('*, players:player_id(*)') 
        .eq('fixture_id', activeFixture.id);
    
    if (squadError) console.error("SQUAD FETCH ERROR:", squadError.message);

    if (squadRows && squadRows.length > 0) {
      const playersList = squadRows.map(row => row.players).filter(Boolean);
      const playerIds = playersList.map(p => p.id);
      
      setSquad(playersList.sort((a, b) => (a.first_name || "").localeCompare(b.first_name || "")));
      
      // Fetch historical transactions to calculate current session debt/payment status
      const { data: txData } = await supabase.from("transactions").select("player_id, amount, transaction_type, fixture_id").in("player_id", playerIds);
      
      const debts: Record<string, number> = {};
      const paidToday: string[] = []; 
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
      setPlayerDebts(debts);
      setPaidPlayerIds(paidToday);
    } else { 
      setSquad([]); 
    }
  }

  useEffect(() => { loadSquadData(); }, [activeFixture]);

  // Payment Toggles & Selection Logic
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
      // Default to Cash and full Match Fee + Debt
      setPaymentData(prev => ({ ...prev, [id]: { amount: matchFee + debt, method: 'cash' } }));
    }
  }

  function updatePlayerData(id: string, field: 'amount' | 'method', value: any) {
    setPaymentData(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  // Calculated Views
  const selectedPlayers = squad.filter(p => selectedPlayerIds.includes(p.id));
  const grandTotal = selectedPlayerIds.reduce((sum, id) => sum + (paymentData[id]?.amount || 0), 0);
  const squadToPay = squad.filter(p => !paidPlayerIds.includes(p.id));
  const squadPaid = squad.filter(p => paidPlayerIds.includes(p.id));

  // Quick Add Logic (Restored)
  async function openQuickAdd() {
    if (!activeClubId) return;
    const { data } = await supabase.from("players").select("*").eq("club_id", activeClubId);
    if (data) {
      const currentIds = squad.map(p => p.id);
      setAvailablePlayers(data.filter(p => !currentIds.includes(p.id)));
    }
    setIsQuickAddOpen(true);
  }

  async function addPlayerToMatch(playerId: string) {
    if (!activeFixture) return;
    await supabase.from("match_squads").insert([{ fixture_id: activeFixture.id, player_id: playerId }]);
    setIsQuickAddOpen(false);
    showToast("Player Added to Squad");
    loadSquadData(); 
  }

  // Final Batch Save Logic
  async function processBatchPayments() {
    if (selectedPlayers.length === 0 || !activeFixture || !activeClubId) return;
    setIsProcessing(true);

    try {
      for (const player of selectedPlayers) {
        const matchFee = player.is_member ? teamFees.member : teamFees.casual;
        const data = paymentData[player.id];

        // Record the Match Fee Liability
        await supabase.from("transactions").insert([{ 
          player_id: player.id, 
          team_id: selectedTeamId, 
          fixture_id: activeFixture.id, 
          club_id: activeClubId, 
          amount: matchFee, 
          transaction_type: 'fee' 
        }]);

        // Record the Actual Payment if they paid something
        if (data && data.amount > 0) {
          await supabase.from("transactions").insert([{ 
            player_id: player.id, 
            team_id: selectedTeamId, 
            fixture_id: activeFixture.id, 
            club_id: activeClubId, 
            amount: data.amount, 
            transaction_type: 'payment', 
            payment_method: data.method 
          }]);
        }
      }

      if (payUmpire && activeFixture.umpire_fee > 0) {
        await supabase.from("transactions").insert([{ 
          team_id: selectedTeamId, 
          fixture_id: activeFixture.id, 
          club_id: activeClubId, 
          amount: activeFixture.umpire_fee, 
          transaction_type: 'expense', 
          payment_method: 'cash', 
          description: 'Umpire Payment' 
        }]);
      }

      await loadSquadData();
      setSelectedPlayerIds([]);
      setPaymentData({});
      setPayUmpire(false);
      showToast(`Saved ${selectedPlayers.length} payments!`);
    } catch (err) {
      showToast("Error saving payments", "error");
    } finally {
      setIsProcessing(false);
    }
  }

  if (loading) return <div className="text-center p-6 text-zinc-500 text-xs font-black uppercase tracking-widest animate-pulse">Loading GameDay...</div>;

  return (
    <div className="animate-in fade-in duration-300 space-y-6 pb-20 relative">
      
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-[100] animate-in slide-in-from-bottom-5 fade-in ${toast.type === 'success' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'} font-black uppercase tracking-widest text-[10px] whitespace-nowrap flex items-center gap-2`}>
          <i className={`fa-solid ${toast.type === 'success' ? 'fa-check' : 'fa-triangle-exclamation'}`}></i>
          {toast.msg}
        </div>
      )}

      {/* Team Selection Dropdown (Admins Only) */}
      {teams.length > 1 && (
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-3xl shadow-lg">
          <label className="text-[10px] text-emerald-500 uppercase font-black tracking-widest block mb-2 ml-1">Admin View</label>
          <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white outline-none font-bold">
            <option value="" disabled>-- Select a Team --</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {/* Match Header */}
      {selectedTeamId && activeFixture ? (
        <div className="bg-[#111] border border-emerald-900/30 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-black italic text-emerald-500 uppercase tracking-tighter">vs {activeFixture.opponent}</h2>
              <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest mt-1">
                {new Date(activeFixture.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </p>
            </div>
            <button onClick={openQuickAdd} className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 text-emerald-500 hover:bg-zinc-800 flex items-center justify-center transition-colors shadow-inner">
              <i className="fa-solid fa-user-plus text-lg"></i>
            </button>
          </div>
        </div>
      ) : selectedTeamId ? (
        <div className="text-center py-10 bg-zinc-900 rounded-3xl border border-zinc-800">
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">No upcoming fixtures found.</p>
        </div>
      ) : null}

      {/* Quick Select Squad Grid */}
      {activeFixture && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-4 px-1">
             <h2 className="text-[11px] font-black uppercase italic text-emerald-500 tracking-widest">To Pay ({squadToPay.length})</h2>
             <button onClick={() => {setSelectedPlayerIds([]); setPaymentData({});}} className="text-[9px] font-black uppercase text-zinc-600 hover:text-zinc-400">Clear All</button>
          </div>
          
          <div className="flex flex-wrap gap-2.5 mb-6">
            {squadToPay.length === 0 && squadPaid.length > 0 ? (
              <div className="w-full text-center py-6 border border-dashed border-emerald-900/50 rounded-2xl bg-emerald-900/10">
                <i className="fa-solid fa-check-double text-2xl text-emerald-500 mb-2"></i>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">All players settled!</p>
              </div>
            ) : (
              squadToPay.map(player => {
                const isSelected = selectedPlayerIds.includes(player.id);
                const debt = Math.max(0, playerDebts[player.id] || 0);
                const displayName = `${player.first_name} ${player.last_name ? player.last_name.charAt(0) + '.' : ''}`;
                return (
                  <button key={player.id} onClick={() => togglePlayerSelection(player.id)} className={`px-4 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all relative ${isSelected ? 'bg-emerald-500 text-black shadow-[0_0_15_rgba(16,185,129,0.3)] scale-[1.02]' : 'bg-[#1A1A1A] text-zinc-300 border border-zinc-800/50 hover:border-zinc-600'}`}>
                    {displayName}
                    {debt > 0 && !isSelected && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-zinc-950"></div>}
                  </button>
                );
              })
            )}
          </div>

          {/* Paid Section */}
          {squadPaid.length > 0 && (
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3 px-1 mt-6 border-t border-zinc-800 pt-4">Paid Today ({squadPaid.length})</h2>
              <div className="flex flex-wrap gap-2">
                {squadPaid.map(player => (
                  <div key={player.id} className="px-3 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest bg-zinc-900 text-zinc-600 border border-zinc-800/50 flex items-center gap-2">
                    <i className="fa-solid fa-check text-emerald-500/50"></i>
                    {`${player.first_name} ${player.last_name ? player.last_name.charAt(0) + '.' : ''}`}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dynamic Payment Cards */}
      {selectedPlayers.length > 0 && (
        <div className="space-y-4 animate-in slide-in-from-bottom-6 duration-300">
          <div className="space-y-3">
            {selectedPlayers.map(player => {
              const data = paymentData[player.id];
              if (!data) return null;
              const debt = Math.max(0, playerDebts[player.id] || 0);
              const matchFee = player.is_member ? teamFees.member : teamFees.casual;

              return (
                <div key={player.id} className="bg-[#1A1A1A] border border-zinc-800 rounded-3xl p-5 shadow-lg relative animate-in fade-in">
                  <button onClick={() => togglePlayerSelection(player.id)} className="absolute top-4 right-4 text-zinc-600 hover:text-zinc-400"><i className="fa-solid fa-xmark"></i></button>
                  <div className="flex justify-between items-start mb-4 pr-6">
                    <div>
                      <h3 className="text-white font-black text-sm uppercase tracking-wide">{player.first_name} {player.last_name}</h3>
                      <div className="flex items-center gap-2 mt-1 text-[9px] font-black uppercase tracking-widest">
                        {debt > 0 && <span className="text-red-500">Debt: ${debt}</span>}
                        <span className="text-emerald-500">Fee: ${matchFee}</span>
                      </div>
                    </div>
                    {/* Method Toggle */}
                    <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1">
                      <button onClick={() => updatePlayerData(player.id, 'method', 'cash')} className={`w-10 h-8 rounded-lg flex items-center justify-center text-xs transition-colors ${data.method === 'cash' ? 'bg-emerald-500 text-black' : 'text-zinc-500 hover:text-white'}`}><i className="fa-solid fa-money-bill-wave"></i></button>
                      <button onClick={() => updatePlayerData(player.id, 'method', 'card')} className={`w-10 h-8 rounded-lg flex items-center justify-center text-xs transition-colors ${data.method === 'card' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}><i className="fa-solid fa-credit-card"></i></button>
                    </div>
                  </div>
                  {/* Amount Input */}
                  <div className="bg-[#111] border border-zinc-800 rounded-2xl p-3 flex justify-between items-center">
                    <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Amount Paid</span>
                    <input type="number" value={data.amount} onChange={(e) => updatePlayerData(player.id, 'amount', Number(e.target.value))} className="bg-transparent text-right text-2xl font-black text-emerald-500 outline-none w-24" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Umpire Toggle & Batch Save Button */}
          <div className="pt-4 space-y-4">
            {activeFixture.umpire_fee > 0 && (
              <div className="bg-[#1A1A1A] border border-zinc-800 rounded-2xl p-4 flex justify-between items-center cursor-pointer" onClick={() => setPayUmpire(!payUmpire)}>
                <span className="text-xs font-black uppercase tracking-widest text-zinc-300 flex items-center gap-2"><i className="fa-solid fa-ticket text-zinc-500"></i> Pay Umpire (${activeFixture.umpire_fee})</span>
                <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${payUmpire ? 'bg-emerald-500' : 'bg-zinc-800'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${payUmpire ? 'translate-x-4' : ''}`}></div>
                </div>
              </div>
            )}
            <div className="flex justify-between items-end px-2">
              <span className="text-xs font-black italic text-zinc-500 uppercase tracking-widest">Total Collected:</span>
              <span className="text-4xl font-black italic text-emerald-500">${grandTotal.toFixed(2)}</span>
            </div>
            <button onClick={processBatchPayments} disabled={isProcessing} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all disabled:opacity-50">
              {isProcessing ? 'Saving...' : `Save ${selectedPlayers.length} Payments`}
            </button>
          </div>
        </div>
      )}

      {/* Quick Add Modal */}
      {isQuickAddOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#111] border border-zinc-800 w-full max-w-[440px] rounded-3xl overflow-hidden flex flex-col max-h-[80vh] shadow-2xl">
            <div className="p-5 flex justify-between items-center border-b border-zinc-800">
              <h2 className="text-lg font-black italic text-emerald-500 uppercase tracking-tighter">Add to Squad</h2>
              <button onClick={() => setIsQuickAddOpen(false)} className="text-zinc-500 hover:text-white"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <input type="text" placeholder="Search..." value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)} className="w-full bg-[#1A1A1A] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500" />
              <div className="space-y-2">
                {availablePlayers.filter(p => `${p.first_name} ${p.last_name}`.toLowerCase().includes(playerSearch.toLowerCase())).map(p => (
                  <button key={p.id} onClick={() => addPlayerToMatch(p.id)} className="w-full flex justify-between items-center bg-[#1A1A1A] p-4 rounded-2xl hover:bg-zinc-800 transition-colors text-left group">
                    <span className="font-bold text-white text-sm">{p.first_name} {p.last_name}</span>
                    <i className="fa-solid fa-plus text-emerald-500"></i>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}