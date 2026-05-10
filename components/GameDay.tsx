// app/dashboard/gameday/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { useActiveClub } from "@/contexts/ClubContext";
import { calculateSquareGross } from '@/lib/fees';
import AiReporterModal from "@/components/AiReporterModal";

export default function GameDay() {
  const { profile, roles } = useProfile();
  const { activeClubId } = useActiveClub();

  const [clubInfo, setClubInfo] = useState({ name: 'FP', logo: '', expense_label: '', pay_id_type: '', pay_id_value: '' });
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  
  const [activeFixture, setActiveFixture] = useState<any>(null);
  const [pastFixtures, setPastFixtures] = useState<any[]>([]);
  const [showPastFixtures, setShowPastFixtures] = useState(false);
  
  const [squad, setSquad] = useState<any[]>([]);
  const [isSquadLoading, setIsSquadLoading] = useState(false); 
  const [availabilityData, setAvailabilityData] = useState<any[]>([]);
  
  // Payment States
  const [teamFees, setTeamFees] = useState({ member: 10, casual: 25 });
  const [playerDebts, setPlayerDebts] = useState<Record<string, number>>({});
  const [paidPlayerIds, setPaidPlayerIds] = useState<string[]>([]); 
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [paymentData, setPaymentData] = useState<Record<string, { amount: number, method: 'cash' | 'card' }>>({});
  
  // Umpire/Expense State
  const [payUmpire, setPayUmpire] = useState(false);
  const [isUmpirePaid, setIsUmpirePaid] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Square State
  const [isSquareEnabled, setIsSquareEnabled] = useState(false);
  
  // Manage Squad States
  const [isManageSquadOpen, setIsManageSquadOpen] = useState(false);
  const [clubPlayers, setClubPlayers] = useState<any[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");

  // Digital Transfer / PayID Modal States
  const [isPayIdModalOpen, setIsPayIdModalOpen] = useState(false);
  const [activePayIdPlayer, setActivePayIdPlayer] = useState<any>(null);

  // Finalise Match Modal States
  const [isFinaliseModalOpen, setIsFinaliseModalOpen] = useState(false);
  const [finaliseStatus, setFinaliseStatus] = useState<'completed' | 'abandoned'>('completed');
  const [chargeAbandonedFee, setChargeAbandonedFee] = useState(false);
  
  // AI Modal States (Decoupled to handle past matches)
  const [aiModalFixture, setAiModalFixture] = useState<any>(null);
  const [aiModalSquad, setAiModalSquad] = useState<any[]>([]);
  
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500); 
  };

  // --- PERMISSION CHECK ---
  const currentClubRole = roles?.find((r: any) => r.club_id === activeClubId)?.role;
  const isSuperAdmin = profile?.role === 'super_admin';
  const isClubAdmin = currentClubRole === 'club_admin';
  const isTeamCaptain = roles?.some((r: any) => r.role === 'team_admin' && r.team_id === selectedTeamId);
  const canManage = isSuperAdmin || isClubAdmin || isTeamCaptain;
  // -------------------------

  // --- SQUARE POS RETURN HANDLER ---
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    
    const dataString = urlParams.get('data');
    const androidTxId = urlParams.get('com.squareup.pos.CLIENT_TRANSACTION_ID');
    const androidError = urlParams.get('com.squareup.pos.ERROR_CODE');

    if (dataString || androidTxId || androidError) {
      const pendingTxStr = localStorage.getItem('square_pending_tx');
      
      const cleanUrl = () => {
        setTimeout(() => {
          window.history.replaceState({}, document.title, window.location.pathname);
        }, 50);
      };

      if (!pendingTxStr) {
        cleanUrl();
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
            cleanUrl();
            loadSquadData(); 
          });
        });
      } else {
        localStorage.removeItem('square_pending_tx');
        cleanUrl();
        showToast("Payment was cancelled or failed.", "error");
      }
    }
  }, []);

  useEffect(() => {
    if (activeClubId) {
      supabase.from('clubs')
        .select('name, logo_url, is_square_enabled, expense_label, pay_id_type, pay_id_value')
        .eq('id', activeClubId)
        .single()
        .then(({data}) => {
          if (data) {
            setClubInfo({ 
              name: data.name || 'FP', 
              logo: data.logo_url || '', 
              expense_label: data.expense_label || '',
              pay_id_type: data.pay_id_type || '',
              pay_id_value: data.pay_id_value || ''
            });
            setIsSquareEnabled(data.is_square_enabled || false);
          }
      });
    } else {
      setIsSquareEnabled(false);
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
        const teamIds = roles?.filter((r: any) => r.role === 'team_admin' && r.club_id === activeClubId).map((r: any) => r.team_id).filter(Boolean) || [];
        if (teamIds.length > 0) query = query.in('id', teamIds);
        else { setTeams([]); setLoading(false); return; }
      }
      
      const { data } = await query;
      if (data) {
        setTeams(data);
        if (data.length > 0) setSelectedTeamId(data[0].id); 
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
      
      const { data: allFix } = await supabase
        .from('fixtures')
        .select('*')
        .eq('team_id', selectedTeamId);
        
      if (allFix) {
        const upcoming = allFix.filter(f => !['completed', 'forfeited', 'abandoned'].includes(f.status))
          .sort((a,b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime());
        const past = allFix.filter(f => ['completed', 'forfeited', 'abandoned'].includes(f.status))
          .sort((a,b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime());

        setActiveFixture(upcoming.length > 0 ? upcoming[0] : null);
        setPastFixtures(past);
      } else {
        setActiveFixture(null);
        setPastFixtures([]);
      }
    }
    loadTeamData();
  }, [selectedTeamId]);

  async function loadSquadData() {
    if (!activeFixture) { setSquad([]); return; }
    
    setIsSquadLoading(true);
    const { data: fixtureTx } = await supabase.from('transactions').select('transaction_type').eq('fixture_id', activeFixture.id).eq('transaction_type', 'expense');
    const hasPaidUmpire = (fixtureTx?.length || 0) > 0;
    setIsUmpirePaid(hasPaidUmpire);
    if (hasPaidUmpire) setPayUmpire(false);

    const { data: squadRows } = await supabase.from('match_squads').select('player_id').eq('fixture_id', activeFixture.id);
    
    const playerIds = squadRows ? [...new Set(squadRows.map(row => row.player_id))] : [];

    if (playerIds.length > 0) {
      const { data: playerDetails } = await supabase.from("players").select("*").in("id", playerIds);
      
      if (playerDetails) {
        setSquad(playerDetails.sort((a, b) => (a.first_name || "").localeCompare(b.first_name || "")));
        
        const { data: txData } = await supabase.from("transactions").select("player_id, amount, transaction_type, fixture_id").in("player_id", playerIds);
        const debts: Record<string, number> = {};
        const paidToday: string[] = []; 
        if (txData) {
          txData.forEach(tx => {
            if (tx.transaction_type === 'fee') {
              debts[tx.player_id] = (debts[tx.player_id] || 0) + Number(tx.amount);
              // Any fee for today's match means they've been processed
              if (tx.fixture_id === activeFixture.id && !paidToday.includes(tx.player_id)) {
                paidToday.push(tx.player_id);
              }
            }
            if (tx.transaction_type === 'payment') {
              debts[tx.player_id] = (debts[tx.player_id] || 0) - Number(tx.amount);
              // Or if they made a manual payment today
              if (tx.fixture_id === activeFixture.id && !paidToday.includes(tx.player_id)) {
                paidToday.push(tx.player_id);
              }
            }
          });
        }
        setPlayerDebts(debts); 
        setPaidPlayerIds(paidToday);

        const draftStateStr = localStorage.getItem('gameday_draft_state');
        if (draftStateStr) {
          try {
            const draft = JSON.parse(draftStateStr);
            const validSelectedIds = (draft.selectedPlayerIds || []).filter((id: string) => !paidToday.includes(id));
            
            const validPaymentData: Record<string, any> = {};
            validSelectedIds.forEach((id: string) => {
              if (draft.paymentData && draft.paymentData[id]) {
                validPaymentData[id] = draft.paymentData[id];
              }
            });

            setSelectedPlayerIds(validSelectedIds);
            setPaymentData(validPaymentData);
            
            if (draft.payUmpire && !hasPaidUmpire) setPayUmpire(true);

            localStorage.removeItem('gameday_draft_state');
          } catch (e) {
            console.error("Failed to parse draft state", e);
          }
        }
      }
    } else {
      setSquad([]);
    }
    setIsSquadLoading(false);
  }
  
  useEffect(() => { loadSquadData(); }, [activeFixture]);

  async function executeMatchFinalization() {
    const resolvedClubId = activeClubId || teams.find(t => t.id === selectedTeamId)?.club_id;
    
    if (!activeFixture || !resolvedClubId) {
      showToast("Missing required club context. Refresh and try again.", "error");
      return;
    }
    
    setIsProcessing(true);

    try {
      const shouldChargeFees = finaliseStatus === 'completed' || (finaliseStatus === 'abandoned' && chargeAbandonedFee);
      const batchTxPayload: any[] = [];

      // 1. Process Debts
      if (shouldChargeFees) {
        const unpaidPlayers = squad.filter(p => !paidPlayerIds.includes(p.id));
        
        if (unpaidPlayers.length > 0) {
          unpaidPlayers.forEach(player => {
            batchTxPayload.push({
              player_id: player.id,
              team_id: selectedTeamId,
              fixture_id: activeFixture.id,
              club_id: resolvedClubId,
              amount: player.is_member ? teamFees.member : teamFees.casual,
              transaction_type: 'fee'
            });
          });
        }
      }

      // 2. Process Umpire Fee (if toggled and unpaid)
      if (payUmpire && activeFixture.umpire_fee > 0 && !isUmpirePaid) {
        batchTxPayload.push({
          team_id: selectedTeamId, 
          fixture_id: activeFixture.id, 
          club_id: resolvedClubId, 
          amount: activeFixture.umpire_fee, 
          transaction_type: 'expense', 
          payment_method: 'cash', 
          description: clubInfo.expense_label || 'Match Expense' 
        });
      }

      // 3. Execute Inserts
      if (batchTxPayload.length > 0) {
        const { error: debtError } = await supabase.from("transactions").insert(batchTxPayload);
        if (debtError) throw debtError;
      }

      // 4. Update Fixture Status
      const { error } = await supabase
        .from('fixtures')
        .update({ status: finaliseStatus })
        .eq('id', activeFixture.id);

      if (error) throw error;

      if (payUmpire) {
        setIsUmpirePaid(true);
        setPayUmpire(false);
      }

      const successMsg = finaliseStatus === 'completed' 
        ? "Match Finalised & Debts Logged!" 
        : (chargeAbandonedFee ? "Match Abandoned & Debts Logged!" : "Match Abandoned");
        
      showToast(successMsg);
      
      const { data: allFix } = await supabase
        .from('fixtures')
        .select('*')
        .eq('team_id', selectedTeamId);
        
      if (allFix) {
        const safeFixList = allFix.map(f => f.id === activeFixture.id ? { ...f, status: finaliseStatus } : f);

        const upcoming = safeFixList.filter(f => !['completed', 'forfeited', 'abandoned'].includes(f.status))
          .sort((a,b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime());
        const past = safeFixList.filter(f => ['completed', 'forfeited', 'abandoned'].includes(f.status))
          .sort((a,b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime());

        setActiveFixture(upcoming.length > 0 ? upcoming[0] : null);
        setPastFixtures(past);
      } else {
        setActiveFixture(null);
      }

      setIsFinaliseModalOpen(false);

      // --- 🔥 FIX: Force state reload to reflect the newly inserted transactions ---
      await loadSquadData();

    } catch (err) {
      console.error("Finalization error:", err);
      showToast("Error finalising match", "error");
    } finally {
      setIsProcessing(false);
    }
  }

  const initiateTapToPay = (player: any) => {
    const resolvedClubId = activeClubId || teams.find(t => t.id === selectedTeamId)?.club_id;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (!isMobile) return showToast("Tap-to-Pay requires a mobile phone.", "error");
    if (!resolvedClubId) return showToast("Missing club selection.", "error");

    const netAmount = paymentData[player.id]?.amount || 0;
    if (netAmount <= 0) return showToast("Amount must be > $0", "error");

    localStorage.setItem('gameday_draft_state', JSON.stringify({
      selectedPlayerIds,
      paymentData,
      payUmpire
    }));

    const grossAmount = calculateSquareGross(netAmount);
    const amountCents = Math.round(grossAmount * 100);
    const feeAmount = player.is_member ? teamFees.member : teamFees.casual;

    localStorage.setItem('square_pending_tx', JSON.stringify({
      player_id: player.id, team_id: selectedTeamId, fixture_id: activeFixture?.id, club_id: resolvedClubId, amount: netAmount, fee_amount: feeAmount 
    }));

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
        `S.com.squareup.pos.TENDER_TYPES=com.squareup.pos.TENDER_CARD;` +
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
      
      const matchFee = player.is_member ? teamFees.member : teamFees.casual;
      const currentBalance = playerDebts[id] || 0; 
      
      // If currentBalance is negative (credit), it subtracts from the fee. 
      // Math.max ensures it never drops below $0 to collect.
      const totalToCollect = Math.max(0, matchFee + currentBalance);

      setSelectedPlayerIds(prev => [...prev, id]);
      setPaymentData(prev => ({ ...prev, [id]: { amount: totalToCollect, method: 'cash' } }));
    }
  }

  async function processBatchPayments() {
    const resolvedClubId = activeClubId || teams.find(t => t.id === selectedTeamId)?.club_id;
    
    if (selectedPlayers.length === 0 || !activeFixture || !resolvedClubId) {
       showToast("Unable to save: Missing active club data.", "error");
       return;
    }

    const newlyPaidIds = selectedPlayers.map(p => p.id);
    setPaidPlayerIds(prev => [...prev, ...newlyPaidIds]);
    setSelectedPlayerIds([]); 
    
    let umpirePaidNow = false;
    if (payUmpire && activeFixture.umpire_fee > 0 && !isUmpirePaid) {
      setIsUmpirePaid(true); 
      setPayUmpire(false);
      umpirePaidNow = true;
    }

    const payloadData = { ...paymentData };
    setPaymentData({}); 
    showToast(`Saving...`);

    const offlinePayload: any[] = [];
    
    for (const player of selectedPlayers) {
      const method = payloadData[player.id]?.method || 'cash';
      const amount = payloadData[player.id]?.amount || 0;
      const fee = player.is_member ? teamFees.member : teamFees.casual;
      
      if (isSquareEnabled && method === 'card' && amount > 0) {
         if (canManage) {
            continue; 
         }
      }

      // Always charge the match fee
      offlinePayload.push({ player_id: player.id, team_id: selectedTeamId, fixture_id: activeFixture.id, club_id: resolvedClubId, amount: fee, transaction_type: 'fee' });
      
      // Only log a payment if they actually handed over cash/card today
      if (amount > 0) {
        offlinePayload.push({ player_id: player.id, team_id: selectedTeamId, fixture_id: activeFixture.id, club_id: resolvedClubId, amount: amount, transaction_type: 'payment', payment_method: method });
      }
    }
    
    if (umpirePaidNow) {
      offlinePayload.push({ 
        team_id: selectedTeamId, fixture_id: activeFixture.id, club_id: resolvedClubId, 
        amount: activeFixture.umpire_fee, transaction_type: 'expense', 
        payment_method: 'cash', description: clubInfo.expense_label || 'Match Expense' 
      });
    }

    if (offlinePayload.length === 0) return;

    try {
      const { error } = await supabase.from("transactions").insert(offlinePayload);
      if (error) throw error;
      
      showToast(`Fully Synced!`);
      loadSquadData(); 

    } catch (err) {
      console.error("Network drop! Saving to offline queue:", err);
      
      const existingQueue = JSON.parse(localStorage.getItem('fp_offline_tx_queue') || '[]');
      localStorage.setItem('fp_offline_tx_queue', JSON.stringify([...existingQueue, ...offlinePayload]));
      
      showToast("Saved offline. Will sync when signal returns.", "error");
    }
  }

  async function openManageSquad() {
    const resolvedClubId = activeClubId || teams.find(t => t.id === selectedTeamId)?.club_id;
    if (!resolvedClubId || !activeFixture) return;
    
    setIsProcessing(true);
    
    // Fetch all players for the club
    const { data: playersData } = await supabase.from("players").select("*").eq("club_id", resolvedClubId);
    if (playersData) {
      setClubPlayers(playersData);
    }

    // Fetch availability for this specific match
    const { data: availData } = await supabase.from("availability").select("player_id, status").eq("fixture_id", activeFixture.id);
    setAvailabilityData(availData || []);

    setPlayerSearch(""); 
    setIsManageSquadOpen(true);
    setIsProcessing(false);
  }

  // --- Clean Insert for RLS ---
  async function toggleSquadMember(playerId: string) {
    if (!activeFixture) return;
    setIsProcessing(true);
    
    const isCurrentlyInSquad = squad.some(p => p.id === playerId);
    
    try {
      if (isCurrentlyInSquad) {
        const { error } = await supabase.from("match_squads").delete().match({ fixture_id: activeFixture.id, player_id: playerId });
        if (error) {
            console.error("Supabase Delete Error:", error);
            throw error;
        }
      } else {
        const { error } = await supabase.from("match_squads").insert([{ fixture_id: activeFixture.id, player_id: playerId }]);
        if (error) {
            console.error("Supabase Insert Error:", error);
            throw error;
        }
      }
      await loadSquadData(); 
    } catch (err: any) {
      console.error("Full toggleSquadMember Error:", err);
      // More specific error message for permission issues
      if (err?.code === '42501' || err?.message?.includes('403')) {
          showToast("Permission denied. You must be a Team Manager to edit this squad.", "error");
      } else {
          showToast("Error updating squad. Please try logging out and back in.", "error");
      }
    } finally {
      setIsProcessing(false);
    }
  }

  // --- Clean Insert for RLS ---
  async function createAndAddPlayer(fullName: string) {
    const resolvedClubId = activeClubId || teams.find(t => t.id === selectedTeamId)?.club_id;
    if (!resolvedClubId || !activeFixture) return;
    
    setIsProcessing(true);
    
    try {
      const parts = fullName.trim().split(' ');
      const firstName = parts[0];
      const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '(Casual)';

      const { data: newPlayer, error: playerError } = await supabase
        .from('players')
        .insert([{
          first_name: firstName,
          last_name: lastName,
          club_id: resolvedClubId,
          is_member: false 
        }])
        .select()
        .single();

      if (playerError) {
          console.error("Supabase Player Creation Error:", playerError);
          throw playerError;
      }

      if (newPlayer) {
        const { error: squadError } = await supabase.from("match_squads").insert([{ fixture_id: activeFixture.id, player_id: newPlayer.id }]);
        
        if (squadError) {
             console.error("Supabase Squad Insert Error:", squadError);
             throw squadError;
        }
        
        showToast("Player Created & Added");
        setPlayerSearch("");
        loadSquadData();
        const { data } = await supabase.from("players").select("*").eq("club_id", resolvedClubId);
        if (data) setClubPlayers(data);
      }

    } catch (err: any) {
      console.error("Full createAndAddPlayer Error:", err);
      if (err?.code === '42501' || err?.message?.includes('403')) {
          showToast("Permission denied. You must be a Team Manager to add players.", "error");
      } else {
          showToast(err.message || "Failed to create player", "error");
      }
    } finally {
      setIsProcessing(false);
    }
  }

  async function openAiReporter(fixture: any) {
    setIsProcessing(true);
    try {
      const { data: squadRows } = await supabase.from('match_squads').select('player_id').eq('fixture_id', fixture.id);
      let fixtureSquad: any[] = [];
      if (squadRows && squadRows.length > 0) {
        const playerIds = squadRows.map(row => row.player_id);
        const { data: playerDetails } = await supabase.from("players").select("*").in("id", playerIds);
        fixtureSquad = playerDetails || [];
      }
      setAiModalSquad(fixtureSquad);
      setAiModalFixture(fixture);
    } catch (err) {
      showToast("Error loading match data for AI", "error");
    } finally {
      setIsProcessing(false);
    }
  }

  const handleReportGenerated = () => {
    if (activeFixture && aiModalFixture?.id === activeFixture.id) {
      setActiveFixture({ ...activeFixture, ai_reports_generated: (activeFixture.ai_reports_generated || 0) + 1 });
    }
    setPastFixtures(prev => prev.map(f => f.id === aiModalFixture?.id ? { ...f, ai_reports_generated: (f.ai_reports_generated || 0) + 1 } : f));
    setAiModalFixture((prev: any) => prev ? { ...prev, ai_reports_generated: (prev.ai_reports_generated || 0) + 1 } : null);
  };

  const selectedPlayers = squad.filter(p => selectedPlayerIds.includes(p.id));
  const squadToPay = squad.filter(p => !paidPlayerIds.includes(p.id));
  const squadPaid = squad.filter(p => paidPlayerIds.includes(p.id));
  const netTotal = selectedPlayerIds.reduce((sum, id) => sum + (paymentData[id]?.amount || 0), 0) - (payUmpire ? (activeFixture?.umpire_fee || 0) : 0);

  const processableCount = selectedPlayers.filter(p => {
    const method = paymentData[p.id]?.method || 'cash';
    return !(isSquareEnabled && method === 'card');
  }).length;

  const currentTeamName = teams.find(t => t.id === selectedTeamId)?.name || "Our Team";

  if (loading) return <div className="text-center p-6 text-zinc-500 text-xs font-black animate-pulse uppercase tracking-widest">Loading GameDay...</div>;

  return (
    <div className="animate-in fade-in duration-300 space-y-6 pb-32 relative overflow-x-hidden">
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-lg z-[300] animate-in slide-in-from-bottom-5 ${toast.type === 'success' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'} font-black uppercase tracking-widest text-[10px] whitespace-nowrap flex items-center gap-2`}>
          <i className={`fa-solid ${toast.type === 'success' ? 'fa-check' : 'fa-triangle-exclamation'}`}></i> {toast.msg}
        </div>
      )}

      {profile && profile.onboarding_completed !== true && profile.role !== 'super_admin' && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-5 rounded-xl shadow-sm mb-6 flex flex-col items-center text-center animate-in slide-in-from-top-4">
          <i className="fa-solid fa-triangle-exclamation text-amber-500 text-2xl mb-2"></i>
          <h3 className="font-black uppercase tracking-widest text-amber-900 dark:text-amber-400 text-sm mb-1">Setup Incomplete</h3>
          <p className="text-[11px] font-bold text-amber-700 dark:text-amber-500/70 mb-4">Your club configuration is missing critical data. Some features may be disabled.</p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('trigger-onboarding'))}
            className="bg-amber-500 hover:bg-amber-400 text-white dark:text-black font-black uppercase tracking-widest text-[10px] px-6 py-3 rounded-lg shadow-md active:scale-95 transition-all"
          >
            Resume Setup Now
          </button>
        </div>
      )}

      {(profile?.role === 'club_admin' || profile?.role === 'super_admin') && teams.length > 1 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm transition-colors">
          <label className="text-[10px] uppercase font-black tracking-widest text-emerald-600 dark:text-emerald-500 block mb-2 ml-1">Manager View</label>
          <select value={selectedTeamId || ""} onChange={(e) => setSelectedTeamId(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none font-bold transition-colors">
            <option value="" disabled>-- Select a Team --</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {selectedTeamId && activeFixture ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden transition-colors">
          
          <div className="flex justify-between items-center p-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded text-white tracking-widest bg-emerald-600 dark:bg-emerald-500">
                {new Date(activeFixture.match_date).toDateString() === new Date().toDateString() ? 'Active' : 'Upcoming'}
              </span>
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                {new Date(activeFixture.match_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
              </span>
            </div>
            
            {canManage && (
              <div className="flex gap-2">
                <button 
                  onClick={openManageSquad}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-black uppercase shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  <i className="fa-solid fa-user-plus"></i>
                  <span>Add Player</span>
                </button>
              </div>
            )}
          </div>

          <div className="p-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
                {clubInfo.logo ? (
                  <img src={clubInfo.logo} alt="Club Logo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] font-black text-zinc-500">{clubInfo.name?.substring(0, 2).toUpperCase()}</span>
                )}
              </div>
              <span className="font-black text-xs uppercase tracking-wide text-zinc-900 dark:text-white leading-tight break-words">
                {currentTeamName}
              </span>
            </div>

            <div className="shrink-0 px-2 text-center">
              <span className="text-[10px] font-black text-zinc-300 dark:text-zinc-700 italic uppercase tracking-widest">VS</span>
            </div>

            <div className="flex items-center justify-end gap-3 flex-1">
              <span className="font-black text-xs uppercase tracking-wide text-zinc-900 dark:text-white text-right leading-tight break-words">
                {activeFixture.opponent}
              </span>
              <div className="w-8 h-8 rounded-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-shield text-zinc-300 dark:text-zinc-700 text-xs"></i>
              </div>
            </div>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-950/50 px-5 py-3 border-t border-zinc-100 dark:border-zinc-800">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              {activeFixture.start_time && `${activeFixture.start_time} • `}
              {activeFixture.location || 'Location TBA'}
            </p>
          </div>
        </div>
      ) : selectedTeamId ? (
        <div className="text-center py-12 px-6 bg-white dark:bg-zinc-900 rounded-3xl border-2 border-dashed border-emerald-500/30 dark:border-emerald-500/20 transition-colors flex flex-col items-center shadow-sm mt-2 animate-in fade-in">
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-4 text-emerald-600 dark:text-emerald-500 shadow-inner">
            <i className="fa-solid fa-calendar-xmark text-3xl opacity-80"></i>
          </div>
          <h3 className="font-black uppercase tracking-widest text-sm text-emerald-800 dark:text-emerald-400 mb-2">No Active Matches</h3>
          
          {canManage ? (
            <>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-6 max-w-[250px] leading-relaxed">
                Your GameDay is empty. Let dAIve build your schedule instantly.
              </p>
              <button 
                 onClick={() => window.dispatchEvent(new CustomEvent('navigate-setup', { detail: 'fixtures' }))}
                 className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95 flex items-center gap-2"
              >
                 <i className="fa-solid fa-wand-magic-sparkles"></i> Upload Draw
              </button>
            </>
          ) : (
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 max-w-[250px] leading-relaxed">
              Waiting for your Team Manager to add the schedule.
            </p>
          )}
        </div>
      ) : (
        <div className="text-center py-12 px-6 bg-white dark:bg-zinc-900 rounded-3xl border-2 border-dashed border-emerald-500/30 dark:border-emerald-500/20 transition-colors flex flex-col items-center shadow-sm mt-6 animate-in fade-in">
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-4 text-emerald-600 dark:text-emerald-500 shadow-inner">
            <i className="fa-solid fa-users-slash text-3xl opacity-80"></i>
          </div>
          <h3 className="font-black uppercase tracking-widest text-sm text-emerald-800 dark:text-emerald-400 mb-2">No Teams Found</h3>
          
          {canManage ? (
            <>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-6 max-w-[250px] leading-relaxed">
                Create a team first so you can start adding players and matches.
              </p>
              <button 
                 onClick={() => window.dispatchEvent(new CustomEvent('navigate-setup', { detail: 'teams' }))}
                 className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95 flex items-center gap-2"
              >
                 <i className="fa-solid fa-users-viewfinder"></i> Create Team
              </button>
            </>
          ) : (
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 max-w-[250px] leading-relaxed">
               Waiting for a Club Manager to set up the club.
            </p>
          )}
        </div>
      )}

      {/* --- PAYMENT & COLLECTION AREA --- */}
      {activeFixture && (
        <div className="mb-4 mt-8 border-t border-zinc-200 dark:border-zinc-800/50 pt-6 transition-colors">
          
          <div className="flex justify-between items-center mb-4 px-1">
             <h2 className="text-[11px] font-black uppercase italic tracking-widest text-emerald-600 dark:text-emerald-500">To Pay ({squadToPay.length})</h2>
             <button onClick={() => {setSelectedPlayerIds([]); setPaymentData({});}} className="text-[9px] font-black uppercase text-zinc-500 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400">Clear All</button>
          </div>

          <div className="flex flex-wrap gap-2.5 mb-6">
            {isSquadLoading ? (
               <div className="w-full text-center py-6">
                 <i className="fa-solid fa-circle-notch fa-spin text-emerald-500 text-2xl"></i>
               </div>
            ) : squad.length === 0 ? (
               <div className="w-full text-center py-8 px-6 border-2 border-dashed border-emerald-500/50 dark:border-emerald-900/50 rounded-2xl bg-emerald-50/50 dark:bg-emerald-900/10 transition-colors flex flex-col items-center">
                 <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-3 text-emerald-600 dark:text-emerald-500">
                   <i className="fa-solid fa-clipboard-user text-xl"></i>
                 </div>
                 <h3 className="font-black uppercase tracking-widest text-xs text-emerald-800 dark:text-emerald-400 mb-1">Who's Playing?</h3>
                 
                 {canManage ? (
                   <>
                     <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 leading-relaxed">
                       Select the players for this match so you can collect fees.
                     </p>
                     <button 
                       onClick={openManageSquad}
                       className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 flex items-center gap-2"
                     >
                       <i className="fa-solid fa-user-plus"></i> Select Team
                     </button>
                   </>
                 ) : (
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 leading-relaxed">
                      Waiting for your Team Manager to assign the match players.
                    </p>
                 )}
               </div>
            ) : squadToPay.length === 0 && squadPaid.length > 0 ? (
              <div className="w-full text-center py-6 border border-dashed border-emerald-500/30 dark:border-emerald-900/50 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 transition-colors animate-in zoom-in-95">
                <i className="fa-solid fa-check-double text-2xl text-emerald-500 mb-2"></i>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500">All settled!</p>
              </div>
            ) : (
              squadToPay.map(player => {
                const isSelected = selectedPlayerIds.includes(player.id);
                const currentBalance = playerDebts[player.id] || 0;
                return (
                  <button 
                    key={player.id} 
                    onClick={() => togglePlayerSelection(player.id)} 
                    className={`px-4 py-3 rounded-xl font-black text-[11px] uppercase transition-all relative ${isSelected ? 'text-white bg-emerald-600 dark:bg-emerald-500 scale-[1.02] shadow-[0_0_15px_rgba(16,185,129,0.3)] border-transparent' : 'bg-white dark:bg-[#1A1A1A] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-400 dark:hover:border-zinc-600'}`}
                  >
                    {player.nickname || `${player.first_name} ${player.last_name?.charAt(0)}.`}
                    {currentBalance > 0 && !isSelected && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-zinc-950"></div>}
                    {currentBalance < 0 && !isSelected && <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full border-2 border-white dark:border-zinc-950"></div>}
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

      {/* --- SELECTED PLAYERS PAYMENT PANEL --- */}
      {activeFixture && selectedPlayers.length > 0 && (
        <div className="space-y-4 animate-in slide-in-from-bottom-6">

          {selectedPlayers.map(player => {
            const data = paymentData[player.id];
            const currentBalance = playerDebts[player.id] || 0;
            const matchFee = player.is_member ? teamFees.member : teamFees.casual;

            return (
              <div key={player.id} className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm relative transition-colors">
                <button onClick={() => togglePlayerSelection(player.id)} className="absolute top-4 right-4 text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"><i className="fa-solid fa-xmark"></i></button>
                <div className="flex justify-between items-start mb-4 pr-6">
                  <div>
                    <h3 className="text-zinc-900 dark:text-white font-black text-sm uppercase tracking-wide">
                      {player.nickname || `${player.first_name} ${player.last_name}`}
                    </h3>
                    <div className="flex gap-2 mt-1 text-[9px] font-black uppercase tracking-widest">
                      {currentBalance > 0 && <span className="text-red-500">Debt: ${currentBalance}</span>}
                      {currentBalance < 0 && <span className="text-emerald-500">Credit: ${Math.abs(currentBalance)}</span>}
                      <span className="text-zinc-500">Fee: ${matchFee}</span>
                    </div>
                  </div>
                  
                  <div className="flex bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-1 transition-colors">
                    <button 
                      onClick={() => setPaymentData(prev => ({...prev, [player.id]: {...prev[player.id], method: 'cash'}}))} 
                      title="Cash"
                      className={`w-10 h-8 rounded-lg flex items-center justify-center text-xs transition-colors ${data?.method === 'cash' ? 'bg-emerald-500 text-black shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                    >
                      <i className="fa-solid fa-money-bill-wave"></i>
                    </button>
                    
                    <button 
                      onClick={() => {
                        setPaymentData(prev => ({...prev, [player.id]: {...prev[player.id], method: 'card'}}));
                        
                        if (isSquareEnabled && canManage) {
                          initiateTapToPay(player);
                        } else if (clubInfo.pay_id_value) {
                          setActivePayIdPlayer(player);
                          setIsPayIdModalOpen(true);
                        }
                      }} 
                      title="Card / Digital"
                      className={`w-10 h-8 rounded-lg flex items-center justify-center text-xs transition-colors ${data?.method === 'card' ? 'bg-blue-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                    >
                      <i className="fa-solid fa-credit-card"></i>
                    </button>
                  </div>
                </div>
                <div className="bg-zinc-50 dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 flex justify-between items-center transition-colors">
                    <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Amount Paid</span>
                    <input type="number" value={data?.amount || ""} onChange={(e) => setPaymentData(prev => ({...prev, [player.id]: {...prev[player.id], amount: Number(e.target.value)}}))} className="bg-transparent text-right text-2xl font-black text-emerald-500 outline-none w-24" />
                </div>
              </div>
            );
          })}
          
          <div className="pt-4 space-y-4">            
            <div className="flex justify-between items-end px-2">
              <span className="text-xs font-black italic text-zinc-500 uppercase tracking-widest">
                {netTotal < 0 ? 'Net Outlay:' : 'Total Collected:'}
              </span>
              <span className={`text-4xl font-black italic ${netTotal < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {netTotal < 0 ? '-' : ''}${Math.abs(netTotal).toFixed(2)}
              </span>
            </div>
            
            <button onClick={processBatchPayments} disabled={isProcessing || processableCount === 0} className="w-full text-white bg-emerald-600 dark:bg-emerald-500 font-black py-5 rounded-xl uppercase tracking-widest text-sm shadow-md active:scale-95 transition-all disabled:opacity-50">
              {isProcessing ? 'Saving...' : `Save ${processableCount} Payment${processableCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}

      {/* --- MATCH COMPLETION ACTIONS --- */}
      {activeFixture && selectedPlayerIds.length === 0 && (
        <div className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800 space-y-6">
          
          {/* --- MOVED: UMPIRE / EXPENSE TOGGLE --- */}
          {activeFixture?.umpire_fee > 0 && (
            <div className="mb-2">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-600 mb-3 ml-1">Match Expenses</h3>
              <div 
                className={`border rounded-xl p-4 flex justify-between items-center transition-all shadow-sm ${isUmpirePaid ? 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800' : 'bg-white dark:bg-[#1A1A1A] border-zinc-200 dark:border-zinc-800 cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 active:scale-[0.98]'}`} 
                onClick={() => !isUmpirePaid && setPayUmpire(!payUmpire)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isUmpirePaid ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : payUmpire ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'}`}>
                    <i className={`fa-solid ${isUmpirePaid ? 'fa-check' : 'fa-whistle'} text-sm`}></i>
                  </div>
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-widest text-zinc-500">Record Payment?</span>
                    <span className="block text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                      {clubInfo.expense_label || 'Umpire'} (${activeFixture?.umpire_fee})
                    </span>
                  </div>
                </div>
                
                {isUmpirePaid ? (
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-lg">Paid</span>
                ) : (
                  <div className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 ${payUmpire ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-800'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${payUmpire ? 'translate-x-5' : 'translate-x-0'}`}></div>
                  </div>
                )}
              </div>
              {!isUmpirePaid && !payUmpire && (
                 <p className="text-[10px] text-zinc-400 dark:text-zinc-500 italic mt-2 ml-1">
                   Toggle this if you paid the {clubInfo.expense_label || 'Umpire'} today.
                 </p>
              )}
            </div>
          )}

          <div className="space-y-3">
            <button 
              onClick={() => { setFinaliseStatus('completed'); setChargeAbandonedFee(false); setIsFinaliseModalOpen(true); }} 
              className="w-full bg-zinc-900 dark:bg-white text-white dark:text-black font-black py-4 rounded-xl uppercase tracking-widest text-xs shadow-sm active:scale-95 transition-all"
            >
              Finalise Match
            </button>
            <p className="text-[9px] text-zinc-400 dark:text-zinc-600 text-center italic">
              Closes the match and finalises the ledger.
            </p>
          </div>
        </div>
      )}

      {/* --- PAST MATCHES TOGGLE --- */}
      {pastFixtures.length > 0 && (
        <div className="mt-6">
           <button 
              onClick={() => setShowPastFixtures(!showPastFixtures)}
              className="w-full py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm text-[10px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400 flex items-center justify-between px-5 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700"
           >
              <span>Past Matches ({pastFixtures.length})</span>
              <i className={`fa-solid fa-chevron-${showPastFixtures ? 'up' : 'down'}`}></i>
           </button>

           {showPastFixtures && (
              <div className="mt-3 space-y-2 animate-in slide-in-from-top-2 fade-in">
                 {pastFixtures.map(pf => (
                    <div key={pf.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex justify-between items-center shadow-sm transition-colors">
                       <div className="flex-1 min-w-0 pr-4">
                          <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">
                             {new Date(pf.match_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                             <span className="mx-2 text-zinc-300 dark:text-zinc-700">•</span>
                             <span className={pf.status === 'completed' ? 'text-emerald-500' : pf.status === 'forfeited' ? 'text-orange-500' : 'text-red-500'}>{pf.status}</span>
                          </div>
                          <div className="font-bold text-sm text-zinc-900 dark:text-white uppercase tracking-wide leading-tight break-words">
                             VS {pf.opponent}
                          </div>
                       </div>
                       <button 
                          onClick={() => openAiReporter(pf)}
                          disabled={isProcessing}
                          className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center hover:opacity-90 transition-opacity shadow-sm shrink-0 disabled:opacity-50"
                          title="Generate Match Report"
                       >
                          {isProcessing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                       </button>
                    </div>
                 ))}
              </div>
           )}
        </div>
      )}

      {/* --- FINALISE MATCH MODAL --- */}
      {isFinaliseModalOpen && activeFixture && (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4 transition-colors">
          <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 w-full max-w-[400px] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-5 flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-lg font-black italic uppercase tracking-tighter text-emerald-600 dark:text-emerald-500">Wrap Up Match</h2>
              <button onClick={() => setIsFinaliseModalOpen(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-zinc-50 dark:bg-[#1A1A1A] p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="flex bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-1 transition-colors mb-2">
                  <button onClick={() => setFinaliseStatus('completed')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-colors ${finaliseStatus === 'completed' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}>Played</button>
                  <button onClick={() => setFinaliseStatus('abandoned')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-colors ${finaliseStatus === 'abandoned' ? 'bg-red-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}>Abandoned</button>
                </div>
                
                {finaliseStatus === 'abandoned' && (
                  <div className="mt-4 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-700 pt-4">
                     <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">Charge Match Fees?</span>
                     <button 
                       onClick={() => setChargeAbandonedFee(!chargeAbandonedFee)}
                       className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${chargeAbandonedFee ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                     >
                       <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${chargeAbandonedFee ? 'translate-x-4' : 'translate-x-0'}`}></div>
                     </button>
                  </div>
                )}

                <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400 leading-relaxed mt-3">
                  {finaliseStatus === 'abandoned' && !chargeAbandonedFee
                    ? "No match fees will be collected or added to player balances for this match."
                    : `Any unpaid fees from today's squad (${squad.filter(p => !paidPlayerIds.includes(p.id)).length} player${squad.filter(p => !paidPlayerIds.includes(p.id)).length === 1 ? '' : 's'}) will automatically roll over to their outstanding debts.`
                  }
                </p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setIsFinaliseModalOpen(false)} className="flex-1 py-4 bg-zinc-200 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-400 rounded-xl text-xs font-black uppercase tracking-widest transition-colors hover:bg-zinc-300 dark:hover:bg-zinc-800">Cancel</button>
                <button 
                  onClick={executeMatchFinalization} 
                  disabled={isProcessing}
                  className={`flex-1 py-4 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95 disabled:opacity-50 ${finaliseStatus === 'completed' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'}`}
                >
                  {isProcessing ? 'Saving...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- SELECT TEAM MODAL --- */}
      {isManageSquadOpen && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 transition-colors">
          <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 w-full max-w-[440px] rounded-3xl overflow-hidden flex flex-col max-h-[90dvh] shadow-2xl transition-colors">
            <div className="p-5 flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 transition-colors">
              <h2 className="text-lg font-black italic uppercase tracking-tighter text-emerald-600 dark:text-emerald-500">Select Team</h2>
              <button onClick={() => setIsManageSquadOpen(false)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1 space-y-4 pb-6">
              <input type="text" placeholder="Search across club..." value={playerSearch || ""} onChange={(e) => setPlayerSearch(e.target.value)} className="w-full bg-zinc-50 dark:bg-[#1A1A1A] border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-zinc-500 transition-colors" />
              
              <div className="space-y-4">
                {/* CREATE ON THE FLY BUTTON */}
                {playerSearch.trim().length > 0 && !clubPlayers.some(p => `${p.first_name} ${p.last_name}`.toLowerCase() === playerSearch.trim().toLowerCase()) && (
                  <button 
                    onClick={() => createAndAddPlayer(playerSearch)}
                    disabled={isProcessing}
                    className="w-full flex justify-between items-center bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors text-left group disabled:opacity-50"
                  >
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                      + Add "{playerSearch}"
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/70 bg-emerald-200 dark:bg-emerald-900 px-2 py-1 rounded-md">New Casual</span>
                  </button>
                )}

                {/* Categorized Sections */}
                {['yes', 'maybe', 'no_reply', 'no'].map((section) => {
                  const sectionPlayers = clubPlayers.filter(p => {
                    const avail = availabilityData.find(a => a.player_id === p.id);
                    const status = avail ? avail.status : 'no_reply';

                    // Relevant if in team, already in squad, or explicitly replied
                    const isRelevant = p.default_team_id === selectedTeamId || squad.some(s => s.id === p.id) || avail !== undefined;
                    const matchesSearch = playerSearch ? `${p.first_name} ${p.last_name} ${p.nickname || ''}`.toLowerCase().includes(playerSearch.toLowerCase()) : true;

                    if (playerSearch) {
                      return status === section && matchesSearch;
                    } else {
                      return status === section && isRelevant;
                    }
                  });

                  if (sectionPlayers.length === 0) return null;

                  const config = {
                    yes: { label: "Available", color: "text-emerald-500", icon: "fa-circle-check" },
                    maybe: { label: "Maybe", color: "text-amber-500", icon: "fa-circle-question" },
                    no_reply: { label: "No Reply", color: "text-zinc-400 dark:text-zinc-500", icon: "fa-circle" },
                    no: { label: "Unavailable", color: "text-red-500", icon: "fa-circle-xmark" }
                  }[section as 'yes' | 'maybe' | 'no_reply' | 'no'];

                  return (
                    <div key={section} className="mb-4">
                      <h3 className={`text-[10px] font-black uppercase tracking-widest ${config.color} mb-3 flex items-center gap-2`}>
                        <i className={`fa-solid ${config.icon}`}></i> {config.label}
                      </h3>
                      <div className="flex flex-wrap gap-2.5">
                        {sectionPlayers.map(p => {
                          const isInSquad = squad.some(s => s.id === p.id);
                          return (
                            <button 
                              key={p.id} 
                              onClick={() => toggleSquadMember(p.id)} 
                              disabled={isProcessing}
                              className={`px-4 py-3 rounded-xl font-black text-[11px] uppercase transition-all flex items-center gap-2 ${isInSquad ? 'text-white bg-emerald-600 dark:bg-emerald-500 scale-[1.02] shadow-[0_0_15px_rgba(16,185,129,0.3)] border-transparent' : 'bg-white dark:bg-[#1A1A1A] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-400 dark:hover:border-zinc-600'} disabled:opacity-50`}
                            >
                              {p.nickname || `${p.first_name} ${p.last_name?.charAt(0) || ''}.`}
                              {isInSquad ? (
                                <i className="fa-solid fa-check text-[10px]"></i>
                              ) : (
                                <i className="fa-solid fa-plus text-[10px] opacity-50"></i>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="p-5 border-t border-zinc-100 dark:border-zinc-800 flex gap-3 bg-zinc-50 dark:bg-[#111] transition-colors">
              <button onClick={() => setIsManageSquadOpen(false)} className="flex-1 py-4 rounded-xl text-xs font-black uppercase text-zinc-600 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-900 hover:bg-zinc-300 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
              <button onClick={() => setIsManageSquadOpen(false)} disabled={isProcessing} className="flex-1 py-4 rounded-xl text-xs font-black uppercase text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-md">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DIGITAL TRANSFER / PAYID MODAL --- */}
      {isPayIdModalOpen && activePayIdPlayer && (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4 transition-colors">
          <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 w-full max-w-[400px] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-5 flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-lg font-black italic uppercase tracking-tighter text-emerald-600 dark:text-emerald-500">Transfer</h2>
              <button onClick={() => setIsPayIdModalOpen(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            
            <div className="p-6 space-y-6 text-center">
              <div>
                <p className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-1">Amount Due</p>
                <p className="text-4xl font-black text-zinc-900 dark:text-white">${paymentData[activePayIdPlayer.id]?.amount?.toFixed(2)}</p>
                <p className="text-sm font-bold text-zinc-500 mt-2">for {activePayIdPlayer.first_name}&apos;s match fees</p>
              </div>

              <div className="bg-zinc-50 dark:bg-[#1A1A1A] p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 transition-colors">
                 <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">
                    {clubInfo.pay_id_type === 'bank_account' ? 'Pay Club via Bank Account' : `Pay Club via ${clubInfo.pay_id_type}`}
                 </p>
                 <div className="flex items-center gap-2">
                   <code className="flex-1 bg-white dark:bg-[#111] px-3 py-3 rounded-lg font-mono text-sm border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-bold select-all transition-colors">{clubInfo.pay_id_value}</code>
                   <button 
                      onClick={() => {
                        navigator.clipboard.writeText(clubInfo.pay_id_value);
                        showToast("Copied!");
                      }}
                      className="px-4 py-3 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-white rounded-lg text-xs font-black uppercase transition-colors shadow-sm flex items-center gap-2"
                   >
                      Copy
                   </button>
                 </div>
              </div>

              <button 
                onClick={() => setIsPayIdModalOpen(false)} 
                className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl text-xs font-black uppercase tracking-widest shadow-md hover:scale-[0.98] transition-transform"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SMART AI MODAL DECOUPLED FROM ACTIVE MATCH --- */}
      <AiReporterModal 
        isOpen={!!aiModalFixture} 
        onClose={() => {
          setAiModalFixture(null);
          setAiModalSquad([]);
        }} 
        fixture={aiModalFixture}
        squad={aiModalSquad}
        themeColor="#10b981" 
        teamName={currentTeamName}
        reportsGenerated={aiModalFixture?.ai_reports_generated || 0}
        onReportIncrement={() => {
          if (activeFixture && aiModalFixture?.id === activeFixture.id) {
            setActiveFixture({ ...activeFixture, ai_reports_generated: (activeFixture.ai_reports_generated || 0) + 1 });
          }
          setPastFixtures(prev => prev.map(f => f.id === aiModalFixture?.id ? { ...f, ai_reports_generated: (f.ai_reports_generated || 0) + 1 } : f));
          setAiModalFixture((prev: any) => prev ? { ...prev, ai_reports_generated: (prev.ai_reports_generated || 0) + 1 } : null);
        }}
      />
    </div>
  );
}