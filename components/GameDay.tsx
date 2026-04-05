"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { useActiveClub } from "@/contexts/ClubContext";
import { toPng } from 'html-to-image';
import { PaymentForm, CreditCard } from 'react-square-web-payments-sdk';
import { calculateSquareGross } from '@/lib/fees';

export default function GameDay() {
  const { profile, roles } = useProfile();
  const { activeClubId } = useActiveClub();
  const squadImageRef = useRef<HTMLDivElement>(null);

  // Theme & Config State
  const [themeColor, setThemeColor] = useState("#10b981");
  const [clubLocationId, setClubLocationId] = useState<string>("");

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
  
  // Square Modal State
  const [activeSquarePlayer, setActiveSquarePlayer] = useState<any>(null);

  // Quick Add State
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000); 
  };

  // Fetch Theme Color & Square Location ID
  useEffect(() => {
    if (activeClubId) {
      supabase.from('clubs').select('theme_color, square_location_id').eq('id', activeClubId).single().then(({data}) => {
        if (data?.theme_color) setThemeColor(data.theme_color);
        if (data?.square_location_id) setClubLocationId(data.square_location_id);
      });
    }
  }, [activeClubId]);

  // 1. Fetch Teams (RBAC & Multi-tenant)
  useEffect(() => {
    async function fetchTeams() {
      if (!profile) return;
      setLoading(true);

      let query = supabase.from("teams").select("*");
      
      if (profile.role === 'club_admin' || profile.role === 'super_admin') {
        if (activeClubId) query = query.eq('club_id', activeClubId);
      } else {
        const teamIds = roles?.filter((r: any) => r.role === 'team_admin').map((r: any) => r.team_id).filter(Boolean) || [];
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
  }, [profile, roles, activeClubId, selectedTeamId]);

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
    
    const { data: squadRows, error: squadError } = await supabase
        .from('match_squads')
        .select('player_id') 
        .eq('fixture_id', activeFixture.id);
    
    if (squadError) {
      console.error("SQUAD FETCH ERROR:", squadError.message);
      return;
    }

    if (squadRows && squadRows.length > 0) {
      const playerIds = squadRows.map(row => row.player_id);
      
      const { data: playerDetails, error: playersError } = await supabase
        .from("players")
        .select("*")
        .in("id", playerIds);
      
      if (playersError) {
        console.error("DETAILS FETCH ERROR:", playersError.message);
      }

      if (playerDetails) {
        setSquad(playerDetails.sort((a, b) => (a.first_name || "").localeCompare(b.first_name || "")));
        
        const { data: txData } = await supabase
          .from("transactions")
          .select("player_id, amount, transaction_type, fixture_id")
          .in("player_id", playerIds);
        
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
      }
    } else { 
      setSquad([]); 
    }
  }

  useEffect(() => { loadSquadData(); }, [activeFixture]);

  // Image Generation Logic
  async function downloadSquadImage() {
    if (!squadImageRef.current) return;
    try {
      showToast("Generating image...");
      const dataUrl = await toPng(squadImageRef.current, { cacheBust: true, quality: 1 });
      const link = document.createElement('a');
      link.download = `Match-Squad-vs-${activeFixture.opponent}.png`;
      link.href = dataUrl;
      link.click();
      showToast("Image Downloaded!");
    } catch (err) {
      showToast("Failed to generate image", "error");
    }
  }

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
      setPaymentData(prev => ({ ...prev, [id]: { amount: matchFee + debt, method: 'cash' } }));
    }
  }

  function updatePlayerData(id: string, field: 'amount' | 'method', value: any) {
    setPaymentData(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  const selectedPlayers = squad.filter(p => selectedPlayerIds.includes(p.id));
  
  const grandTotal = selectedPlayerIds.reduce((sum, id) => sum + (paymentData[id]?.amount || 0), 0);
  const netTotal = grandTotal - (payUmpire && activeFixture?.umpire_fee ? activeFixture.umpire_fee : 0);
  
  const squadToPay = squad.filter(p => !paidPlayerIds.includes(p.id));
  const squadPaid = squad.filter(p => paidPlayerIds.includes(p.id));

  // Quick Add Logic
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

        await supabase.from("transactions").insert([{ 
          player_id: player.id, 
          team_id: selectedTeamId, 
          fixture_id: activeFixture.id, 
          club_id: activeClubId, 
          amount: matchFee, 
          transaction_type: 'fee' 
        }]);

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
    <div className="animate-in fade-in duration-300 space-y-6 pb-20 relative overflow-x-hidden">
      
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-[200] animate-in slide-in-from-bottom-5 fade-in ${toast.type === 'success' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'} font-black uppercase tracking-widest text-[10px] whitespace-nowrap flex items-center gap-2`}>
          <i className={`fa-solid ${toast.type === 'success' ? 'fa-check' : 'fa-triangle-exclamation'}`}></i>
          {toast.msg}
        </div>
      )}

      {teams.length > 1 && (
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-3xl shadow-lg">
          <label className="text-[10px] uppercase font-black tracking-widest block mb-2 ml-1" style={{ color: themeColor }}>Admin View</label>
          <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white outline-none font-bold">
            <option value="" disabled>-- Select a Team --</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {selectedTeamId && activeFixture ? (
        <div className="bg-[#111] border border-zinc-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: themeColor }}></div>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-black italic uppercase tracking-tighter" style={{ color: themeColor }}>vs {activeFixture.opponent}</h2>
              <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest mt-1">
                {new Date(activeFixture.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </p>
              <button onClick={downloadSquadImage} className="mt-3 text-[10px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
                <i className="fa-solid fa-camera mr-2"></i> Export Graphic
              </button>
            </div>
            <button onClick={openQuickAdd} className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 flex items-center justify-center transition-colors shadow-inner" style={{ color: themeColor }}>
              <i className="fa-solid fa-user-plus text-lg"></i>
            </button>
          </div>
        </div>
      ) : selectedTeamId ? (
        <div className="text-center py-10 bg-zinc-900 rounded-3xl border border-zinc-800">
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">No upcoming fixtures found.</p>
        </div>
      ) : null}

      {/* Hidden Render Target for the Image */}
      <div className="absolute top-[-9999px] left-[-9999px]">
        <div ref={squadImageRef} className="w-[1080px] h-[1080px] bg-[#111] p-12 flex flex-col relative" style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, #222 0%, #111 70%)' }}>
          <div className="absolute top-0 left-0 w-full h-4" style={{ backgroundColor: themeColor }}></div>
          <h1 className="text-6xl font-black uppercase italic text-white mb-2">Match Squad</h1>
          <h2 className="text-4xl font-bold uppercase text-zinc-400 mb-12" style={{ color: themeColor }}>VS {activeFixture?.opponent}</h2>
          
          <div className="flex flex-wrap gap-6">
            {squad.map((player, index) => (
              <div key={player.id} className="w-[30%] bg-[#1A1A1A] border-l-4 p-6 rounded-xl" style={{ borderColor: themeColor }}>
                <span className="text-zinc-500 text-2xl font-black mr-4">{index + 1}</span>
                <span className="text-3xl font-bold text-white uppercase">{player.first_name} {player.last_name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {activeFixture && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-4 px-1">
             <h2 className="text-[11px] font-black uppercase italic tracking-widest" style={{ color: themeColor }}>To Pay ({squadToPay.length})</h2>
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
                  <button 
                    key={player.id} 
                    onClick={() => togglePlayerSelection(player.id)} 
                    className={`px-4 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all relative ${isSelected ? 'text-black scale-[1.02]' : 'bg-[#1A1A1A] text-zinc-300 border border-zinc-800/50 hover:border-zinc-600'}`}
                    style={isSelected ? { backgroundColor: themeColor, boxShadow: `0 0 15px ${themeColor}4D` } : {}}
                  >
                    {displayName}
                    {debt > 0 && !isSelected && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-zinc-950"></div>}
                  </button>
                );
              })
            )}
          </div>

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
                    <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1">
                      <button onClick={() => updatePlayerData(player.id, 'method', 'cash')} className={`w-10 h-8 rounded-lg flex items-center justify-center text-xs transition-colors ${data.method === 'cash' ? 'bg-emerald-500 text-black' : 'text-zinc-500 hover:text-white'}`}><i className="fa-solid fa-money-bill-wave"></i></button>
                      
                      <button 
                        onClick={() => {
                          const userRole = roles?.find((r: any) => r.team_id === selectedTeamId || r.club_id === activeClubId);
                          if (!userRole?.can_take_payments && profile.role !== 'super_admin' && profile.role !== 'club_admin') {
                            return showToast("You do not have permission to process card payments.", "error");
                          }
                          setActiveSquarePlayer(player);
                        }} 
                        className={`w-10 h-8 rounded-lg flex items-center justify-center text-xs transition-colors text-zinc-500 hover:text-white hover:bg-blue-500`}
                      >
                        <i className="fa-solid fa-credit-card"></i>
                      </button>
                    </div>
                  </div>
                  <div className="bg-[#111] border border-zinc-800 rounded-2xl p-3 flex justify-between items-center">
                    <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Amount Paid</span>
                    <input type="number" value={data.amount} onChange={(e) => updatePlayerData(player.id, 'amount', Number(e.target.value))} className="bg-transparent text-right text-2xl font-black text-emerald-500 outline-none w-24" />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 space-y-4">
            {activeFixture.umpire_fee > 0 && (
              <div className="bg-[#1A1A1A] border border-zinc-800 rounded-2xl p-4 flex justify-between items-center cursor-pointer" onClick={() => setPayUmpire(!payUmpire)}>
                <span className="text-xs font-black uppercase tracking-widest text-zinc-300 flex items-center gap-2"><i className="fa-solid fa-ticket text-zinc-500"></i> Pay Umpire (${activeFixture.umpire_fee})</span>
                <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${payUmpire ? 'bg-red-500' : 'bg-zinc-800'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${payUmpire ? 'translate-x-4' : ''}`}></div>
                </div>
              </div>
            )}
            <div className="flex justify-between items-end px-2">
              <span className="text-xs font-black italic text-zinc-500 uppercase tracking-widest">
                {netTotal < 0 ? 'Net Outlay:' : 'Total Collected:'}
              </span>
              <span className={`text-4xl font-black italic ${netTotal < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {netTotal < 0 ? '-' : ''}${Math.abs(netTotal).toFixed(2)}
              </span>
            </div>
            <button 
              onClick={processBatchPayments} 
              disabled={isProcessing} 
              className="w-full text-white font-black py-5 rounded-2xl uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all disabled:opacity-50"
              style={{ backgroundColor: themeColor }}
            >
              {isProcessing ? 'Saving...' : `Save ${selectedPlayers.length} Payments`}
            </button>
          </div>
        </div>
      )}

      {isQuickAddOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#111] border border-zinc-800 w-full max-w-[440px] rounded-3xl overflow-hidden flex flex-col max-h-[80vh] shadow-2xl">
            <div className="p-5 flex justify-between items-center border-b border-zinc-800">
              <h2 className="text-lg font-black italic uppercase tracking-tighter" style={{ color: themeColor }}>Add to Squad</h2>
              <button onClick={() => setIsQuickAddOpen(false)} className="text-zinc-500 hover:text-white"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <input type="text" placeholder="Search..." value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)} className="w-full bg-[#1A1A1A] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-zinc-500" />
              <div className="space-y-2">
                {availablePlayers.filter(p => `${p.first_name} ${p.last_name}`.toLowerCase().includes(playerSearch.toLowerCase())).map(p => (
                  <button key={p.id} onClick={() => addPlayerToMatch(p.id)} className="w-full flex justify-between items-center bg-[#1A1A1A] p-4 rounded-2xl hover:bg-zinc-800 transition-colors text-left group">
                    <span className="font-bold text-white text-sm">{p.first_name} {p.last_name}</span>
                    <i className="fa-solid fa-plus" style={{ color: themeColor }}></i>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SQUARE PAYMENT MODAL - WITH SAFEGUARDS */}
      {activeSquarePlayer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-[#111] border border-zinc-800 w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-black uppercase italic text-white">Card Payment</h2>
              <button onClick={() => setActiveSquarePlayer(null)} className="text-zinc-500 hover:text-white">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            
            <div className="mb-6 p-4 bg-zinc-900 rounded-2xl border border-zinc-800 flex justify-between items-center">
              <div>
                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Player</p>
                <p className="text-white font-bold">{activeSquarePlayer.first_name} {activeSquarePlayer.last_name}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Total to Charge</p>
                <p className="text-blue-400 font-black text-xl">${calculateSquareGross(paymentData[activeSquarePlayer.id]?.amount || 0)}</p>
              </div>
            </div>

            {/* SAFEGUARD: Only Render if we have the App ID and the dynamically fetched Location ID */}
            {process.env.NEXT_PUBLIC_SQUARE_APP_ID && clubLocationId ? (
              <PaymentForm
                applicationId={process.env.NEXT_PUBLIC_SQUARE_APP_ID}
                locationId={clubLocationId} 
                cardTokenizeResponseReceived={async (token: any, verifiedBuyer: any) => {
                  if (token.errors) {
                     showToast("Card Error", "error");
                     return;
                  }
                  
                  setIsProcessing(true);
                  const grossAmount = calculateSquareGross(paymentData[activeSquarePlayer.id].amount);
                  
                  try {
                    const res = await fetch('/api/payments/square', {
                      method: 'POST',
                      body: JSON.stringify({
                        sourceId: token.token,
                        amount: grossAmount,
                        clubId: activeClubId,
                        playerId: activeSquarePlayer.id,
                        fixtureId: activeFixture.id
                      })
                    });
                    
                    if (res.ok) {
                      await supabase.from("transactions").insert([{ 
                        player_id: activeSquarePlayer.id, 
                        team_id: selectedTeamId, 
                        fixture_id: activeFixture.id, 
                        club_id: activeClubId,
                        amount: paymentData[activeSquarePlayer.id].amount, 
                        transaction_type: 'payment', 
                        payment_method: 'card' 
                      }]);
                      
                      setPaidPlayerIds(prev => [...prev, activeSquarePlayer.id]);
                      setSelectedPlayerIds(prev => prev.filter(id => id !== activeSquarePlayer.id));
                      
                      showToast("Payment Successful!");
                      setActiveSquarePlayer(null);
                    } else {
                      const errorData = await res.json();
                      showToast(errorData.error || "Payment Failed", "error");
                    }
                  } catch (e) {
                    showToast("Payment Failed", "error");
                  } finally {
                    setIsProcessing(false);
                  }
                }}
              >
                <CreditCard />
              </PaymentForm>
            ) : (
              <div className="text-center py-10 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Initializing Secure SDK...</p>
                {!process.env.NEXT_PUBLIC_SQUARE_APP_ID && <p className="text-red-500 text-[10px] mt-2 font-bold">Error: Vercel App ID Missing.</p>}
                {!clubLocationId && <p className="text-red-500 text-[10px] mt-2 font-bold">Error: Location ID Missing in Club Setup.</p>}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}