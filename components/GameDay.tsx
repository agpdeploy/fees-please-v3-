"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { useActiveClub } from "@/contexts/ClubContext";
import { toPng } from 'html-to-image';
import { calculateSquareGross } from '@/lib/fees';

export default function GameDay() {
  const { profile, roles } = useProfile();
  const { activeClubId } = useActiveClub();
  const squadImageRef = useRef<HTMLDivElement>(null);

  const [themeColor, setThemeColor] = useState("#10b981");
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [activeFixture, setActiveFixture] = useState<any>(null);
  const [squad, setSquad] = useState<any[]>([]);
  const [teamFees, setTeamFees] = useState({ member: 10, casual: 25 });
  const [playerDebts, setPlayerDebts] = useState<Record<string, number>>({});
  const [paidPlayerIds, setPaidPlayerIds] = useState<string[]>([]); 
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [paymentData, setPaymentData] = useState<Record<string, { amount: number, method: 'cash' | 'card' }>>({});
  const [payUmpire, setPayUmpire] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
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
    
    // Square returns results as query parameters on Android, or a 'data' string on iOS
    const dataString = urlParams.get('data');
    const androidStatus = urlParams.get('com.squareup.pos.RESULT_NAME'); 

    if (dataString || androidStatus) {
      const pendingTxStr = localStorage.getItem('square_pending_tx');
      if (!pendingTxStr) return;

      const pendingTx = JSON.parse(pendingTxStr);
      let isSuccess = false;

      if (dataString) {
        try {
          const response = JSON.parse(decodeURIComponent(dataString));
          if (response.status === 'ok' || response.transaction_id) isSuccess = true;
        } catch (e) { console.error("Parse error"); }
      } else if (androidStatus && androidStatus.includes('SUCCESS')) {
        isSuccess = true;
      }

      if (isSuccess) {
        supabase.from("transactions").insert([{ 
          player_id: pendingTx.player_id, team_id: pendingTx.team_id, 
          fixture_id: pendingTx.fixture_id, club_id: pendingTx.club_id,
          amount: pendingTx.amount, transaction_type: 'payment', payment_method: 'card' 
        }]).then(() => {
          showToast("Payment Recorded Successfully!", "success");
          setPaidPlayerIds(prev => [...prev, pendingTx.player_id]);
          localStorage.removeItem('square_pending_tx');
        });
      } else {
        showToast("Payment was cancelled or failed in Square.", "error");
      }
      
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [activeFixture, selectedTeamId, activeClubId]);

  useEffect(() => {
    if (activeClubId) {
      supabase.from('clubs').select('theme_color').eq('id', activeClubId).single().then(({data}) => {
        if (data?.theme_color) setThemeColor(data.theme_color);
      });
    }
  }, [activeClubId]);

  useEffect(() => {
    async function fetchTeams() {
      if (!profile) return;
      setLoading(true);
      let query = supabase.from("teams").select("*");
      if (profile.role === 'club_admin' || profile.role === 'super_admin') {
        if (activeClubId) query = query.eq('club_id', activeClubId);
      } else {
        const teamIds = roles?.filter((r: any) => r.role === 'team_admin').map((r: any) => r.team_id).filter(Boolean) || [];
        if (teamIds.length > 0) query = query.in('id', teamIds);
        else { setTeams([]); setLoading(false); return; }
      }
      const { data } = await query;
      if (data) {
        setTeams(data);
        if (data.length === 1) setSelectedTeamId(data[0].id);
      }
      setLoading(false);
    }
    fetchTeams();
  }, [profile, roles, activeClubId]);

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
    }
  }
  useEffect(() => { loadSquadData(); }, [activeFixture]);

  // --- THE "TAP TO PAY" ENGINE ---
  const initiateTapToPay = (player: any) => {
    // 1. Friendly Desktop Check
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) {
      return showToast("Tap-to-Pay requires a mobile phone. Please use your phone.", "error");
    }

    const netAmount = paymentData[player.id]?.amount || 0;
    if (netAmount <= 0) return showToast("Amount must be greater than $0", "error");

    const grossAmount = calculateSquareGross(netAmount);
    const amountCents = Math.round(grossAmount * 100);

    localStorage.setItem('square_pending_tx', JSON.stringify({
      player_id: player.id, team_id: selectedTeamId, fixture_id: activeFixture?.id, club_id: activeClubId, amount: netAmount 
    }));

    const callbackUrl = "https://feesplease.app/gameday";
    const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;

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
        `S.com.squareup.pos.TENDER_TYPES=com.squareup.pos.TENDER_CARD,com.squareup.pos.TENDER_CARD_ON_FILE,com.squareup.pos.TENDER_CONTACTLESS;` +
        `end`;
      window.location.href = androidIntent;
    } else {
      const data = {
        amount_money: { amount: amountCents, currency_code: "AUD" },
        callback_url: callbackUrl,
        client_id: appId,
        version: "1.3",
        notes: `Match Fee: ${player.first_name}`,
        options: { supported_tender_types: ["CREDIT_CARD", "APPLE_PAY", "GOOGLE_PAY"] }
      };
      window.location.href = `square-commerce-v1://payment/create?data=${encodeURIComponent(JSON.stringify(data))}`;
    }

    // 2. Friendly Missing App Check
    // If the browser hasn't been backgrounded after 2.5 seconds, it means the app switch failed.
    setTimeout(() => {
      if (!document.hidden) {
        showToast("Square POS App not found. Please install it from the App Store or Google Play.", "error");
      }
    }, 2500);
  };

  async function downloadSquadImage() {
    if (!squadImageRef.current) return;
    try {
      showToast("Generating image...");
      const dataUrl = await toPng(squadImageRef.current, { cacheBust: true, quality: 1 });
      const link = document.createElement('a'); link.download = `Match-Squad.png`; link.href = dataUrl; link.click();
      showToast("Downloaded!");
    } catch (err) { showToast("Error generating image", "error"); }
  }

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
        if (paymentData[player.id]?.method !== 'cash') continue;
        await supabase.from("transactions").insert([{ player_id: player.id, team_id: selectedTeamId, fixture_id: activeFixture.id, club_id: activeClubId, amount: player.is_member ? teamFees.member : teamFees.casual, transaction_type: 'fee' }]);
        await supabase.from("transactions").insert([{ player_id: player.id, team_id: selectedTeamId, fixture_id: activeFixture.id, club_id: activeClubId, amount: paymentData[player.id].amount, transaction_type: 'payment', payment_method: 'cash' }]);
      }
      if (payUmpire && activeFixture.umpire_fee > 0) {
        await supabase.from("transactions").insert([{ team_id: selectedTeamId, fixture_id: activeFixture.id, club_id: activeClubId, amount: activeFixture.umpire_fee, transaction_type: 'expense', payment_method: 'cash', description: 'Umpire Payment' }]);
      }
      await loadSquadData(); setSelectedPlayerIds([]); setPaymentData({}); setPayUmpire(false); showToast(`Saved!`);
    } catch (err) { showToast("Error", "error"); } finally { setIsProcessing(false); }
  }

  const selectedPlayers = squad.filter(p => selectedPlayerIds.includes(p.id));
  const squadToPay = squad.filter(p => !paidPlayerIds.includes(p.id));
  const squadPaid = squad.filter(p => paidPlayerIds.includes(p.id));
  const netTotal = selectedPlayerIds.reduce((sum, id) => sum + (paymentData[id]?.amount || 0), 0) - (payUmpire ? (activeFixture?.umpire_fee || 0) : 0);

  if (loading) return <div className="text-center p-6 text-zinc-500 text-xs font-black animate-pulse">Loading GameDay...</div>;

  return (
    <div className="animate-in fade-in duration-300 space-y-6 pb-20 relative overflow-x-hidden">
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl z-[200] animate-in slide-in-from-bottom-5 ${toast.type === 'success' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'} font-black uppercase tracking-widest text-[10px] whitespace-nowrap flex items-center gap-2`}>
          <i className={`fa-solid ${toast.type === 'success' ? 'fa-check' : 'fa-triangle-exclamation'}`}></i> {toast.msg}
        </div>
      )}

      {selectedTeamId && activeFixture && (
        <div className="bg-[#111] border border-zinc-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: themeColor }}></div>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-black italic uppercase" style={{ color: themeColor }}>vs {activeFixture.opponent}</h2>
              <p className="text-xs text-zinc-400 font-bold uppercase">{new Date(activeFixture.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
              <button onClick={downloadSquadImage} className="mt-3 text-[10px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">Export Graphic</button>
            </div>
            <button onClick={() => setIsQuickAddOpen(true)} className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-inner" style={{ color: themeColor }}><i className="fa-solid fa-user-plus text-lg"></i></button>
          </div>
        </div>
      )}

      <div className="absolute top-[-9999px] left-[-9999px]">
        <div ref={squadImageRef} className="w-[1080px] h-[1080px] bg-[#111] p-12 flex flex-col relative" style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, #222 0%, #111 70%)' }}>
          <div className="absolute top-0 left-0 w-full h-4" style={{ backgroundColor: themeColor }}></div>
          <h1 className="text-6xl font-black uppercase italic text-white mb-2">Match Squad</h1>
          <h2 className="text-4xl font-bold uppercase text-zinc-400 mb-12" style={{ color: themeColor }}>VS {activeFixture?.opponent}</h2>
          <div className="flex flex-wrap gap-6">{squad.map((p, i) => (<div key={p.id} className="w-[30%] bg-[#1A1A1A] border-l-4 p-6 rounded-xl" style={{ borderColor: themeColor }}><span className="text-zinc-500 text-2xl font-black mr-4">{i + 1}</span><span className="text-3xl font-bold text-white uppercase">{p.first_name} {p.last_name}</span></div>))}</div>
        </div>
      </div>

      {activeFixture && (
        <div className="mb-4">
          <h2 className="text-[11px] font-black uppercase italic tracking-widest mb-4 px-1" style={{ color: themeColor }}>To Pay ({squadToPay.length})</h2>
          <div className="flex flex-wrap gap-2.5 mb-6">
            {squadToPay.map(player => (
              <button key={player.id} onClick={() => togglePlayerSelection(player.id)} className={`px-4 py-3 rounded-2xl font-black text-[11px] uppercase transition-all ${selectedPlayerIds.includes(player.id) ? 'text-black scale-[1.02]' : 'bg-[#1A1A1A] text-zinc-300 border border-zinc-800/50'}`} style={selectedPlayerIds.includes(player.id) ? { backgroundColor: themeColor } : {}}>
                {player.first_name} {player.last_name?.charAt(0)}.
                {Math.max(0, playerDebts[player.id] || 0) > 0 && !selectedPlayerIds.includes(player.id) && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>}
              </button>
            ))}
          </div>
          {squadPaid.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-4 border-t border-zinc-800">
               {squadPaid.map(p => (<div key={p.id} className="px-3 py-2 rounded-xl font-bold text-[10px] uppercase bg-zinc-900 text-zinc-600 flex items-center gap-2"><i className="fa-solid fa-check text-emerald-500/50"></i> {p.first_name} {p.last_name?.charAt(0)}.</div>))}
            </div>
          )}
        </div>
      )}

      {selectedPlayers.length > 0 && (
        <div className="space-y-4 animate-in slide-in-from-bottom-6">
          {selectedPlayers.map(player => {
            const data = paymentData[player.id];
            return (
              <div key={player.id} className="bg-[#1A1A1A] border border-zinc-800 rounded-3xl p-5 shadow-lg relative">
                <div className="flex justify-between items-start mb-4 pr-6">
                  <div>
                    <h3 className="text-white font-black text-sm uppercase">{player.first_name} {player.last_name}</h3>
                    <div className="flex gap-2 mt-1 text-[9px] font-black uppercase text-emerald-500">Total Owed: ${data?.amount}</div>
                  </div>
                  <div className="flex bg-zinc-900 rounded-xl p-1">
                    <button 
                      onClick={() => setPaymentData(prev => ({...prev, [player.id]: {...prev[player.id], method: 'cash'}}))} 
                      className={`w-10 h-8 rounded-lg text-xs ${data?.method === 'cash' ? 'bg-emerald-500 text-black' : 'text-zinc-500'}`}
                    >
                      <i className="fa-solid fa-money-bill-wave"></i>
                    </button>
                    <button 
                      onClick={() => {
                        const userRole = roles?.find((r: any) => r.team_id === selectedTeamId || r.club_id === activeClubId);
                        if (!userRole?.can_take_payments && profile.role !== 'super_admin' && profile.role !== 'club_admin') {
                          return showToast("Permission Denied", "error");
                        }
                        setPaymentData(prev => ({...prev, [player.id]: {...prev[player.id], method: 'card'}}));
                        initiateTapToPay(player);
                      }} 
                      className={`w-10 h-8 rounded-lg text-xs text-zinc-500 hover:bg-blue-500 hover:text-white transition-colors`}
                    >
                      <i className="fa-solid fa-credit-card"></i>
                    </button>
                  </div>
                </div>
                <input type="number" value={data?.amount} onChange={(e) => setPaymentData(prev => ({...prev, [player.id]: {...prev[player.id], amount: Number(e.target.value)}}))} className="w-full bg-[#111] border border-zinc-800 rounded-2xl p-3 text-right text-2xl font-black text-emerald-500 outline-none" />
              </div>
            );
          })}
          <div className="pt-4 space-y-4">
            <div className="flex justify-between items-end px-2"><span className="text-xs font-black italic text-zinc-500 uppercase">Cash to Save:</span><span className={`text-4xl font-black italic text-emerald-500`}>${Math.abs(netTotal).toFixed(2)}</span></div>
            <button onClick={processBatchPayments} disabled={isProcessing || selectedPlayers.filter(p => paymentData[p.id]?.method === 'cash').length === 0} className="w-full text-white font-black py-5 rounded-2xl uppercase tracking-widest text-sm" style={{ backgroundColor: themeColor }}>
              {isProcessing ? 'Saving...' : `Save ${selectedPlayers.filter(p => paymentData[p.id]?.method === 'cash').length} Cash Payments`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}