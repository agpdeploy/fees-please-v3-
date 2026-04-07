"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { useActiveClub } from "@/contexts/ClubContext";
import { calculateSquareGross } from '@/lib/fees';

export default function GameDay() {
  const { profile, roles } = useProfile();
  const { activeClubId } = useActiveClub();

  const [themeColor, setThemeColor] = useState("#10b981");
  const [clubInfo, setClubInfo] = useState({ name: 'FP', logo: '' });
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [activeFixture, setActiveFixture] = useState<any>(null);
  const [squad, setSquad] = useState<any[]>([]);
  
  // Payment States
  const [teamFees, setTeamFees] = useState({ member: 10, casual: 25 });
  const [playerDebts, setPlayerDebts] = useState<Record<string, number>>({});
  const [paidPlayerIds, setPaidPlayerIds] = useState<string[]>([]); 
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [paymentData, setPaymentData] = useState<Record<string, { amount: number, method: 'cash' | 'card' }>>({});
  const [payUmpire, setPayUmpire] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Square State
  const [isSquareEnabled, setIsSquareEnabled] = useState(false);
  
  // Quick Add States
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500); 
  };

  // --- SQUARE POS RETURN HANDLER ---
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    
    const dataString = urlParams.get('data'); // iOS
    const androidTxId = urlParams.get('com.squareup.pos.CLIENT_TRANSACTION_ID'); // Android Success
    const androidError = urlParams.get('com.squareup.pos.ERROR_CODE'); // Android Fail

    if (dataString || androidTxId || androidError) {
      const pendingTxStr = localStorage.getItem('square_pending_tx');
      if (!pendingTxStr) {
        // Clean URL if we somehow get here without a pending transaction
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      const pendingTx = JSON.parse(pendingTxStr);
      let isSuccess = false;

      if (dataString) {
        try {
          const response = JSON.parse(decodeURIComponent(dataString));
          if (response.status === 'ok' || response.transaction_id) isSuccess = true;
        } catch (e) { console.error("Parse error"); }
      } else if (androidTxId) {
        isSuccess = true;
      }

      if (isSuccess) {
        supabase.from("transactions").insert([{ 
          player_id: pendingTx.player_id, team_id: pendingTx.team_id, 
          fixture_id: pendingTx.fixture_id, club_id: pendingTx.club_id,
          amount: pendingTx.fee_amount, transaction_type: 'fee' 
        }]).then(() => {
          supabase.from("transactions").insert([{ 
            player_id: pendingTx.player_id, team_id: pendingTx.team_id, 
            fixture_id: pendingTx.fixture_id, club_id: pendingTx.club_id,
            amount: pendingTx.amount, transaction_type: 'payment', payment_method: 'card' 
          }]).then(() => {
            localStorage.removeItem('square_pending_tx');
            showToast("Payment Successful!");
            window.history.replaceState({}, document.title, window.location.pathname); // Clean URL
            loadSquadData(); // Refresh the board instantly
          });
        });
      } else {
        showToast("Payment was cancelled or failed in Square.", "error");
        localStorage.removeItem('square_pending_tx');
        window.history.replaceState({}, document.title, window.location.pathname); // Clean URL
      }
    }
  }, [activeFixture, activeClubId]); // Ensure dependencies allow loadSquadData to work

  useEffect(() => {
    if (activeClubId) {
      supabase.from('clubs').select('name, logo_url, theme_color, is_square_enabled').eq('id', activeClubId).single().then(({data}) => {
        if (data) {
          if (data.theme_color) setThemeColor(data.theme_color);
          setClubInfo({ name: data.name || 'FP', logo: data.logo_url || '' });
          setIsSquareEnabled(data.is_square_enabled || false);
        }
      });
    } else {
      setIsSquareEnabled(false);
    }
  }, [activeClubId]);

  // THE CROSS-CLUB BLEED FIX IS HERE
  useEffect(() => {
    async function fetchTeams() {
      if (!profile) return;
      setLoading(true);
      let query = supabase.from("teams").select("*");
      
      if (profile.role === 'club_admin' || profile.role === 'super_admin') {
        if (activeClubId) query = query.eq('club_id', activeClubId);
      } else {
        // Explicitly filter roles so only teams belonging to the ACTIVE club are loaded
        const teamIds = roles?.filter((r: any) => r.role === 'team_admin' && r.club_id === activeClubId).map((r: any) => r.team_id).filter(Boolean) || [];
        if (teamIds.length > 0) query = query.in('id', teamIds);
        else { setTeams([]); setLoading(false); return; }
      }
      
      const { data } = await query;
      if (data) {
        setTeams(data);
        if (data.length === 1) setSelectedTeamId(data[0].id); // Auto-selects if only 1 team!
      }
      setLoading(false);
    }
    fetchTeams();
  }, [profile, roles, activeClubId]);

  useEffect(() => {
    if (!selectedTeamId) return;
    async function loadTeamData() {
      const { data: teamData } = await supabase.from("teams").select("member_fee, casual_fee").eq("id", selectedTeamId).single();
      if (teamData) setTeamFees({ member: teamData.member_fee || 10, casual: teamData.casual_fee || 25 });
      const today = new Date().toISOString().split('T')[0];
      const { data: fixData } = await supabase.from('fixtures').select('*').eq('team_id', selectedTeamId).gte('match_date', today).order('match_date', { ascending: true }).limit(1).maybeSingle();
      setActiveFixture(fixData || null);
    }
    loadTeamData();
  }, [selectedTeamId]);

  async function loadSquadData() {
    if (!activeFixture) { setSquad([]); return; }
    const { data: squadRows } = await supabase.from('match_squads').select('player_id').eq('fixture_id', activeFixture.id);
    if (squadRows && squadRows.length > 0) {
      const playerIds = squadRows.map(row => row.player_id);
      const { data: playerDetails } = await supabase.from("players").select("*").in("id", playerIds);
      if (playerDetails) {
        setSquad(playerDetails.sort((a, b) => (a.first_name || "").localeCompare(b.first_name || "")));
        const { data: txData } = await supabase.from("transactions").select("player_id, amount, transaction_type, fixture_id").in("player_id", playerIds);
        const debts: Record<string, number> = {};
        const paidToday: string[] = []; 
        if (txData) {
          txData.forEach(tx => {
            if (tx.transaction_type === 'fee') debts[tx.player_id] = (debts[tx.player_id] || 0) + Number(tx.amount);
            if (tx.transaction_type === 'payment') {
              debts[tx.player_id] = (debts[tx.player_id] || 0) - Number(tx.amount);
              if (tx.fixture_id === activeFixture.id) paidToday.push(tx.player_id);
            }
          });
        }
        setPlayerDebts(debts); setPaidPlayerIds(paidToday);
      }
    } else {
      setSquad([]);
    }
  }
  
  useEffect(() => { loadSquadData(); }, [activeFixture]);

  // --- SQUARE TAP TO PAY ---
  const initiateTapToPay = (player: any) => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) {
      return showToast("Tap-to-Pay requires a mobile phone.", "error");
    }

    const netAmount = paymentData[player.id]?.amount || 0;
    if (netAmount <= 0) return showToast("Amount must be > $0", "error");

    const grossAmount = calculateSquareGross(netAmount);
    const amountCents = Math.round(grossAmount * 100);
    const feeAmount = player.is_member ? teamFees.member : teamFees.casual;

    localStorage.setItem('square_pending_tx', JSON.stringify({
      player_id: player.id, team_id: selectedTeamId, fixture_id: activeFixture?.id, club_id: activeClubId, amount: netAmount, fee_amount: feeAmount 
    }));

    // Ensure trailing slash so Android correctly identifies it as the PWA root scope
    const callbackUrl = window.location.origin + '/';
    const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
    
    if (!appId) {
      return showToast("Square App ID is missing.", "error");
    }

    const matchNotes = `${player.first_name} Match Fees (${activeFixture?.opponent || 'TBA'})`;

    const isAndroid = /Android/i.test(navigator.userAgent);

    if (isAndroid) {
      const androidIntent = 
        `intent:#Intent;` +
        `action=com.squareup.pos.action.CHARGE;` +
        `package=com.squareup;` +
        `S.com.squareup.pos.WEB_CALLBACK_URI=${callbackUrl};` +
        `S.com.squareup.pos.CLIENT_ID=${appId};` +
        `S.com.squareup.pos.API_VERSION=v2.0;` +
        `i.com.squareup.pos.TOTAL_AMOUNT=${amountCents};` +
        `S.com.squareup.pos.CURRENCY_CODE=AUD;` +
        `S.com.squareup.pos.TENDER_TYPES=com.squareup.pos.TENDER_CARD,com.squareup.pos.TENDER_CONTACTLESS;` +
        `S.com.squareup.pos.NOTE=${encodeURIComponent(matchNotes)};` + 
        `end`;
      window.location.href = androidIntent;
    } else {
      const data = {
        amount_money: { amount: amountCents, currency_code: "AUD" },
        callback_url: callbackUrl,
        client_id: appId,
        version: "1.3",
        notes: matchNotes,
        options: { supported_tender_types: ["CREDIT_CARD", "APPLE_PAY", "GOOGLE_PAY"] }
      };
      window.location.href = `square-commerce-v1://payment/create?data=${encodeURIComponent(JSON.stringify(data))}`;
    }

    setTimeout(() => {
      if (!document.hidden) showToast("Square POS App not found.", "error");
    }, 2500);
  };

  function togglePlayerSelection(id: string) {
    if (selectedPlayerIds.includes(id)) {
      setSelectedPlayerIds(prev => prev.filter(pId => pId !== id));
      setPaymentData(prev => { const newData = { ...prev }; delete newData[id]; return newData; });
    } else {
      const player = squad.find(p => p.id === id);
      if (!player) return;
      const amount = (player.is_member ? teamFees.member : teamFees.casual) + Math.max(0, playerDebts[id] || 0);
      setSelectedPlayerIds(prev => [...prev, id]);
      setPaymentData(prev => ({ ...prev, [id]: { amount, method: 'cash' } }));
    }
  }

  async function processBatchPayments() {
    if (selectedPlayers.length === 0 || !activeFixture || !activeClubId) return;
    setIsProcessing(true);
    try {
      for (const player of selectedPlayers) {
        const method = paymentData[player.id]?.method || 'cash';
        
        if (isSquareEnabled && method === 'card') continue;

        await supabase.from("transactions").insert([{ player_id: player.id, team_id: selectedTeamId, fixture_id: activeFixture.id, club_id: activeClubId, amount: player.is_member ? teamFees.member : teamFees.casual, transaction_type: 'fee' }]);
        await supabase.from("transactions").insert([{ player_id: player.id, team_id: selectedTeamId, fixture_id: activeFixture.id, club_id: activeClubId, amount: paymentData[player.id].amount, transaction_type: 'payment', payment_method: method }]);
      }
      if (payUmpire && activeFixture.umpire_fee > 0) {
        await supabase.from("transactions").insert([{ team_id: selectedTeamId, fixture_id: activeFixture.id, club_id: activeClubId, amount: activeFixture.umpire_fee, transaction_type: 'expense', payment_method: 'cash', description: 'Umpire Payment' }]);
      }
      await loadSquadData(); setSelectedPlayerIds([]); setPaymentData({}); setPayUmpire(false); showToast(`Saved!`);
    } catch (err) { showToast("Error", "error"); } finally { setIsProcessing(false); }
  }

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

  const selectedPlayers = squad.filter(p => selectedPlayerIds.includes(p.id));
  const squadToPay = squad.filter(p => !paidPlayerIds.includes(p.id));
  const squadPaid = squad.filter(p => paidPlayerIds.includes(p.id));
  const netTotal = selectedPlayerIds.reduce((sum, id) => sum + (paymentData[id]?.amount || 0), 0) - (payUmpire ? (activeFixture?.umpire_fee || 0) : 0);

  const processableCount = selectedPlayers.filter(p => {
    const method = paymentData[p.id]?.method || 'cash';
    return !(isSquareEnabled && method === 'card');
  }).length;

  if (loading) return <div className="text-center p-6 text-zinc-500 text-xs font-black animate-pulse uppercase tracking-widest">Loading GameDay...</div>;

  return (
    <div className="animate-in fade-in duration-300 space-y-6 pb-20 relative overflow-x-hidden">
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-[200] animate-in slide-in-from-bottom-5 ${toast.type === 'success' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'} font-black uppercase tracking-widest text-[10px] whitespace-nowrap flex items-center gap-2`}>
          <i className={`fa-solid ${toast.type === 'success' ? 'fa-check' : 'fa-triangle-exclamation'}`}></i> {toast.msg}
        </div>
      )}

      {teams.length > 1 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-3xl shadow-lg transition-colors">
          <label className="text-[10px] uppercase font-black tracking-widest block mb-2 ml-1" style={{ color: themeColor }}>Admin View</label>
          <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none font-bold transition-colors">
            <option value="" disabled>-- Select a Team --</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {selectedTeamId && activeFixture ? (
        <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden transition-colors">
          <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: themeColor }}></div>
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-black italic uppercase tracking-tighter" style={{ color: themeColor }}>vs {activeFixture.opponent}</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest mt-1">
                {activeFixture.start_time && `${activeFixture.start_time} • `}
                {new Date(activeFixture.match_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                {activeFixture.location && ` • ${activeFixture.location}`}
              </p>
              {activeFixture.notes && (
                <p className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-1.5 italic font-bold">{activeFixture.notes}</p>
              )}
            </div>
            <button onClick={openQuickAdd} className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 flex items-center justify-center shadow-inner transition-colors" style={{ color: themeColor }}>
              <i className="fa-solid fa-user-plus text-lg"></i>
            </button>
          </div>
        </div>
      ) : selectedTeamId ? (
        <div className="text-center py-10 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 transition-colors">
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">No upcoming fixtures found.</p>
        </div>
      ) : null}

      {/* --- PAYMENT & COLLECTION AREA --- */}
      {activeFixture && (
        <div className="mb-4 mt-8 border-t border-zinc-200 dark:border-zinc-800/50 pt-6 transition-colors">
          <div className="flex justify-between items-center mb-4 px-1">
             <h2 className="text-[11px] font-black uppercase italic tracking-widest" style={{ color: themeColor }}>To Pay ({squadToPay.length})</h2>
             <button onClick={() => {setSelectedPlayerIds([]); setPaymentData({});}} className="text-[9px] font-black uppercase text-zinc-500 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400">Clear All</button>
          </div>
          
          <div className="flex flex-wrap gap-2.5 mb-6">
            {squadToPay.length === 0 && squadPaid.length > 0 ? (
              <div className="w-full text-center py-6 border border-dashed border-emerald-500/30 dark:border-emerald-900/50 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 transition-colors">
                <i className="fa-solid fa-check-double text-2xl text-emerald-500 mb-2"></i>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500">All settled!</p>
              </div>
            ) : (
              squadToPay.map(player => {
                const isSelected = selectedPlayerIds.includes(player.id);
                const debt = Math.max(0, playerDebts[player.id] || 0);
                return (
                  <button 
                    key={player.id} 
                    onClick={() => togglePlayerSelection(player.id)} 
                    className={`px-4 py-3 rounded-2xl font-black text-[11px] uppercase transition-all relative ${isSelected ? 'text-black scale-[1.02]' : 'bg-white dark:bg-[#1A1A1A] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-400 dark:hover:border-zinc-600'}`}
                    style={isSelected ? { backgroundColor: themeColor, boxShadow: `0 0 15px ${themeColor}4D` } : {}}
                  >
                    {player.nickname || `${player.first_name} ${player.last_name?.charAt(0)}.`}
                    {debt > 0 && !isSelected && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-zinc-950"></div>}
                  </button>
                );
              })
            )}
          </div>

          {squadPaid.length > 0 && (
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-600 mb-3 px-1 mt-6 border-t border-zinc-200 dark:border-zinc-800 pt-4 transition-colors">Paid Today ({squadPaid.length})</h2>
              <div className="flex flex-wrap gap-2">
                 {squadPaid.map(p => (<div key={p.id} className="px-3 py-2 rounded-xl font-bold text-[10px] uppercase bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-800/50 flex items-center gap-2 transition-colors"><i className="fa-solid fa-check text-emerald-500/50"></i> {p.nickname || `${p.first_name} ${p.last_name?.charAt(0)}.`}</div>))}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedPlayers.length > 0 && (
        <div className="space-y-4 animate-in slide-in-from-bottom-6">
          {selectedPlayers.map(player => {
            const data = paymentData[player.id];
            const debt = Math.max(0, playerDebts[player.id] || 0);
            const matchFee = player.is_member ? teamFees.member : teamFees.casual;

            return (
              <div key={player.id} className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-lg relative transition-colors">
                <button onClick={() => togglePlayerSelection(player.id)} className="absolute top-4 right-4 text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"><i className="fa-solid fa-xmark"></i></button>
                <div className="flex justify-between items-start mb-4 pr-6">
                  <div>
                    <h3 className="text-zinc-900 dark:text-white font-black text-sm uppercase tracking-wide">
                      {player.nickname || `${player.first_name} ${player.last_name}`}
                    </h3>
                    <div className="flex gap-2 mt-1 text-[9px] font-black uppercase tracking-widest">
                      {debt > 0 && <span className="text-red-500">Debt: ${debt}</span>}
                      <span className="text-emerald-500">Fee: ${matchFee}</span>
                    </div>
                  </div>
                  <div className="flex bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-1 transition-colors">
                    <button 
                      onClick={() => setPaymentData(prev => ({...prev, [player.id]: {...prev[player.id], method: 'cash'}}))} 
                      className={`w-10 h-8 rounded-lg flex items-center justify-center text-xs transition-colors ${data?.method === 'cash' ? 'bg-emerald-500 text-black' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                    >
                      <i className="fa-solid fa-money-bill-wave"></i>
                    </button>
                    
                    <button 
                      onClick={() => {
                        setPaymentData(prev => ({...prev, [player.id]: {...prev[player.id], method: 'card'}}));
                        
                        if (isSquareEnabled) {
                          const userRole = roles?.find((r: any) => r.club_id === activeClubId && (r.team_id === selectedTeamId || r.role === 'club_admin'));
                          if (!userRole?.can_take_payments && profile.role !== 'super_admin' && profile.role !== 'club_admin') {
                            return showToast("Permission Denied", "error");
                          }
                          initiateTapToPay(player);
                        }
                      }} 
                      className={`w-10 h-8 rounded-lg flex items-center justify-center text-xs transition-colors ${data?.method === 'card' ? 'bg-blue-500 text-white' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                    >
                      <i className="fa-solid fa-credit-card"></i>
                    </button>
                  </div>
                </div>
                <div className="bg-zinc-50 dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 flex justify-between items-center transition-colors">
                    <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Amount Paid</span>
                    <input type="number" value={data?.amount} onChange={(e) => setPaymentData(prev => ({...prev, [player.id]: {...prev[player.id], amount: Number(e.target.value)}}))} className="bg-transparent text-right text-2xl font-black text-emerald-500 outline-none w-24" />
                </div>
              </div>
            );
          })}
          
          <div className="pt-4 space-y-4">
            {activeFixture.umpire_fee > 0 && (
              <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex justify-between items-center cursor-pointer transition-colors" onClick={() => setPayUmpire(!payUmpire)}>
                <span className="text-xs font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300 flex items-center gap-2"><i className="fa-solid fa-ticket text-zinc-500"></i> Pay Umpire (${activeFixture.umpire_fee})</span>
                <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${payUmpire ? 'bg-red-500' : 'bg-zinc-300 dark:bg-zinc-800'}`}>
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
            
            <button onClick={processBatchPayments} disabled={isProcessing || processableCount === 0} className="w-full text-white font-black py-5 rounded-2xl uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all disabled:opacity-50" style={{ backgroundColor: themeColor }}>
              {isProcessing ? 'Saving...' : `Save ${processableCount} Payment${processableCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}

      {isQuickAddOpen && (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/80 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-4 transition-colors">
          <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 w-full max-w-[440px] rounded-3xl overflow-hidden flex flex-col max-h-[80vh] shadow-2xl transition-colors">
            <div className="p-5 flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 transition-colors">
              <h2 className="text-lg font-black italic uppercase tracking-tighter" style={{ color: themeColor }}>Add to Squad</h2>
              <button onClick={() => setIsQuickAddOpen(false)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <input type="text" placeholder="Search..." value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)} className="w-full bg-zinc-50 dark:bg-[#1A1A1A] border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-zinc-500 transition-colors" />
              <div className="space-y-2">
                {availablePlayers.filter(p => `${p.first_name} ${p.last_name} ${p.nickname}`.toLowerCase().includes(playerSearch.toLowerCase())).map(p => (
                  <button key={p.id} onClick={() => addPlayerToMatch(p.id)} className="w-full flex justify-between items-center bg-zinc-50 dark:bg-[#1A1A1A] p-4 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left group">
                    <span className="font-bold text-zinc-900 dark:text-white text-sm">{p.first_name} {p.last_name} {p.nickname && <span className="text-zinc-500 font-normal italic ml-1">"{p.nickname}"</span>}</span>
                    <i className="fa-solid fa-plus" style={{ color: themeColor }}></i>
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