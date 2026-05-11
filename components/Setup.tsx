"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { useActiveClub } from "@/contexts/ClubContext";
import PlayersTab from "@/components/PlayersTab";
import FixturesTab from "@/components/FixturesTab"; 

interface SetupProps {
  activeTab: 'config' | 'access' | 'teams' | 'players' | 'fixtures';
}

interface UserRole {
  id: string;
  email: string;
  role: 'club_admin' | 'team_admin';
  team_id?: string;
  can_take_payments: boolean;
  teams?: { name: string };
}

export default function Setup({ activeTab }: SetupProps) {
  const [clubRecord, setClubRecord] = useState<any>(null);
  const [clubUsers, setClubUsers] = useState<UserRole[]>([]); 
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

  // CONFIG STATE
  const [clubName, setClubName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [announcement, setAnnouncement] = useState(""); 
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  
  // SPONSOR STATE
  const [sponsor1Logo, setSponsor1Logo] = useState("");
  const [sponsor1Url, setSponsor1Url] = useState("");
  const [sponsor2Logo, setSponsor2Logo] = useState("");
  const [sponsor2Url, setSponsor2Url] = useState("");
  const [sponsor3Logo, setSponsor3Logo] = useState("");
  const [sponsor3Url, setSponsor3Url] = useState("");
  const [isUploadingSponsor, setIsUploadingSponsor] = useState(false);

  const [seasonName, setSeasonName] = useState("");
  const [seasonStart, setSeasonStart] = useState("");
  const [seasonEnd, setSeasonEnd] = useState("");
  
  const [defaultMemberFee, setDefaultMemberFee] = useState<number | "">(10);
  const [defaultCasualFee, setDefaultCasualFee] = useState<number | "">(25);
  const [defaultUmpireFee, setDefaultUmpireFee] = useState<number | "">(70);
  
  const [expenseLabel, setExpenseLabel] = useState("Umpire Fee");
  
  const [squareAccessToken, setSquareAccessToken] = useState("");
  const [squareLocationId, setSquareLocationId] = useState("");
  const [isSquareEnabled, setIsSquareEnabled] = useState(false);

  // CLUB LEVEL MANUAL PAYMENT STATE
  const [payIdType, setPayIdType] = useState<'mobile' | 'email' | 'bank_account'>('mobile');
  const [payIdValue, setPayIdValue] = useState("");

  // TEAM STATE
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamSlug, setTeamSlug] = useState(""); 
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [memberFee, setMemberFee] = useState<number | "">(10);
  const [casualFee, setCasualFee] = useState<number | "">(25);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);

  const [isSquadModalOpen, setIsSquadModalOpen] = useState(false);
  const [activeSquadFixture, setActiveSquadFixture] = useState<any>(null);
  const [squadPlayerIds, setSquadPlayerIds] = useState<string[]>([]);
  const [availabilityData, setAvailabilityData] = useState<any[]>([]);
  
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
      setAnnouncement(clubData.announcement || "");
      setSeasonName(clubData.season_name || "");
      setSeasonStart(clubData.season_start || "");
      setSeasonEnd(clubData.season_end || "");
      setDefaultMemberFee(clubData.default_member_fee !== undefined ? clubData.default_member_fee : 10);
      setDefaultCasualFee(clubData.default_casual_fee !== undefined ? clubData.default_casual_fee : 25);
      setExpenseLabel(clubData.expense_label || "Umpire Fee");
      setDefaultUmpireFee(clubData.default_umpire_fee !== undefined ? clubData.default_umpire_fee : 70);
      setSquareAccessToken(clubData.square_access_token || "");
      setSquareLocationId(clubData.square_location_id || "");
      setIsSquareEnabled(clubData.is_square_enabled || false);
      setPayIdType(clubData.pay_id_type || 'mobile');
      setPayIdValue(clubData.pay_id_value || "");
    }

    const { data: usersData } = await supabase.from("user_roles").select("*, teams(name)").eq("club_id", clubId);
    if (usersData) setClubUsers(usersData as UserRole[]);

    const { data: teamData } = await supabase.from("teams").select("*").eq("club_id", clubId).order("name");
    if (teamData) {
      setTeams(teamData);
      if (teamData.length > 0) {
         const { data: sponsorData } = await supabase.from("public_team_profiles").select("*").eq("team_id", teamData[0].id).single();
         if (sponsorData) {
            setSponsor1Logo(sponsorData.sponsor_1_logo || "");
            setSponsor1Url(sponsorData.sponsor_1_url || "");
            setSponsor2Logo(sponsorData.sponsor_2_logo || "");
            setSponsor2Url(sponsorData.sponsor_2_url || "");
            setSponsor3Logo(sponsorData.sponsor_3_logo || "");
            setSponsor3Url(sponsorData.sponsor_3_url || "");
         }
      }
    }

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
      setClubName(""); setLogoUrl(""); setAnnouncement(""); setSeasonName(""); setSeasonStart(""); setSeasonEnd("");
      setTeams([]); setPlayers([]); setFixtures([]); setClubUsers([]);
    }
  }, [clubId]);

  const cropAndCompressImage = (file: File, isLogo: boolean = true): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          
          if (isLogo) {
             const size = Math.min(img.width, img.height);
             canvas.width = 300; canvas.height = 300;
             const ctx = canvas.getContext("2d");
             if (!ctx) return reject("Canvas error");
             const startX = (img.width - size) / 2; const startY = (img.height - size) / 2;
             ctx.drawImage(img, startX, startY, size, size, 0, 0, 300, 300);
          } else {
             const scale = Math.min(400 / img.width, 1);
             canvas.width = img.width * scale;
             canvas.height = img.height * scale;
             const ctx = canvas.getContext("2d");
             if (!ctx) return reject("Canvas error");
             ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          }
          
          canvas.toBlob((blob) => {
            if (!blob) return reject("Blob error");
            resolve(new File([blob], "image.webp", { type: "image/webp" }));
          }, "image/webp", 0.8);
        };
        img.onerror = () => reject("Image format invalid");
      };
      reader.onerror = () => reject("File read error");
    });
  };

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'sponsor1' | 'sponsor2' | 'sponsor3') {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return showToast("File too large. Max 10MB.", "error");
    
    if (type === 'logo') setIsUploadingLogo(true);
    else setIsUploadingSponsor(true);
    
    showToast("Processing Image...");
    try {
      const processedFile = await cropAndCompressImage(file, type === 'logo');
      const fileName = `${clubId}-${type}-${Math.random()}.webp`;
      const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, processedFile);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
      
      if (type === 'logo') setLogoUrl(data.publicUrl);
      if (type === 'sponsor1') setSponsor1Logo(data.publicUrl);
      if (type === 'sponsor2') setSponsor2Logo(data.publicUrl);
      if (type === 'sponsor3') setSponsor3Logo(data.publicUrl);
      
      showToast("Uploaded! Hit Save Configuration.");
    } catch (err: any) { showToast(err.message || "Upload failed", "error"); } 
    finally { setIsUploadingLogo(false); setIsUploadingSponsor(false); }
  }

  async function saveConfig() {
    setIsSaving(true);
    const generatedSlug = clubName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const payload = { 
      name: clubName, 
      logo_url: logoUrl,
      announcement: announcement,
      season_name: seasonName, 
      season_start: seasonStart || null, 
      season_end: seasonEnd || null, 
      default_member_fee: defaultMemberFee === "" ? 0 : defaultMemberFee, 
      default_casual_fee: defaultCasualFee === "" ? 0 : defaultCasualFee, 
      expense_label: expenseLabel, 
      default_umpire_fee: defaultUmpireFee === "" ? 0 : defaultUmpireFee,
      square_access_token: squareAccessToken,
      square_location_id: squareLocationId,
      is_square_enabled: isSquareEnabled,
      pay_id_type: payIdValue ? payIdType : null,
      pay_id_value: payIdValue || null
    };
    
    if (clubId && clubId !== 'new') {
      const { error } = await supabase.from("clubs").update(payload).eq("id", clubId);
      if (error) { showToast(error.message, "error"); return; }
      
      const { data: clubTeams } = await supabase.from('teams').select('id, name').eq('club_id', clubId);
      if (clubTeams && clubTeams.length > 0) {
        const storefrontPayload = clubTeams.map(t => ({ 
           team_id: t.id, 
           team_name: t.name, 
           club_logo_url: logoUrl,
           sponsor_1_logo: sponsor1Logo, sponsor_1_url: sponsor1Url,
           sponsor_2_logo: sponsor2Logo, sponsor_2_url: sponsor2Url,
           sponsor_3_logo: sponsor3Logo, sponsor_3_url: sponsor3Url
        }));
        const { error: storeError } = await supabase.from('public_team_profiles').upsert(storefrontPayload);
        if (storeError) console.error("Storefront Sync Error:", storeError);
      }
      
      window.location.reload();
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
    if (inviteRole === 'team_admin' && !inviteTeamId) return showToast("Please select a team for the manager", "error");
    setIsSaving(true); showToast("Sending invite...");
    try {
      const response = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, club_id: clubId, team_id: inviteRole === 'team_admin' ? inviteTeamId : null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to invite user');
      
      // OPTIMISTIC UI: Inject the user immediately so they appear before the database round-trip finishes
      const teamObj = inviteRole === 'team_admin' ? { name: teams.find(t => t.id === inviteTeamId)?.name || '' } : undefined;
      setClubUsers(prev => [...prev, {
        id: `temp-${Date.now()}`,
        email: inviteEmail,
        role: inviteRole,
        team_id: inviteRole === 'team_admin' ? inviteTeamId : undefined,
        can_take_payments: false,
        teams: teamObj
      }]);

      showToast(`Invite sent to ${inviteEmail}!`);
      setInviteEmail(""); setInviteTeamId(""); 
      loadClubData(); 
    } catch (err: any) { showToast(err.message, "error"); } 
    finally { setIsSaving(false); }
  }

  async function saveRoleUpdate(roleId: string) {
    if (editRoleAssigned === 'team_admin' && !editRoleTeamId) {
       return showToast("Please select a team.", "error");
    }

    setIsSaving(true);
    
    // EXPLICIT PAYLOAD: Ensure null team_id is pushed to Postgres if promoting to club_admin
    const payload: any = { role: editRoleAssigned };
    if (editRoleAssigned === 'club_admin') {
       payload.team_id = null;
    } else {
       payload.team_id = editRoleTeamId;
    }

    const { data, error } = await supabase.from('user_roles').update(payload).eq('id', roleId).select();
    
    setIsSaving(false);
    
    if (error) {
      showToast(error.message, "error");
    } else if (!data || data.length === 0) {
      showToast("Security Block: Permission Denied to edit roles.", "error");
    } else {
      showToast("Role updated successfully!");
      setEditingRoleId(null);
      loadClubData();
    }
  }

  async function handleRemoveRole(roleId: string) {
    if (!window.confirm("Are you sure you want to revoke this access rule?")) return;
    
    // Optimistic UI Removal
    setClubUsers(prev => prev.filter(user => user.id !== roleId));

    const { data, error } = await supabase.from("user_roles").delete().eq('id', roleId).select();
    if (error) {
       showToast(error.message, "error");
       loadClubData(); // Revert on error
    } else if (!data || data.length === 0) {
       showToast("Security Block: Permission Denied to delete roles.", "error");
       loadClubData(); // Revert on error
    } else { 
       showToast("Access revoked."); 
    }
  }

  async function togglePaymentPermission(roleId: string, currentStatus: boolean) {
    // Optimistic UI Update
    setClubUsers(prev => prev.map(user => user.id === roleId ? { ...user, can_take_payments: !currentStatus } : user));
    
    const { data, error } = await supabase.from("user_roles").update({ can_take_payments: !currentStatus }).eq('id', roleId).select();
    
    if (error || !data || data.length === 0) {
      // Revert UI if it failed or got blocked by RLS
      setClubUsers(prev => prev.map(user => user.id === roleId ? { ...user, can_take_payments: currentStatus } : user));
      showToast(error ? error.message : "Security Block: Permission Denied.", "error");
    } else { 
      showToast(!currentStatus ? "Payment permission granted." : "Payment permission revoked."); 
    }
  }

  function resetTeamForm() { 
    setTeamName(""); 
    setTeamSlug("");
    setIsSlugManuallyEdited(false);
    setEditingTeamId(null); 
    setMemberFee(defaultMemberFee || 10); 
    setCasualFee(defaultCasualFee || 25); 
    setIsTeamModalOpen(false);
  }

  function startEditingTeam(t: any) { 
    setTeamName(t.name); 
    setTeamSlug(t.slug || "");
    setIsSlugManuallyEdited(!!t.slug);
    setMemberFee(t.member_fee !== undefined ? t.member_fee : 10); 
    setCasualFee(t.casual_fee !== undefined ? t.casual_fee : 25); 
    setEditingTeamId(t.id); 
    setIsTeamModalOpen(true);
  }

  function handleTeamNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newName = e.target.value;
    setTeamName(newName);
    
    // Auto-generate slug only if the user hasn't manually edited it
    if (!isSlugManuallyEdited) {
      setTeamSlug(newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
    }
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTeamSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
    setIsSlugManuallyEdited(true);
  }
  
  async function saveTeam() {
    if (!teamName) return showToast("Team name is required.", "error");
    
    // Fallback if slug is empty
    const finalSlug = teamSlug || teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const payload = { 
      name: teamName, 
      slug: finalSlug,
      member_fee: memberFee === "" ? 0 : memberFee, 
      casual_fee: casualFee === "" ? 0 : casualFee, 
      club_id: clubId
    };
    
    setIsSaving(true);
    let result;
    let savedTeamId = editingTeamId;

    if (editingTeamId) { 
      result = await supabase.from("teams").update(payload).eq("id", editingTeamId).select().single(); 
    } else { 
      result = await supabase.from("teams").insert([payload]).select().single(); 
    }
    
    setIsSaving(false);

    if (result.error) {
      if (result.error.code === '23505') { // Postgres Unique Constraint Violation
        showToast("That Custom Link is already taken. Please try a different one.", "error");
      } else {
        showToast(result.error.message, "error"); 
      }
    } else { 
      if (result.data) {
        savedTeamId = result.data.id;
        await supabase.from("public_team_profiles").upsert({
          team_id: savedTeamId,
          team_name: teamName,
          club_logo_url: logoUrl || clubRecord?.logo_url,
          sponsor_1_logo: sponsor1Logo, sponsor_1_url: sponsor1Url,
          sponsor_2_logo: sponsor2Logo, sponsor_2_url: sponsor2Url,
          sponsor_3_logo: sponsor3Logo, sponsor_3_url: sponsor3Url
        });
      }
      showToast("Team saved successfully!"); 
      resetTeamForm(); 
      loadClubData(); 
    }
  }

  async function openRosterModal(team: any) { 
    setActiveRosterTeam(team); 
    setPlayerSearch(""); 
    setRosterPlayerIds(players.filter(p => p.default_team_id === team.id).map(p => p.id)); 
    setIsRosterModalOpen(true); 
  }
  
  function toggleRosterPlayer(playerId: string) { 
    setRosterPlayerIds(prev => prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]); 
  }
  
  async function saveTeamRoster() {
    setIsSaving(true);
    const currentIds = players.filter(p => p.default_team_id === activeRosterTeam.id).map(p => p.id);
    const removedIds = currentIds.filter(id => !rosterPlayerIds.includes(id));
    const addedIds = rosterPlayerIds.filter(id => !currentIds.includes(id));
    
    if (removedIds.length > 0) await supabase.from("players").update({ default_team_id: null }).in("id", removedIds);
    if (addedIds.length > 0) await supabase.from("players").update({ default_team_id: activeRosterTeam.id }).in("id", addedIds);
    
    await loadClubData(); 
    setIsSaving(false); 
    setIsRosterModalOpen(false); 
    showToast(`${activeRosterTeam.name} Roster Updated!`);
  }
  
  async function openSquadModal(fixture: any) { 
    setActiveSquadFixture(fixture); 
    setPlayerSearch(""); 
    
    const { data: squadData } = await supabase.from("match_squads").select("player_id").eq("fixture_id", fixture.id); 
    setSquadPlayerIds(squadData ? squadData.map(row => row.player_id) : []); 

    const { data: availData } = await supabase.from("availability").select("player_id, status").eq("fixture_id", fixture.id);
    setAvailabilityData(availData || []);

    setIsSquadModalOpen(true); 
  }

  function toggleSquadPlayer(playerId: string) { 
    setSquadPlayerIds(prev => prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]); 
  }
  
  async function saveSquad() { 
    setIsSaving(true); 
    await supabase.from("match_squads").delete().eq("fixture_id", activeSquadFixture.id); 
    if (squadPlayerIds.length > 0) { 
      const inserts = squadPlayerIds.map(playerId => ({ fixture_id: activeSquadFixture.id, player_id: playerId })); 
      const { error } = await supabase.from("match_squads").insert(inserts); 
      if (error) showToast(error.message, "error"); 
      else showToast("Match Players updated!"); 
    } 
    setIsSaving(false); 
    setIsSquadModalOpen(false); 
  }
  
  async function deleteItem(table: string, id: string) { 
    if (!window.confirm("Are you sure?")) return; 
    await supabase.from(table).delete().eq("id", id); 
    showToast("Item deleted."); 
    loadClubData(); 
  }

  if (profileLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Loading Profile...</p>
      </div>
    );
  }

  if (!clubId && profile?.role !== 'super_admin') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 animate-in zoom-in-95 fade-in duration-500">
        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mb-6">
          <i className="fa-solid fa-hand-wave text-2xl"></i>
        </div>
        <h1 className="text-2xl font-black italic uppercase tracking-tighter text-zinc-900 dark:text-white mb-2">Welcome!</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm text-center mb-8 max-w-xs">
          It looks like you don't belong to a club yet. What would you like to do?
        </p>
        
        <div className="w-full max-w-sm space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
            <h3 className="text-zinc-900 dark:text-white font-black uppercase tracking-widest text-xs mb-1"><i className="fa-solid fa-plus text-emerald-500 mr-2"></i> Register New Club</h3>
            <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-4 leading-relaxed">Create a brand new workspace for your club or team.</p>
            
            <div className="space-y-3">
              <input 
                type="text" 
                placeholder="e.g. Ferny Districts CC" 
                value={clubName || ""} 
                onChange={(e) => setClubName(e.target.value)} 
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" 
              />
              <button 
                onClick={saveConfig} 
                disabled={isSaving || !clubName} 
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl uppercase tracking-widest text-xs active:scale-95 transition-all shadow-sm disabled:opacity-50"
              >
                {isSaving ? "Creating..." : "Create Club"}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm text-center">
            <h3 className="text-zinc-900 dark:text-white font-black uppercase tracking-widest text-xs mb-1">Looking for your team?</h3>
            <p className="text-zinc-500 text-xs mb-0">Ask your Club Manager to send an invite to <strong className="text-zinc-800 dark:text-zinc-300">{profile?.email}</strong></p>
          </div>
        </div>
      </div>
    );
  }

  const filteredRosterPlayers = players.filter(p => `${p.first_name} ${p.last_name} ${p.nickname}`.toLowerCase().includes(playerSearch.toLowerCase()));
  const currentTeamPlayers = filteredRosterPlayers.filter(p => p.default_team_id === activeRosterTeam?.id);
  const unassignedPlayers = filteredRosterPlayers.filter(p => p.default_team_id === null);
  const otherTeamPlayers = filteredRosterPlayers.filter(p => p.default_team_id !== activeRosterTeam?.id && p.default_team_id !== null);

  const uniqueEmails = Array.from(new Set(clubUsers.map(user => user.email)));

  return (
    <div className="animate-in fade-in duration-300 space-y-6 pb-20 relative">
      
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-lg z-[100] animate-in slide-in-from-bottom-5 fade-in ${toast.type === 'success' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'} font-black uppercase tracking-widest text-[10px] whitespace-nowrap flex items-center gap-2`}>
          <i className={`fa-solid ${toast.type === 'success' ? 'fa-check' : 'fa-triangle-exclamation'}`}></i> {toast.msg}
        </div>
      )}

      {profile?.role === 'super_admin' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm mb-6 flex items-center gap-4 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
            <i className="fa-solid fa-crown"></i>
          </div>
          <div className="flex-1">
            <label className="text-[9px] text-zinc-500 font-black uppercase tracking-widest block mb-1">God Mode: Active Club</label>
            <select 
              value={clubId || ''} 
              onChange={(e) => {
                setActiveClubId(e.target.value || null);
                setClubId(e.target.value || null);
              }} 
              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-white outline-none font-bold transition-colors"
            >
              {allClubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="new">+ Create New Club...</option>
            </select>
          </div>
        </div>
      )}

      {/* --- CONFIG TAB --- */}
      {activeTab === 'config' && (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm relative transition-colors">
            <h2 className="text-[11px] font-black uppercase italic text-emerald-600 dark:text-emerald-500 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">Branding & Sponsors</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Active Club Announcement</label>
                <textarea 
                  value={announcement} 
                  onChange={(e) => setAnnouncement(e.target.value)} 
                  placeholder="e.g. 📢 Ground closed today due to rain. All games cancelled." 
                  rows={2}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors resize-none"
                />
                <p className="text-[8px] text-zinc-400 mt-1 ml-1 font-bold uppercase tracking-widest">This appears at the very top of all team landing pages.</p>
              </div>

              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Club Name</label>
                <input type="text" value={clubName || ""} onChange={(e) => setClubName(e.target.value)} placeholder="e.g. Ferny Districts CC" className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
              </div>
              
              {(!clubId || clubId === 'new') ? (
                <div className="p-4 text-center bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Save Club First to Upload Logo</p>
                </div>
              ) : (
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Club Logo</label>
                  <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 p-3 rounded-xl transition-colors">
                    {logoUrl ? <img src={logoUrl} alt="Logo" className="w-12 h-12 rounded-lg object-cover bg-white" /> : <div className="w-12 h-12 rounded-lg bg-zinc-200 dark:bg-zinc-900 flex items-center justify-center border border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500"><i className="fa-solid fa-image"></i></div>}
                    <div className="flex-1">
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'logo')} className="hidden" id="logo-upload" disabled={isUploadingLogo} />
                      <label htmlFor="logo-upload" className={`text-xs font-bold px-4 py-2 rounded-lg transition-colors inline-block ${isUploadingLogo ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed' : 'bg-zinc-800 dark:bg-zinc-700 text-white hover:bg-zinc-700 dark:hover:bg-zinc-600 cursor-pointer shadow-sm'}`}>
                        {isUploadingLogo ? "Processing..." : "Upload Logo"}
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/50 space-y-4">
                 <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-2">Club Sponsors (Public Page)</label>
                 
                 {(!clubId || clubId === 'new') ? (
                    <div className="p-4 text-center bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Save Club First to Upload Sponsors</p>
                    </div>
                 ) : (
                   [
                     { id: 'sponsor1', num: 1, logo: sponsor1Logo, url: sponsor1Url, setUrl: setSponsor1Url, clear: () => {setSponsor1Logo(""); setSponsor1Url("")} },
                     { id: 'sponsor2', num: 2, logo: sponsor2Logo, url: sponsor2Url, setUrl: setSponsor2Url, clear: () => {setSponsor2Logo(""); setSponsor2Url("")} },
                     { id: 'sponsor3', num: 3, logo: sponsor3Logo, url: sponsor3Url, setUrl: setSponsor3Url, clear: () => {setSponsor3Logo(""); setSponsor3Url("")} }
                   ].map((s) => (
                     <div key={s.id} className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700/50 transition-colors">
                        <div className="flex gap-3">
                           <div className="w-16 h-12 rounded-lg bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center shrink-0 overflow-hidden relative group">
                              {s.logo ? (
                                 <>
                                   <img src={s.logo} className="w-full h-full object-contain p-1" />
                                   <button onClick={s.clear} className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><i className="fa-solid fa-trash text-xs"></i></button>
                                 </>
                              ) : <i className="fa-solid fa-image text-zinc-400"></i>}
                           </div>
                           <div className="flex-1 space-y-2">
                             <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, s.id as any)} className="hidden" id={`${s.id}-upload`} disabled={isUploadingSponsor} />
                             <div className="flex justify-between items-center">
                                <label htmlFor={`${s.id}-upload`} className={`text-[10px] font-bold px-3 py-1.5 rounded-md cursor-pointer transition-colors 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30'}`}>
                                   {s.logo ? 'Change Logo' : `Upload Sponsor ${s.num}`}
                                </label>
                             </div>
                             <input type="url" placeholder="https://..." value={s.url} onChange={(e) => s.setUrl(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                           </div>
                        </div>
                     </div>
                   ))
                 )}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm relative transition-colors">
            <h2 className="text-[11px] font-black uppercase italic text-emerald-600 dark:text-emerald-500 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">Season & Global Rules</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Season Name</label>
                <input type="text" placeholder="e.g. Winter 2026" value={seasonName || ""} onChange={(e) => setSeasonName(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Global Start Date</label>
                  <input type="date" value={seasonStart || ""} onChange={(e) => setSeasonStart(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-white outline-none color-scheme-light dark:color-scheme-dark transition-colors" />
                </div>
                <div className="flex-1">
                  <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Global End Date</label>
                  <input type="date" value={seasonEnd || ""} onChange={(e) => setSeasonEnd(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-white outline-none color-scheme-light dark:color-scheme-dark transition-colors" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <div className="flex-[2]">
                  <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Global Expense Label</label>
                  <input type="text" placeholder="e.g. Umpire Fee, Court Hire" value={expenseLabel || ""} onChange={(e) => setExpenseLabel(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                </div>
                <div className="flex-1">
                  <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Default Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                    <input 
                      type="number" 
                      placeholder="70" 
                      value={defaultUmpireFee ?? ""} 
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
                    value={defaultMemberFee ?? ""} 
                    onChange={(e) => setDefaultMemberFee(e.target.value === '' ? '' : Number(e.target.value))} 
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" 
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Default Casual Fee ($)</label>
                  <input 
                    type="number" 
                    value={defaultCasualFee ?? ""} 
                    onChange={(e) => setDefaultCasualFee(e.target.value === '' ? '' : Number(e.target.value))} 
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-white outline-none transition-colors" 
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
                    <input type="password" placeholder="EAAA..." value={squareAccessToken || ""} onChange={(e) => setSquareAccessToken(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                  </div>
                  <div>
                    <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Square Location ID</label>
                    <input type="text" placeholder="L..." value={squareLocationId || ""} onChange={(e) => setSquareLocationId(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm relative transition-colors">
            <h2 className="text-[11px] font-black uppercase italic text-emerald-600 dark:text-emerald-500 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">Manual Payment Fallback (Club Level)</h2>
            <div className="space-y-4">
              <div className="flex gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors">
                <div className="w-1/3">
                  <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Transfer Type</label>
                  <select 
                    value={payIdType || ""} 
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
                    value={payIdValue || ""} 
                    onChange={(e) => setPayIdValue(e.target.value)} 
                    placeholder={payIdType === 'mobile' ? 'e.g. 0400 000 000' : payIdType === 'email' ? 'e.g. admin@club.com' : 'e.g. BSB: 123-456 ACC: 12345678'}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" 
                  />
                </div>
              </div>
            </div>
          </div>

          <button onClick={saveConfig} disabled={isSaving || !clubName} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-sm active:scale-95 transition-all shadow-md disabled:opacity-50">
            {isSaving ? "Saving Configuration..." : (clubId && clubId !== 'new' ? "Save Club Settings" : "Create New Club")}
          </button>
        </div>
      )}

      {(!clubId || clubId === 'new') && activeTab !== 'config' && (
        <div className="p-10 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl mt-6 shadow-sm transition-colors">
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Please save your club configuration first.</p>
        </div>
      )}

      {/* --- ACCESS TAB --- */}
      {clubId && clubId !== 'new' && activeTab === 'access' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm relative transition-colors">
            <h2 className="text-[11px] font-black uppercase italic text-zinc-800 dark:text-zinc-200 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">Add Admins</h2>
            <div className="space-y-4">
              <input 
                type="email" 
                placeholder="User's Email Address" 
                value={inviteEmail || ""} 
                onChange={(e) => setInviteEmail(e.target.value)} 
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" 
              />
              
              <div className="flex bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl p-1 transition-colors">
                <button 
                  onClick={() => setInviteRole('club_admin')} 
                  className={`flex-1 py-3 text-[10px] font-black uppercase rounded-lg transition-all ${inviteRole === 'club_admin' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                >
                  Club Manager
                </button>
                <button 
                  onClick={() => setInviteRole('team_admin')} 
                  className={`flex-1 py-3 text-[10px] font-black uppercase rounded-lg transition-all ${inviteRole === 'team_admin' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                >
                  Team Manager
                </button>
              </div>

              {inviteRole === 'team_admin' && (
                <select 
                  value={inviteTeamId || ""} 
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
                {isSaving ? "Processing..." : "Invite Admin"}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-1">Current Admins</h3>
            {uniqueEmails.length === 0 ? (
              <div className="text-center py-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors">
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">No assigned roles found.</p>
              </div>
            ) : (
              uniqueEmails.map((email) => {
                const userRolesForEmail = clubUsers.filter(u => u.email === email);
                
                // Cross-reference with the players array to display their linked name
                const linkedPlayer = players.find(p => p.email && p.email.toLowerCase() === email.toLowerCase());

                return (
                  <div key={email} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex flex-col gap-3 group shadow-sm transition-colors">
                    <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2 flex flex-col">
                      {linkedPlayer ? (
                        <>
                          <div className="font-bold text-zinc-900 dark:text-white text-sm uppercase tracking-wide flex items-center gap-2">
                            <span>{linkedPlayer.first_name} {linkedPlayer.last_name}</span>
                            {linkedPlayer.nickname && <span className="text-zinc-400 dark:text-zinc-500 text-xs italic font-normal normal-case">"{linkedPlayer.nickname}"</span>}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-bold mt-0.5">{email}</div>
                        </>
                      ) : (
                        <div className="font-bold text-zinc-900 dark:text-white text-sm">{email}</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      {userRolesForEmail.map((user) => (
                        <div key={user.id} className="flex flex-col bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3 border border-zinc-100 dark:border-zinc-700/50">
                          <div className="flex justify-between items-center">
                            <div className={`text-[9px] font-black uppercase tracking-widest ${user.role === 'club_admin' ? 'text-blue-500 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-500'}`}>
                              {user.role === 'club_admin' ? 'Club Manager' : 'Team Manager'}
                              {user.role === 'team_admin' && user.teams?.name && ` • ${user.teams.name}`}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => {
                                setEditingRoleId(user.id);
                                setEditRoleAssigned(user.role);
                                setEditRoleTeamId(user.team_id || "");
                              }} className="w-7 h-7 rounded-md bg-zinc-200 dark:bg-zinc-700 text-zinc-500 hover:text-blue-600 transition-colors flex items-center justify-center">
                                <i className="fa-solid fa-pen text-[10px]"></i>
                              </button>
                              <button onClick={() => handleRemoveRole(user.id)} className="w-7 h-7 rounded-md bg-zinc-200 dark:bg-zinc-700 text-zinc-500 hover:text-red-500 transition-colors flex items-center justify-center">
                                <i className="fa-solid fa-trash text-[10px]"></i>
                              </button>
                            </div>
                          </div>

                          {editingRoleId === user.id && (
                            <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
                              <div className="flex gap-2">
                                <select 
                                  value={editRoleAssigned || ""} 
                                  onChange={(e) => setEditRoleAssigned(e.target.value as any)} 
                                  className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500"
                                >
                                  <option value="club_admin">Club Manager</option>
                                  <option value="team_admin">Team Manager</option>
                                </select>
                                
                                {editRoleAssigned === 'team_admin' && (
                                  <select 
                                    value={editRoleTeamId || ""} 
                                    onChange={(e) => setEditRoleTeamId(e.target.value)} 
                                    className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500"
                                  >
                                    <option value="">-- Select Team --</option>
                                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                  </select>
                                )}
                              </div>
                              
                              <div className="flex gap-2">
                                <button onClick={() => setEditingRoleId(null)} className="flex-1 py-1.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 text-zinc-700 dark:text-zinc-300 rounded-lg text-[10px] font-black uppercase transition-colors">Cancel</button>
                                <button onClick={() => saveRoleUpdate(user.id)} className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase transition-colors">Save</button>
                              </div>
                            </div>
                          )}

                          {user.role !== 'club_admin' && editingRoleId !== user.id && (
                            <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-700 pt-2 mt-2 transition-colors">
                              <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 uppercase">Square Payments</span>
                              <button onClick={() => togglePaymentPermission(user.id, user.can_take_payments)} className={`text-[9px] font-black uppercase px-2 py-1 rounded transition-colors shadow-sm ${user.can_take_payments ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'}`}>
                                {user.can_take_payments ? 'Enabled' : 'Disabled'}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* --- TEAMS TAB (REVAMPED UX) --- */}
      {clubId && clubId !== 'new' && activeTab === 'teams' && (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
          
          <button
            onClick={() => {
              resetTeamForm();
              setIsTeamModalOpen(true);
            }}
            className="w-full bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-plus text-sm"></i>
            Add New Team
          </button>

          <div className="space-y-3">
            {teams.length === 0 ? (
              <div className="text-center p-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors">
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">No teams created yet.</p>
              </div>
            ) : (
              teams.map(t => {
                const assignedManager = clubUsers.find(u => u.team_id === t.id && u.role === 'team_admin');
                return (
                  <div key={t.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm transition-colors group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="font-black text-zinc-900 dark:text-white text-lg uppercase tracking-wide group-hover:text-emerald-500 transition-colors">
                          {t.name}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-bold mt-1 uppercase tracking-widest flex items-center gap-2">
                          <span className="text-emerald-600 dark:text-emerald-500">M: ${t.member_fee}</span>
                          <span>•</span>
                          <span className="text-zinc-400">C: ${t.casual_fee}</span>
                          {clubRecord?.season_name && (
                            <>
                              <span>•</span>
                              <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-400">
                                {clubRecord.season_name}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="text-[9px] text-zinc-400 uppercase tracking-widest mt-2">
                          MANAGER: <span className="font-bold text-zinc-600 dark:text-zinc-300">{assignedManager ? assignedManager.email : 'Unassigned'}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 shrink-0 ml-4">
                        <button onClick={() => {
                          const link = `${window.location.origin}/t/${t.slug || t.id}`;
                          navigator.clipboard.writeText(link);
                          showToast("Team Link Copied!");
                        }} className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-colors flex items-center justify-center" title="Copy Public Availability Link">
                          <i className="fa-solid fa-link text-xs"></i>
                        </button>
                        <button onClick={() => startEditingTeam(t)} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center">
                          <i className="fa-solid fa-pen text-xs"></i>
                        </button>
                        <button onClick={() => deleteItem('teams', t.id)} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-red-500 transition-colors flex items-center justify-center">
                          <i className="fa-solid fa-trash text-xs"></i>
                        </button>
                      </div>
                    </div>
                    
                    <button onClick={() => openRosterModal(t)} className="w-full py-3 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 flex items-center justify-center gap-2 transition-colors">
                      <i className="fa-solid fa-clipboard-user"></i> Assign Team Players
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* --- ADD / EDIT TEAM MODAL --- */}
      {isTeamModalOpen && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 transition-colors">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-[440px] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 transition-colors">
            <div className="p-5 flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-lg font-black italic uppercase tracking-tighter text-emerald-600 dark:text-emerald-500">
                {editingTeamId ? 'Edit Team' : 'Add New Team'}
              </h2>
              <button onClick={() => { setIsTeamModalOpen(false); resetTeamForm(); }} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            
            <div className="p-5 space-y-4 pb-8">
              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Team Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Bin Chickens" 
                  value={teamName || ""} 
                  onChange={handleTeamNameChange} 
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" 
                />
              </div>

              {/* NEW SLUG LOGIC INJECTED HERE */}
              <div className="mb-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2 ml-1">
                  Friendly URL Slug (Optional)
                </label>
                <div className="flex items-center bg-zinc-50 dark:bg-[#1A1A1A] border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-1 focus-within:border-emerald-500 transition-colors">
                  <span className="text-zinc-400 dark:text-zinc-600 mr-1 select-none font-bold text-sm">
                    feesplease.app/t/
                  </span>
                  <input 
                    type="text" 
                    value={teamSlug} 
                    onChange={handleSlugChange}
                    placeholder="bin-chickens"
                    className="bg-transparent py-2 text-sm text-zinc-900 dark:text-white outline-none w-full font-bold placeholder:font-normal"
                  />
                </div>
                <p className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-1.5 italic ml-1">
                  Used for a direct shareable link so players can easily pay.
                </p>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Member Fee ($)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                    <input 
                      type="number" 
                      value={memberFee ?? ""} 
                      onChange={(e) => setMemberFee(e.target.value === '' ? '' : Number(e.target.value))} 
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl pl-7 pr-3 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" 
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Casual Fee ($)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                    <input 
                      type="number" 
                      value={casualFee ?? ""} 
                      onChange={(e) => setCasualFee(e.target.value === '' ? '' : Number(e.target.value))} 
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl pl-7 pr-3 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" 
                    />
                  </div>
                </div>
              </div>

              <button 
                onClick={saveTeam} 
                disabled={isSaving || !teamName}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs active:scale-95 transition-all shadow-md disabled:opacity-50 mt-2"
              >
                {isSaving ? "Saving..." : (editingTeamId ? 'Update Team' : 'Create Team')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- PLAYERS TAB --- */}
      {clubId && clubId !== 'new' && activeTab === 'players' && (
        <PlayersTab 
          clubId={clubId} 
          teams={teams} 
          players={players} 
          clubUsers={clubUsers} 
          loadClubData={loadClubData} 
          showToast={showToast} 
        />
      )}

      {/* --- FIXTURES TAB --- */}
      {clubId && clubId !== 'new' && activeTab === 'fixtures' && (
        <FixturesTab 
          clubId={clubId} 
          teams={teams} 
          fixtures={fixtures} 
          defaultUmpireFee={defaultUmpireFee}
          expenseLabel={expenseLabel}
          loadClubData={loadClubData} 
          showToast={showToast} 
          openSquadModal={openSquadModal}
        />
      )}

      {/* --- MODALS --- */}
      {isSquadModalOpen && activeSquadFixture && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 transition-colors">
          <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 w-full max-w-[440px] rounded-3xl overflow-hidden flex flex-col max-h-[85vh] shadow-2xl animate-in slide-in-from-bottom-8 transition-colors">
            <div className="p-5 flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 transition-colors">
              <h2 className="text-lg font-black italic text-emerald-600 dark:text-emerald-500 uppercase tracking-tighter">MATCH SQUAD: {activeSquadFixture.opponent}</h2>
              <button onClick={() => setIsSquadModalOpen(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1 space-y-6 pb-24">
              <input 
                type="text" 
                placeholder="Search or Add a Player..." 
                value={playerSearch || ""} 
                onChange={(e) => setPlayerSearch(e.target.value)} 
                className="w-full bg-zinc-50 dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" 
              />

              {/* Categorized Sections */}
              {['yes', 'maybe', 'no_reply', 'no'].map((section) => {
                const sectionPlayers = players.filter(p => {
                  const avail = availabilityData.find(a => a.player_id === p.id);
                  const status = avail ? avail.status : 'no_reply';
                  const isRelevant = p.default_team_id === activeSquadFixture.team_id || squadPlayerIds.includes(p.id) || avail !== undefined;
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
                  <div key={section}>
                    <h3 className={`text-[10px] font-black uppercase tracking-widest ${config.color} mb-3 flex items-center gap-2`}>
                      <i className={`fa-solid ${config.icon}`}></i> {config.label}
                    </h3>
                    <div className="flex flex-wrap gap-2.5">
                      {sectionPlayers.map(p => {
                        const isSelected = squadPlayerIds.includes(p.id);
                        return (
                          <button 
                            key={p.id} 
                            onClick={() => toggleSquadPlayer(p.id)} 
                            disabled={isSaving} 
                            className={`px-4 py-3 rounded-xl font-black text-[11px] uppercase transition-all flex items-center gap-2 ${isSelected ? 'text-white bg-emerald-600 dark:bg-emerald-500 scale-[1.02] shadow-[0_0_15px_rgba(16,185,129,0.3)] border-transparent' : 'bg-white dark:bg-[#1A1A1A] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-400 dark:hover:border-zinc-600'} disabled:opacity-50`}
                          >
                            {p.nickname || `${p.first_name} ${p.last_name?.charAt(0) || ''}.`}
                            {isSelected ? <i className="fa-solid fa-check text-[10px]"></i> : <i className="fa-solid fa-plus text-[10px] opacity-50"></i>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="p-5 border-t border-zinc-100 dark:border-zinc-800 flex gap-3 bg-zinc-50 dark:bg-[#111] transition-colors">
              <button onClick={() => setIsSquadModalOpen(false)} className="flex-1 py-4 rounded-xl text-xs font-black uppercase text-zinc-600 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-900 hover:bg-zinc-300 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
              <button onClick={saveSquad} disabled={isSaving} className="flex-1 py-4 rounded-xl text-xs font-black uppercase text-white bg-emerald-600 hover:bg-emerald-50 disabled:opacity-50 transition-colors shadow-md">
                {isSaving ? 'Saving...' : 'Save Match Squad'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- NEW ROSTER MODAL (MATCHES SQUAD UX) --- */}
      {isRosterModalOpen && activeRosterTeam && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-colors">
          <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 w-full max-w-[440px] rounded-3xl overflow-hidden flex flex-col max-h-[80vh] shadow-2xl transition-colors">
            <div className="p-5 flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 transition-colors">
              <h2 className="text-lg font-black italic uppercase tracking-tighter text-emerald-600 dark:text-emerald-500">{activeRosterTeam.name} Roster</h2>
              <button onClick={() => setIsRosterModalOpen(false)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1 space-y-6 pb-24">
              <input 
                type="text" 
                placeholder="Search players..." 
                value={playerSearch || ""} 
                onChange={(e) => setPlayerSearch(e.target.value)} 
                className="w-full bg-zinc-50 dark:bg-[#1A1A1A] border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-zinc-500 transition-colors" 
              />
              
              <div className="space-y-6">
                {/* CURRENT TEAM */}
                {currentTeamPlayers.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 mb-3">Current Squad</h3>
                    <div className="flex flex-wrap gap-2.5">
                      {currentTeamPlayers.map(p => {
                        const isSelected = rosterPlayerIds.includes(p.id);
                        return (
                          <button key={p.id} onClick={() => toggleRosterPlayer(p.id)} disabled={isSaving} className={`px-4 py-3 rounded-xl font-black text-[11px] uppercase transition-all flex items-center gap-2 ${isSelected ? 'text-white bg-emerald-600 dark:bg-emerald-500 scale-[1.02] shadow-[0_0_15px_rgba(16,185,129,0.3)] border-transparent' : 'bg-white dark:bg-[#1A1A1A] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-400 dark:hover:border-zinc-600'} disabled:opacity-50`}>
                            {p.nickname || `${p.first_name} ${p.last_name?.charAt(0)}.`}
                            {isSelected ? <i className="fa-solid fa-check text-[10px]"></i> : <i className="fa-solid fa-plus text-[10px] opacity-50"></i>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* UNASSIGNED PLAYERS */}
                {unassignedPlayers.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-3">Unassigned Players</h3>
                    <div className="flex flex-wrap gap-2.5">
                      {unassignedPlayers.map(p => {
                        const isSelected = rosterPlayerIds.includes(p.id);
                        return (
                          <button key={p.id} onClick={() => toggleRosterPlayer(p.id)} disabled={isSaving} className={`px-4 py-3 rounded-xl font-black text-[11px] uppercase transition-all flex items-center gap-2 ${isSelected ? 'text-white bg-emerald-600 dark:bg-emerald-500 scale-[1.02] shadow-[0_0_15px_rgba(16,185,129,0.3)] border-transparent' : 'bg-white dark:bg-[#1A1A1A] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-400 dark:hover:border-zinc-600'} disabled:opacity-50`}>
                            {p.nickname || `${p.first_name} ${p.last_name?.charAt(0)}.`}
                            {isSelected ? <i className="fa-solid fa-check text-[10px]"></i> : <i className="fa-solid fa-plus text-[10px] opacity-50"></i>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* OTHER TEAMS */}
                {otherTeamPlayers.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-500 mb-3">Assigned to Other Teams</h3>
                    <div className="flex flex-wrap gap-2.5">
                      {otherTeamPlayers.map(p => {
                        const isSelected = rosterPlayerIds.includes(p.id);
                        const otherTeamName = teams.find(t => t.id === p.default_team_id)?.name;
                        return (
                          <button key={p.id} onClick={() => toggleRosterPlayer(p.id)} disabled={isSaving} className={`px-4 py-3 rounded-xl font-black text-[11px] uppercase transition-all flex items-center gap-2 ${isSelected ? 'text-white bg-emerald-600 dark:bg-emerald-500 scale-[1.02] shadow-[0_0_15px_rgba(16,185,129,0.3)] border-transparent' : 'bg-white dark:bg-[#1A1A1A] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-400 dark:hover:border-zinc-600'} disabled:opacity-50`}>
                            {p.nickname || `${p.first_name} ${p.last_name?.charAt(0)}.`}
                            {!isSelected && <span className="text-[9px] text-orange-500 normal-case tracking-normal ml-1">({otherTeamName})</span>}
                            {isSelected ? <i className="fa-solid fa-check text-[10px]"></i> : <i className="fa-solid fa-plus text-[10px] opacity-50"></i>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-5 border-t border-zinc-100 dark:border-zinc-800 flex gap-3 bg-zinc-50 dark:bg-[#111] transition-colors">
              <button onClick={() => setIsRosterModalOpen(false)} className="flex-1 py-4 rounded-xl text-xs font-black uppercase text-zinc-600 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-900 hover:bg-zinc-300 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
              <button onClick={saveTeamRoster} disabled={isSaving} className="flex-1 py-4 rounded-xl text-xs font-black uppercase text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-md">{isSaving ? 'Saving...' : 'Save Players'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}