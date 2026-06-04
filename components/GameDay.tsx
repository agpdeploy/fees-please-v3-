// app/dashboard/gameday/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { useActiveClub } from "@/contexts/ClubContext";
import { calculateSquareOnlineGross } from '@/lib/fees';
import { QRCodeSVG } from 'qrcode.react';
import { Mark } from './Brand';

import SetupChecklist from './SetupChecklist';
export default function GameDay() {
  const { profile, roles } = useProfile();
  const { activeClubId } = useActiveClub();

  const [clubInfo, setClubInfo] = useState<any>({ name: 'FP', logo: '', expense_label: '', pay_id_type: '', pay_id_value: '' });
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
  
  // QR Code POS States
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrModalPlayer, setQrModalPlayer] = useState<any>(null);
  const [qrTxId, setQrTxId] = useState<string>("");
  const [qrTxAmount, setQrTxAmount] = useState<number>(0);
  
  // Manage Squad States (Inline Expanding UI)
  const [isManageSquadExpanded, setIsManageSquadExpanded] = useState(false);
  const manageTeamRef = useRef<HTMLDivElement>(null);
  const [fixtureAvailability, setFixtureAvailability] = useState<any[]>([]);
  const [expandedPoolSections, setExpandedPoolSections] = useState<Record<string, boolean>>({
    yes: true, maybe: true, no_reply: false, no: false
  });

  // Digital Transfer / PayID Modal States
  const [isPayIdModalOpen, setIsPayIdModalOpen] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [pendingReminderCount, setPendingReminderCount] = useState(0);

  const handleConfirmSendReminders = async () => {
    if (!activeFixture) return;
    try {
      const res = await fetch("/api/send-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          fixtureId: activeFixture.id, 
          teamId: selectedTeamId, 
          action: 'send',
          senderName: profile?.first_name || "Your Captain"
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reminders");
      showToast(`Sent ${data.sentCount} reminder${data.sentCount !== 1 ? 's' : ''}!`);
    } catch (error: any) {
      showToast(error.message, "error");
    } finally {
      setIsReminderModalOpen(false);
    }
  };
  const [activePayIdPlayer, setActivePayIdPlayer] = useState<any>(null);
  const [clubPlayers, setClubPlayers] = useState<any[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [newPlayerEmail, setNewPlayerEmail] = useState("");

  // Finalise Match Modal States
  const [isFinaliseModalOpen, setIsFinaliseModalOpen] = useState(false);
  const [finaliseStatus, setFinaliseStatus] = useState<'completed' | 'abandoned'>('completed');
  const [chargeAbandonedFee, setChargeAbandonedFee] = useState(false);
  const [unpaidPlayerActions, setUnpaidPlayerActions] = useState<Record<string, 'charge' | 'remove' | 'paid'>>({});
  
  // --- INLINE AI REPORTER STATES ---
  const [expandedPastFixtureId, setExpandedPastFixtureId] = useState<string | null>(null);
  const [reporterSquad, setReporterSquad] = useState<any[]>([]);
  const [reporterImages, setReporterImages] = useState<File[]>([]);
  const [reporterNotes, setReporterNotes] = useState("");
  const [reporterCharacter, setReporterCharacter] = useState("DAIVE");
  const [reporterText, setReporterText] = useState("");
  const [reporterLoading, setReporterLoading] = useState(false);
  const [reporterLoadingText, setReporterLoadingText] = useState("");
  
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
  const currentTeamName = teams.find(t => t.id === selectedTeamId)?.name || "Our Team";

  // --- QR CODE REALTIME LISTENER ---
  useEffect(() => {
    if (!isQrModalOpen || !qrTxId) return;
    
    const channel = supabase.channel(`tx-${qrTxId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'transactions', filter: `id=eq.${qrTxId}` },
        (payload) => {
          if (payload.new.status === 'paid') {
             showToast("Payment Successful!");
             setIsQrModalOpen(false);
             
             setPaidPlayerIds(prev => [...prev, qrModalPlayer.id]);
             setSelectedPlayerIds(prev => prev.filter(id => id !== qrModalPlayer.id));
             setPaymentData(prev => { const d = {...prev}; delete d[qrModalPlayer.id]; return d; });
             
             loadSquadData();
          }
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isQrModalOpen, qrTxId, qrModalPlayer]);

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
        .select('*')
        .eq('id', activeClubId)
        .single()
        .then(({data}) => {
          if (data) {
            setClubInfo({ 
              name: data.name || 'FP', 
              logo: data.logo_url || '', 
              expense_label: data.expense_label || '',
              pay_id_type: data.pay_id_type || '',
              pay_id_value: data.pay_id_value || '',
              season_name: data.season_name,
              season_start: data.season_start,
              season_end: data.season_end,
              default_umpire_fee: data.default_umpire_fee,
              accepts_cash: data.accepts_cash,
              
              square_access_token: data.square_access_token,
              square_location_id: data.square_location_id
            });
            setIsSquareEnabled(!!data.square_access_token);
          }
      });
    } else {
      setIsSquareEnabled(false);
    }
  }, [activeClubId]);

  useEffect(() => {
    async function fetchTeams() {
      if (!profile) return;
      if (teams.length === 0) setLoading(true);
      
      let query = supabase.from("teams").select("*");
      
      if (profile.role === 'club_admin' || profile.role === 'super_admin') {
        if (activeClubId) {
          query = query.eq('club_id', activeClubId);
        } else if (profile.role !== 'super_admin') {
          setTeams([]);
          setLoading(false);
          return;
        }
      } else {
        const teamIds = roles?.filter((r: any) => r.role === 'team_admin' && r.club_id === activeClubId).map((r: any) => r.team_id).filter(Boolean) || [];
        if (teamIds.length > 0) query = query.in('id', teamIds);
        else { setTeams([]); setLoading(false); return; }
      }
      
      const { data } = await query;
      if (data) {
        setTeams(data);
        if (data.length > 0) {
          const savedTeam = localStorage.getItem('fp_selected_team_id');
          if (savedTeam && data.find((t: any) => t.id === savedTeam)) {
            setSelectedTeamId(savedTeam);
          } else {
            setSelectedTeamId(data[0].id);
          }
        }
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
        const isPastFixture = (f: any) => {
           if (['completed', 'forfeited', 'abandoned'].includes(f.status)) return true;
           const matchD = new Date(f.match_date);
           const msPerDay = 24 * 60 * 60 * 1000;
           
           // Option A (Blocker): Unfinalised matches stay active forever, UNLESS they are a historical backfill
           const uploadedAfterMatch = f.created_at ? new Date(f.created_at).getTime() > (matchD.getTime() + msPerDay) : false;
           
           return uploadedAfterMatch;
        };
        const upcoming = allFix.filter(f => !isPastFixture(f))
          .sort((a,b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime());
        const past = allFix.filter(f => isPastFixture(f))
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
        
        const { data: txData } = await supabase.from("transactions").select("player_id, amount, transaction_type, fixture_id, status").in("player_id", playerIds);
        const debts: Record<string, number> = {};
        const paidToday: string[] = []; 
        if (txData) {
          txData.forEach((tx: any) => {
            if (tx.transaction_type === 'fee') {
              debts[tx.player_id] = (debts[tx.player_id] || 0) + Number(tx.amount);
              // Any POSITIVE fee for today's match means they've been processed
              // EXCEPT if it's a pending/unpaid fee created for online checkout
              if (Number(tx.amount) > 0 && tx.fixture_id === activeFixture.id && tx.status !== 'unpaid' && !paidToday.includes(tx.player_id)) {
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
    
    const { data: availData } = await supabase.from('availability').select('*').eq('fixture_id', activeFixture.id);
    if (availData) setFixtureAvailability(availData);
    
    setIsSquadLoading(false);
  }
  
  useEffect(() => { loadSquadData(); }, [activeFixture]);

  // --- AI REPORTER LOADING EFFECT ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (reporterLoading) {
      let messages: string[] = [];
      if (reporterCharacter === 'OUTBACK_EXPERT') {
        messages = ["Looking for the snake bite kit...", "Checking the radiator levels...", "Wrestling a rogue bin chicken...", "Sparking up the camp oven...", "Decoding the scorebook..."];
      } else if (reporterCharacter === 'CLUB_VETERAN') {
        messages = ["Stretching the hammies...", "Complaining about the umpire...", "Checking the price of a meat pie...", "Reminiscing about the 1998 Grand Final...", "Squinting at the run rate..."];
      } else if (reporterCharacter === 'SUBURBAN_MUM') {
        messages = ["Pouring a generous glass of Cardonnay...", "Saying 'Look at moy' to the umpire...", "Adjusting her statement earrings...", "Admiring her new activewear...", "Gossiping with the scorers..."];
      } else if (reporterCharacter === 'ALIEN_MASTER') {
        messages = ["Communing with the force...", "Lifting the cricket bat with my mind...", "Sensing the run rate..."];
      } else if (reporterCharacter === 'NEWS_ANCHOR') {
        messages = ["Fixing my perfect hair...", "Smelling the rich mahogany...", "Pouring three fingers of scotch..."];
      } else if (reporterCharacter === 'CLASSIC_COMMENTATOR') {
        messages = ["Adjusting the bone-colored jacket...", "Clearing the throat...", "Admiring a marvellous shot..."];
      } else {
        messages = ["Crunching the numbers...", "Running the dAIve algorithms...", "Scanning the scorebook...", "Identifying the MVP..."];
      }
      
      let i = 0;
      setReporterLoadingText(messages[0]);
      
      interval = setInterval(() => {
        i++;
        if (i < messages.length) {
          setReporterLoadingText(messages[i]);
        } else {
          setReporterLoadingText("Still analyzing... the handwriting is terrible...");
        }
      }, 2500); 
    }
    
    return () => clearInterval(interval);
  }, [reporterLoading, reporterCharacter]);

  // --- INLINE AI REPORTER LOGIC ---
  async function togglePastFixtureForAi(fixture: any) {
    if (expandedPastFixtureId === fixture.id) {
      setExpandedPastFixtureId(null);
      return;
    }
    setIsProcessing(true);
    try {
      const { data: squadRows } = await supabase.from('match_squads').select('player_id').eq('fixture_id', fixture.id);
      let fixtureSquad: any[] = [];
      if (squadRows && squadRows.length > 0) {
        const playerIds = squadRows.map(row => row.player_id);
        const { data: playerDetails } = await supabase.from("players").select("*").in("id", playerIds);
        fixtureSquad = playerDetails || [];
      }
      setReporterSquad(fixtureSquad);
      setReporterImages([]);
      setReporterNotes("");
      setReporterText("");
      setExpandedPastFixtureId(fixture.id);
    } catch (err) {
      showToast("Error loading match data for AI", "error");
    } finally {
      setIsProcessing(false);
    }
  }

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800; 
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          }
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleGenerateReport = async (fixture: any) => {
    if (reporterImages.length === 0) return showToast("Please upload at least one scorebook photo!", "error");
    
    setReporterLoading(true);
    setReporterText("");

    try {
      // Compress all uploaded images
      const base64Images = await Promise.all(reporterImages.map(img => compressImage(img)));

      const context = {
        competition: fixture?.notes || "Match",
        teamName: currentTeamName, 
        opponent: fixture?.opponent || "The Opposition",
        roster: reporterSquad.length > 0 
          ? reporterSquad.map(p => p.nickname || p.first_name).join(", ") 
          : "Names currently being finalized."
      };

      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagesBase64: base64Images, character: reporterCharacter, context, customNotes: reporterNotes }),
      });

      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Server responded with an error");

      if (data.report) {
        setReporterText(data.report);
        // Update local count visually
        setPastFixtures(prev => prev.map(f => f.id === fixture.id ? { ...f, ai_reports_generated: (f.ai_reports_generated || 0) + 1 } : f));
      } else {
        throw new Error("No report returned");
      }
    } catch (err: any) {
      console.error(err);
      setReporterText(`Blimey! The news wire is down. Error: ${err.message}`);
    } finally {
      setReporterLoading(false);
    }
  };

  const handleShareReport = async () => {
    const shareText = reporterText.replace(/\*\*/g, '*'); // Convert Markdown bold to WhatsApp bold
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Match Report',
          text: shareText,
        });
      } catch (err) {
        console.log("Share failed", err);
      }
    } else {
      navigator.clipboard.writeText(shareText);
      showToast("Report copied to clipboard!");
    }
  };

  const formatReportText = (text: string) => {
    return text.split('\n').map((line, index) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <span key={index} className="block mb-2">
          {parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={i} className="font-black text-zinc-900 dark:text-white">{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
        </span>
      );
    });
  };

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
      const playersToRemove: string[] = [];

      // 1. Process Debts & Removals
      if (shouldChargeFees) {
        // Prevent duplicate fees: Fetch existing fee transactions for this fixture
        const { data: existingFees } = await supabase
          .from('transactions')
          .select('player_id')
          .eq('fixture_id', activeFixture.id)
          .eq('transaction_type', 'fee');
          
        const playersWithExistingFees = existingFees?.map(tx => tx.player_id) || [];
        
        if (squad.length > 0) {
          squad.forEach(player => {
            // Even if they paid, we still need to process their action (charge/remove)
            // so their ledger correctly reflects the match fee they owed.
            const action = unpaidPlayerActions[player.id] || 'charge';
            
            if (action === 'charge') {
              // Only charge if they don't already have a fee for this fixture
              if (!playersWithExistingFees.includes(player.id)) {
                batchTxPayload.push({
                  player_id: player.id,
                  team_id: selectedTeamId,
                  fixture_id: activeFixture.id,
                  club_id: resolvedClubId,
                  amount: player.is_member ? teamFees.member : teamFees.casual,
                  transaction_type: 'fee',
                  status: 'unpaid'
                });
              }
            } else if (action === 'paid') {
              if (!playersWithExistingFees.includes(player.id)) {
                batchTxPayload.push({
                  player_id: player.id,
                  team_id: selectedTeamId,
                  fixture_id: activeFixture.id,
                  club_id: resolvedClubId,
                  amount: player.is_member ? teamFees.member : teamFees.casual,
                  transaction_type: 'fee',
                  status: 'paid'
                });
              }
              batchTxPayload.push({
                player_id: player.id,
                team_id: selectedTeamId,
                fixture_id: activeFixture.id,
                club_id: resolvedClubId,
                amount: player.is_member ? teamFees.member : teamFees.casual,
                transaction_type: 'payment',
                payment_method: 'cash',
                description: 'Match Fees',
                status: 'completed'
              });
            } else if (action === 'remove') {
              playersToRemove.push(player.id);
            }
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

      // 4. Execute Removals
      if (playersToRemove.length > 0) {
        const { error: removeError } = await supabase
          .from("match_squads")
          .delete()
          .eq("fixture_id", activeFixture.id)
          .in("player_id", playersToRemove);
          
        if (removeError) throw removeError;
      }

      // 5. Update Fixture Status
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

  const initiateOnlinePayment = async (player: any, overrideAmount?: number) => {
    const resolvedClubId = activeClubId || teams.find(t => t.id === selectedTeamId)?.club_id;
    
    if (!resolvedClubId) return showToast("Missing club selection.", "error");

    const netAmount = overrideAmount !== undefined ? overrideAmount : (paymentData[player.id]?.amount || 0);
    if (netAmount <= 0) return showToast("Amount must be > $0", "error");

    setIsProcessing(true);
    try {
      const matchNotes = `Combined Payment (${activeFixture?.opponent || 'TBA'})`;
      const { data: newTx, error: txError } = await supabase.from('transactions').insert({
        club_id: resolvedClubId,
        player_id: player.id,
        team_id: selectedTeamId,
        fixture_id: activeFixture?.id,
        amount: netAmount,
        transaction_type: 'checkout_link',
        status: 'unpaid',
        description: matchNotes
      }).select().single();
      
      if (txError) throw txError;
      
      setQrTxId(newTx.id);
      setQrModalPlayer(player);
      setQrTxAmount(calculateSquareOnlineGross(netAmount, clubInfo));
      setIsQrModalOpen(true);
    } catch (err: any) {
      console.error(err);
      showToast(`Failed to generate payment link: ${err.message || 'Unknown error'}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  function togglePlayerSelection(id: string) {
    if (selectedPlayerIds.includes(id)) {
      setSelectedPlayerIds(prev => prev.filter(p => p !== id));
      setPaymentData(prev => {
        const newData = { ...prev };
        delete newData[id];
        return newData;
      });
    } else {
      const player = squad.find(p => p.id === id);
      if (!player) return;
      
      const matchFee = player.is_member ? teamFees.member : teamFees.casual;
      const currentBalance = playerDebts[id] || 0; 
      
      // If currentBalance is negative (credit), it subtracts from the fee. 
      // Math.max ensures it never drops below $0 to collect.
      const totalToCollect = Math.max(0, matchFee + currentBalance);

      const defaultMethod = (clubInfo?.accepts_cash !== false) ? 'cash' : 'card';

      setSelectedPlayerIds(prev => [...prev, id]);
      setPaymentData(prev => ({ ...prev, [id]: { amount: totalToCollect, method: defaultMethod } }));

      // If the club is strictly Digital/Card Only, and ONLY 1 player is selected (or we are selecting the first one),
      // we could pop open checkout. But since they can select multiple, auto-popping modal for Square/PayID 
      // on EVERY click might be annoying. Let's only auto-pop if it's the first selection.
      if (clubInfo?.accepts_cash === false && selectedPlayerIds.length === 0) {
        if (isSquareEnabled && canManage) {
          initiateOnlinePayment(player, totalToCollect);
        } else if (clubInfo?.pay_id_value) {
          setActivePayIdPlayer(player);
          setIsPayIdModalOpen(true);
        }
      }
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
    
    // Check for existing fees to prevent double billing if they pay late
    const { data: existingFees } = await supabase
      .from('transactions')
      .select('player_id')
      .eq('fixture_id', activeFixture.id)
      .eq('transaction_type', 'fee')
      .in('player_id', newlyPaidIds);
      
    const playersWithExistingFees = existingFees?.map(tx => tx.player_id) || [];
    
    for (const player of selectedPlayers) {
      const method = payloadData[player.id]?.method || 'cash';
      const amount = payloadData[player.id]?.amount || 0;
      const fee = player.is_member ? teamFees.member : teamFees.casual;
      
      if (isSquareEnabled && method === 'card' && amount > 0) {
         if (canManage) {
            continue; 
         }
      }

      // Only charge the match fee if it hasn't already been charged (e.g. during Match Finalization)
      if (!playersWithExistingFees.includes(player.id)) {
        offlinePayload.push({ player_id: player.id, team_id: selectedTeamId, fixture_id: activeFixture.id, club_id: resolvedClubId, amount: fee, transaction_type: 'fee' });
      }
      
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

  async function addPlayerToSquad(playerId: string) {
    if (!activeFixture) return;
    setIsProcessing(true);
    const { error } = await supabase.from('match_squads').insert([{ fixture_id: activeFixture.id, player_id: playerId }]);
    if (error) showToast(error.message, "error");
    else {
      showToast("Player Added!");
      setPlayerSearch("");
      loadSquadData();
    }
    setIsProcessing(false);
  }

  async function createAndAddPlayer(fullName: string, email?: string) {
    if (!activeFixture) return;
    setIsProcessing(true);
    try {
      const parts = fullName.trim().split(' ');
      const firstName = parts[0];
      const lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;

      const { data: newPlayer, error: playerError } = await supabase
        .from('players')
        .insert([{
          first_name: firstName,
          last_name: lastName,
          email: email || null,
          club_id: activeClubId,
          is_member: true,
          default_team_id: activeFixture.team_id
        }])
        .select()
        .single();

      if (playerError) throw playerError;

      if (newPlayer) {
        const { error: squadError } = await supabase.from("match_squads").insert([{ fixture_id: activeFixture.id, player_id: newPlayer.id }]);
        if (squadError) throw squadError;
        
        showToast("Player Created & Added");
        setPlayerSearch("");
        setNewPlayerEmail("");
        setIsManageSquadExpanded(false);
        loadSquadData();
      }
    } catch (err: any) {
      showToast(err.message || "Failed to create player", "error");
    } finally {
      setIsProcessing(false);
    }
  }

  // --- Inline Managed Squad Toggle ---
  async function toggleManageSquad(smoothScroll: boolean = false) {
    if (isManageSquadExpanded) {
      setIsManageSquadExpanded(false);
      return;
    }

    const resolvedClubId = activeClubId || teams.find(t => t.id === selectedTeamId)?.club_id;
    if (!resolvedClubId || !activeFixture) return;
    
    setIsProcessing(true);
    
    // Fetch all players for the club
    const { data: playersData } = await supabase.from("players").select("*").eq("club_id", resolvedClubId).eq("is_active", true);
    if (playersData) {
      setClubPlayers(playersData);
    }

    // Fetch availability for this specific match
    const { data: availData } = await supabase.from("availability").select("player_id, status").eq("fixture_id", activeFixture.id);
    setAvailabilityData(availData || []);

    setPlayerSearch(""); 
    setIsManageSquadExpanded(true);
    setIsProcessing(false);

    if (smoothScroll && manageTeamRef.current) {
      setTimeout(() => {
        manageTeamRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }

  // Removed Manage Availability and Squad toggles here

  const selectedPlayers = squad.filter(p => selectedPlayerIds.includes(p.id));
  const squadToPay = squad.filter(p => !paidPlayerIds.includes(p.id));
  const squadPaid = squad.filter(p => paidPlayerIds.includes(p.id));
  const netTotal = selectedPlayerIds.reduce((sum, id) => sum + (paymentData[id]?.amount || 0), 0) - (payUmpire ? (activeFixture?.umpire_fee || 0) : 0);

  const processableCount = selectedPlayers.filter(p => {
    const method = paymentData[p.id]?.method || 'cash';
    return !(isSquareEnabled && method === 'card');
  }).length;

  if (loading && !profile) return <div className="text-center p-6 text-zinc-500 text-xs font-black animate-pulse uppercase tracking-widest">Loading GameDay...</div>;

  if (isFinaliseModalOpen && activeFixture) {
    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-300 min-h-[calc(100vh-64px)] bg-zinc-50 dark:bg-black pb-32">
        <div className="max-w-md mx-auto pt-6 px-4">
          <button onClick={() => setIsFinaliseModalOpen(false)} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white font-black text-[10px] uppercase tracking-widest mb-6 transition-colors">
            <i className="fa-solid fa-arrow-left"></i> BACK
          </button>
          
          <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-xl font-black italic uppercase tracking-tighter text-emerald-600 dark:text-emerald-500">Wrap Up Match</h2>
            </div>
            <div className="p-6 space-y-6">
              {new Date(activeFixture.match_date) > new Date() && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 p-4 rounded-xl flex items-start gap-3">
                  <i className="fa-solid fa-triangle-exclamation text-amber-500 mt-0.5"></i>
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                    <strong>Future Match:</strong> This match hasn't happened yet. Are you sure you want to wrap it up?
                  </p>
                </div>
              )}
              <div className="bg-zinc-50 dark:bg-[#1A1A1A] p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="flex bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-1 transition-colors mb-2">
                  <button onClick={() => setFinaliseStatus('completed')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-colors ${finaliseStatus === 'completed' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}>Played</button>
                  <button onClick={() => setFinaliseStatus('abandoned')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-colors ${finaliseStatus === 'abandoned' ? 'bg-red-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}>Abandoned</button>
                </div>
                
                {finaliseStatus === 'abandoned' && (
                  <div className="mt-4 border-t border-zinc-200 dark:border-zinc-700 pt-4">
                     <div className="flex items-center justify-between mb-3">
                       <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">Charge Match Fees?</span>
                       <button 
                         onClick={() => setChargeAbandonedFee(!chargeAbandonedFee)}
                         className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${chargeAbandonedFee ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                       >
                         <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${chargeAbandonedFee ? 'translate-x-4' : 'translate-x-0'}`}></div>
                       </button>
                     </div>
                     <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400 leading-relaxed">
                       {chargeAbandonedFee
                         ? `Any unpaid fees from today's squad (${squad.filter(p => !paidPlayerIds.includes(p.id)).length} player${squad.filter(p => !paidPlayerIds.includes(p.id)).length === 1 ? '' : 's'}) will automatically roll over to their outstanding debts.`
                         : "No match fees will be collected or added to player balances for this match."}
                     </p>
                  </div>
                )}

                {finaliseStatus === 'completed' && activeFixture?.umpire_fee > 0 && (
                  <div className="mt-4 border-t border-zinc-200 dark:border-zinc-700 pt-4">
                     <div className="flex items-center justify-between mb-3">
                       <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">Record {clubInfo.expense_label || 'Expenses'}? (${activeFixture.umpire_fee})</span>
                       {isUmpirePaid ? (
                         <span className="text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-500 bg-orange-50 dark:bg-orange-500/10 px-2 py-1 rounded-md">Paid</span>
                       ) : (
                         <button 
                           onClick={() => setPayUmpire(!payUmpire)}
                           className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${payUmpire ? 'bg-orange-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                         >
                           <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${payUmpire ? 'translate-x-4' : 'translate-x-0'}`}></div>
                         </button>
                       )}
                     </div>
                     <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400 leading-relaxed">
                       {payUmpire || isUmpirePaid ? "An expense transaction will be recorded for this match." : "No expense transaction will be recorded."}
                     </p>
                  </div>
                )}

                {finaliseStatus === 'completed' && squad.filter(p => !paidPlayerIds.includes(p.id)).length > 0 && (
                  <div className="mt-4 border-t border-zinc-200 dark:border-zinc-700 pt-4">
                     <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400 mb-3 block">Unpaid Players ({squad.filter(p => !paidPlayerIds.includes(p.id)).length})</span>
                     <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
                        {squad.filter(p => !paidPlayerIds.includes(p.id)).map(p => (
                           <div key={p.id} className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-2.5 rounded-xl">
                              <span className="text-xs font-bold text-zinc-900 dark:text-white uppercase truncate pr-2">
                                 {p.nickname || `${p.first_name} ${p.last_name?.charAt(0)}.`}
                              </span>
                              <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 shrink-0">
                                 <button
                                   onClick={() => setUnpaidPlayerActions(prev => ({...prev, [p.id]: 'charge'}))}
                                   className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-md transition-colors ${unpaidPlayerActions[p.id] === 'charge' ? 'bg-red-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                                 >
                                    Owes Fees
                                 </button>
                                 <button
                                   onClick={() => setUnpaidPlayerActions(prev => ({...prev, [p.id]: 'paid'}))}
                                   className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-md transition-colors ${unpaidPlayerActions[p.id] === 'paid' ? 'bg-emerald-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                                 >
                                    Paid
                                 </button>
                                 <button
                                   onClick={() => setUnpaidPlayerActions(prev => ({...prev, [p.id]: 'remove'}))}
                                   className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-md transition-colors ${unpaidPlayerActions[p.id] === 'remove' ? 'bg-zinc-300 dark:bg-zinc-600 text-zinc-800 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                                 >
                                    Did Not Play
                                 </button>
                               </div>
                           </div>
                        ))}
                     </div>
                  </div>
                )}

                {finaliseStatus === 'completed' && (
                   <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400 leading-relaxed mt-4">
                     Review unpaid players above. Marking as 'Owe Fees' rolls the fee to their account. 'Paid' logs their fee as settled. 'Did Not Play' removes them from the match.
                   </p>
                )}
              </div>

              <button 
                onClick={executeMatchFinalization} 
                disabled={isProcessing}
                className={`w-full py-4 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95 disabled:opacity-50 ${finaliseStatus === 'completed' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'}`}
              >
                {isProcessing ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 space-y-6 pb-32 relative overflow-x-hidden">
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-lg z-[300] animate-in slide-in-from-bottom-5 ${toast.type === 'success' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'} font-black uppercase tracking-widest text-[10px] whitespace-nowrap flex items-center gap-2`}>
          <i className={`fa-solid ${toast.type === 'success' ? 'fa-check' : 'fa-triangle-exclamation'}`}></i> {toast.msg}
        </div>
      )}

      {profile && profile.onboarding_completed !== true && profile.role !== 'super_admin' && (
          <SetupChecklist 
            user={profile}
            activeClubId={activeClubId} 
            clubInfo={clubInfo} 
            onUpdateClubInfo={setClubInfo}
            teamFees={teamFees} 
            teamsCount={teams.length}
            teams={teams}
            onDismiss={() => {
               if (profile?.id) {
                 supabase.from('profiles').update({ onboarding_completed: true }).eq('id', profile.id).then(() => {
                   window.location.reload();
                 });
               }
            }}
            onClubCreated={(clubId) => window.location.reload()}
          />
      )}

      {(profile?.onboarding_completed === true || profile?.role !== 'club_admin') && (
        <>
          {(profile?.role === 'club_admin' || profile?.role === 'super_admin') && teams.filter(t => t.is_active !== false).length > 1 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm transition-colors">
          <label className="text-[10px] uppercase font-black tracking-widest text-emerald-600 dark:text-emerald-500 block mb-2 ml-1">Manager View</label>
          <select value={selectedTeamId || ""} onChange={(e) => { setSelectedTeamId(e.target.value); localStorage.setItem('fp_selected_team_id', e.target.value); }} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none font-bold transition-colors">
            <option value="" disabled>-- Select a Team --</option>
            {teams.filter(t => t.is_active !== false).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {selectedTeamId && activeFixture ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden transition-colors">
          
          <div className="flex flex-col gap-2 p-4 border-b border-zinc-100 dark:border-zinc-800" ref={manageTeamRef}>
            <div className="flex items-center justify-between">
              <div className="flex items-center flex-wrap gap-2">
                {(() => {
                  const matchD = new Date(activeFixture.match_date);
                  const today = new Date();
                  const isToday = matchD.toDateString() === today.toDateString();
                  const isPast = matchD < new Date(today.setHours(0,0,0,0));
                  
                  let text = "Upcoming";
                  let bg = "bg-emerald-600 dark:bg-emerald-500";
                  if (isToday) {
                    text = "Active";
                  } else if (isPast) {
                    text = "To Finalise";
                    bg = "bg-amber-500 dark:bg-amber-600";
                  }
                  return (
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded text-white tracking-widest ${bg} leading-none shadow-sm`}>
                      {text}
                    </span>
                  );
                })()}
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  {new Date(activeFixture.match_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                  {(activeFixture.start_time || activeFixture.location) && (
                    <>
                      <span className="mx-1.5">•</span>
                      {activeFixture.start_time && `${activeFixture.start_time} `}
                      {activeFixture.location && `@ ${activeFixture.location}`}
                    </>
                  )}
                </span>
              </div>
            </div>

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

          {/* INLINE TABS COMPONENT (Migrated to Team Hub) */}
        </div>
      ) : selectedTeamId && profile?.onboarding_completed ? (
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
              Waiting for your Team Admin to add the schedule.
            </p>
          )}
        </div>
      ) : profile?.onboarding_completed ? (
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
               Waiting for an Account Admin to set up the club.
            </p>
          )}
        </div>
      ) : null}


      {/* --- PAYMENT & COLLECTION AREA --- */}
      {activeFixture && (
        <div className="mb-4 mt-8 border-t border-zinc-200 dark:border-zinc-800/50 pt-6 transition-colors">
          
          <div className="flex justify-between items-center mb-4 px-1">
             <h2 className="text-[11px] font-black uppercase italic tracking-widest text-emerald-600 dark:text-emerald-500">To Pay ({squadToPay.length})</h2>
             <div className="flex items-center gap-4">
               {canManage && squad.length > 0 && (
                 <button onClick={() => toggleManageSquad()} className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 hover:text-emerald-700 flex items-center gap-1.5"><i className="fa-solid fa-user-plus"></i> Add</button>
               )}
               <button onClick={() => {setSelectedPlayerIds([]); setPaymentData({});}} className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400">Clear All</button>
             </div>
          </div>

          {/* INLINE ADD PLAYER */}
          {isManageSquadExpanded && (
            <div className="bg-zinc-50 dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 mb-6 animate-in slide-in-from-top-2 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                  <i className="fa-solid fa-user-plus text-emerald-500"></i> Add Player to Squad
                </h2>
                <button onClick={() => setIsManageSquadExpanded(false)} className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors">
                  <i className="fa-solid fa-xmark text-xs"></i>
                </button>
              </div>
              
              <div className="relative mb-4">
                <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm"></i>
                <input 
                  type="text" 
                  placeholder="Search existing players or type a new name..." 
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  className="w-full bg-white dark:bg-[#222] border border-zinc-200 dark:border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors font-bold shadow-sm"
                />
              </div>

              <div className="max-h-96 overflow-y-auto pr-1">
                {playerSearch.trim().length > 0 && !clubPlayers.some(p => p.first_name.toLowerCase() === playerSearch.toLowerCase().split(' ')[0]) && (
                   <div className="bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-xl border border-emerald-200 dark:border-emerald-500/20 shadow-sm animate-in fade-in mb-3">
                     <h3 className="text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1.5"><i className="fa-solid fa-sparkles"></i> Create New Member</h3>
                     <div className="flex flex-col sm:flex-row gap-2">
                       <input 
                         type="email" 
                         placeholder="Email (Optional)" 
                         value={newPlayerEmail}
                         onChange={(e) => setNewPlayerEmail(e.target.value)}
                         className="flex-1 bg-white dark:bg-black border border-emerald-200 dark:border-emerald-500/30 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500 font-bold"
                       />
                       <button 
                         onClick={() => createAndAddPlayer(playerSearch, newPlayerEmail)}
                         disabled={isProcessing}
                         className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                       >
                         {isProcessing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : "Create & Add"}
                       </button>
                     </div>
                   </div>
                )}
                {['yes', 'maybe', 'no_reply', 'no'].map((section) => {
                  const sectionPlayers = clubPlayers.filter(p => {
                    const avail = fixtureAvailability.find(a => a.player_id === p.id);
                    const status = avail ? avail.status : 'no_reply';
                    const isRelevant = p.default_team_id === selectedTeamId || avail !== undefined;
                    const matchesSearch = playerSearch ? `${p.first_name} ${p.last_name || ''} ${p.nickname || ''}`.toLowerCase().includes(playerSearch.toLowerCase()) : true;
                    
                    const isNotAlreadyInSquad = !squad.some(sp => sp.id === p.id);

                    return isNotAlreadyInSquad && (playerSearch ? (status === section && matchesSearch) : (status === section && isRelevant));
                  });

                  if (sectionPlayers.length === 0) return null;

                  const config = {
                    yes: { label: "Available", color: "text-emerald-500", icon: "fa-circle-check" },
                    maybe: { label: "Maybe", color: "text-amber-500", icon: "fa-circle-question" },
                    no_reply: { label: fixtureAvailability.length > 0 ? "No Reply" : "Squad Players", color: "text-zinc-400 dark:text-zinc-500", icon: fixtureAvailability.length > 0 ? "fa-circle" : "fa-users" },
                    no: { label: "Unavailable", color: "text-red-500", icon: "fa-circle-xmark" }
                  }[section as 'yes' | 'maybe' | 'no_reply' | 'no'];

                  const isSecExpanded = expandedPoolSections[section] || playerSearch.trim().length > 0 || (fixtureAvailability.length === 0 && section === 'no_reply');
                  const toggleSec = () => setExpandedPoolSections(prev => ({...prev, [section]: !prev[section]}));

                  return (
                    <div key={section} className="mb-2">
                      <button onClick={toggleSec} className="w-full flex items-center justify-between py-2 text-left group">
                        <h3 className={`text-[10px] font-black uppercase tracking-widest ${config.color} flex items-center gap-2`}>
                          <i className={`fa-solid ${config.icon}`}></i> {config.label} ({sectionPlayers.length})
                        </h3>
                        <i className={`fa-solid fa-chevron-${isSecExpanded ? 'up' : 'down'} text-[10px] text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors`}></i>
                      </button>
                      
                      {isSecExpanded && (
                        <div className="flex flex-wrap gap-2.5 pt-2 pb-1 animate-in fade-in">
                          {sectionPlayers.map(p => (
                            <button 
                              key={p.id}
                              onClick={() => {
                                 addPlayerToSquad(p.id);
                                 if (playerSearch.trim().length > 0) setPlayerSearch("");
                              }}
                              disabled={isProcessing}
                              className="px-4 py-3 rounded-xl font-black text-[11px] uppercase transition-all flex items-center gap-2 bg-white dark:bg-[#1A1A1A] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-400 dark:hover:border-zinc-600 shadow-sm disabled:opacity-50"
                            >
                              <span>{p.nickname || `${p.first_name} ${p.last_name ? p.last_name.charAt(0) + '.' : ''}`}</span>
                              <i className="fa-solid fa-plus text-[10px] opacity-50"></i>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {playerSearch.trim() === "" && clubPlayers.filter(p => !squad.some(sp => sp.id === p.id)).length === 0 && (
                   <div className="text-center py-4 text-[10px] uppercase font-bold text-zinc-400">
                     All players are in the squad!
                   </div>
                )}
                
                {fixtureAvailability.length === 0 && (
                   <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 rounded-xl p-4 mt-6 mb-2 text-center">
                     <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-2"><i className="fa-solid fa-lightbulb text-amber-500 mr-1.5"></i> Did you know?</p>
                     <p className="text-[10px] text-zinc-600 dark:text-zinc-400 mb-3 font-bold leading-relaxed">You can share your own Availability Hub with your team so players can RSVP for upcoming matches!</p>
                     <button onClick={() => {
                        window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'team' }));
                     }} className="bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 text-emerald-700 dark:text-emerald-400 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95">
                        Go to Team Hub <i className="fa-solid fa-arrow-right ml-1"></i>
                     </button>
                   </div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2.5 mb-6">
            {isSquadLoading ? (
               <div className="w-full text-center py-6">
                 <i className="fa-solid fa-circle-notch fa-spin text-emerald-500 text-2xl"></i>
               </div>
            ) : squad.length === 0 ? (
               !isManageSquadExpanded ? (
                 <div className="w-full text-center py-8 px-6 border-2 border-dashed border-emerald-500/50 dark:border-emerald-900/50 rounded-2xl bg-emerald-50/50 dark:bg-emerald-900/10 transition-colors flex flex-col items-center">
                   <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-3 text-emerald-600 dark:text-emerald-500">
                     <i className="fa-solid fa-clipboard-user text-xl"></i>
                   </div>
                   <h3 className="font-black uppercase tracking-widest text-xs text-emerald-800 dark:text-emerald-400 mb-1">Who's Available?</h3>
                   
                   {canManage ? (
                     <>
                       <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 leading-relaxed">
                         Select the players for this match so you can collect fees.
                       </p>
                       <button 
                         onClick={() => toggleManageSquad(true)}
                         className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 flex items-center gap-2"
                       >
                         <i className="fa-solid fa-user-plus"></i> Select Squad
                       </button>
                     </>
                   ) : (
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 leading-relaxed">
                        Waiting for your Team Admin to assign the match players.
                      </p>
                   )}
                 </div>
               ) : null
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
                    className={`px-4 py-3 rounded-xl font-black text-[11px] uppercase transition-all relative border ${isSelected ? 'text-white bg-emerald-600 dark:bg-emerald-500 scale-[1.02] shadow-[0_0_15px_rgba(16,185,129,0.3)] border-transparent' : 'bg-white dark:bg-[#1A1A1A] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-400 dark:hover:border-zinc-600'}`}
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
                  
                  {((clubInfo?.accepts_cash !== false) && (clubInfo?.is_square_enabled !== false)) && (
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
                            initiateOnlinePayment(player);
                          } else if (clubInfo?.pay_id_value) {
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
                  )}

                  {((clubInfo?.accepts_cash !== false) && (clubInfo?.is_square_enabled === false)) && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black text-[9px] uppercase tracking-widest px-3 py-2 rounded-lg flex items-center gap-2">
                       <i className="fa-solid fa-money-bill-wave"></i> Cash Only
                    </div>
                  )}

                  {((clubInfo?.accepts_cash === false) && (clubInfo?.is_square_enabled !== false)) && (
                    <button 
                      onClick={() => {
                        setPaymentData(prev => ({...prev, [player.id]: {...prev[player.id], method: 'card'}}));
                        if (isSquareEnabled && canManage) {
                          initiateOnlinePayment(player);
                        } else if (clubInfo?.pay_id_value) {
                          setActivePayIdPlayer(player);
                          setIsPayIdModalOpen(true);
                        }
                      }}
                      className="bg-blue-500 text-white font-black text-[9px] uppercase tracking-widest px-3 py-2 rounded-lg shadow-sm flex items-center gap-2 hover:bg-blue-600 active:scale-95 transition-all"
                    >
                       <i className="fa-solid fa-qrcode"></i> Digital Checkout
                    </button>
                  )}
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
            
            <button onClick={processBatchPayments} disabled={isProcessing || processableCount === 0} className="w-full py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50">
              {isProcessing ? 'Saving...' : `Save ${processableCount} Payment${processableCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}

      {/* --- MATCH COMPLETION ACTIONS --- */}
      {activeFixture && selectedPlayerIds.length === 0 && (
        <div className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800 space-y-6">
          
          {/* --- MOVED: UMPIRE / EXPENSE TOGGLE INTO FINALISE MODAL --- */}

          <div className="space-y-3">
            <button 
              onClick={() => { 
                setFinaliseStatus('completed'); 
                setChargeAbandonedFee(false); 
                const newActions: Record<string, 'charge' | 'remove' | 'paid'> = {};
                squad.filter(p => !paidPlayerIds.includes(p.id)).forEach(p => {
                  newActions[p.id] = 'charge'; 
                });
                setUnpaidPlayerActions(newActions);
                setIsFinaliseModalOpen(true); 
              }} 
              className="w-full py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              Finalise Match
            </button>
            <p className="text-[9px] text-zinc-400 dark:text-zinc-600 text-center italic">
              Closes the match and finalises the ledger.
            </p>
          </div>
        </div>
      )}

      {/* --- PAST MATCHES TOGGLE (WITH INLINE REPORTER) --- */}
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
                 {pastFixtures.map(pf => {
                    const isExpanded = expandedPastFixtureId === pf.id;

                    return (
                      <div key={pf.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm transition-colors overflow-hidden">
                         
                         {/* Match Header (Clickable) */}
                         <div 
                           onClick={() => togglePastFixtureForAi(pf)} 
                           className={`flex justify-between items-center p-4 cursor-pointer transition-colors ${isExpanded ? 'bg-zinc-50 dark:bg-zinc-800/50' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
                         >
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
                           
                           {/* Magic Wand Action Button */}
                           <button 
                              disabled={isProcessing}
                              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm shrink-0 disabled:opacity-50 ${isExpanded ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200'}`}
                              title={isExpanded ? "Close Reporter" : "Generate Match Report"}
                           >
                              {isProcessing && expandedPastFixtureId === pf.id ? (
                                <i className="fa-solid fa-circle-notch fa-spin text-emerald-600"></i>
                              ) : (
                                <i className={`fa-solid ${isExpanded ? 'fa-chevron-up text-xs' : 'fa-wand-magic-sparkles text-emerald-500'}`}></i>
                              )}
                           </button>
                         </div>

                         {/* Inline AI Reporter Area */}
                         {isExpanded && (
                           <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#111] animate-in slide-in-from-top-2">
                             <div className="p-5 flex flex-col space-y-6">
                               
                               {/* Reporter Header */}
                               <div>
                                 <h2 className="text-[14px] font-black italic uppercase tracking-tighter text-emerald-600 dark:text-emerald-500 flex items-center gap-2">
                                   Match Reporter
                                 </h2>
                                 <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                                    <i className="fa-solid fa-wand-magic-sparkles text-emerald-500 text-[8px]"></i> Add your results to get commentary on the match.
                                 </p>
                                 
                               </div>

                               {/* Setup: Character & Image Selection */}
                               {!reporterLoading && !reporterText && (
                                 <div className="space-y-4">
                                   
                                   {/* Persona Dropdown */}
                                   <div className="space-y-1.5">
                                     <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Commentary Style</label>
                                     <select 
                                       value={reporterCharacter}
                                       onChange={(e) => setReporterCharacter(e.target.value)}
                                       className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors shadow-sm"
                                     >
                                       <option value="DAIVE">dAIve (Friendly Analyst)</option>
                                       <option value="OUTBACK_EXPERT">Rusty (Outback Expert)</option>
                                       <option value="CLUB_VETERAN">Gaz (Club Veteran)</option>
                                       <option value="SUBURBAN_MUM">Shazza (Suburban Mum)</option>
                                       <option value="CLASSIC_COMMENTATOR">Legendary Aussie Commentator</option>
                                       <option value="NEWS_ANCHOR">1970s Egotistical News Anchor</option>
                                       <option value="ALIEN_MASTER">Mystical Green Alien</option>
                                     </select>
                                   </div>

                                   {/* Custom Highlights Area */}
                                   <div className="space-y-1.5">
                                     <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Custom Highlights (Optional)</label>
                                     <textarea 
                                       value={reporterNotes}
                                       onChange={(e) => setReporterNotes(e.target.value)}
                                       placeholder="e.g., Ronan has an incredible debut! Edith scored her 100th point with the team."
                                       rows={2}
                                       className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors shadow-sm"
                                     />
                                   </div>

                                   {/* File Upload Box (Multiple) */}
                                   <div className="relative group mt-2">
                                     <input 
                                       type="file" 
                                       accept="image/*" 
                                       multiple
                                       onChange={(e) => setReporterImages(Array.from(e.target.files || []).slice(0, 3))} // Cap at 3 images
                                       className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                     />
                                     <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${reporterImages.length > 0 ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 group-hover:border-zinc-400'}`}>
                                       <i className={`fa-solid ${reporterImages.length > 0 ? 'fa-images text-emerald-600 dark:text-emerald-500' : 'fa-camera text-zinc-400 dark:text-zinc-500'} text-2xl mb-2 transition-colors`}></i>
                                       <p className={`text-[10px] font-bold uppercase tracking-widest ${reporterImages.length > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-500'}`}>
                                         {reporterImages.length > 0 ? `${reporterImages.length} Image${reporterImages.length > 1 ? 's' : ''} Selected` : 'Upload Scorebook(s)'}
                                       </p>
                                     </div>
                                   </div>
                                   
                                   <button 
                                     onClick={() => handleGenerateReport(pf)}
                                     disabled={reporterImages.length === 0}
                                     className="w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs text-white shadow-md active:scale-95 transition-all disabled:opacity-50 bg-emerald-600 hover:bg-emerald-500 mt-2"
                                   >
                                     Generate Report
                                   </button>
                                 </div>
                               )}

                               {/* Loading State */}
                               {reporterLoading && (
                                 <div className="flex flex-col items-center justify-center py-8 space-y-5 animate-in fade-in">
                                   <i className="fa-solid fa-wand-magic-sparkles text-3xl animate-pulse text-emerald-500"></i>
                                   <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center px-4 animate-pulse">
                                     {reporterLoadingText}
                                   </p>
                                 </div>
                               )}

                               {/* Generated Result */}
                               {reporterText && !reporterLoading && (
                                 <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                   <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-5 rounded-2xl shadow-sm">
                                     <div className="text-sm font-medium leading-relaxed text-zinc-800 dark:text-zinc-300">
                                       {formatReportText(reporterText)}
                                     </div>
                                   </div>
                                   
                                   <div className="flex gap-2">
                                     <button onClick={() => { setReporterText(""); setReporterImages([]); setReporterNotes(""); }} className="flex-1 py-4 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 transition-colors font-black uppercase tracking-widest text-[10px] text-zinc-600 dark:text-zinc-400 shadow-sm">
                                       New
                                     </button>
                                     <button onClick={handleShareReport} className="flex-[2] py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50">
                                       <i className="fa-solid fa-share-nodes mr-2"></i> Share Report
                                     </button>
                                   </div>
                                 </div>
                               )}
                             </div>
                           </div>
                         )}
                      </div>
                    );
                 })}
              </div>
           )}
        </div>
      )}

      {/* --- SEND REMINDERS MODAL --- */}
      {isReminderModalOpen && activeFixture && (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4 transition-colors">
          <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 w-full max-w-[400px] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-5 flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-lg font-black italic uppercase tracking-tighter text-emerald-600 dark:text-emerald-500">Send Reminders</h2>
              <button onClick={() => setIsReminderModalOpen(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            <div className="p-6 space-y-6">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                You're about to send an availability invite to this game to <strong className="text-zinc-900 dark:text-white">{pendingReminderCount}</strong> {pendingReminderCount === 1 ? 'person' : 'people'}. Do you wish to send now?
              </p>
              
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 p-4 rounded-xl flex items-start gap-3">
                <i className="fa-solid fa-triangle-exclamation text-amber-500 mt-0.5"></i>
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                  <strong>Please note:</strong> You can only send 1 reminder per game.
                </p>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsReminderModalOpen(false)} 
                  className="flex-1 py-3.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-black uppercase tracking-widest rounded-xl transition-colors"
                >
                  No - Don't send
                </button>
                <button 
                  onClick={handleConfirmSendReminders} 
                  className="flex-1 py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  Yes - Send
                </button>
              </div>
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
      {isQrModalOpen && qrModalPlayer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 max-w-sm w-full text-center shadow-2xl relative max-h-[95vh] overflow-y-auto">
            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
            
            <Mark className="w-10 h-10 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 rounded-2xl shadow-sm" />
            
            <h2 className="text-xl font-black text-zinc-900 dark:text-white mb-1 md:mb-2 tracking-tight">Scan to Pay</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4 md:mb-6 leading-relaxed">
              Have <span className="font-bold text-zinc-900 dark:text-white">{qrModalPlayer.first_name}</span> scan this code to securely pay <span className="font-black text-emerald-600 dark:text-emerald-400">${qrTxAmount.toFixed(2)}</span> on their phone.
            </p>
            
            <div className="bg-white p-4 rounded-2xl inline-block mb-4 border-4 border-zinc-100 dark:border-zinc-800 shadow-sm relative group cursor-pointer" onClick={() => window.open(`${window.location.origin}/pay/${qrTxId}`, '_blank')}>
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                <i className="fa-solid fa-external-link-alt text-white text-3xl"></i>
              </div>
              <QRCodeSVG 
                value={`${window.location.origin}/pay/${qrTxId}`} 
                size={180}
                bgColor={"#ffffff"}
                fgColor={"#000000"}
                level={"Q"}
                includeMargin={false}
              />
            </div>
            
            <div className="flex justify-center gap-2 mb-4">
              <button 
                onClick={() => {
                  const url = `${window.location.origin}/pay/${qrTxId}`;
                  if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(url);
                    showToast("Link copied to clipboard!", "success");
                  } else {
                    // Fallback for non-secure HTTP contexts (like 192.168.x.x)
                    const textArea = document.createElement("textarea");
                    textArea.value = url;
                    textArea.style.position = "fixed";
                    textArea.style.left = "-999999px";
                    document.body.appendChild(textArea);
                    textArea.select();
                    try {
                      document.execCommand('copy');
                      showToast("Link copied to clipboard!", "success");
                    } catch (error) {
                      showToast("Failed to copy link.", "error");
                    }
                    textArea.remove();
                  }
                }}
                className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-2"
              >
                <i className="fa-solid fa-copy"></i> Copy Link
              </button>
            </div>
            
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-500 mb-6 bg-emerald-50 dark:bg-emerald-500/10 py-2 rounded-lg animate-pulse">
              <i className="fa-solid fa-circle-notch fa-spin"></i>
              <span>Waiting for payment...</span>
            </div>
            
            <button 
              onClick={() => {
                setIsQrModalOpen(false);
                setQrTxId("");
                setQrModalPlayer(null);
              }}
              className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-black uppercase tracking-widest rounded-xl transition-colors shadow-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

        </>
      )}
    </div>
  );
}