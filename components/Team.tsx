"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { useActiveClub } from "@/contexts/ClubContext";
import TeamListGraphicBuilder from "./TeamListGraphicBuilder";

export default function Team() {
  const { profile, roles } = useProfile();
  const { activeClubId } = useActiveClub();

  const [isLoading, setIsLoading] = useState(true);
  const [activeSeasonName, setActiveSeasonName] = useState<string | null | undefined>(undefined);
  const [planTier, setPlanTier] = useState<string>('free');
  const [clubInfo, setClubInfo] = useState<any>({ name: 'FP', logo_url: '' });
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [clubPlayers, setClubPlayers] = useState<any[]>([]);
  
  // Aggregated Data
  const [playerStats, setPlayerStats] = useState<Record<string, { id: string, name: string, full_name: string, is_member: boolean, balance: number, gamesPlayed: number }>>({});
  const [fixtureAvail, setFixtureAvail] = useState<any[]>([]);
  const [rosterSummary, setRosterSummary] = useState({ members: 0, casuals: 0, totalGames: 0 });

  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // UI States
  const [visibleFixtureCount, setVisibleFixtureCount] = useState(5);
  const [expandedFixtureId, setExpandedFixtureId] = useState<string | null>(null);
  
  // Inline Manage Team States
  const [managingFixtureId, setManagingFixtureId] = useState<string | null>(null);
  const [squadPlayerIds, setSquadPlayerIds] = useState<string[]>([]);
  const [modalAvailData, setModalAvailData] = useState<any[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [expandedPoolSections, setExpandedPoolSections] = useState<Record<string, boolean>>({ yes: true, maybe: true, no_reply: false, no: false });
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Inline Quick Financial Adjust
  const [activeFinancePlayerId, setActiveFinancePlayerId] = useState<string | null>(null);
  const [manualAmount, setManualAmount] = useState<number | "">("");
  const [manualType, setManualType] = useState<'payment' | 'fee'>('payment');
  const [manualNote, setManualNote] = useState("");

  // Tab & Email States
  const [activeTab, setActiveTab] = useState<'availability' | 'squad'>('availability');
  
  const [availabilityMode, setAvailabilityMode] = useState<'menu' | 'email_players' | 'email_stats'>('menu');
  const [emailSelectedPlayerIds, setEmailSelectedPlayerIds] = useState<string[]>([]);
  const [activeGraphicFixtureId, setActiveGraphicFixtureId] = useState<string | null>(null);
  const [availabilityEmailNote, setAvailabilityEmailNote] = useState("");
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  
  const [squadMode, setSquadMode] = useState<'squad' | 'email_players' | 'email_stats'>('squad');
  const [squadEmailSelectedPlayerIds, setSquadEmailSelectedPlayerIds] = useState<string[]>([]);
  const [squadEmailNote, setSquadEmailNote] = useState("");
  const [isSendingSquadEmail, setIsSendingSquadEmail] = useState(false);
  
  const [expandedEmailSections, setExpandedEmailSections] = useState<Record<string, boolean>>({ yes: true, maybe: true, no_reply: true, no: true });

  const [showPastFixtures, setShowPastFixtures] = useState(false);

  const [emailStats, setEmailStats] = useState<Record<string, number>>({ sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0 });
  const [isHubVisible, setIsHubVisible] = useState(false);
  const [emailLogDetails, setEmailLogDetails] = useState<any[]>([]);
  const [activeStatFilter, setActiveStatFilter] = useState<'sent' | 'delivered' | 'opened' | 'bounced' | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  const isClubAdmin = profile?.role === 'super_admin' || roles?.some((r: any) => r.role === 'club_admin' && r.club_id === activeClubId);

  const canManageTeam = (teamId: string) => {
    return isClubAdmin || roles?.some((r: any) => r.role === 'team_admin' && r.team_id === teamId);
  };

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const formatName = (p: any) => p.nickname ? p.nickname : `${p.first_name} ${p.last_name?.charAt(0) || ''}.`;

  // Clear state on club change to prevent data bleed between accounts
  useEffect(() => {
    setSelectedTeamId("");
    setTeams([]);
    setFixtureAvail([]);
    setClubPlayers([]);
    setPlayerStats({});
  }, [activeClubId]);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!profile || !activeClubId) return;
      if (refreshTrigger === 0) setIsLoading(true);

      
      // Fetch club info to get season_name and plan_tier for filtering/features
      const { data: clubData } = await supabase.from('clubs').select('season_name, plan_tier, name, logo_url').eq('id', activeClubId).single();
      const clubSeasonName = clubData?.season_name || null;
      setActiveSeasonName(clubSeasonName);
      setPlanTier(clubData?.plan_tier || 'free');
      if (clubData) setClubInfo(clubData);

      // 1. Determine Teams
      let teamQuery = supabase.from("teams").select("id, name, slug").eq("club_id", activeClubId);
      if (!isClubAdmin) {
        const allowedTeamIds = roles?.filter((r: any) => r.role === 'team_admin' && r.club_id === activeClubId).map((r: any) => r.team_id) || [];
        if (allowedTeamIds.length === 0) { setIsLoading(false); return; }
        teamQuery = teamQuery.in('id', allowedTeamIds);
      }
      
      const { data: teamData } = await teamQuery;
      const validTeams = teamData || [];
      setTeams(validTeams);
      
      let targetTeamId = selectedTeamId;
      if (!targetTeamId && validTeams.length > 0) {
        const savedTeam = localStorage.getItem('fp_selected_team_id');
        if (savedTeam && validTeams.find((t: any) => t.id === savedTeam)) {
          targetTeamId = savedTeam;
        } else {
          targetTeamId = validTeams[0].id;
        }
        setSelectedTeamId(targetTeamId);
      }

      if (!targetTeamId) { setIsLoading(false); return; }

      // Fetch all players for the club to allow cross-team causal adding
      const { data: playersData } = await supabase.from("players").select("id, first_name, last_name, nickname, email, default_team_id, is_member, is_active").eq("club_id", activeClubId);
      const allPlayers = playersData || [];
      setClubPlayers(allPlayers);
      const today = new Date();
      today.setHours(0,0,0,0);
      const { data: dbFixtures } = await supabase
        .from("fixtures")
        .select("id, opponent, match_date, team_id, status, reminder_sent, created_at, is_active, season_name, start_time, location, opponent_logo_url, notes")
        .eq("team_id", targetTeamId);

      let fixtures: any[] = [];
      const rawFixtures = dbFixtures?.filter((f: any) => clubSeasonName ? (f.season_name === clubSeasonName || !f.season_name) : !f.season_name) || [];
      if (rawFixtures && rawFixtures.length > 0) {
        const isPastFixture = (f: any) => {
           if (['completed', 'forfeited', 'abandoned'].includes(f.status)) return true;
           const matchD = new Date(f.match_date);
           const msPerDay = 24 * 60 * 60 * 1000;
           
           // Option A (Blocker): Unfinalised matches stay active forever, UNLESS they are a historical backfill
           const uploadedAfterMatch = f.created_at ? new Date(f.created_at).getTime() > (matchD.getTime() + msPerDay) : false;
           
           return uploadedAfterMatch;
        };

        const upcoming = rawFixtures.filter(f => !isPastFixture(f))
          .sort((a,b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime());
        const past = rawFixtures.filter(f => isPastFixture(f))
          .sort((a,b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime());
        fixtures = [...upcoming, ...past];
      }

      if (fixtures && fixtures.length > 0) {
        const fixtureIds = fixtures.map(f => f.id);
        const { data: availData } = await supabase.from("availability").select("fixture_id, player_id, status").in("fixture_id", fixtureIds);
        const { data: squadData } = await supabase.from("match_squads").select("fixture_id, player_id").in("fixture_id", fixtureIds);

        const formattedAvail = fixtures.map(f => {
          const lists: Record<string, string[]> = { yes: [], maybe: [], no: [], pending: [], squadIds: [] };
          const teamRoster = allPlayers.filter(p => p.default_team_id === f.team_id);
          const respondedPlayerIds = new Set();
          
          const fixtureAvails = availData?.filter(a => a.fixture_id === f.id) || [];
          const fixtureSquads = squadData?.filter(s => s.fixture_id === f.id) || [];
          
          fixtureSquads.forEach(s => lists.squadIds.push(s.player_id));

          fixtureAvails.forEach(a => {
            const player = allPlayers.find(p => p.id === a.player_id);
            if (player) {
               lists[a.status]?.push(formatName(player));
               respondedPlayerIds.add(player.id);
            }
          });

          teamRoster.forEach(p => {
             if (p.is_active !== false && !respondedPlayerIds.has(p.id)) {
                lists.pending.push(formatName(p));
             }
          });

          const total = lists.yes.length + lists.maybe.length + lists.no.length + lists.pending.length;

          return { ...f, lists, total };
        });
        setFixtureAvail(formattedAvail);
      } else {
        setFixtureAvail([]);
      }

      setIsLoading(false);
    }

    fetchDashboardData();
  }, [profile, activeClubId, selectedTeamId, roles, isClubAdmin, refreshTrigger]);

  const copyTeamLink = async () => {
    if (!selectedTeamId) return;
    const team = teams.find(t => t.id === selectedTeamId);
    const identifier = team?.slug || selectedTeamId;
    const shareUrl = `${window.location.origin}/t/${identifier}`;
    
    const shareTextWithoutUrl = `🏏 Update your availability for ${team?.name || 'the team'} here:`;
    const shareText = `${shareTextWithoutUrl}\n${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          text: shareTextWithoutUrl,
          url: shareUrl,
        });
      } catch (err) {
        console.error("Share failed", err);
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      showToast("Link copied to clipboard!");
    }
  };



  // --- INLINE SQUAD LOGIC ---
  const nextUpcomingFixtureId = fixtureAvail.find(fx => {
    const mD = new Date(fx.match_date);
    const tM = new Date();
    tM.setHours(0,0,0,0);
    const isP = ['completed', 'forfeited', 'abandoned'].includes(fx.status) || (fx.created_at ? new Date(fx.created_at).getTime() > (mD.getTime() + 24*60*60*1000) : false);
    const isT = mD.toDateString() === tM.toDateString();
    const isTF = !isP && mD < tM;
    return !isP && !isT && !isTF;
  })?.id;

  async function loadModalAvailData(fixtureId: string) { 
    setIsProcessing(true);
    const { data: squadData } = await supabase.from("match_squads").select("player_id").eq("fixture_id", fixtureId); 
    setSquadPlayerIds(squadData ? squadData.map(row => row.player_id) : []); 

    const { data: availData } = await supabase.from("availability").select("player_id, status").eq("fixture_id", fixtureId);
    setModalAvailData(availData || []);
    setIsProcessing(false);
  }

  const handleExpandFixture = (fId: string) => {
    if (expandedFixtureId === fId) {
      setExpandedFixtureId(null);
      setAvailabilityMode('menu');
      setSquadMode('squad');
    } else {
      setExpandedFixtureId(fId);
      const showAvailabilityTab = fId === nextUpcomingFixtureId;
      setActiveTab(showAvailabilityTab ? 'availability' : 'squad');
      setAvailabilityMode('menu');
      setSquadMode('squad');
      loadModalAvailData(fId);
    }
  };

  function toggleSquadPlayer(playerId: string) { 
    setSquadPlayerIds(prev => prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]); 
  }

  // --- Email Logic ---
  async function fetchEmailLogs(fixtureId: string) {
    try {
      const { data } = await supabase.from('email_logs').select('id, status, email_type, players(id, first_name, last_name, nickname, email)').eq('fixture_id', fixtureId);
      if (data) {
         const stats: Record<string, number> = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0 };
         data.forEach(log => {
           if (log.email_type !== 'squad_notification') {
             stats.sent++;
             stats[log.status] = (stats[log.status] || 0) + 1;
             if (['delivered', 'opened', 'clicked', 'complained'].includes(log.status)) {
               stats.delivered++;
             }
           }
         });
         setEmailStats(stats);
         setEmailLogDetails(data);
         setActiveStatFilter(null);
         return data;
      }
      return [];
    } catch (err) {
      console.error(err);
      showToast("Error loading analytics", "error");
      return [];
    } finally {
      setIsStatsLoading(false);
    }
  }

  const handleShareMatch = async (fixture: any) => {
    if (!fixture) return;
    const teamSlug = teams.find(t => t.id === selectedTeamId)?.slug || selectedTeamId;
    const shareUrl = `${window.location.origin}/t/${teamSlug}`;
    const matchDate = new Date(fixture.match_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    
    const shareTextWithoutUrl = `🏏 Game On! vs ${fixture.opponent}\n📅 ${matchDate} @ ${fixture.start_time || 'TBA'}\n📍 ${fixture.location || 'TBA'}\n\nUpdate your availability here:`;
    const shareText = `${shareTextWithoutUrl}\n${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Match Reminder: vs ${fixture.opponent}`,
          text: shareTextWithoutUrl,
          url: shareUrl,
        });
      } catch (err) {
        console.error("Share failed", err);
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      showToast("Reminder copied to clipboard!");
    }
  };

  const handleConfirmSendReminders = async (fixture: any) => {
    if (!fixture) return;
    setIsSendingReminders(true);
    
    try {
      const res = await fetch("/api/send-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          fixtureId: fixture.id, 
          teamId: selectedTeamId, 
          action: 'send',
          senderName: profile?.first_name || "Your Captain",
          customMessage: availabilityEmailNote,
          selectedPlayerIds: emailSelectedPlayerIds.length > 0 ? emailSelectedPlayerIds : undefined
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reminders");
      
      showToast(`Sent ${data.sentCount} reminder${data.sentCount !== 1 ? 's' : ''}!`);
      
      if (availabilityMode === 'email_players') {
        await fetchEmailLogs(fixture.id);
        setEmailSelectedPlayerIds([]);
      }
      setRefreshTrigger(prev => prev + 1); // Refresh data so reminder_sent flag is updated
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to send reminders", "error");
    } finally {
      setIsSendingReminders(false);
    }
  };

  const handleSendSquadEmail = async (fixtureId: string) => {
    if (!fixtureId || !selectedTeamId || squadEmailSelectedPlayerIds.length === 0) return;
    setIsSendingSquadEmail(true);

    try {
      const payload = {
        fixtureId: fixtureId,
        teamId: selectedTeamId,
        selectedPlayerIds: squadEmailSelectedPlayerIds,
        customMessage: squadEmailNote,
        senderName: profile?.first_name || "Your Team Admin"
      };

      const response = await fetch('/api/send-squad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to send squad emails');

      showToast(`Sent ${result.sentCount} team email${result.sentCount !== 1 ? 's' : ''}!`);
      setSquadEmailNote("");
      await fetchEmailLogs(fixtureId);
    } catch (err: any) {
      console.error(err);
      showToast(err.message, "error");
    } finally {
      setIsSendingSquadEmail(false);
    }
  };
  
  async function createAndAddPlayer(fullName: string, fixtureId: string) {
    if (!fixtureId) return;
    setIsSaving(true);
    try {
      const parts = fullName.trim().split(' ');
      const firstName = parts[0];
      const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '(Casual)';

      const { data: newPlayer, error: playerError } = await supabase
        .from('players')
        .insert([{
          first_name: firstName,
          last_name: lastName,
          club_id: activeClubId,
          is_member: false 
        }])
        .select()
        .single();

      if (playerError) throw playerError;

      if (newPlayer) {
        const { error: squadError } = await supabase.from("match_squads").insert([{ fixture_id: fixtureId, player_id: newPlayer.id }]);
        if (squadError) throw squadError;
        
        showToast("Player Created & Added");
        setPlayerSearch("");
        setRefreshTrigger(prev => prev + 1);
        setSquadPlayerIds(prev => [...prev, newPlayer.id]);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to create player", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveSquad(fixtureId: string) { 
    setIsSaving(true); 
    await supabase.from("match_squads").delete().eq("fixture_id", fixtureId); 
    if (squadPlayerIds.length > 0) { 
      const inserts = squadPlayerIds.map(playerId => ({ fixture_id: fixtureId, player_id: playerId })); 
      const { error } = await supabase.from("match_squads").insert(inserts); 
      
      // Automatically set their availability to 'yes' when locked into the squad
      const availInserts = squadPlayerIds.map(playerId => ({ fixture_id: fixtureId, player_id: playerId, status: 'yes' }));
      await supabase.from("availability").upsert(availInserts, { onConflict: 'fixture_id,player_id' });

      if (error) showToast(error.message, "error"); 
      else showToast("Match Team Locked In!"); 
    } else {
      showToast("Match Team Cleared!");
    }
    
      // Auto-refresh the main data so the 'SQUAD' counts update
      setRefreshTrigger(prev => prev + 1);
    setIsSaving(false); 
  }

  async function handleManualSave(e: React.FormEvent, targetPlayerId: string, fixtureId: string | null) {
    e.preventDefault();
    if (!manualAmount || isSaving || !activeClubId) return;
    setIsSaving(true);

    const txType = manualType === 'fee' ? 'expense' : 'payment';
    const payload = {
      player_id: targetPlayerId,
      team_id: selectedTeamId,
      club_id: activeClubId,
      fixture_id: fixtureId || null,
      amount: Number(manualAmount),
      transaction_type: manualType,
      payment_method: manualType === 'payment' ? (manualNote.toLowerCase().includes('card') ? 'card' : 'cash') : null,
      description: manualNote || `Manual ${manualType}`
    };

    const { error } = await supabase.from("transactions").insert([payload]);
    
    if (error) {
      showToast("Error saving transaction: " + error.message, 'error');
    } else {
      setManualAmount("");
      setManualNote("");
      setActiveFinancePlayerId(null);
      setRefreshTrigger(prev => prev + 1);
      showToast("Transaction Recorded!");
    }
    setIsSaving(false);
  }

  if (isLoading && fixtureAvail.length === 0 && Object.keys(playerStats).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Loading Team Data...</p>
      </div>
    );
  }

  if (activeSeasonName === null && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 bg-white dark:bg-zinc-900 rounded-3xl border-2 border-dashed border-zinc-500/30 dark:border-zinc-500/20 shadow-sm mt-2">
         <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-900/20 rounded-full flex items-center justify-center mb-4 text-zinc-600 dark:text-zinc-500 shadow-inner">
            <i className="fa-solid fa-moon text-3xl opacity-80"></i>
         </div>
         <h3 className="font-black uppercase tracking-widest text-sm text-zinc-800 dark:text-zinc-400 mb-2">Season Closed</h3>
         <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-center max-w-[250px] leading-relaxed">
            There is no active season. Team Hub is unavailable until a new season begins.
         </p>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="p-10 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl mt-6 shadow-sm mx-4">
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">You are not assigned to manage any teams yet.</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 space-y-6 pb-20 relative">
      
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-lg z-[100] animate-in slide-in-from-bottom-5 fade-in ${toast.type === 'success' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'} font-black uppercase tracking-widest text-[10px] whitespace-nowrap flex items-center gap-2`}>
          <i className={`fa-solid ${toast.type === 'success' ? 'fa-check' : 'fa-triangle-exclamation'}`}></i> {toast.msg}
        </div>
      )}

      {teams.length > 1 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm transition-colors">
          <label className="text-[10px] uppercase font-black tracking-widest text-emerald-600 dark:text-emerald-500 block mb-2 ml-1">Managing Team</label>
          <select 
            value={selectedTeamId} 
            onChange={(e) => { setSelectedTeamId(e.target.value); localStorage.setItem('fp_selected_team_id', e.target.value); }}
            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none font-bold transition-colors cursor-pointer"
          >
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {/* SECTION: PLAYER AVAILABILITY */}
      <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm flex flex-col gap-4 mt-2">
         <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/50 pb-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 flex items-center justify-center">
                 <i className="fa-solid fa-users text-sm"></i>
              </div>
              <h2 className="text-sm font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">Team Hub</h2>
            </div>
            <div className="flex gap-2">
               <button 
                 onClick={() => setIsHubVisible(!isHubVisible)}
                 className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all flex items-center gap-2"
               >
                 <i className={`fa-solid ${isHubVisible ? 'fa-eye-slash' : 'fa-eye'}`}></i> {isHubVisible ? 'Hide' : 'View'}
               </button>
               <button 
                 onClick={copyTeamLink}
                 className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-emerald-100 dark:hover:bg-emerald-500/20 active:scale-95 transition-all flex items-center gap-2"
               >
                 <i className="fa-solid fa-share-nodes"></i> Share
               </button>
            </div>
         </div>

         <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 leading-relaxed px-1 mb-2">
           Manage your players' availability and lock in match squads.
         </p>

         {isHubVisible && selectedTeamId && (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden mb-6 relative bg-zinc-50 dark:bg-zinc-950 animate-in fade-in slide-in-from-top-2">
               <div className="absolute top-0 w-full bg-zinc-200 dark:bg-zinc-800 text-[9px] font-black uppercase text-center py-1 tracking-widest text-zinc-500 z-10 pointer-events-none">Public Player View</div>
               <iframe 
                 src={`/t/${teams.find(t => t.id === selectedTeamId)?.slug || selectedTeamId}`} 
                 className="w-full h-[650px] border-0 pt-6"
               />
            </div>
         )}

         {fixtureAvail.length === 0 ? (
            <p className="text-xs font-bold text-zinc-500 text-center py-6">No upcoming fixtures found.</p>
         ) : (
            <>
              {fixtureAvail.slice(0, visibleFixtureCount).map((f, i) => {
                 const date = new Date(f.match_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
                 
                 const matchD = new Date(f.match_date);
                 const msPerDay = 24 * 60 * 60 * 1000;
                 const uploadedAfterMatch = f.created_at ? new Date(f.created_at).getTime() > (matchD.getTime() + msPerDay) : false;
                 const isPast = ['completed', 'forfeited', 'abandoned'].includes(f.status) || uploadedAfterMatch;
                 
                 const todayMidnight = new Date();
                 todayMidnight.setHours(0,0,0,0);
                 const isToday = matchD.toDateString() === todayMidnight.toDateString();
                 const isToFinalise = !isPast && matchD < todayMidnight;
                 
                 let badgeText = "";
                 let badgeColor = "";
                 if (!f.is_active) {
                    badgeText = "DEACTIVATED";
                    badgeColor = "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
                 } else if (f.status === 'forfeited') {
                    badgeText = "FORFEIT";
                    badgeColor = "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
                 } else if (f.status === 'abandoned') {
                    badgeText = "ABANDONED";
                    badgeColor = "bg-red-600 text-white";
                 } else if (f.status === 'completed' || uploadedAfterMatch) {
                    badgeText = "COMPLETED";
                    badgeColor = "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
                 } else if (isToday) {
                    badgeText = "ACTIVE";
                    badgeColor = "bg-emerald-600 text-white";
                 } else if (isToFinalise) {
                    badgeText = "TO FINALISE";
                    badgeColor = "bg-amber-500 text-white";
                 } else {
                    badgeText = "UPCOMING";
                    badgeColor = "bg-emerald-600 text-white";
                 }
                 
                 const prevMatchD = i > 0 ? new Date(fixtureAvail[i-1].match_date) : null;
                 const prevUploadedAfterMatch = i > 0 && fixtureAvail[i-1].created_at ? new Date(fixtureAvail[i-1].created_at).getTime() > (prevMatchD!.getTime() + msPerDay) : false;
                 const prevIsPast = i > 0 ? ['completed', 'forfeited', 'abandoned'].includes(fixtureAvail[i-1].status) || prevUploadedAfterMatch : false;
                 
                 const showPastDivider = isPast && !prevIsPast;

                 if (isPast && !showPastFixtures && !showPastDivider) return null;

                 const yesPct = f.total > 0 ? (f.lists.yes.length / f.total) * 100 : 0;
                 const maybePct = f.total > 0 ? (f.lists.maybe.length / f.total) * 100 : 0;
                 const noPct = f.total > 0 ? (f.lists.no.length / f.total) * 100 : 0;
                 const isExpanded = expandedFixtureId === f.id;

                 return (
                    <React.Fragment key={f.id}>
                       {showPastDivider && (
                         <div className="mt-4 mb-2">
                           <button 
                              onClick={() => setShowPastFixtures(!showPastFixtures)}
                              className="w-full py-3 bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm text-[10px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400 flex items-center justify-between px-5 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700"
                           >
                              <span>Past Matches</span>
                              <i className={`fa-solid fa-chevron-${showPastFixtures ? 'up' : 'down'}`}></i>
                           </button>
                         </div>
                       )}
                       {(!isPast || showPastFixtures) && (
                       <div className="bg-zinc-50 dark:bg-[#1A1A1A] rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-all">
                          <button 
                             onClick={() => handleExpandFixture(f.id)}
                             className="w-full text-left p-4 focus:outline-none hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                          >
                             <div className="flex justify-between items-start w-full mb-3">
                                 <div className="flex flex-col items-start gap-1">
                                   {badgeText && <span className={`text-[9px] font-black uppercase px-2 py-1 rounded tracking-widest leading-none shadow-sm ${badgeColor}`}>{badgeText}</span>}
                                   <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                     {date}
                                     {(f.start_time || f.location) && (
                                       <>
                                         <span className="mx-1.5">•</span>
                                         {f.start_time && `${f.start_time} `}
                                         {f.location && `@ ${f.location}`}
                                       </>
                                     )}
                                   </span>
                                 </div>
                              </div>

                              <div className="flex items-center justify-between gap-2 w-full mb-4">
                                <div className="flex items-center gap-3 flex-1">
                                  <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
                                    {clubInfo?.logo_url ? (
                                      <img src={clubInfo.logo_url} alt="Club Logo" className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-[10px] font-black text-zinc-500">{clubInfo?.name?.substring(0, 2).toUpperCase()}</span>
                                    )}
                                  </div>
                                  <span className="font-black text-xs uppercase tracking-wide text-zinc-900 dark:text-white leading-tight break-words text-left">
                                    {teams.find(t => t.id === f.team_id)?.name || "Team"}
                                  </span>
                                </div>

                                <div className="shrink-0 px-2 text-center">
                                  <span className="text-[10px] font-black text-zinc-300 dark:text-zinc-700 italic uppercase tracking-widest">VS</span>
                                </div>

                                <div className="flex items-center justify-end gap-3 flex-1">
                                  <span className="font-black text-xs uppercase tracking-wide text-zinc-900 dark:text-white text-right leading-tight break-words">
                                    {f.opponent}
                                  </span>
                                  <div className="w-8 h-8 rounded-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
                                    {f.opponent_logo_url ? (
                                      <img src={f.opponent_logo_url} alt="Opponent Logo" className="w-full h-full object-cover" />
                                    ) : (
                                      <i className="fa-solid fa-shield text-zinc-300 dark:text-zinc-700 text-xs"></i>
                                    )}
                                  </div>
                                </div>
                              </div>
                          
                          <div className="w-full h-3.5 bg-zinc-200 dark:bg-zinc-900 rounded-full overflow-hidden flex shadow-inner">
                             <div style={{ width: `${yesPct}%` }} className="bg-emerald-500 h-full transition-all"></div>
                             <div style={{ width: `${maybePct}%` }} className="bg-amber-500 h-full transition-all"></div>
                             <div style={{ width: `${noPct}%` }} className="bg-red-500 h-full transition-all"></div>
                          </div>
                          
                          <div className="flex justify-between items-center mt-2">
                             <div className="flex gap-2 sm:gap-3 text-[9px] font-black uppercase tracking-widest">
                                <span className="text-emerald-600 dark:text-emerald-500">{f.lists.yes.length} YES</span>
                                <span className="text-amber-500">{f.lists.maybe.length} MAYBE</span>
                                <span className="text-zinc-400 dark:text-zinc-500">{f.lists.pending.length} PENDING</span>
                                <span className="text-red-500">{f.lists.no.length} NO</span>
                             </div>
                             <i className={`fa-solid fa-chevron-down text-zinc-400 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}></i>
                          </div>
                       </button>

                       {/* Expanded Roster Lists & Manage Team */}
                       {isExpanded && (
                          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111] animate-in slide-in-from-top-2 fade-in duration-200">
                             
                             {canManageTeam(f.team_id) && f.id === nextUpcomingFixtureId && (
                                <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/30 transition-colors mb-4 rounded-t-2xl">
                                  <div className="relative flex bg-emerald-50 dark:bg-emerald-950/40 p-1 rounded-xl">
                                    <div 
                                      className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-emerald-600 shadow-md rounded-lg transition-all duration-300 ease-out ${
                                        activeTab === 'squad' ? 'translate-x-full' : 'translate-x-0'
                                      }`}
                                    />
                                    
                                    <button 
                                      onClick={() => setActiveTab('availability')} 
                                      className={`flex-1 relative z-10 py-2.5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors duration-300 ${activeTab === 'availability' ? 'text-white' : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/50'}`}
                                    >
                                      <i className="fa-solid fa-bullhorn"></i> Availability
                                    </button>
                                    
                                    <button 
                                      onClick={() => setActiveTab('squad')} 
                                      className={`flex-1 relative z-10 py-2.5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors duration-300 ${activeTab === 'squad' ? 'text-white' : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/50'}`}
                                    >
                                      <i className="fa-solid fa-clipboard-check"></i> Match Lineup
                                    </button>
                                  </div>
                                </div>
                             )}

                             {/* --- AVAILABILITY TAB --- */}
                             {activeTab === 'availability' && canManageTeam(f.team_id) && f.id === nextUpcomingFixtureId && (
                               <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                                 {availabilityMode === 'menu' ? (
                                   <div className="flex flex-col gap-3">
                                     <button onClick={() => handleShareMatch(f)} className="w-full bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex items-center gap-4 hover:border-emerald-300 transition-colors text-left">
                                       <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500 shrink-0">
                                         <i className="fa-solid fa-share-nodes"></i>
                                       </div>
                                       <div>
                                         <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest">Share to Social</h4>
                                         <p className="text-[10px] font-medium text-zinc-500">Copy or share the availability link to your team group chat.</p>
                                       </div>
                                     </button>
                                     
                                     <button 
                                       onClick={async () => {
                                         setIsStatsLoading(true);
                                         const logs = await fetchEmailLogs(f.id);
                                         const respondedIds = new Set(modalAvailData.filter(a => ['yes', 'no', 'maybe'].includes(a.status)).map(a => a.player_id));
                                         const isSuperAdmin = profile?.role === 'super_admin';
                                         const pending = clubPlayers.filter(p => {
                                           const hasSent = logs.some(log => log.email_type === 'availability_reminder' && (log as any).players?.id === p.id);
                                           return p.default_team_id === f.team_id && 
                                                  p.is_active !== false &&
                                                  !respondedIds.has(p.id) && 
                                                  p.email && 
                                                  p.unsubscribed !== true && 
                                                  !hasSent;
                                         });
                                         setEmailSelectedPlayerIds(pending.map(p => p.id));
                                         setAvailabilityMode('email_players');
                                       }}
                                       className="w-full bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex items-center gap-4 hover:border-blue-300 transition-colors text-left"
                                     >
                                       <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500 shrink-0">
                                         <i className="fa-solid fa-paper-plane"></i>
                                       </div>
                                       <div>
                                         <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                                           Email Players {planTier === 'free' && <i className="fa-solid fa-lock text-amber-500 text-[10px]"></i>}
                                         </h4>
                                         <p className="text-[10px] font-medium text-zinc-500">Send an availability email directly to specific players.</p>
                                       </div>
                                     </button>
                                     
                                   </div>
                                 ) : (
                                   <div className="space-y-4">
                                     <div className="flex items-center justify-between mb-4">
                                       <button onClick={() => setAvailabilityMode('menu')} className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-2">
                                          <i className="fa-solid fa-arrow-left"></i> Back
                                       </button>
                                       <button 
                                         onClick={() => {
                                           const respondedIds = new Set(modalAvailData.filter(a => ['yes', 'no', 'maybe'].includes(a.status)).map(a => a.player_id));
                                           const eligible = clubPlayers.filter(p => {
                                             const hasSent = emailLogDetails.some(log => log.email_type === 'availability_reminder' && log.players?.id === p.id);
                                             return p.default_team_id === f.team_id && 
                                                    p.is_active !== false && 
                                                    !respondedIds.has(p.id) &&
                                                    p.email && 
                                                    p.email.trim() !== '' && 
                                                    p.unsubscribed !== true && 
                                                    !hasSent;
                                           });
                                           if (emailSelectedPlayerIds.length === eligible.length && eligible.length > 0) {
                                              setEmailSelectedPlayerIds([]);
                                           } else {
                                              setEmailSelectedPlayerIds(eligible.map(s => s.id));
                                           }
                                         }}
                                         className="text-[9px] font-black uppercase text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-md"
                                       >
                                          Select All
                                       </button>
                                     </div>
                                     
                                                                          <textarea 
                                       placeholder="Add a custom note (e.g. We need to know by Thursday)..."
                                       className="w-full text-xs p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1A1A1A] text-zinc-900 dark:text-white mb-3 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 shadow-sm focus:border-blue-500 transition-colors"
                                       rows={2}
                                       value={availabilityEmailNote}
                                       onChange={(e) => setAvailabilityEmailNote(e.target.value)}
                                     />

                                     <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
                                       {['yes', 'maybe', 'no_reply', 'no'].map((section) => {
                                         const sectionPlayers = clubPlayers.filter(p => {
                                           const avail = modalAvailData.find(a => a.player_id === p.id);
                                           const status = avail ? avail.status : 'no_reply';
                                           return (p.default_team_id === f.team_id && p.is_active !== false || avail !== undefined) && status === section;
                                         });

                                         if (sectionPlayers.length === 0) return null;

                                         const config = {
                                           yes: { label: "Available", color: "text-emerald-500", icon: "fa-circle-check" },
                                           maybe: { label: "Maybe", color: "text-amber-500", icon: "fa-circle-question" },
                                           no_reply: { label: "Pending", color: "text-zinc-400 dark:text-zinc-500", icon: "fa-circle" },
                                           no: { label: "Unavailable", color: "text-red-500", icon: "fa-circle-xmark" }
                                         }[section as 'yes' | 'maybe' | 'no_reply' | 'no'];

                                         const isSecExpanded = expandedEmailSections[section];
                                         const toggleSec = () => setExpandedEmailSections(prev => ({...prev, [section]: !prev[section]}));

                                         return (
                                           <div key={section} className="mb-2">
                                             <button onClick={toggleSec} className="w-full flex items-center justify-between py-2 text-left group">
                                               <h3 className={`text-[10px] font-black uppercase tracking-widest ${config.color} flex items-center gap-2`}>
                                                 <i className={`fa-solid ${config.icon}`}></i> {config.label} ({sectionPlayers.length})
                                               </h3>
                                               <i className={`fa-solid fa-chevron-${isSecExpanded ? 'up' : 'down'} text-[10px] text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors`}></i>
                                             </button>
                                             
                                             {isSecExpanded && (
                                               <div className="flex flex-wrap gap-2 pt-2 pb-1 animate-in fade-in">
                                                 {sectionPlayers.map(p => {
                                                   const avail = modalAvailData.find(a => a.player_id === p.id);
                                                    const isSelected = emailSelectedPlayerIds.includes(p.id);
                                                    const hasEmail = !!p.email;
                                                    const hasResponded = avail && ['yes', 'no', 'maybe'].includes(avail.status);
                                                    const hasSent = emailLogDetails.some(log => log.email_type === 'availability_reminder' && log.players?.id === p.id);
                                                    const isLocked = hasSent || hasResponded;
                                                    const isDisabled = !hasEmail || p.unsubscribed === true || isLocked;
                                                    
                                                    return (
                                                      <button 
                                                        key={p.id}
                                                        disabled={isDisabled}
                                                        onClick={() => {
                                                          if (!isDisabled) {
                                                             setEmailSelectedPlayerIds(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]);
                                                          }
                                                        }}
                                                        className={`relative flex flex-col p-3 rounded-xl border transition-all text-left min-w-[140px] flex-1 sm:flex-none ${
                                                          isSelected ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-400 dark:border-emerald-500/50 shadow-sm' : 
                                                          isDisabled ? 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 opacity-60' : 
                                                          'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-700'
                                                        }`}
                                                      >
                                                        <div className="flex justify-between items-start mb-2 gap-4 w-full">
                                                          <span className={`text-[11px] font-black uppercase tracking-widest ${isDisabled ? 'text-zinc-400 dark:text-zinc-600' : 'text-zinc-800 dark:text-zinc-200'}`}>
                                                            {p.nickname || `${p.first_name} ${p.last_name?.charAt(0) || ''}.`}
                                                          </span>
                                                          {isSelected ? (
                                                            <div className="w-5 h-5 rounded bg-emerald-500 text-white flex items-center justify-center shadow-sm shrink-0">
                                                              <i className="fa-solid fa-check text-[10px]"></i>
                                                            </div>
                                                          ) : isDisabled ? null : (
                                                            <div className="text-zinc-300 dark:text-zinc-700 text-xs font-black">+</div>
                                                          )}
                                                        </div>
                                                        
                                                        <div className="text-[8px] font-bold tracking-widest uppercase flex items-center gap-1 mt-auto">
                                                          {!hasEmail ? (
                                                            <span className="text-red-500"><i className="fa-solid fa-envelope-circle-xmark mr-1"></i> No Email</span>
                                                          ) : p.unsubscribed ? (
                                                            <span className="text-amber-500"><i className="fa-solid fa-ban mr-1"></i> Unsubscribed</span>
                                                          ) : isLocked ? (
                                                            <span className="text-zinc-400 dark:text-zinc-500"><i className={`fa-solid ${hasResponded ? 'fa-reply' : 'fa-paper-plane'} mr-1`}></i> {hasResponded ? 'Responded' : 'Sent'}</span>
                                                          ) : (
                                                            <span className="text-emerald-500"><i className="fa-regular fa-envelope mr-1"></i> Ready to Send</span>
                                                          )}
                                                        </div>
                                                      </button>
                                                    );
                                                 })}
                                               </div>
                                             )}
                                           </div>
                                         );
                                       })}
                                     </div>
                                     
                                     <button 
                                       onClick={() => {
                                         if (planTier === 'free') {
                                           window.dispatchEvent(new CustomEvent('navigate-setup', { detail: 'billing' }));
                                           return;
                                         }
                                         handleConfirmSendReminders(f);
                                       }}
                                       disabled={isSendingReminders || (planTier !== 'free' && emailSelectedPlayerIds.length === 0)}
                                       className={`w-full py-4 mt-4 flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:active:scale-100 ${planTier === 'free' ? 'bg-amber-400 hover:bg-amber-300 text-amber-900 shadow-amber-500/20' : 'text-white bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'}`}
                                     >
                                       {isSendingReminders ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className={`fa-solid ${planTier === 'free' ? 'fa-lock' : 'fa-paper-plane'}`}></i>}
                                       {planTier === 'free' ? 'Upgrade to Email' : `Send to ${emailSelectedPlayerIds.length} Player${emailSelectedPlayerIds.length !== 1 ? 's' : ''}`}
                                     </button>
                                   </div>
                                 )}
                               </div>
                             )}

                             {/* --- SQUAD TAB --- */}
                             {activeTab === 'squad' && (
                               <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                  {squadMode === 'squad' ? (
                                    <>
                                     {canManageTeam(f.team_id) && (
                                        <div className="mb-6">
                                          <input 
                                            type="text" 
                                            placeholder="Search or add a player..." 
                                            value={playerSearch || ""} 
                                            onChange={(e) => setPlayerSearch(e.target.value)} 
                                            className="w-full bg-zinc-50 dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors mb-4 shadow-sm" 
                                          />

                                          <div className="space-y-3">
                                            {playerSearch.trim().length > 0 && !clubPlayers.some(p => `${p.first_name} ${p.last_name}`.toLowerCase() === playerSearch.trim().toLowerCase()) && (
                                              <button 
                                                onClick={() => createAndAddPlayer(playerSearch, f.id)}
                                                disabled={isSaving}
                                                className="w-full flex justify-between items-center bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors text-left group disabled:opacity-50"
                                              >
                                                <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                                                  + Add "{playerSearch}"
                                                </span>
                                                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/70 bg-emerald-200 dark:bg-emerald-900 px-2 py-1 rounded-md">New Casual</span>
                                              </button>
                                            )}

                                            {['yes', 'maybe', 'no_reply', 'no'].map((section) => {
                                              const sectionPlayers = clubPlayers.filter(p => {
                                                const avail = modalAvailData.find(a => a.player_id === p.id);
                                                const status = avail ? avail.status : 'no_reply';
                                                const isRelevant = (p.default_team_id === f.team_id && p.is_active !== false) || squadPlayerIds.includes(p.id) || avail !== undefined;
                                                const matchesSearch = playerSearch ? `${p.first_name} ${p.last_name} ${p.nickname || ''}`.toLowerCase().includes(playerSearch.toLowerCase()) : true;

                                                return playerSearch ? (status === section && matchesSearch) : (status === section && isRelevant);
                                              });

                                              if (sectionPlayers.length === 0) return null;

                                              const config = {
                                                yes: { label: "Available", color: "text-emerald-500", icon: "fa-circle-check" },
                                                maybe: { label: "Maybe", color: "text-amber-500", icon: "fa-circle-question" },
                                                no_reply: { label: "Pending", color: "text-zinc-400 dark:text-zinc-500", icon: "fa-circle" },
                                                no: { label: "Unavailable", color: "text-red-500", icon: "fa-circle-xmark" }
                                              }[section as 'yes' | 'maybe' | 'no_reply' | 'no'];

                                              const isSecExpanded = expandedPoolSections[section] || playerSearch.trim().length > 0;
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
                                                      {sectionPlayers.map(p => {
                                                        const isSelected = squadPlayerIds.includes(p.id);
                                                        return (
                                                          <button 
                                                            key={p.id} 
                                                            onClick={() => toggleSquadPlayer(p.id)} 
                                                            disabled={isSaving} 
                                                            className={`px-4 py-3 rounded-xl font-black text-[11px] uppercase transition-all flex items-center gap-2 ${isSelected ? 'text-white bg-emerald-600 dark:bg-emerald-500 scale-[1.02] shadow-[0_0_15px_rgba(16,185,129,0.3)] border-transparent' : 'bg-zinc-50 dark:bg-[#1A1A1A] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-400 dark:hover:border-zinc-600'} disabled:opacity-50`}
                                                          >
                                                            {formatName(p)}
                                                            {isSelected ? <i className="fa-solid fa-check text-[10px]"></i> : <i className="fa-solid fa-plus text-[10px] opacity-50"></i>}
                                                          </button>
                                                        );
                                                      })}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                          
                                          <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                            <button onClick={() => saveSquad(f.id)} disabled={isSaving} className="w-full py-3 rounded-xl text-xs font-black uppercase text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-md">
                                              {isSaving ? 'Saving...' : 'Lock In Match Lineup'}
                                            </button>
                                          </div>
                                        </div>
                                     )}

                                     {/* DETAILED SQUAD LIST WITH FINANCIALS */}
                                     {f.lists.squadIds.length > 0 ? (
                                       <div className="space-y-3 mt-6 pt-6 border-t-2 border-dashed border-zinc-200 dark:border-zinc-800">
                                         <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3 border-b border-zinc-100 dark:border-zinc-800 pb-1 flex justify-between">
                                           <span>Confirmed Lineup</span>
                                           <span>{f.lists.squadIds.length} Players</span>
                                         </h4>
                                         {f.lists.squadIds.map((pid: string) => {
                                           const pStats = playerStats[pid];
                                           if (!pStats) return null;
                                           
                                           const isFinanceOpen = activeFinancePlayerId === `${f.id}-${pid}`;
                                           
                                           return (
                                             <div key={pid} className="bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 flex flex-col transition-all">
                                                <div className="flex justify-between items-center">
                                                  <div>
                                                    <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                                      {pStats.name}
                                                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${pStats.is_member ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                                        {pStats.is_member ? 'Member' : 'Casual'}
                                                      </span>
                                                    </div>
                                                    <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mt-1">
                                                      {pStats.gamesPlayed} Matches
                                                    </div>
                                                  </div>
                                                  
                                                  <div className="flex items-center gap-3">
                                                    {pStats.balance > 0 ? (
                                                      <span className="text-[11px] font-black text-red-500">-${pStats.balance.toFixed(0)}</span>
                                                    ) : pStats.balance < 0 ? (
                                                      <span className="text-[10px] font-black text-emerald-500">+${Math.abs(pStats.balance).toFixed(0)}</span>
                                                    ) : (
                                                      <span className="text-[9px] font-black text-zinc-400">Settled</span>
                                                    )}
                                                    
                                                    {canManageTeam(f.team_id) && (
                                                      <button 
                                                        onClick={() => {
                                                          if (isFinanceOpen) setActiveFinancePlayerId(null);
                                                          else { setActiveFinancePlayerId(`${f.id}-${pid}`); setManualType('payment'); setManualAmount(""); setManualNote(""); }
                                                        }}
                                                        className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 flex items-center justify-center transition-colors"
                                                      >
                                                        <i className={`fa-solid ${isFinanceOpen ? 'fa-times' : 'fa-dollar-sign'} text-[10px]`}></i>
                                                      </button>
                                                    )}
                                                    </div>
                                                  </div>
                                                
                                                {/* Quick Finance Adjust Panel */}
                                                {isFinanceOpen && (
                                                  <form onSubmit={(e) => handleManualSave(e, pid, f.id)} className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 animate-in fade-in slide-in-from-top-2">
                                                    <div className="flex gap-2 mb-2">
                                                      <button type="button" onClick={() => setManualType('payment')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg ${manualType === 'payment' ? 'bg-emerald-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>Pay (+)</button>
                                                      <button type="button" onClick={() => setManualType('fee')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg ${manualType === 'fee' ? 'bg-red-500 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>Charge (-)</button>
                                                    </div>
                                                    <div className="flex gap-2">
                                                      <input type="number" placeholder="$" value={manualAmount} onChange={e => setManualAmount(Number(e.target.value))} required className="w-20 bg-white dark:bg-[#111] border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-2 text-xs font-bold text-center outline-none focus:border-emerald-500" />
                                                      <input type="text" placeholder="Note (Cash, Card, Match Fee)" value={manualNote} onChange={e => setManualNote(e.target.value)} className="flex-1 bg-white dark:bg-[#111] border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500" />
                                                    </div>
                                                    <button type="submit" disabled={isSaving} className="w-full mt-2 py-2 bg-zinc-800 text-white dark:bg-zinc-200 dark:text-black rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm hover:scale-[1.01] transition-transform">
                                                      {isSaving ? 'Saving...' : 'Confirm'}
                                                    </button>
                                                  </form>
                                                )}
                                             </div>
                                           );
                                         })}

                                         {canManageTeam(f.team_id) && (
                                           <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-3">
                                             <button 
                                               onClick={async () => {
                                                 setIsStatsLoading(true);
                                                 const logs = await fetchEmailLogs(f.id);
                                                 const isSuperAdmin = profile?.role === 'super_admin';
                                                 const eligible = f.lists.squadIds.filter((pid: string) => {
                                                   const p = clubPlayers.find(cp => cp.id === pid);
                                                   if (!p) return false;
                                                   const hasSent = logs.some(log => log.email_type === 'squad_notification' && (log as any).players?.id === p.id);
                                                   return p.email && p.email.trim() !== '' && p.unsubscribed !== true && (!hasSent || isSuperAdmin);
                                                 });
                                                 
                                                 setSquadEmailSelectedPlayerIds(eligible);
                                                 setSquadMode('email_players');
                                               }}
                                               className="w-full bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex items-center gap-4 hover:border-blue-300 transition-colors text-left shadow-sm"
                                             >
                                               <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500 shrink-0">
                                                 <i className="fa-solid fa-paper-plane"></i>
                                               </div>
                                               <div>
                                                 <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                                                   Email Team Members {planTier === 'free' && <i className="fa-solid fa-lock text-amber-500 text-[10px]"></i>}
                                                 </h4>
                                                                                                  <p className="text-[10px] font-medium text-zinc-500">Send selection & pre-pay links.</p>
                                               </div>
                                             </button>
                                             
                                             <button 
                                               onClick={() => {
                                                 setActiveGraphicFixtureId(f.id);
                                               }}
                                               className="w-full bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex items-center gap-4 hover:border-emerald-300 transition-colors text-left shadow-sm"
                                             >
                                               <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500 shrink-0">
                                                 <i className="fa-solid fa-share-nodes"></i>
                                               </div>
                                               <div>
                                                 <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                                                   Generate a Team List {planTier === 'free' && <i className="fa-solid fa-lock text-amber-500 text-[10px]"></i>}
                                                 </h4>
                                                 <p className="text-[10px] font-medium text-zinc-500">Create a social media share graphic.</p>
                                               </div>
                                             </button>
                                           </div>
                                         )}
                                       </div>
                                     ) : (
                                       <div className="text-center text-zinc-500 text-[10px] font-black uppercase tracking-widest py-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl mt-6">No Lineup Selected Yet</div>
                                     )}
                                    </>
                                  ) : (
                                    <div className="space-y-4">
                                      <div className="flex items-center justify-between mb-4">
                                        <button onClick={() => setSquadMode('squad')} className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-2">
                                          <i className="fa-solid fa-arrow-left"></i> Back
                                        </button>
                                        <button 
                                          onClick={() => {
                                            const isSuperAdmin = profile?.role === 'super_admin';
                                            const eligible = f.lists.squadIds.filter((pid: string) => {
                                              const p = clubPlayers.find(cp => cp.id === pid);
                                              if (!p) return false;
                                              const hasSent = emailLogDetails.some(log => log.email_type === 'squad_notification' && log.players?.id === p.id);
                                              return p.email && p.email.trim() !== '' && p.unsubscribed !== true && (!hasSent || isSuperAdmin);
                                            });
                                            if (squadEmailSelectedPlayerIds.length === eligible.length && eligible.length > 0) {
                                               setSquadEmailSelectedPlayerIds([]);
                                            } else {
                                               setSquadEmailSelectedPlayerIds(eligible);
                                            }
                                          }}
                                          className="text-[9px] font-black uppercase text-emerald-600 hover:text-emerald-700 dark:text-emerald-500 dark:hover:text-emerald-400 px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-md"
                                        >
                                           Select All
                                        </button>
                                      </div>
                                      <textarea 
                                        placeholder="Add a custom note (e.g. We prefer cash but you can pay via card)..."
                                        className="w-full text-xs p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1A1A1A] text-zinc-900 dark:text-white mb-3 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 shadow-sm focus:border-blue-500 transition-colors"
                                        rows={2}
                                        value={squadEmailNote}
                                        onChange={(e) => setSquadEmailNote(e.target.value)}
                                      />
                                      <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar space-y-3 mb-4">
                                        {['yes', 'maybe', 'no_reply', 'no'].map((section) => {
                                          const sectionPlayers = f.lists.squadIds.filter((pid: string) => {
                                            const avail = modalAvailData.find(a => a.player_id === pid);
                                            const status = avail ? avail.status : 'no_reply';
                                            return status === section;
                                          }).map((pid: string) => clubPlayers.find(cp => cp.id === pid)).filter(Boolean);

                                          if (sectionPlayers.length === 0) return null;

                                          const config = {
                                            yes: { label: "Available", color: "text-emerald-500", icon: "fa-circle-check" },
                                            maybe: { label: "Maybe", color: "text-amber-500", icon: "fa-circle-question" },
                                            no_reply: { label: "Pending", color: "text-zinc-400 dark:text-zinc-500", icon: "fa-circle" },
                                            no: { label: "Unavailable", color: "text-red-500", icon: "fa-circle-xmark" }
                                          }[section as 'yes' | 'maybe' | 'no_reply' | 'no'];

                                          const isSecExpanded = expandedEmailSections[section];
                                          const toggleSec = () => setExpandedEmailSections(prev => ({...prev, [section]: !prev[section]}));

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
                                                  {sectionPlayers.map((p: any) => {
                                                      const hasEmail = !!p.email;
                                                      const isSelected = squadEmailSelectedPlayerIds.includes(p.id);
                                                      const hasSent = emailLogDetails.some(log => log.email_type === 'squad_notification' && log.players?.id === p.id);
                                                      const isSuperAdmin = profile?.role === 'super_admin';
                                                      const isLocked = hasSent;
                                                      const isDisabled = !hasEmail || p.unsubscribed === true || isLocked;
                                                      
                                                      return (
                                                        <button 
                                                          key={p.id} 
                                                          onClick={() => {
                                                            if (isDisabled) return;
                                                            if (isSelected) {
                                                              setSquadEmailSelectedPlayerIds(prev => prev.filter(id => id !== p.id));
                                                            } else {
                                                              setSquadEmailSelectedPlayerIds(prev => [...prev, p.id]);
                                                            }
                                                          }}
                                                          disabled={isDisabled}
                                                          className={`relative flex flex-col p-3 rounded-xl border transition-all text-left min-w-[140px] flex-1 sm:flex-none ${
                                                            isSelected ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-400 dark:border-emerald-500/50 shadow-sm' : 
                                                            isDisabled ? 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 opacity-60' : 
                                                            'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-700'
                                                          }`}
                                                        >
                                                          <div className="flex justify-between items-start mb-2 gap-4 w-full">
                                                            <span className={`text-[11px] font-black uppercase tracking-widest ${isDisabled ? 'text-zinc-400 dark:text-zinc-600' : 'text-zinc-800 dark:text-zinc-200'}`}>
                                                              {p.nickname || `${p.first_name} ${p.last_name?.charAt(0) || ''}.`}
                                                            </span>
                                                            {isSelected ? (
                                                              <div className="w-5 h-5 rounded bg-emerald-500 text-white flex items-center justify-center shadow-sm shrink-0">
                                                                <i className="fa-solid fa-check text-[10px]"></i>
                                                              </div>
                                                            ) : isDisabled ? null : (
                                                              <div className="text-zinc-300 dark:text-zinc-700 text-xs font-black">+</div>
                                                            )}
                                                          </div>
                                                          
                                                          <div className="text-[8px] font-bold tracking-widest uppercase flex items-center gap-1 mt-auto">
                                                            {!hasEmail ? (
                                                              <span className="text-red-500"><i className="fa-solid fa-envelope-circle-xmark mr-1"></i> No Email</span>
                                                            ) : p.unsubscribed ? (
                                                              <span className="text-amber-500"><i className="fa-solid fa-ban mr-1"></i> Unsub</span>
                                                            ) : isLocked ? (
                                                              <span className="text-zinc-400 dark:text-zinc-500"><i className="fa-solid fa-paper-plane mr-1"></i> Sent</span>
                                                            ) : hasSent ? (
                                                              <span className="text-emerald-500"><i className="fa-solid fa-paper-plane mr-1"></i> Sent (Resend)</span>
                                                            ) : (
                                                              <span className="text-emerald-500"><i className="fa-regular fa-envelope mr-1"></i> Ready to Send</span>
                                                            )}
                                                          </div>
                                                        </button>
                                                      )
                                                  })}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <button 
                                        onClick={() => {
                                          if (planTier === 'free') {
                                            window.dispatchEvent(new CustomEvent('navigate-setup', { detail: 'billing' }));
                                            return;
                                          }
                                          handleSendSquadEmail(f.id);
                                        }}
                                        disabled={isSendingSquadEmail || (planTier !== 'free' && squadEmailSelectedPlayerIds.length === 0)}
                                        className={`w-full py-4 mt-4 flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:active:scale-100 ${planTier === 'free' ? 'bg-amber-400 hover:bg-amber-300 text-amber-900 shadow-amber-500/20' : 'text-white bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'}`}
                                      >
                                        {isSendingSquadEmail ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className={`fa-solid ${planTier === 'free' ? 'fa-lock' : 'fa-paper-plane'}`}></i>}
                                        {planTier === 'free' ? 'Upgrade to Email' : `Send to ${squadEmailSelectedPlayerIds.length} Player${squadEmailSelectedPlayerIds.length !== 1 ? 's' : ''}`}
                                      </button>
                                    </div>
                                  )}
                               </div>
                             )}

                           </div>
                        )}
                       </div>
                       )}
                    </React.Fragment>
                 );
              })}
              
              {fixtureAvail.length > visibleFixtureCount && (
                <button 
                  onClick={() => setVisibleFixtureCount(prev => prev + 5)}
                  className="w-full py-4 mt-2 rounded-2xl bg-zinc-50 dark:bg-[#1A1A1A] hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-zinc-500 dark:text-zinc-400 font-black uppercase tracking-widest text-[10px] transition-colors shadow-sm"
                >
                  <i className="fa-solid fa-chevron-down mr-2"></i> Show More Fixtures
                </button>
              )}
             </>
          )}
       </div>

       {/* Team List Graphic Modal */}
       <TeamListGraphicBuilder 
         isOpen={activeGraphicFixtureId !== null}
         onClose={() => setActiveGraphicFixtureId(null)}
         fixture={fixtureAvail.find(f => f.id === activeGraphicFixtureId)}
         clubPlayers={clubPlayers}
         team={teams.find(t => t.id === selectedTeamId)}
         clubId={activeClubId}
         planTier={planTier}
       />
     </div>
   );
}
