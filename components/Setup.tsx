"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { useActiveClub } from "@/contexts/ClubContext";

interface SetupProps {
  activeTab: 'config' | 'access' | 'teams' | 'players' | 'fixtures';
}

export default function Setup({ activeTab }: SetupProps) {
  const [clubRecord, setClubRecord] = useState<any>(null);
  const [clubUsers, setClubUsers] = useState<any[]>([]); 
  const [teams, setTeams] = useState<any[]>([]);
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [allClubs, setAllClubs] = useState<any[]>([]); 
  const [isLoading, setIsLoading] = useState(true);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<'club_admin' | 'team_admin'>('club_admin');
  const [inviteTeamId, setInviteTeamId] = useState("");
  
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editRoleAssigned, setEditRoleAssigned] = useState<'club_admin' | 'team_admin'>('club_admin');
  const [editRoleTeamId, setEditRoleTeamId] = useState<string>("");

  const [clubName, setClubName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [seasonName, setSeasonName] = useState("");
  const [seasonStart, setSeasonStart] = useState("");
  const [seasonEnd, setSeasonEnd] = useState("");
  
  const [defaultMemberFee, setDefaultMemberFee] = useState<number | "">(10);
  const [defaultCasualFee, setDefaultCasualFee] = useState<number | "">(25);
  const [defaultUmpireFee, setDefaultUmpireFee] = useState<number | "">(70);
  
  const [expenseLabel, setExpenseLabel] = useState("Umpire Fee");
  const [themeColor, setThemeColor] = useState("#10b981");
  const [themeFont, setThemeFont] = useState("Inter");
  
  const [squareAccessToken, setSquareAccessToken] = useState("");
  const [squareLocationId, setSquareLocationId] = useState("");
  const [isSquareEnabled, setIsSquareEnabled] = useState(false);

  // CLUB LEVEL MANUAL PAYMENT STATE
  const [payIdType, setPayIdType] = useState<'mobile' | 'email' | 'bank_account'>('mobile');
  const [payIdValue, setPayIdValue] = useState("");

  const [fixtureTeamId, setFixtureTeamId] = useState("");
  const [opponent, setOpponent] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [fixtureTime, setFixtureTime] = useState(""); 
  const [fixtureLocation, setFixtureLocation] = useState(""); 
  const [fixtureNotes, setFixtureNotes] = useState(""); 
  
  const [umpireFee, setUmpireFee] = useState<number | "">(70);
  
  const [editingFixtureId, setEditingFixtureId] = useState<string | null>(null);

  const [playerTeamId, setPlayerTeamId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [playerNickname, setPlayerNickname] = useState(""); 
  const [playerMobile, setPlayerMobile] = useState(""); 
  const [playerEmail, setPlayerEmail] = useState("");
  const [isMember, setIsMember] = useState(true);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const [parsedPlayers, setParsedPlayers] = useState<any[]>([]);

  const [teamName, setTeamName] = useState("");
  
  const [memberFee, setMemberFee] = useState<number | "">(10);
  const [casualFee, setCasualFee] = useState<number | "">(25);
  
  const [teamSeasonStart, setTeamSeasonStart] = useState("");
  const [teamSeasonEnd, setTeamSeasonEnd] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#10b981");
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);

  const [isSquadModalOpen, setIsSquadModalOpen] = useState(false);
  const [activeSquadFixture, setActiveSquadFixture] = useState<any>(null);
  const [squadPlayerIds, setSquadPlayerIds] = useState<string[]>([]);
  
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [activeRosterTeam, setActiveRosterTeam] = useState<any>(null);
  const [rosterPlayerIds, setRosterPlayerIds] = useState<string[]>([]);

  const [playerSearch, setPlayerSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const { profile, loading: profileLoading } = useProfile();
  const { activeClubId, setActiveClubId } = useActiveClub();
  const [clubId, setClubId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'teams') {
      resetTeamForm();
    } else if (activeTab === 'players') {
      resetPlayerForm();
      setIsBulkMode(false);
    } else if (activeTab === 'fixtures') {
      resetFixtureForm();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!profile) return;
    if (profile.role === 'super_admin') {
      supabase.from('clubs').select('id, name').order('name').then(({ data }) => {
        if (data) {
          setAllClubs(data);
          if (!activeClubId && data.length > 0) {
            setActiveClubId(data[0].id);
            setClubId(data[0].id);
          } else if (activeClubId) {
            setClubId(activeClubId);
          }
        }
      });
    } else if (profile.club_id) {
      setClubId(profile.club_id);
    }
  }, [profile, activeClubId, setActiveClubId]);

  async function loadClubData() {
    setIsLoading(true);
    if (!clubId || clubId === 'new') return;

    const { data: clubData } = await supabase.from("clubs").select("*").eq("id", clubId).single();
    if (clubData) {
      setClubRecord(clubData);
      setClubName(clubData.name || "");
      setLogoUrl(clubData.logo_url || "");
      setSeasonName(clubData.season_name || "");
      setSeasonStart(clubData.season_start || "");
      setSeasonEnd(clubData.season_end || "");
      setDefaultMemberFee(clubData.default_member_fee !== undefined ? clubData.default_member_fee : 10);
      setDefaultCasualFee(clubData.default_casual_fee !== undefined ? clubData.default_casual_fee : 25);
      setExpenseLabel(clubData.expense_label || "Umpire Fee");
      setDefaultUmpireFee(clubData.default_umpire_fee !== undefined ? clubData.default_umpire_fee : 70);
      setThemeColor(clubData.theme_color || "#10b981");
      setThemeFont(clubData.theme_font || "Inter");
      setSquareAccessToken(clubData.square_access_token || "");
      setSquareLocationId(clubData.square_location_id || "");
      setIsSquareEnabled(clubData.is_square_enabled || false);
      setPayIdType(clubData.pay_id_type || 'mobile');
      setPayIdValue(clubData.pay_id_value || "");
    }

    const { data: usersData } = await supabase.from("user_roles").select("*, teams(name)").eq("club_id", clubId);
    if (usersData) setClubUsers(usersData);

    const { data: teamData } = await supabase.from("teams").select("*").eq("club_id", clubId).order("name");
    if (teamData) setTeams(teamData);

    const { data: fixData } = await supabase.from("fixtures").select("*, teams(name)").in("team_id", teamData?.map(t => t.id) || []).order("match_date", { ascending: true });
    if (fixData) setFixtures(fixData);

    const { data: playerData } = await supabase.from("players").select("*").eq("club_id", clubId).order("first_name", { ascending: true });
    if (playerData) setPlayers(playerData);

    setIsLoading(false);
  }

  useEffect(() => { 
    if (clubId && clubId !== 'new') {
      loadClubData(); 
    } else if (clubId === 'new') {
      setIsLoading(false);
      setClubName(""); setLogoUrl(""); setSeasonName(""); setSeasonStart(""); setSeasonEnd("");
      setTeams([]); setPlayers([]); setFixtures([]); setClubUsers([]);
    }
  }, [clubId]);

  const cropAndCompressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const size = Math.min(img.width, img.height);
          canvas.width = 300; canvas.height = 300;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject("Canvas error");
          const startX = (img.width - size) / 2; const startY = (img.height - size) / 2;
          ctx.drawImage(img, startX, startY, size, size, 0, 0, 300, 300);
          canvas.toBlob((blob) => {
            if (!blob) return reject("Blob error");
            resolve(new File([blob], "logo.webp", { type: "image/webp" }));
          }, "image/webp", 0.8);
        };
        img.onerror = () => reject("Image format invalid");
      };
      reader.onerror = () => reject("File read error");
    });
  };

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !clubId || clubId === 'new') {
      return showToast("Please save the organization name first to generate an ID.", "error");
    }
    
    if (file.size > 10 * 1024 * 1024) return showToast("File too large. Maximum size is 10MB.", "error");
    setIsUploadingLogo(true); showToast("Processing & Compressing Image...");
    try {
      const processedFile = await cropAndCompressImage(file);
      const fileName = `${clubId}-${Math.random()}.webp`;
      const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, processedFile);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
      setLogoUrl(data.publicUrl);
      showToast("Logo Uploaded! Hit Save Below.");
    } catch (err: any) { showToast(err.message || "Upload failed", "error"); } 
    finally { setIsUploadingLogo(false); }
  }

  async function saveConfig() {
    setIsSaving(true);
    const generatedSlug = clubName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const payload = { 
      name: clubName, 
      logo_url: logoUrl, 
      season_name: seasonName, 
      season_start: seasonStart || null, 
      season_end: seasonEnd || null, 
      default_member_fee: defaultMemberFee === "" ? 0 : defaultMemberFee, 
      default_casual_fee: defaultCasualFee === "" ? 0 : defaultCasualFee, 
      expense_label: expenseLabel, 
      default_umpire_fee: defaultUmpireFee === "" ? 0 : defaultUmpireFee,
      theme_color: themeColor, 
      theme_font: themeFont,
      square_access_token: squareAccessToken,
      square_location_id: squareLocationId,
      is_square_enabled: isSquareEnabled,
      pay_id_type: payIdValue ? payIdType : null,
      pay_id_value: payIdValue || null
    };
    
    if (clubId && clubId !== 'new') {
      const { error } = await supabase.from("clubs").update(payload).eq("id", clubId);
      if (error) showToast(error.message, "error"); 
      else window.location.reload();
    } else {
      const { data: newClub, error } = await supabase.from("clubs").insert([{ ...payload, slug: generatedSlug }]).select().single();
      if (error) { 
        showToast(error.message, "error"); 
      } else if (newClub) {
        await supabase.from("user_roles").insert({
          user_id: profile.id,
          email: profile.email,
          role: 'club_admin',
          club_id: newClub.id
        });
        window.location.reload(); 
      }
    }
    setIsSaving(false);
  }

  async function handleInviteUser() {
    if (!inviteEmail) return showToast("Please enter an email address", "error");
    if (inviteRole === 'team_admin' && !inviteTeamId) return showToast("Please select a team for the captain", "error");
    setIsSaving(true); showToast("Sending invite...");
    try {
      const response = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, club_id: clubId, team_id: inviteRole === 'team_admin' ? inviteTeamId : null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to invite user');
      showToast(`Invite sent to ${inviteEmail}!`);
      setInviteEmail(""); setInviteTeamId(""); loadClubData(); 
    } catch (err: any) { showToast(err.message, "error"); } 
    finally { setIsSaving(false); }
  }

  async function saveRoleUpdate(roleId: string) {
    setIsSaving(true);
    const payload = {
      role: editRoleAssigned,
      team_id: editRoleAssigned === 'team_admin' ? editRoleTeamId : null
    };
    
    const { error } = await supabase.from('user_roles').update(payload).eq('id', roleId);
    
    setIsSaving(false);
    if (error) {
      showToast(error.message, "error");
    } else {
      showToast("Role updated successfully!");
      setEditingRoleId(null);
      loadClubData();
    }
  }

  async function handleRemoveRole(roleId: string) {
    if (!window.confirm("Are you sure you want to revoke this access rule?")) return;
    const { error } = await supabase.from("user_roles").delete().eq('id', roleId);
    if (error) showToast(error.message, "error");
    else { showToast("Access revoked."); loadClubData(); }
  }

  async function togglePaymentPermission(roleId: string, currentStatus: boolean) {
    setClubUsers(prev => prev.map(user => user.id === roleId ? { ...user, can_take_payments: !currentStatus } : user));
    const { error } = await supabase.from("user_roles").update({ can_take_payments: !currentStatus }).eq('id', roleId);
    if (error) {
      setClubUsers(prev => prev.map(user => user.id === roleId ? { ...user, can_take_payments: currentStatus } : user));
      showToast(error.message, "error");
    } else { showToast(!currentStatus ? "Payment permission granted." : "Payment permission revoked."); }
  }

  function resetTeamForm() { 
    setTeamName(""); 
    setEditingTeamId(null); 
    setMemberFee(defaultMemberFee || 10); 
    setCasualFee(defaultCasualFee || 25); 
    setPrimaryColor(themeColor); 
    setTeamSeasonStart(seasonStart); 
    setTeamSeasonEnd(seasonEnd); 
  }

  function startEditingTeam(t: any) { 
    setTeamName(t.name); 
    setMemberFee(t.member_fee !== undefined ? t.member_fee : 10); 
    setCasualFee(t.casual_fee !== undefined ? t.casual_fee : 25); 
    setPrimaryColor(t.primary_color || "#10b981"); 
    setTeamSeasonStart(t.season_start || ""); 
    setTeamSeasonEnd(t.season_end || ""); 
    setEditingTeamId(t.id); 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  }
  
  async function saveTeam() {
    if (!teamName) return showToast("Team name is required.", "error");
    const payload = { 
      name: teamName, 
      member_fee: memberFee === "" ? 0 : memberFee, 
      casual_fee: casualFee === "" ? 0 : casualFee, 
      primary_color: primaryColor, 
      club_id: clubId, 
      season_start: teamSeasonStart || null, 
      season_end: teamSeasonEnd || null
    };
    let error;
    if (editingTeamId) { const res = await supabase.from("teams").update(payload).eq("id", editingTeamId); error = res.error; } 
    else { const res = await supabase.from("teams").insert([payload]); error = res.error; }
    if (error) showToast(error.message, "error"); else { showToast("Team saved successfully!"); resetTeamForm(); loadClubData(); }
  }

  function resetFixtureForm() { 
    setFixtureTeamId(""); 
    setOpponent(""); 
    setMatchDate(""); 
    setFixtureTime(""); 
    setFixtureLocation(""); 
    setFixtureNotes(""); 
    setUmpireFee(defaultUmpireFee || 0); 
    setEditingFixtureId(null); 
  }
  
  function startEditingFixture(f: any) { 
    setFixtureTeamId(f.team_id); 
    setOpponent(f.opponent); 
    setMatchDate(f.match_date); 
    setFixtureTime(f.start_time || ""); 
    setFixtureLocation(f.location || ""); 
    setFixtureNotes(f.notes || ""); 
    setUmpireFee(f.umpire_fee !== undefined ? f.umpire_fee : defaultUmpireFee); 
    setEditingFixtureId(f.id); 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  }
  
  async function saveFixture() {
    if (!opponent || !matchDate || !fixtureTeamId) return showToast("Please fill all match fields.", "error");
    
    const payload = { 
      team_id: fixtureTeamId, 
      opponent, 
      match_date: matchDate, 
      start_time: fixtureTime, 
      location: fixtureLocation, 
      notes: fixtureNotes, 
      umpire_fee: umpireFee === "" ? 0 : umpireFee 
    };

    let error;
    if (editingFixtureId) { const res = await supabase.from("fixtures").update(payload).eq("id", editingFixtureId); error = res.error; } 
    else { const res = await supabase.from("fixtures").insert([payload]); error = res.error; }
    if (error) showToast(error.message, "error"); else { showToast("Fixture saved!"); resetFixtureForm(); loadClubData(); }
  }

  function resetPlayerForm() { setPlayerTeamId(""); setFirstName(""); setLastName(""); setPlayerNickname(""); setPlayerMobile(""); setPlayerEmail(""); setIsMember(true); setEditingPlayerId(null); }
  
  function startEditingPlayer(p: any) { setPlayerTeamId(p.default_team_id || ""); setFirstName(p.first_name); setLastName(p.last_name); setPlayerNickname(p.nickname || ""); setPlayerMobile(p.mobile_number || ""); setPlayerEmail(p.email || ""); setIsMember(p.is_member); setEditingPlayerId(p.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  
  async function savePlayer() {
    if (!firstName || !lastName) return showToast("Please enter player name.", "error");
    
    const cleanEmail = playerEmail ? playerEmail.toLowerCase().trim() : null;
    
    const payload = { 
      first_name: firstName, 
      last_name: lastName, 
      nickname: playerNickname || null,
      mobile_number: playerMobile || null,
      email: cleanEmail,
      is_member: isMember, 
      default_team_id: playerTeamId || null, 
      club_id: clubId 
    };
    
    let error;
    if (editingPlayerId) { const res = await supabase.from("players").update(payload).eq("id", editingPlayerId); error = res.error; } 
    else { const res = await supabase.from("players").insert([payload]); error = res.error; }
    if (error) showToast(error.message, "error"); else { showToast("Player saved!"); resetPlayerForm(); loadClubData(); }
  }

  function parseBulkData() {
    const rows = bulkInput.trim().split('\n');
    const parsed = rows.map(row => { const cols = row.split(/\t|,/).map(c => c.trim()); return { first_name: cols[0] || "", last_name: cols[1] || "", is_member: cols[2] ? !cols[2].toLowerCase().includes('casual') : true }; }).filter(p => p.first_name);
    setParsedPlayers(parsed);
  }
  async function saveBulkPlayers() {
    if (parsedPlayers.length === 0) return showToast("No players parsed.", "error");
    setIsSaving(true);
    const payload = parsedPlayers.map(p => ({ ...p, default_team_id: playerTeamId || null, club_id: clubId }));
    const { error } = await supabase.from("players").insert(payload);
    setIsSaving(false);
    if (error) showToast(error.message, "error"); else { showToast(`Imported ${parsedPlayers.length} players!`); setBulkInput(""); setParsedPlayers([]); setIsBulkMode(false); loadClubData(); }
  }

  async function openRosterModal(team: any) { setActiveRosterTeam(team); setPlayerSearch(""); setRosterPlayerIds(players.filter(p => p.default_team_id === team.id).map(p => p.id)); setIsRosterModalOpen(true); }
  function toggleRosterPlayer(playerId: string) { setRosterPlayerIds(prev => prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]); }
  async function saveTeamRoster() {
    setIsSaving(true);
    const currentIds = players.filter(p => p.default_team_id === activeRosterTeam.id).map(p => p.id);
    const removedIds = currentIds.filter(id => !rosterPlayerIds.includes(id));
    const addedIds = rosterPlayerIds.filter(id => !currentIds.includes(id));
    if (removedIds.length > 0) await supabase.from("players").update({ default_team_id: null }).in("id", removedIds);
    if (addedIds.length > 0) await supabase.from("players").update({ default_team_id: activeRosterTeam.id }).in("id", addedIds);
    await loadClubData(); setIsSaving(false); setIsRosterModalOpen(false); showToast(`${activeRosterTeam.name} Roster Updated!`);
  }
  
  async function openSquadModal(fixture: any) { setActiveSquadFixture(fixture); setPlayerSearch(""); const { data } = await supabase.from("match_squads").select("player_id").eq("fixture_id", fixture.id); setSquadPlayerIds(data ? data.map(row => row.player_id) : []); setIsSquadModalOpen(true); }
  function toggleSquadPlayer(playerId: string) { setSquadPlayerIds(prev => prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]); }
  async function saveSquad() { 
    setIsSaving(true); await supabase.from("match_squads").delete().eq("fixture_id", activeSquadFixture.id); 
    if (squadPlayerIds.length > 0) { const inserts = squadPlayerIds.map(playerId => ({ fixture_id: activeSquadFixture.id, player_id: playerId })); const { error } = await supabase.from("match_squads").insert(inserts); if (error) showToast(error.message, "error"); else showToast("Squad updated for match!"); } 
    setIsSaving(false); setIsSquadModalOpen(false); 
  }
  
  async function deleteItem(table: string, id: string) { if (!window.confirm("Are you sure?")) return; await supabase.from(table).delete().eq("id", id); showToast("Item deleted."); loadClubData(); }

  if (profileLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Loading Profile...</p>
      </div>
    );
  }

  // The Onboarding Interceptor (Updated for Light Mode)
  if (!clubId && profile?.role !== 'super_admin') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 animate-in zoom-in-95 fade-in duration-500">
        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mb-6">
          <i className="fa-solid fa-hand-wave text-2xl"></i>
        </div>
        <h1 className="text-2xl font-black italic uppercase tracking-tighter text-zinc-900 dark:text-white mb-2">Welcome!</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm text-center mb-8 max-w-xs">
          It looks like you don't belong to an organization yet. What would you like to do?
        </p>
        
        <div className="w-full max-w-sm space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
            <h3 className="text-zinc-900 dark:text-white font-black uppercase tracking-widest text-xs mb-1"><i className="fa-solid fa-plus text-emerald-500 mr-2"></i> Register New Organization</h3>
            <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-4 leading-relaxed">Create a brand new workspace for your club or team.</p>
            
            <div className="space-y-3">
              <input 
                type="text" 
                placeholder="e.g. Ferny Districts CC" 
                value={clubName} 
                onChange={(e) => setClubName(e.target.value)} 
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" 
              />
              <button 
                onClick={saveConfig} 
                disabled={isSaving || !clubName} 
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl uppercase tracking-widest text-xs active:scale-95 transition-all shadow-sm disabled:opacity-50"
              >
                {isSaving ? "Creating..." : "Create Organization"}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm text-center">
            <h3 className="text-zinc-900 dark:text-white font-black uppercase tracking-widest text-xs mb-1">Looking for your team?</h3>
            <p className="text-zinc-500 text-xs mb-0">Ask your Club Admin to send an invite to <strong className="text-zinc-800 dark:text-zinc-300">{profile?.email}</strong></p>
          </div>
        </div>
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

      {/* GOD MODE CLUB PICKER */}
      {profile?.role === 'super_admin' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm mb-6 flex items-center gap-4 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
            <i className="fa-solid fa-crown"></i>
          </div>
          <div className="flex-1">
            <label className="text-[9px] text-zinc-500 font-black uppercase tracking-widest block mb-1">God Mode: Active Organization</label>
            <select 
              value={clubId || ''} 
              onChange={(e) => {
                setActiveClubId(e.target.value || null);
                setClubId(e.target.value || null);
              }} 
              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-white outline-none font-bold transition-colors"
            >
              {allClubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="new">+ Create New Organization...</option>
            </select>
          </div>
        </div>
      )}

      {/* --- CONFIG TAB --- */}
      {activeTab === 'config' && (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm relative transition-colors">
            <h2 className="text-[11px] font-black uppercase italic text-emerald-600 dark:text-emerald-500 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">Branding</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Club Organization Name</label>
                <input type="text" value={clubName} onChange={(e) => setClubName(e.target.value)} placeholder="e.g. Ferny Districts CC" className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
              </div>
              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Club Logo (Auto-Squares to 300px)</label>
                <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 p-3 rounded-xl transition-colors">
                  {logoUrl ? <img src={logoUrl} alt="Logo" className="w-12 h-12 rounded-lg object-cover bg-white" /> : <div className="w-12 h-12 rounded-lg bg-zinc-200 dark:bg-zinc-900 flex items-center justify-center border border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500"><i className="fa-solid fa-image"></i></div>}
                  <div className="flex-1">
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" id="logo-upload" disabled={isUploadingLogo || !clubId || clubId === 'new'} />
                    <label htmlFor="logo-upload" className={`text-xs font-bold px-4 py-2 rounded-lg transition-colors inline-block ${isUploadingLogo || !clubId || clubId === 'new' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed' : 'bg-zinc-800 dark:bg-zinc-700 text-white hover:bg-zinc-700 dark:hover:bg-zinc-600 cursor-pointer shadow-sm'}`}>
                      {(!clubId || clubId === 'new') ? "Save club name first to upload logo" : (isUploadingLogo ? "Compressing..." : "Upload New Image")}
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm relative transition-colors">
            <h2 className="text-[11px] font-black uppercase italic text-emerald-600 dark:text-emerald-500 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">Season & Global Rules</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Season Name</label>
                <input type="text" placeholder="e.g. Winter 2026" value={seasonName} onChange={(e) => setSeasonName(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Global Start Date</label>
                  <input type="date" value={seasonStart} onChange={(e) => setSeasonStart(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-white outline-none color-scheme-light dark:color-scheme-dark transition-colors" />
                </div>
                <div className="flex-1">
                  <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Global End Date</label>
                  <input type="date" value={seasonEnd} onChange={(e) => setSeasonEnd(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-white outline-none color-scheme-light dark:color-scheme-dark transition-colors" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <div className="flex-[2]">
                  <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Global Expense Label</label>
                  <input type="text" placeholder="e.g. Umpire Fee, Court Hire" value={expenseLabel} onChange={(e) => setExpenseLabel(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                </div>
                <div className="flex-1">
                  <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Default Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                    <input 
                      type="number" 
                      placeholder="70" 
                      value={defaultUmpireFee} 
                      onChange={(e) => setDefaultUmpireFee(e.target.value === '' ? '' : Number(e.target.value))} 
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl pl-7 pr-3 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" 
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Default Member Fee ($)</label>
                  <input 
                    type="number" 
                    value={defaultMemberFee} 
                    onChange={(e) => setDefaultMemberFee(e.target.value === '' ? '' : Number(e.target.value))} 
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" 
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Default Casual Fee ($)</label>
                  <input 
                    type="number" 
                    value={defaultCasualFee} 
                    onChange={(e) => setDefaultCasualFee(e.target.value === '' ? '' : Number(e.target.value))} 
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" 
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm relative transition-colors">
            <h2 className="text-[11px] font-black uppercase italic text-emerald-600 dark:text-emerald-500 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">Payment Integration (Square)</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800 p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 transition-colors">
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-300 uppercase">Enable Square</span>
                <button onClick={() => setIsSquareEnabled(!isSquareEnabled)} className={`text-xs font-black uppercase px-3 py-1.5 rounded-lg transition-colors shadow-sm ${isSquareEnabled ? 'bg-emerald-600 text-white' : 'bg-zinc-300 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-300'}`}>{isSquareEnabled ? 'Active' : 'Disabled'}</button>
              </div>
              {isSquareEnabled && (
                <>
                  <div>
                    <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Square Access Token</label>
                    <input type="password" placeholder="EAAA..." value={squareAccessToken} onChange={(e) => setSquareAccessToken(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                  </div>
                  <div>
                    <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Square Location ID</label>
                    <input type="text" placeholder="L..." value={squareLocationId} onChange={(e) => setSquareLocationId(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* MANUAL PAYMENT DETAILS (ORG LEVEL) */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm relative transition-colors">
            <h2 className="text-[11px] font-black uppercase italic text-emerald-600 dark:text-emerald-500 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">Manual Payment Fallback (Club Level)</h2>
            <div className="space-y-4">
              <div className="flex gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors">
                <div className="w-1/3">
                  <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Transfer Type</label>
                  <select 
                    value={payIdType} 
                    onChange={(e) => setPayIdType(e.target.value as any)} 
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="mobile">PayID (Mobile)</option>
                    <option value="email">PayID (Email)</option>
                    <option value="bank_account">Bank Account</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Payment Details</label>
                  <input 
                    type="text" 
                    value={payIdValue} 
                    onChange={(e) => setPayIdValue(e.target.value)} 
                    placeholder={payIdType === 'mobile' ? 'e.g. 0400 000 000' : payIdType === 'email' ? 'e.g. admin@club.com' : 'e.g. BSB: 123-456 ACC: 12345678'}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" 
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm relative transition-colors">
            <h2 className="text-[11px] font-black uppercase italic text-emerald-600 dark:text-emerald-500 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">App Appearance</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Primary Theme Color</label>
                <div className="flex gap-3">
                  <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="w-14 h-12 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-1 py-1 cursor-pointer shrink-0 transition-colors" />
                  <input type="text" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none font-mono transition-colors" />
                </div>
              </div>
              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Typography (Google Font)</label>
                <select value={themeFont} onChange={(e) => setThemeFont(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none font-bold transition-colors">
                  <option value="Inter">Inter (Modern Default)</option>
                  <option value="Roboto">Roboto (Clean)</option>
                  <option value="Poppins">Poppins (Geometric)</option>
                  <option value="Montserrat">Montserrat (Bold)</option>
                </select>
              </div>
            </div>
          </div>

          <button onClick={saveConfig} disabled={isSaving || !clubName} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-sm active:scale-95 transition-all shadow-md disabled:opacity-50">
            {isSaving ? "Saving Configuration..." : (clubId && clubId !== 'new' ? "Save Club Settings" : "Create New Organization")}
          </button>
        </div>
      )}

      {(!clubId || clubId === 'new') && activeTab !== 'config' && (
        <div className="p-10 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl mt-6 shadow-sm transition-colors">
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Please save your organization configuration first.</p>
        </div>
      )}

      {/* --- ACCESS TAB --- */}
      {clubId && clubId !== 'new' && activeTab === 'access' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm relative transition-colors">
            <h2 className="text-[11px] font-black uppercase italic text-emerald-600 dark:text-emerald-500 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">Invite User / Grant Access</h2>
            <div className="space-y-4">
              <input 
                type="email" 
                placeholder="User's Email Address" 
                value={inviteEmail} 
                onChange={(e) => setInviteEmail(e.target.value)} 
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" 
              />
              
              <div className="flex bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl p-1 transition-colors">
                <button 
                  onClick={() => setInviteRole('club_admin')} 
                  className={`flex-1 py-3 text-[10px] font-black uppercase rounded-lg transition-all ${inviteRole === 'club_admin' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                >
                  Club Admin
                </button>
                <button 
                  onClick={() => setInviteRole('team_admin')} 
                  className={`flex-1 py-3 text-[10px] font-black uppercase rounded-lg transition-all ${inviteRole === 'team_admin' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                >
                  Team Captain
                </button>
              </div>

              {inviteRole === 'team_admin' && (
                <select 
                  value={inviteTeamId} 
                  onChange={(e) => setInviteTeamId(e.target.value)} 
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 animate-in slide-in-from-top-2 transition-colors"
                >
                  <option value="">-- Select Team to Manage --</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}

              <button 
                onClick={handleInviteUser} 
                disabled={isSaving || !inviteEmail}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs active:scale-95 transition-all disabled:opacity-50 shadow-md"
              >
                {isSaving ? "Processing..." : "Grant Access"}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-1">Permissions Ledger</h3>
            {clubUsers.length === 0 ? (
              <div className="text-center py-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors">
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">No assigned roles found.</p>
              </div>
            ) : (
              clubUsers.map(user => (
                <div key={user.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex flex-col gap-3 group shadow-sm transition-colors">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold text-zinc-900 dark:text-white text-sm">{user.email}</div>
                      <div className={`text-[9px] font-black uppercase tracking-widest mt-1 ${user.role === 'club_admin' ? 'text-blue-500 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-500'}`}>
                        {user.role === 'club_admin' ? 'Club Admin' : 'Team Captain'}
                        {user.role === 'team_admin' && user.teams?.name && ` • ${user.teams.name}`}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => {
                        setEditingRoleId(user.id);
                        setEditRoleAssigned(user.role);
                        setEditRoleTeamId(user.team_id || "");
                      }} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center">
                        <i className="fa-solid fa-pen text-xs"></i>
                      </button>
                      <button onClick={() => handleRemoveRole(user.id)} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-red-500 transition-colors flex items-center justify-center">
                        <i className="fa-solid fa-trash text-xs"></i>
                      </button>
                    </div>
                  </div>

                  {editingRoleId === user.id && (
                    <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 transition-colors">
                      <div className="flex gap-2">
                        <select 
                          value={editRoleAssigned} 
                          onChange={(e) => setEditRoleAssigned(e.target.value as any)} 
                          className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
                        >
                          <option value="club_admin">Club Admin</option>
                          <option value="team_admin">Team Captain</option>
                        </select>
                        
                        {editRoleAssigned === 'team_admin' && (
                          <select 
                            value={editRoleTeamId} 
                            onChange={(e) => setEditRoleTeamId(e.target.value)} 
                            className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
                          >
                            <option value="">-- Select Team --</option>
                            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <button onClick={() => setEditingRoleId(null)} className="flex-1 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-400 rounded-xl text-xs font-black uppercase transition-colors">Cancel</button>
                        <button onClick={() => saveRoleUpdate(user.id)} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase transition-colors">Save</button>
                      </div>
                    </div>
                  )}

                  {user.role !== 'club_admin' && editingRoleId !== user.id && (
                    <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-3 mt-1 transition-colors">
                      <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 uppercase">Square Payments</span>
                      <button onClick={() => togglePaymentPermission(user.id, user.can_take_payments)} className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg transition-colors shadow-sm ${user.can_take_payments ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-500'}`}>
                        {user.can_take_payments ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* --- TEAMS TAB (CLEANED UP) --- */}
      {clubId && clubId !== 'new' && activeTab === 'teams' && (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm relative transition-colors">
            {editingTeamId && <button onClick={resetTeamForm} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><i className="fa-solid fa-xmark"></i></button>}
            <h2 className="text-[11px] font-black uppercase italic text-emerald-600 dark:text-emerald-500 mb-4">{editingTeamId ? 'Edit Team' : 'Add New Team'}</h2>
            <div className="flex gap-3 mb-3">
              <input type="text" placeholder="Team Name" value={teamName} onChange={(e) => setTeamName(e.target.value)} className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-12 h-[46px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-1 py-1 cursor-pointer shrink-0 transition-colors" />
            </div>
            <div className="flex gap-3 mb-3">
              <div className="flex-1">
                <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Member Fee ($)</label>
                <input 
                  type="number" 
                  value={memberFee} 
                  onChange={(e) => setMemberFee(e.target.value === '' ? '' : Number(e.target.value))} 
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-white outline-none transition-colors" 
                />
              </div>
              <div className="flex-1">
                <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Casual Fee ($)</label>
                <input 
                  type="number" 
                  value={casualFee} 
                  onChange={(e) => setCasualFee(e.target.value === '' ? '' : Number(e.target.value))} 
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-white outline-none transition-colors" 
                />
              </div>
            </div>

            <div className="flex gap-3 mb-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors">
              <div className="flex-1">
                <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Override Start Date</label>
                <input type="date" value={teamSeasonStart} onChange={(e) => setTeamSeasonStart(e.target.value)} className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none color-scheme-light dark:color-scheme-dark transition-colors" />
              </div>
              <div className="flex-1">
                <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Override End Date</label>
                <input type="date" value={teamSeasonEnd} onChange={(e) => setTeamSeasonEnd(e.target.value)} className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none color-scheme-light dark:color-scheme-dark transition-colors" />
              </div>
            </div>
            <button onClick={saveTeam} className={`w-full font-black py-3 rounded-xl uppercase tracking-widest text-xs active:scale-95 transition-all text-white shadow-md ${editingTeamId ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
              {editingTeamId ? 'Update Team' : 'Create Team'}
            </button>
          </div>
          <div className="space-y-3">
            {teams.map(t => {
              const assignedCaptain = clubUsers.find(u => u.team_id === t.id && u.role === 'team_admin');
              return (
                <div key={t.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex flex-col gap-3 group shadow-sm transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: t.primary_color || '#10b981' }}></div>
                      <div>
                        <div className="font-black text-zinc-900 dark:text-white text-sm uppercase tracking-wide">{t.name}</div>
                        <div className="text-[10px] text-zinc-500 font-bold mt-0.5">
                          CAPTAIN: {assignedCaptain ? assignedCaptain.email : 'Unassigned'} • M: ${t.member_fee} • C: ${t.casual_fee}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => startEditingTeam(t)} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center"><i className="fa-solid fa-pen text-xs"></i></button>
                      <button onClick={() => deleteItem('teams', t.id)} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-red-500 transition-colors flex items-center justify-center"><i className="fa-solid fa-trash text-xs"></i></button>
                    </div>
                  </div>
                  <button onClick={() => openRosterModal(t)} className="w-full py-2.5 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 flex items-center justify-center gap-2 transition-colors">
                    <i className="fa-solid fa-clipboard-user"></i> Bulk Assign Roster
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- PLAYERS TAB --- */}
      {clubId && clubId !== 'new' && activeTab === 'players' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm relative transition-colors">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[11px] font-black uppercase italic text-emerald-600 dark:text-emerald-500">{editingPlayerId ? 'Edit Player' : (isBulkMode ? 'Bulk Import' : 'Add Player')}</h2>
              {!editingPlayerId && <button onClick={() => {setIsBulkMode(!isBulkMode); setParsedPlayers([]);}} className="text-[10px] font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white uppercase tracking-widest underline decoration-zinc-300 dark:decoration-zinc-700 transition-colors">{isBulkMode ? 'Single Add' : 'Bulk Paste'}</button>}
            </div>
            
            <select value={playerTeamId} onChange={(e) => setPlayerTeamId(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 mb-3 transition-colors">
              <option value="">-- No Default Team (Casual) --</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            
            {!isBulkMode ? (
              <>
                <div className="flex gap-2 mb-3">
                  <input type="text" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                  <input type="text" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                </div>
                
                <div className="flex gap-2 mb-3">
                  <input type="text" placeholder="Nickname (e.g. Aitcho)" value={playerNickname} onChange={(e) => setPlayerNickname(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                  <input type="tel" placeholder="Mobile Number" value={playerMobile} onChange={(e) => setPlayerMobile(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                </div>
                
                <div className="mb-3">
                  <input type="email" placeholder="Email Address (Optional - For App Link)" value={playerEmail} onChange={(e) => setPlayerEmail(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 transition-colors" />
                </div>

                <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800 p-3 rounded-xl mb-4 border border-zinc-300 dark:border-zinc-700 transition-colors">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-300 uppercase">Status</span>
                  <button onClick={() => setIsMember(!isMember)} className={`text-xs font-black uppercase px-3 py-1.5 rounded-lg transition-colors shadow-sm ${isMember ? 'bg-emerald-600 text-white' : 'bg-zinc-300 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-300'}`}>{isMember ? 'Member' : 'Casual'}</button>
                </div>
                <button onClick={savePlayer} className={`w-full font-black py-3 rounded-xl uppercase tracking-widest text-xs active:scale-95 transition-all text-white shadow-md ${editingPlayerId ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>{editingPlayerId ? 'Update Player' : 'Save Player'}</button>
              </>
            ) : (
              <div className="space-y-3">
                <textarea value={bulkInput} onChange={(e) => setBulkInput(e.target.value)} placeholder="Tony \t C \t Member" className="w-full h-32 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 font-mono text-xs whitespace-pre transition-colors" />
                {parsedPlayers.length === 0 ? <button onClick={parseBulkData} className="w-full bg-zinc-700 hover:bg-zinc-600 text-white font-black py-3 rounded-xl uppercase tracking-widest text-xs transition-colors shadow-sm">Parse Data</button> : 
                  <button onClick={saveBulkPlayers} disabled={isSaving} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl uppercase tracking-widest text-xs disabled:opacity-50 transition-colors shadow-md">{isSaving ? 'Importing...' : `Import ${parsedPlayers.length}`}</button>}
              </div>
            )}
          </div>
          <div className="space-y-2">
            {players.map(p => (
              <div key={p.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex flex-col gap-2 group shadow-sm transition-colors">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold text-zinc-900 dark:text-white">
                      {p.first_name} {p.last_name} {p.nickname && <span className="text-zinc-500 font-normal italic">"{p.nickname}"</span>}
                    </div>
                    <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mt-1">
                      {teams.find(t => t.id === p.default_team_id)?.name || "Casual"} 
                      {p.email && ` • ${p.email}`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEditingPlayer(p)} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center"><i className="fa-solid fa-pen text-xs"></i></button>
                    <button onClick={() => deleteItem('players', p.id)} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-red-500 transition-colors flex items-center justify-center"><i className="fa-solid fa-trash text-xs"></i></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- FIXTURES TAB --- */}
      {clubId && clubId !== 'new' && activeTab === 'fixtures' && (
        <div className="space-y-6 animate-in slide-in-from-left-4 fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm relative transition-colors">
            {editingFixtureId && <button onClick={resetFixtureForm} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"><i className="fa-solid fa-xmark"></i></button>}
            <h2 className="text-[11px] font-black uppercase italic text-emerald-600 dark:text-emerald-500 mb-4">{editingFixtureId ? 'Edit Match' : 'Add Match'}</h2>
            <select value={fixtureTeamId} onChange={(e) => setFixtureTeamId(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 mb-3 transition-colors">
              <option value="">-- Assign to Team --</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div className="space-y-3 mb-4">
              <input type="text" placeholder="Opponent" value={opponent} onChange={(e) => setOpponent(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
              <input type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 color-scheme-light dark:color-scheme-dark transition-colors" />
              
              <div className="flex gap-2">
                <input type="text" placeholder="Start Time (e.g. 1:00 PM)" value={fixtureTime} onChange={(e) => setFixtureTime(e.target.value)} className="w-1/3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                <div className="flex-1 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">$</span>
                  <input 
                    type="number" 
                    placeholder={expenseLabel || "Umpire Fee"} 
                    value={umpireFee} 
                    onChange={(e) => setUmpireFee(e.target.value === '' ? '' : Number(e.target.value))} 
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl pl-8 pr-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" 
                  />
                </div>
              </div>
              <input type="text" placeholder="Location" value={fixtureLocation} onChange={(e) => setFixtureLocation(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
              <input type="text" placeholder="Match Notes" value={fixtureNotes} onChange={(e) => setFixtureNotes(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
            </div>
            <button onClick={saveFixture} className={`w-full font-black py-3 rounded-xl uppercase tracking-widest text-xs active:scale-95 transition-all text-white shadow-md ${editingFixtureId ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>{editingFixtureId ? 'Update Fixture' : 'Save Fixture'}</button>
          </div>
          <div className="space-y-2">
            {fixtures.map(f => (
              <div key={f.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex flex-col gap-3 group shadow-sm transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mb-1">{new Date(f.match_date).toLocaleDateString()} {f.start_time && `• ${f.start_time}`}</div>
                    <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">{f.teams?.name} vs {f.opponent}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEditingFixture(f)} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center"><i className="fa-solid fa-pen text-xs"></i></button>
                    <button onClick={() => deleteItem('fixtures', f.id)} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-red-500 transition-colors flex items-center justify-center"><i className="fa-solid fa-trash text-xs"></i></button>
                  </div>
                </div>
                <button onClick={() => openSquadModal(f)} className="w-full py-2 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 flex items-center justify-center gap-2 transition-colors">
                  <i className="fa-solid fa-users"></i> Pre-Game Squad
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- MODALS --- */}
      {isSquadModalOpen && activeSquadFixture && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 transition-colors">
          <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 w-full max-w-[440px] rounded-3xl overflow-hidden flex flex-col max-h-[85vh] shadow-2xl animate-in slide-in-from-bottom-8 transition-colors">
            <div className="p-5 flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 transition-colors">
              <h2 className="text-lg font-black italic text-emerald-600 dark:text-emerald-500 uppercase tracking-tighter">SQUAD: {activeSquadFixture.opponent}</h2>
              <button onClick={() => setIsSquadModalOpen(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-6">
              <input type="text" placeholder="Search player..." value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)} className="w-full bg-zinc-50 dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-600 mb-3">Core Team</h3>
                <div className="space-y-2">
                  {players.filter(p => p.default_team_id === activeSquadFixture.team_id).filter(p => `${p.first_name} ${p.last_name} ${p.nickname}`.toLowerCase().includes(playerSearch.toLowerCase())).map(p => {
                    const isSelected = squadPlayerIds.includes(p.id);
                    return (
                      <div key={p.id} onClick={() => toggleSquadPlayer(p.id)} className="flex justify-between items-center bg-zinc-50 dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800/50 p-4 rounded-xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                        <span className="font-bold text-zinc-900 dark:text-white text-sm">{p.first_name} {p.last_name} {p.nickname && <span className="text-zinc-500 font-normal italic ml-1">"{p.nickname}"</span>}</span>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] transition-colors ${isSelected ? 'bg-emerald-500 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>{isSelected ? <i className="fa-solid fa-check"></i> : <i className="fa-solid fa-plus"></i>}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-600 mb-3">Other Members</h3>
                <div className="space-y-2">
                  {players.filter(p => p.default_team_id !== activeSquadFixture.team_id).filter(p => `${p.first_name} ${p.last_name} ${p.nickname}`.toLowerCase().includes(playerSearch.toLowerCase())).map(p => {
                    const isSelected = squadPlayerIds.includes(p.id);
                    return (
                      <div key={p.id} onClick={() => toggleSquadPlayer(p.id)} className="flex justify-between items-center bg-zinc-50 dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800/50 p-4 rounded-xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                        <span className="font-bold text-zinc-900 dark:text-white text-sm">{p.first_name} {p.last_name} {p.nickname && <span className="text-zinc-500 font-normal italic ml-1">"{p.nickname}"</span>}</span>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] transition-colors ${isSelected ? 'bg-emerald-500 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>{isSelected ? <i className="fa-solid fa-check"></i> : <i className="fa-solid fa-plus"></i>}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-zinc-100 dark:border-zinc-800 flex gap-3 bg-zinc-50 dark:bg-[#111] transition-colors">
              <button onClick={() => setIsSquadModalOpen(false)} className="flex-1 py-4 rounded-xl text-xs font-black uppercase text-zinc-600 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-900 hover:bg-zinc-300 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
              <button onClick={saveSquad} disabled={isSaving} className="flex-1 py-4 rounded-xl text-xs font-black uppercase text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-md">{isSaving ? 'Saving...' : 'Update Squad'}</button>
            </div>
          </div>
        </div>
      )}

      {isRosterModalOpen && activeRosterTeam && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 transition-colors">
          <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 w-full max-w-[440px] rounded-3xl overflow-hidden flex flex-col max-h-[85vh] shadow-2xl animate-in slide-in-from-bottom-8 transition-colors">
            <div className="p-5 flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 transition-colors">
              <h2 className="text-lg font-black italic text-emerald-600 dark:text-emerald-500 uppercase tracking-tighter">{activeRosterTeam.name} Roster</h2>
              <button onClick={() => setIsRosterModalOpen(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-6">
              <input type="text" placeholder="Search..." value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)} className="w-full bg-zinc-50 dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
              <div className="space-y-2">
                {players.filter(p => `${p.first_name} ${p.last_name} ${p.nickname}`.toLowerCase().includes(playerSearch.toLowerCase())).map(p => {
                  const isSelected = rosterPlayerIds.includes(p.id);
                  return (
                    <div key={p.id} onClick={() => toggleRosterPlayer(p.id)} className="flex justify-between items-center bg-zinc-50 dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800/50 p-4 rounded-xl cursor-pointer transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <span className="font-bold text-zinc-900 dark:text-white text-sm">{p.first_name} {p.last_name}</span>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] transition-colors ${isSelected ? 'bg-emerald-500 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>{isSelected ? <i className="fa-solid fa-check"></i> : <i className="fa-solid fa-plus"></i>}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-5 border-t border-zinc-100 dark:border-zinc-800 flex gap-3 bg-zinc-50 dark:bg-[#111] transition-colors">
              <button onClick={() => setIsRosterModalOpen(false)} className="flex-1 py-4 rounded-xl text-xs font-black uppercase text-zinc-600 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-900 hover:bg-zinc-300 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
              <button onClick={saveTeamRoster} disabled={isSaving} className="flex-1 py-4 rounded-xl text-xs font-black uppercase text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-md">{isSaving ? 'Saving...' : 'Save Roster'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}