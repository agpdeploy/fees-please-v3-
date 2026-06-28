"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { useActiveClub } from "@/contexts/ClubContext";
import PlayersTab from "@/components/PlayersTab";
import FixturesTab from "@/components/FixturesTab"; 
import AutomationsTab from "@/components/AutomationsTab";
import TeamWalletTab from "@/components/TeamWalletTab";
import PlayHQSeasonAlert from "@/components/PlayHQSeasonAlert";
import FinaliseSeasonView from "@/components/FinaliseSeasonView";
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { hasFeature } from "@/lib/features";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string);

interface SetupProps {
  activeTab: 'config' | 'billing' | 'access' | 'teams' | 'players' | 'fixtures' | 'reports' | 'wallet' | 'payments' | 'sponsors';
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
  const [clubCat, setClubCat] = useState<string | null>(null);
  
  // PUBLIC CLUB INFO
  const [publicEmail, setPublicEmail] = useState("");
  const [publicWebsite, setPublicWebsite] = useState("");
  const [publicAddress, setPublicAddress] = useState("");

  const [isClubActive, setIsClubActive] = useState(true);
  const [godModeSearch, setGodModeSearch] = useState("");
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
  const [sponsorStats, setSponsorStats] = useState({ impressions: 0, clicks: 0, ctr: 0 });
  const [isUploadingSponsor, setIsUploadingSponsor] = useState(false);

  const [seasonName, setSeasonName] = useState("");
  const [seasonStart, setSeasonStart] = useState("");
  const [seasonEnd, setSeasonEnd] = useState("");
  const [isEditingSeason, setIsEditingSeason] = useState(false);
  
  const [defaultMemberFee, setDefaultMemberFee] = useState<number | "">("");
  const [defaultCasualFee, setDefaultCasualFee] = useState<number | "">("");
  const [defaultUmpireFee, setDefaultUmpireFee] = useState<number | "">("");
  
  const [expenseLabel, setExpenseLabel] = useState("");
  
  const [squareAccessToken, setSquareAccessToken] = useState("");
  const [squareLocationId, setSquareLocationId] = useState("");
  const [squareMerchantId, setSquareMerchantId] = useState("");


  // CLUB LEVEL MANUAL PAYMENT STATE
  const [payIdType, setPayIdType] = useState<'mobile' | 'email' | 'bank_account'>('mobile');
  const [payIdValue, setPayIdValue] = useState('');
  const [overridePlatformFee, setOverridePlatformFee] = useState(false);
  const [acceptsCash, setAcceptsCash] = useState(true);
  const [acceptsCard, setAcceptsCard] = useState(true);

  // TEAM STATE
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamSlug, setTeamSlug] = useState(""); 
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [memberFee, setMemberFee] = useState<number | "">("");
  const [casualFee, setCasualFee] = useState<number | "">(25);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  
  const [expandedRosterTeamId, setExpandedRosterTeamId] = useState<string | null>(null);
  const [activeRosterTeam, setActiveRosterTeam] = useState<any>(null);
  const [rosterPlayerIds, setRosterPlayerIds] = useState<string[]>([]);

  const [playerSearch, setPlayerSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
  const [newSeasons, setNewSeasons] = useState<any[]>([]);
  const [isCheckingSeasons, setIsCheckingSeasons] = useState(false);
  const [isFinaliseSeasonOpen, setIsFinaliseSeasonOpen] = useState(false);

  async function checkForNewSeasons() {
    if (!clubId || clubId === 'new') return;
    setIsCheckingSeasons(true);
    try {
      const res = await fetch(`/api/cron/playhq-check?clubId=${clubId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success') {
          setNewSeasons(data.unmappedSeasons || []);
        }
      }
    } catch (e) {
      console.error("Failed to check for new PlayHQ seasons:", e);
    } finally {
      setIsCheckingSeasons(false);
    }
  }

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const { profile, loading: profileLoading } = useProfile();
  const isSuperAdmin = profile?.role === 'super_admin';
  const { activeClubId, setActiveClubId } = useActiveClub();
  const [clubId, setClubId] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    if (clubRecord?.plan_interval) {
      setIsAnnual(clubRecord.plan_interval === 'yearly' || clubRecord.plan_interval === 'annual');
    }
  }, [clubRecord?.plan_interval]);

  useEffect(() => {
    // If the url has ?success=square_connected or ?error, show a toast
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('session_id')) {
      const sessionId = urlParams.get('session_id');
      fetch('/api/pay/stripe/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      }).then(res => res.json()).then(data => {
        if (data.success && data.plan) {
          setClubRecord((prev: any) => prev ? { ...prev, plan_tier: data.plan } : null);
        }
        showToast("Subscription updated successfully!");
        window.history.replaceState({}, document.title, window.location.pathname);
      });
    }
    if (urlParams.get('success') === 'square_connected') {
      showToast("Connected to Square successfully!");
      // clean up url
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.has('error')) {
      const errorMsg = urlParams.get('error');
      showToast(`Square Connection Error: ${errorMsg}`, "error");
      // clean up url
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'teams') {
      resetTeamForm();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'teams' && clubId && clubId !== 'new') {
      checkForNewSeasons();
    }
  }, [activeTab, clubId]);

  useEffect(() => {
    if (!profile) return;
    if (profile.role === 'super_admin') {
      supabase.from('clubs').select('id, name, is_active').order('name').then(({ data }) => {
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
    } else {
      if (activeClubId) {
        setClubId(activeClubId);
      } else if (profile.club_id) {
        setClubId(profile.club_id);
        setActiveClubId(profile.club_id);
      }
    }
  }, [profile, activeClubId, setActiveClubId]);

  async function loadClubData() {
    setIsLoading(true);
    if (!clubId || clubId === 'new') return;

    const { data: clubData } = await supabase.from("clubs").select("*").eq("id", clubId).single();
    if (clubData) {
      setClubRecord(clubData);
      setClubName(clubData.name || "");
      setClubCat(clubData.club_cat || null);
      
      const settings = clubData.settings || {};
      setPublicEmail(settings.public_email || "");
      setPublicWebsite(settings.public_website || "");
      setPublicAddress(settings.public_address || "");

      setIsClubActive(clubData.is_active !== false);
      setLogoUrl(clubData.logo_url || "");
      setAnnouncement(clubData.announcement || "");
      setSeasonName(clubData.season_name || "");
      setSeasonStart(clubData.season_start || "");
      setSeasonEnd(clubData.season_end || "");
      setDefaultMemberFee(clubData.default_member_fee != null ? clubData.default_member_fee : "");
      setDefaultCasualFee(clubData.default_casual_fee != null ? clubData.default_casual_fee : "");
      setExpenseLabel(clubData.expense_label || "");
      setDefaultUmpireFee(clubData.default_umpire_fee != null ? clubData.default_umpire_fee : "");
      setSquareAccessToken(clubData.square_access_token || "");
      setSquareLocationId(clubData.square_location_id || "");
      setSquareMerchantId(clubData.square_merchant_id || "");

      setPayIdType(clubData.pay_id_type || 'mobile');
      setPayIdValue(clubData.pay_id_value || '');
      setOverridePlatformFee(clubData.override_platform_fee || false);
      setAcceptsCash(clubData.accepts_cash ?? true);
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

    const { data: sponsorAnalytics } = await supabase.from("sponsor_analytics").select("event_type").eq("club_id", clubId);
    let imp = 0, clk = 0;
    if (sponsorAnalytics) {
      sponsorAnalytics.forEach((s: any) => {
        if (s.event_type === 'impression') imp++;
        if (s.event_type === 'click') clk++;
      });
    }
    setSponsorStats({ impressions: imp, clicks: clk, ctr: imp > 0 ? (clk / imp) * 100 : 0 });

    const { data: fixData } = await supabase.from("fixtures").select("*, teams(name)").in("team_id", teamData?.map(t => t.id) || []).order("match_date", { ascending: true });
    if (fixData) {
      const filteredFix = fixData.filter(f => !clubData?.season_name || f.season_name === clubData.season_name || !f.season_name);
      setFixtures(filteredFix);
    }

    const { data: playerData } = await supabase.from("players").select("*").eq("club_id", clubId).order("first_name", { ascending: true });
    if (playerData) setPlayers(playerData);

    setIsLoading(false);
  }

  useEffect(() => { 
    if (clubId && clubId !== 'new') {
      loadClubData(); 
    } else if (clubId === 'new') {
      setIsLoading(false);
      setClubName(""); setClubCat(null); setLogoUrl(""); setAnnouncement(""); setSeasonName(""); setSeasonStart(""); setSeasonEnd(""); setIsClubActive(true);
      setPublicEmail(""); setPublicWebsite(""); setPublicAddress("");
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

  const handleStartTrial = async () => {
    try {
      setIsSaving(true);
      const res = await fetch('/api/club/start-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId })
      });
      if (!res.ok) throw new Error("Failed to start trial");
      await loadClubData(); // refresh data
      showToast("14-Day Free Trial Started! Enjoy Plus features.");
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  async function handleHardDeleteClub() {
    if (!clubId || clubId === 'new') return;
    if (!window.confirm(`⚠️ EXTREME DANGER: Are you sure you want to PERMANENTLY delete the club "${clubName}" and ALL of its teams, players, fixtures, and financial data? This action cannot be undone.`)) return;
    if (!window.confirm(`FINAL WARNING: To confirm, type "DELETE" into the prompt.`)) return; // Simple double confirm
    
    // Simulate a prompt since window.prompt might not work well in all environments, but we can use confirm for now
    const check = window.prompt(`To confirm permanent deletion, type "${clubName}" exactly:`);
    if (check !== clubName) {
      showToast("Deletion cancelled. Name did not match.", "error");
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.rpc('hard_delete_club', { p_club_id: clubId });
    if (error) {
      showToast("Error deleting club: " + error.message, "error");
      setIsLoading(false);
      return;
    }

    showToast("Club permanently deleted.");
    window.location.reload(); // Reload the entire app to reset state
  }

  async function handleToggleClubStatus() {
    if (!clubId || clubId === 'new') return;
    
    setIsLoading(true);
    const newStatus = !isClubActive;
    
    const { error } = await supabase.from('clubs').update({ is_active: newStatus }).eq('id', clubId);
    
    if (error) {
      showToast("Error updating status: " + error.message, "error");
    } else {
      setIsClubActive(newStatus);
      showToast(`Club is now ${newStatus ? 'Active' : 'Deactivated'}.`);
    }
    setIsLoading(false);
  }

  async function saveConfig() {
    setIsSaving(true);
    const generatedSlug = clubName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const currentSettings = clubRecord?.settings || {};
    const payload = { 
      name: clubName, 
      club_cat: clubCat,
      settings: {
        ...currentSettings,
        public_email: publicEmail,
        public_website: publicWebsite,
        public_address: publicAddress
      },
      is_active: isClubActive,
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
      square_merchant_id: squareMerchantId,

      pay_id_type: payIdValue ? payIdType : null,
      pay_id_value: payIdValue || null,
      override_platform_fee: overridePlatformFee,
      accepts_cash: acceptsCash
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
      
      showToast("Settings saved successfully!");
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
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, club_id: clubId, team_id: inviteRole === 'team_admin' ? inviteTeamId : null, inviter_name: profile?.first_name }),
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
    setMemberFee(defaultMemberFee || ""); 
    setCasualFee(defaultCasualFee || 25); 
    setIsTeamModalOpen(false);
  }

  function startEditingTeam(t: any) { 
    setTeamName(t.name); 
    setTeamSlug(t.slug || "");
    setIsSlugManuallyEdited(!!t.slug);
    setMemberFee(t.member_fee !== undefined ? t.member_fee : ""); 
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

    if (!editingTeamId && clubRecord?.plan_tier === 'free' && teams.length >= 1) {
      showToast("Free plan is limited to 1 team. Upgrade to Plus/Pro to manage multiple teams!", "error");
      return;
    }

    if (!editingTeamId && clubRecord?.plan_tier === 'pro' && teams.length >= 5) {
      showToast("Pro plan is limited to 5 teams. Please manage existing teams or contact support to expand your club.", "error");
      return;
    }
    
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
    setExpandedRosterTeamId(team.id); 
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
    setExpandedRosterTeamId(null); 
    showToast(`${activeRosterTeam.name} Roster Updated!`);
  }
  
  async function deleteItem(table: string, id: string) { 
    if (!window.confirm("Are you sure?")) return; 
    await supabase.from(table).delete().eq("id", id); 
    showToast("Item deleted."); 
    loadClubData(); 
  }

  async function toggleTeamActiveStatus(teamId: string, currentStatus: boolean) {
    if (!window.confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'reactivate'} this team?`)) return;
    
    setIsSaving(true);
    const { error } = await supabase.from('teams').update({ is_active: !currentStatus }).eq('id', teamId);
    setIsSaving(false);
    
    if (error) {
      showToast(error.message, "error");
    } else {
      showToast(`Team ${currentStatus ? 'deactivated' : 'reactivated'}.`);
      loadClubData();
    }
  }

  async function handleStripeCheckout(plan: 'plus' | 'pro') {
    if (!clubId || clubId === 'new') return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/pay/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          clubId, 
          plan,
          interval: isAnnual ? 'annual' : 'monthly'
        })
      });
      const data = await res.json();
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
      } else {
        throw new Error(data.error || "Failed to start checkout");
      }
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStripePortal() {
    if (!clubId || clubId === 'new') return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/pay/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          clubId,
          returnUrl: window.location.href
        })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error || "Failed to open portal");
    } catch (e: any) {
      showToast(e.message, "error");
      setIsSaving(false);
    }
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
          It looks like you don't belong to an account yet. What would you like to do?
        </p>
        
        <div className="w-full max-w-sm space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
            <h3 className="text-zinc-900 dark:text-white font-black uppercase tracking-widest text-xs mb-1"><i className="fa-solid fa-plus text-emerald-500 mr-2"></i> Register New Account</h3>
            <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-4 leading-relaxed">Create a brand new workspace for your account or team.</p>
            
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
                className="w-full py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                {isSaving ? "Creating..." : "Create Account"}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm text-center">
            <h3 className="text-zinc-900 dark:text-white font-black uppercase tracking-widest text-xs mb-1">Looking for your team?</h3>
            <p className="text-zinc-500 text-xs mb-0">Ask your Account Admin to send an invite to <strong className="text-zinc-800 dark:text-zinc-300">{profile?.email}</strong></p>
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
        <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-500/20 rounded-2xl p-4 sm:p-6 shadow-sm mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <i className="fa-solid fa-crown text-emerald-600 dark:text-emerald-500 text-sm"></i>
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500">God Mode: Active Account</h3>
          </div>
          
          <div className="relative mb-2">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs"></i>
            <input 
              type="text" 
              value={godModeSearch}
              onChange={(e) => setGodModeSearch(e.target.value)}
              placeholder="Search clubs..."
              className="w-full bg-white dark:bg-zinc-900 border border-emerald-500/20 rounded-xl pl-9 pr-4 py-2 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          
          <select
            value={clubId || ''}
            onChange={(e) => {
              setActiveClubId(e.target.value || null);
              setClubId(e.target.value || null);
            }}
            className="block w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-emerald-500/20 text-zinc-900 dark:text-white rounded-xl shadow-sm appearance-none outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm font-bold"
          >
            <option value="new">🌟 Create New Account</option>
            {allClubs
              .filter(c => c.name.toLowerCase().includes(godModeSearch.toLowerCase()))
              .map(c => <option key={c.id} value={c.id}>{c.name} {c.is_active === false ? '(Deactivated)' : ''}</option>)}
          </select>
        </div>
      )}

      {/* --- CONFIG TAB --- */}
      {activeTab === 'config' && (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
          
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm relative transition-colors">
            <h2 className="text-[11px] font-black uppercase italic text-emerald-600 dark:text-emerald-500 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">Account Details</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Name</label>
                <input type="text" value={clubName || ""} onChange={(e) => setClubName(e.target.value)} placeholder="e.g. Ferny Districts CC" className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
              </div>

              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Email</label>
                <input type="email" value={publicEmail || ""} onChange={(e) => setPublicEmail(e.target.value)} placeholder="e.g. contact@fernydistrictscc.com" className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
              </div>

              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Website</label>
                <input type="url" value={publicWebsite || ""} onChange={(e) => setPublicWebsite(e.target.value)} placeholder="e.g. https://fernydistrictscc.com" className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
              </div>

              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Address</label>
                <input type="text" value={publicAddress || ""} onChange={(e) => setPublicAddress(e.target.value)} placeholder="e.g. 26 Tramway St, Ferny Grove" className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
              </div>

              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Platform Integration</label>
                <select value={clubCat || ""} onChange={(e) => setClubCat(e.target.value || null)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors">
                  <option value="">None</option>
                  <option value="PlayHQ">PlayHQ</option>
                </select>
              </div>
              
              {profile?.role === 'super_admin' && clubId && clubId !== 'new' && (
                <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300">Account Status</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{isClubActive ? 'Active' : 'Deactivated (Hidden)'}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleToggleClubStatus} disabled={isLoading} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${isClubActive ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'}`}>
                      {isClubActive ? 'Deactivate Account' : 'Reactivate Account'}
                    </button>
                    {!isClubActive && (
                      <button onClick={handleHardDeleteClub} disabled={isLoading} className="px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-white hover:bg-red-500">
                        Hard Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {(!clubId || clubId === 'new') ? (
                <div className="p-4 text-center bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Save Account First to Upload Logo</p>
                </div>
              ) : (
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Account Logo</label>
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

            </div>
          </div>
          <button onClick={saveConfig} disabled={isSaving || !clubName} className="w-full py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50">
            {isSaving ? "Saving Configuration..." : (clubId && clubId !== 'new' ? "Save Account Settings" : "Create New Account")}
          </button>
        </div>
      )}

      {/* --- BILLING TAB --- */}
      {activeTab === 'billing' && (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
          {clubId && clubId !== 'new' && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm relative transition-colors overflow-hidden">
              <div className="flex flex-col items-start mb-6 border-b border-zinc-100 dark:border-zinc-800 pb-4 gap-4">
                <div>
                  <h2 className="text-[11px] font-black uppercase italic text-emerald-600 dark:text-emerald-500 mb-1">Subscription Plan</h2>
                  <p className="text-zinc-500 text-xs">Choose the right plan based on your needs. All paid plans include a 14-day free trial. Current plan: <strong className="text-zinc-900 dark:text-white uppercase">{clubRecord?.trial_ends_at && new Date(clubRecord.trial_ends_at) > new Date() && clubRecord?.plan_tier === 'free' ? 'PLUS (TRIAL ACTIVE)' : `${clubRecord?.plan_tier} ${clubRecord?.plan_interval ? `(${clubRecord.plan_interval})` : ''}`}</strong></p>
                </div>
                
                {clubRecord?.plan_tier !== 'free' && clubRecord?.settings?.cancel_at_period_end && (
                  <div className="w-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex gap-3 items-start animate-in fade-in zoom-in-95">
                    <i className="fa-solid fa-triangle-exclamation text-amber-500 mt-0.5"></i>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-amber-900 dark:text-amber-400 mb-1">Pending Cancellation</h3>
                      <p className="text-xs text-amber-700 dark:text-amber-500">Your subscription has been canceled and will not renew. You will retain your current plan features until the end of the billing period, after which you will be downgraded to the Free plan.</p>
                    </div>
                  </div>
                )}

                {clubRecord?.trial_ends_at && new Date(clubRecord.trial_ends_at) > new Date() && clubRecord?.plan_tier === 'free' && (
                  <div className="w-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex gap-3 items-start animate-in fade-in zoom-in-95">
                    <i className="fa-solid fa-clock text-amber-500 mt-0.5"></i>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-amber-900 dark:text-amber-400 mb-1">Trial Active</h3>
                      <p className="text-xs text-amber-700 dark:text-amber-500">Your Plus trial expires in {Math.ceil((new Date(clubRecord.trial_ends_at).getTime() - new Date().getTime()) / (1000 * 3600 * 24))} days. Upgrade now to avoid losing access to Plus features.</p>
                    </div>
                  </div>
                )}
              </div>

              {clientSecret ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 mt-6">
                  <button 
                    onClick={() => setClientSecret(null)} 
                    className="mb-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors flex items-center gap-2"
                  >
                    <i className="fa-solid fa-arrow-left"></i> Back to Plans
                  </button>
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden min-h-[500px]">
                    <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
                      <EmbeddedCheckout />
                    </EmbeddedCheckoutProvider>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {/* Free Plan */}
                <div className={`border rounded-xl p-5 ${clubRecord?.plan_tier === 'free' ? 'border-zinc-400 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/20' : 'border-zinc-200 dark:border-zinc-800 opacity-70'}`}>
                  {clubRecord?.plan_tier === 'free' && <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">Current</div>}
                  <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-2">Free</h3>
                  <p className="text-xs text-zinc-500 mb-4">For individuals or teams just getting started. Up to 1 team with basic features.</p>
                  <div className="text-2xl font-black text-zinc-900 dark:text-white mb-4">$0</div>
                  {clubRecord?.plan_tier === 'free' ? (
                    <div className="w-full text-center py-2 text-xs font-bold text-zinc-400 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900">Current plan</div>
                  ) : (
                    <div className="w-full text-center py-2 text-xs font-bold text-zinc-400 border border-zinc-200 dark:border-zinc-800 rounded-lg">Included</div>
                  )}
                  <ul className="mt-6 space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                    <li className="flex gap-2"><i className="fa-solid fa-check text-emerald-500 mt-0.5"></i> 1 Team Limit</li>
                    <li className="flex gap-2"><i className="fa-solid fa-check text-emerald-500 mt-0.5"></i> Financial Ledger</li>
                    <li className="flex gap-2"><i className="fa-solid fa-check text-emerald-500 mt-0.5"></i> Team Hub (Public share link)</li>
                    <li className="flex gap-2"><i className="fa-solid fa-check text-emerald-500 mt-0.5"></i> 2.5% platform fee + Square processing (if integrated)</li>
                    <li className="flex gap-2"><i className="fa-solid fa-check text-emerald-500 mt-0.5"></i> Cash & Bank transfer tracking (0% fee)</li>
                  </ul>
                </div>

                {/* Plus Plan */}
                <div className={`relative bg-white dark:bg-zinc-900 border-2 rounded-2xl p-5 sm:p-6 transition-all ${(clubRecord?.plan_tier === 'plus' || (clubRecord?.trial_ends_at && new Date(clubRecord.trial_ends_at) > new Date() && clubRecord?.plan_tier === 'free')) ? 'border-emerald-500 shadow-md' : 'border-zinc-200 dark:border-zinc-800'}`}>
                  {clubRecord?.plan_tier === 'plus' && <div className="absolute -top-2.5 left-5 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded shadow-sm">Current {clubRecord?.plan_interval ? `(${clubRecord.plan_interval})` : ''}</div>}
                  {clubRecord?.plan_tier === 'free' && clubRecord?.trial_ends_at && new Date(clubRecord.trial_ends_at) > new Date() && <div className="absolute -top-2.5 left-5 bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded shadow-sm">Trial Active</div>}
                  {clubRecord?.plan_tier !== 'plus' && !(clubRecord?.trial_ends_at && new Date(clubRecord.trial_ends_at) > new Date() && clubRecord?.plan_tier === 'free') && <div className="absolute -top-2.5 left-5 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded shadow-sm">Recommended</div>}
                  
                  <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400 mb-2">Plus</h3>
                  <p className="text-xs text-zinc-500 mb-4">Unlimited teams with reduced transaction fees and email capability.</p>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4 bg-emerald-50 dark:bg-emerald-900/10 inline-flex p-2 rounded-lg border border-emerald-500/10">
                    <span className={!isAnnual ? 'text-zinc-900 dark:text-white' : ''}>Monthly</span>
                    <div className={`w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors ${isAnnual ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} onClick={() => setIsAnnual(!isAnnual)}>
                      <div className={`w-3 h-3 rounded-full bg-white transition-transform ${isAnnual ? 'translate-x-4' : 'translate-x-0'}`}></div>
                    </div>
                    <span className={isAnnual ? 'text-emerald-600 dark:text-emerald-500' : ''}>Annual (Save 15%)</span>
                  </div>
                  <div className="text-3xl font-black text-zinc-900 dark:text-white mb-2">
                    {isAnnual ? '$69.00' : '$6.99'} <span className="text-sm text-zinc-500 font-normal">{isAnnual ? '/yr per team' : '/mo per team'}</span>
                  </div>
                  
                  {clubRecord?.plan_tier === 'plus' ? (
                     <button onClick={handleStripePortal} disabled={isSaving} className="w-full mt-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-lg shadow-md transition-colors">Manage</button>
                  ) : (
                     <>
                       {(!clubRecord?.has_had_trial && clubRecord?.plan_tier === 'free') && (
                         <button onClick={handleStartTrial} disabled={isSaving} className="w-full mt-3 py-2 bg-amber-500 hover:bg-amber-400 text-white text-xs font-black uppercase tracking-widest rounded-lg shadow-md transition-colors mb-2">Start 14-Day Free Trial (No Card Required)</button>
                       )}
                       <button onClick={() => handleStripeCheckout('plus')} disabled={isSaving || clubRecord?.plan_tier === 'pro'} className="w-full mt-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-lg shadow-md transition-colors disabled:opacity-50">Upgrade</button>
                     </>
                  )}

                  <ul className="mt-6 space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                    <li className="flex gap-2 font-bold text-zinc-800 dark:text-zinc-200"><i className="fa-solid fa-plus text-emerald-500 mt-0.5"></i> Everything on Free, plus:</li>
                    <li className="flex gap-2"><i className="fa-solid fa-check text-emerald-500 mt-0.5"></i> Unlimited teams (billed per team)</li>
                    <li className="flex gap-2"><i className="fa-solid fa-check text-emerald-500 mt-0.5"></i> Team Hub (Email reminders & pre-pay)</li>
                    <li className="flex gap-2"><i className="fa-solid fa-check text-emerald-500 mt-0.5"></i> 30c platform fee + Square processing (if integrated)</li>
                    <li className="flex gap-2"><i className="fa-solid fa-check text-emerald-500 mt-0.5"></i> Cash & Bank transfer tracking (0% fee)</li>
                  </ul>
                </div>

                {/* Pro Plan */}
                <div className={`relative bg-white dark:bg-zinc-900 border-2 rounded-2xl p-5 sm:p-6 transition-all ${clubRecord?.plan_tier === 'pro' ? 'border-emerald-500 shadow-md' : 'border-zinc-200 dark:border-zinc-800'}`}>
                  {clubRecord?.plan_tier === 'pro' && <div className="absolute -top-2.5 left-5 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded shadow-sm">Current {clubRecord?.plan_interval ? `(${clubRecord.plan_interval})` : ''}</div>}
                  <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-2">Pro</h3>
                  <p className="text-xs text-zinc-500 mb-4">Flat rate covering up to 5 teams with our lowest fees. SMS capability included (coming soon).</p>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4 bg-zinc-50 dark:bg-zinc-800/50 inline-flex p-2 rounded-lg border border-zinc-200 dark:border-zinc-700/50">
                    <span className={!isAnnual ? 'text-zinc-900 dark:text-white' : ''}>Monthly</span>
                    <div className={`w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors ${isAnnual ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} onClick={() => setIsAnnual(!isAnnual)}>
                      <div className={`w-3 h-3 rounded-full bg-white transition-transform ${isAnnual ? 'translate-x-4' : 'translate-x-0'}`}></div>
                    </div>
                    <span className={isAnnual ? 'text-emerald-600 dark:text-emerald-500' : ''}>Annual (Save 15%)</span>
                  </div>
                  <div className="text-3xl font-black text-zinc-900 dark:text-white mb-2">
                    {isAnnual ? '$129.00' : '$12.99'} <span className="text-sm text-zinc-500 font-normal">{isAnnual ? '/yr flat' : '/mo flat'}</span>
                  </div>
                  
                  {clubRecord?.plan_tier === 'pro' ? (
                     <button onClick={handleStripePortal} disabled={isSaving} className="w-full mt-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-lg shadow-md transition-colors">Manage</button>
                  ) : (
                     <button onClick={() => clubRecord?.plan_tier === 'free' ? handleStripeCheckout('pro') : handleStripePortal()} disabled={isSaving} className="w-full mt-3 py-2 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white text-xs font-black uppercase tracking-widest rounded-lg transition-colors">Upgrade</button>
                  )}

                  <ul className="mt-6 space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                    <li className="flex gap-2 font-bold text-zinc-800 dark:text-zinc-200"><i className="fa-solid fa-plus text-emerald-500 mt-0.5"></i> Everything on Plus, plus:</li>
                    <li className="flex gap-2"><i className="fa-solid fa-check text-emerald-500 mt-0.5"></i> Up to 5 teams included</li>
                    <li className="flex gap-2"><i className="fa-solid fa-check text-emerald-500 mt-0.5"></i> Team Hub (SMS allowance included)</li>
                    <li className="flex gap-2"><i className="fa-solid fa-check text-emerald-500 mt-0.5"></i> 15c platform fee + Square processing (if integrated)</li>
                    <li className="flex gap-2"><i className="fa-solid fa-check text-emerald-500 mt-0.5"></i> Cash & Bank transfer tracking (0% fee)</li>
                  </ul>
                </div>
              </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- SPONSORS TAB --- */}
      {activeTab === 'sponsors' && (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm relative overflow-hidden transition-colors">
            {!hasFeature(clubRecord, 'SPONSORS') && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/70 dark:bg-zinc-900/70 backdrop-blur-[2px]">
                <div className="text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-2xl shadow-xl max-w-xs mx-auto">
                   <div className="w-12 h-12 mx-auto bg-amber-100 dark:bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mb-4">
                     <i className="fa-solid fa-bullhorn text-xl"></i>
                   </div>
                   <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white mb-2">Unlock Sponsors</h3>
                   <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-6">Showcase sponsors across your team hub, payment pages, and emails.</p>
                   <button 
                     onClick={() => window.dispatchEvent(new CustomEvent('navigate-setup', { detail: 'billing' }))}
                     className="w-full py-3 rounded-xl font-black uppercase tracking-widest text-xs text-amber-900 bg-amber-400 hover:bg-amber-300 shadow-md shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                   >
                     <i className="fa-solid fa-lock"></i> Upgrade to Plus
                   </button>
                   <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mt-3">Requires Plus Plan</p>
                </div>
              </div>
            )}
            <div className={`p-5 transition-all duration-300 ${!hasFeature(clubRecord, 'SPONSORS') ? 'opacity-30 pointer-events-none blur-[1px]' : ''}`}>
              
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 mb-6">
                <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800/50 pb-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500 flex items-center justify-center">
                     <i className="fa-solid fa-chart-simple text-sm"></i>
                  </div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">Sponsorship Impact</h2>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-2xl font-black text-zinc-900 dark:text-white">{sponsorStats.impressions}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mt-1">Impressions</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-blue-600 dark:text-blue-500">{sponsorStats.clicks}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-600/70 mt-1">Clicks</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-zinc-900 dark:text-white">{sponsorStats.ctr.toFixed(1)}%</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mt-1">Click Rate</p>
                  </div>
                </div>
              </div>

              <h2 className="text-[11px] font-black uppercase italic text-emerald-600 dark:text-emerald-500 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">Account Sponsors</h2>
              <div className="space-y-4">
                   {(!clubId || clubId === 'new') ? (
                      <div className="p-4 text-center bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Save Account First to Upload Sponsors</p>
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
                                  <label htmlFor={`${s.id}-upload`} className={`text-[10px] font-bold px-3 py-1.5 rounded-md cursor-pointer transition-colors bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30`}>
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
          {hasFeature(clubRecord, 'SPONSORS') && (
            <button onClick={saveConfig} disabled={isSaving || !clubName} className="w-full py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50">
              {isSaving ? "Saving Sponsors..." : "Save Sponsors"}
            </button>
          )}
        </div>
      )}

      {(!clubId || clubId === 'new') && activeTab !== 'config' && (
        <div className="p-10 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl mt-6 shadow-sm transition-colors">
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Please save your account configuration first.</p>
        </div>
      )}

      {/* --- PAYMENTS TAB --- */}
      {clubId && clubId !== 'new' && activeTab === 'payments' && (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm relative transition-colors">
            <h2 className="text-[11px] font-black uppercase italic text-emerald-600 dark:text-emerald-500 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">Payment Integration (Square)</h2>
            <div className="space-y-4">
              <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-xl border border-zinc-300 dark:border-zinc-700">
                {squareAccessToken ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 font-bold text-sm">
                      <i className="fa-solid fa-circle-check"></i>
                      <span>Connected to Square</span>
                    </div>
                    {squareMerchantId && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                        Merchant ID: {squareMerchantId}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setSquareAccessToken("");
                        setSquareLocationId("");
                        setSquareMerchantId("");
                        showToast("Disconnected locally. Click Save Settings.");
                      }}
                      className="mt-2 bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors self-start"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      Connect your Square account to process card payments directly via your club page. Don't have a Square account? <a href="https://squareup.com/signup" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold">Create one for free</a>.
                    </p>
                    <a 
                      href={`/api/pay/square/connect?clubId=${clubId}`}
                      className="w-full flex items-center justify-center gap-2 bg-[#3D3A3B] hover:bg-black text-white px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-sm"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" fillRule="evenodd" clipRule="evenodd"><path d="M19 2H5C3.3 2 2 3.3 2 5V19C2 20.7 3.3 22 5 22H19C20.7 22 22 20.7 22 19V5C22 3.3 20.7 2 19 2ZM16 16H8V8H16V16Z" /></svg> Connect Square
                    </a>
                  </div>
                )}
              </div>

              {isSuperAdmin && (
                <div className="mt-4 p-4 border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-bl-lg">Super Admin</div>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <div className="relative inline-block w-10 mt-0.5">
                      <input 
                        type="checkbox" 
                        className="peer sr-only" 
                        checked={overridePlatformFee}
                        onChange={(e) => setOverridePlatformFee(e.target.checked)}
                      />
                      <div className="block h-6 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700 peer-checked:bg-emerald-500 transition-colors"></div>
                      <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4 shadow-sm"></div>
                    </div>
                    <div>
                      <span className="text-sm font-bold text-emerald-800 dark:text-emerald-400 block">Override Platform Fee</span>
                      <span className="text-xs text-emerald-600/80 dark:text-emerald-500/80">Disable the 1.4% platform clip for this account. Square wholesale fees still apply.</span>
                    </div>
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm relative transition-colors mb-6">
            <h2 className="text-[11px] font-black uppercase italic text-emerald-600 dark:text-emerald-500 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">Accepted Payment Methods</h2>
            <div className="flex gap-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`w-10 h-6 rounded-full p-1 transition-colors ${acceptsCash ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${acceptsCash ? 'translate-x-4' : 'translate-x-0'}`}></div>
                </div>
                <input type="checkbox" className="hidden" checked={acceptsCash} onChange={(e) => {
                  if (!e.target.checked && !acceptsCard) {
                    showToast("You must accept at least one payment method", "error");
                    return;
                  }
                  setAcceptsCash(e.target.checked);
                }} />
                <div>
                  <span className="text-sm font-bold text-zinc-900 dark:text-white block">Cash Payments</span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer ml-6">
                <div className={`w-10 h-6 rounded-full p-1 transition-colors ${acceptsCard ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${acceptsCard ? 'translate-x-4' : 'translate-x-0'}`}></div>
                </div>
                <input type="checkbox" className="hidden" checked={acceptsCard} onChange={(e) => {
                  if (!e.target.checked && !acceptsCash) {
                    showToast("You must accept at least one payment method", "error");
                    return;
                  }
                  setAcceptsCard(e.target.checked);
                }} />
                <div>
                  <span className="text-sm font-bold text-zinc-900 dark:text-white block">Card / Digital Payments</span>
                </div>
              </label>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm relative transition-colors">
            <h2 className="text-[11px] font-black uppercase italic text-emerald-600 dark:text-emerald-500 mb-2 border-b border-zinc-100 dark:border-zinc-800 pb-2">Manual Payment Fallback (Account Level)</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold mb-4 leading-relaxed">If you don't connect Square (or if a player prefers bank transfer), they will be given these details to transfer funds directly via their banking app. <strong className="text-zinc-700 dark:text-zinc-300">Note:</strong> These payments are self-reported by the player and won't be automatically verified.</p>
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
                    placeholder={payIdType === 'mobile' ? 'e.g. 0400 000 000' : payIdType === 'email' ? 'e.g. admin@account.com' : 'e.g. BSB: 123-456 ACC: 12345678'}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" 
                  />
                </div>
              </div>
            </div>
          </div>
          
          <button onClick={saveConfig} disabled={isSaving || !clubName} className="w-full py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50">
            {isSaving ? "Saving Settings..." : "Save Payment Settings"}
          </button>
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
                  Account Admin
                </button>
                <button 
                  onClick={() => setInviteRole('team_admin')} 
                  className={`flex-1 py-3 text-[10px] font-black uppercase rounded-lg transition-all ${inviteRole === 'team_admin' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                >
                  Team Admin
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
                className="w-full py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
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
                              {user.role === 'club_admin' ? 'Account Admin' : 'Team Admin'}
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
                                  <option value="club_admin">Account Admin</option>
                                  <option value="team_admin">Team Admin</option>
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

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm relative transition-colors">
            <h2 className="text-[11px] font-black uppercase italic text-emerald-600 dark:text-emerald-500 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">Active Account Announcement</h2>
            <div>
              <textarea 
                value={announcement} 
                onChange={(e) => setAnnouncement(e.target.value)} 
                placeholder="e.g. 📢 Ground closed today due to rain. All games cancelled." 
                rows={2}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors resize-none"
              />
              <p className="text-[8px] text-zinc-400 mt-1 font-bold uppercase tracking-widest">This appears at the very top of all team landing pages.</p>
              <div className="mt-3 flex justify-end">
                <button onClick={saveConfig} disabled={isSaving} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-all shadow-sm active:scale-95 disabled:opacity-50">
                  {isSaving ? "Saving..." : "Save Announcement"}
                </button>
              </div>
            </div>
          </div>
          
          {!clubRecord?.season_name && (
            <PlayHQSeasonAlert
              clubRecord={clubRecord}
              teams={teams}
              newSeasons={newSeasons}
              setNewSeasons={setNewSeasons}
            />
          )}

          {isFinaliseSeasonOpen ? (
            <FinaliseSeasonView
              clubId={clubId}
              teams={teams}
              seasonName={seasonName}
              seasonStart={seasonStart}
              seasonEnd={seasonEnd}
              onCancel={() => setIsFinaliseSeasonOpen(false)}
              onComplete={() => {
                setIsFinaliseSeasonOpen(false);
                loadClubData();
              }}
            />
          ) : (
            <>
              {clubRecord?.season_name && !isEditingSeason && (
                <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col gap-4 relative">
                  <button 
                    onClick={() => setIsEditingSeason(true)}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-white transition-all shadow-sm active:scale-95"
                    title="Edit Season Details"
                  >
                    <i className="fa-solid fa-pen text-xs"></i>
                  </button>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-1">Active Season</h3>
                    <p className="text-lg font-black text-emerald-600 dark:text-emerald-500 tracking-tight">{clubRecord.season_name}</p>
                    {(clubRecord.season_start || clubRecord.season_end) && (
                      <p className="text-[10px] text-zinc-400 font-bold uppercase mt-1 tracking-wider">
                        {clubRecord.season_start ? new Date(clubRecord.season_start).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase() : 'TBA'} - {clubRecord.season_end ? new Date(clubRecord.season_end).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase() : 'TBA'}
                      </p>
                    )}
                  </div>
                  <div className="flex mt-2">
                    <button
                      onClick={() => setIsFinaliseSeasonOpen(true)}
                      disabled={clubRecord.season_end ? new Date() < new Date(clubRecord.season_end) : false}
                      className="w-full py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-md disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                      title={clubRecord.season_end && new Date() < new Date(clubRecord.season_end) ? "Season has not ended yet" : "Wrap up the season"}
                    >
                      <i className="fa-solid fa-flag-checkered"></i>
                      Finalise Season
                    </button>
                  </div>
                </div>
              )}

              {((!clubRecord?.season_name && !isFinaliseSeasonOpen) || isEditingSeason) && (
                <div className="bg-white dark:bg-zinc-900 border-2 border-emerald-500/30 rounded-2xl p-6 shadow-sm mb-6 text-center space-y-4">
                  <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-500 mb-2">
                    <i className={`fa-solid ${isEditingSeason ? 'fa-pen-to-square' : 'fa-seedling'} text-lg`}></i>
                    <h3 className="text-sm font-black uppercase tracking-widest">{isEditingSeason ? "Edit Season Details" : "Start a New Season"}</h3>
                  </div>
                  {!isEditingSeason && (
                    <p className="text-xs text-zinc-500 mb-4 max-w-sm mx-auto leading-relaxed">Your account has no active season. If you are not syncing from PlayHQ, manually start a new season below.</p>
                  )}
                  <div className="max-w-md mx-auto space-y-3 text-left">
                    <div>
                      <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Season Name</label>
                      <input type="text" placeholder="e.g. Winter 2026" value={seasonName || ""} onChange={(e) => setSeasonName(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                    </div>
                    <div className="flex gap-3">
                       <div className="flex-1">
                         <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Start Date</label>
                         <input type="date" value={seasonStart || ""} onChange={(e) => setSeasonStart(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-white outline-none color-scheme-light dark:color-scheme-dark transition-colors" />
                       </div>
                       <div className="flex-1">
                         <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">End Date</label>
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
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setDefaultMemberFee(val);
                            setDefaultCasualFee(val);
                          }} 
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

                    <div className="flex gap-2 pt-2">
                      {isEditingSeason && (
                        <button 
                          onClick={() => setIsEditingSeason(false)}
                          className="flex-1 py-3 rounded-xl bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-black text-xs uppercase tracking-widest shadow-sm active:scale-95 transition-all"
                        >
                          Cancel
                        </button>
                      )}
                      <button 
                        onClick={() => {
                          saveConfig();
                          setIsEditingSeason(false);
                          setTimeout(() => loadClubData(), 1000);
                        }}
                        disabled={!seasonName || isSaving}
                        className="flex-[2] py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest shadow-md active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                      >
                        {isEditingSeason ? <><i className="fa-solid fa-save"></i> Save Changes</> : <><i className="fa-solid fa-play"></i> {isSaving ? "Starting..." : "Start Season"}</>}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-4 mb-4">
                {(clubRecord?.plan_tier === 'free' || !clubRecord?.plan_tier) && teams.length >= 1 ? (
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('navigate-setup', { detail: 'billing' }))}
                    className="w-full bg-amber-400 hover:bg-amber-300 text-amber-900 font-black py-4 rounded-xl uppercase tracking-widest text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-lock text-sm"></i>
                    Upgrade to Add More Teams
                  </button>
                ) : clubRecord?.plan_tier === 'pro' && teams.length >= 5 ? (
                  <button
                    onClick={() => showToast("Pro plan is limited to 5 teams. Please contact support to expand your club.", "error")}
                    className="w-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 font-black py-4 rounded-xl uppercase tracking-widest text-xs cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-ban text-sm"></i>
                    Team Limit Reached
                  </button>
                ) : (
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
                )}
              </div>

              <div className="space-y-3">
            {teams.length === 0 ? (
              <div className="text-center p-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors">
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">No teams created yet.</p>
              </div>
            ) : (
              teams.map(t => {
                const assignedManager = clubUsers.find(u => u.team_id === t.id && u.role === 'team_admin');
                return (
                  <div key={t.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm transition-colors group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="font-black text-zinc-900 dark:text-white text-lg uppercase tracking-wide group-hover:text-emerald-500 transition-colors flex items-center flex-wrap gap-2 leading-tight">
                          {t.name}
                          {t.is_active === false && (
                            <span className="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border border-red-200 dark:border-red-800/50 leading-none">
                              Deactivated
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border border-emerald-200 dark:border-emerald-500/20 leading-none">
                            Match: ${t.member_fee}
                          </span>
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 leading-none">
                            Casual: ${t.casual_fee}
                          </span>
                          {clubRecord?.season_name && (
                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 leading-none truncate max-w-[200px]">
                              {clubRecord.season_name}
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-zinc-400 uppercase tracking-widest mt-3 flex items-center gap-1.5 truncate w-full">
                          <i className="fa-solid fa-user-tie shrink-0"></i> 
                          <span className="shrink-0">MANAGER:</span> 
                          <span className="font-bold text-zinc-600 dark:text-zinc-300 truncate">{assignedManager ? assignedManager.email : 'Unassigned'}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                        <button onClick={() => {
                          const link = `${window.location.origin}/t/${t.slug || t.id}`;
                          navigator.clipboard.writeText(link);
                          showToast("Team Link Copied!");
                        }} className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-colors flex items-center justify-center shrink-0" title="Copy Public Availability Link">
                          <i className="fa-solid fa-link text-xs"></i>
                        </button>
                        <button onClick={() => startEditingTeam(t)} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center shrink-0">
                          <i className="fa-solid fa-pen text-xs"></i>
                        </button>
                        <button onClick={() => toggleTeamActiveStatus(t.id, t.is_active !== false)} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-orange-500 transition-colors flex items-center justify-center shrink-0" title={t.is_active !== false ? "Deactivate Team" : "Reactivate Team"}>
                          <i className={`fa-solid ${t.is_active !== false ? 'fa-ban' : 'fa-rotate-left'} text-xs`}></i>
                        </button>
                        <button onClick={() => deleteItem('teams', t.id)} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-red-500 transition-colors flex items-center justify-center shrink-0">
                          <i className="fa-solid fa-trash text-xs"></i>
                        </button>
                      </div>
                    </div>
                    
                    <button onClick={() => {
                      if (expandedRosterTeamId === t.id) {
                        setExpandedRosterTeamId(null);
                      } else {
                        openRosterModal(t);
                      }
                    }} className="w-full py-3 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 flex items-center justify-center gap-2 transition-colors">
                      {expandedRosterTeamId === t.id ? (
                        <><i className="fa-solid fa-chevron-up"></i> Close Roster</>
                      ) : (
                        <><i className="fa-solid fa-clipboard-user"></i> Assign Team Players</>
                      )}
                    </button>

                    {clubRecord?.club_cat === 'PlayHQ' && (
                      <div className="mt-3 bg-[#0051e5]/5 dark:bg-[#0051e5]/10 border border-[#0051e5]/20 dark:border-[#0051e5]/30 rounded-xl p-4 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-[10px] font-black uppercase italic text-[#0051e5] flex items-center gap-2">
                            <i className="fa-solid fa-rotate-right"></i> PlayHQ Auto-Sync
                          </h3>
                        </div>
                        <div className="flex gap-2">
                          <input type="text" defaultValue={t.settings?.playhq_url || ""} placeholder="https://www.playhq.com/.../teams/..." id={`playhq-sync-${t.id}`} className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-[#0051e5] transition-colors" />
                          <button onClick={async () => {
                            const url = (document.getElementById(`playhq-sync-${t.id}`) as HTMLInputElement)?.value;
                            if (!url) return showToast('Please enter a PlayHQ Team URL', 'error');
                            setIsSaving(true);
                            try {
                              const res = await fetch('/api/playhq-sync', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ url })
                              });
                              if (!res.ok) throw new Error(await res.text());
                              const data = await res.json();
                              
                              let targetSeasonName = clubRecord?.season_name;
                              if (!targetSeasonName && data.seasonName) {
                                await supabase.from('clubs').update({
                                  season_name: data.seasonName,
                                  season_start: data.seasonStart || null,
                                  season_end: data.seasonEnd || null
                                }).eq('id', activeClubId);
                                targetSeasonName = data.seasonName;
                              }

                              if (data.orgDetails) {
                                const currentClubSettings = clubRecord?.settings || {};
                                const newPublicEmail = currentClubSettings.public_email || data.orgDetails.email;
                                const newPublicWebsite = currentClubSettings.public_website || data.orgDetails.website;
                                const newPublicAddress = currentClubSettings.public_address || data.orgDetails.address;
                                
                                if (newPublicEmail !== currentClubSettings.public_email || newPublicWebsite !== currentClubSettings.public_website || newPublicAddress !== currentClubSettings.public_address) {
                                  const updatedClubSettings = {
                                    ...currentClubSettings,
                                    public_email: newPublicEmail,
                                    public_website: newPublicWebsite,
                                    public_address: newPublicAddress,
                                  };
                                  await supabase.from('clubs').update({ settings: updatedClubSettings }).eq('id', activeClubId);
                                  if (clubRecord) clubRecord.settings = updatedClubSettings;
                                  setPublicEmail(newPublicEmail || "");
                                  setPublicWebsite(newPublicWebsite || "");
                                  setPublicAddress(newPublicAddress || "");
                                }
                              }

                              // Save the URL to teams.settings
                              const currentSettings = typeof t.settings === 'object' && t.settings !== null ? t.settings : {};
                              await supabase.from('teams').update({ settings: { ...currentSettings, playhq_url: url } }).eq('id', t.id);

                              if (data.fixtures && data.fixtures.length > 0) {
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);

                                const payload = data.fixtures.map((f: any) => {
                                  const isPast = f.match_date ? new Date(f.match_date) < today : false;
                                  return { 
                                    ...f, 
                                    team_id: t.id, 
                                    umpire_fee: clubRecord?.default_umpire_fee || 0,
                                    status: isPast ? 'completed' : 'upcoming',
                                    is_active: true,
                                    season_name: targetSeasonName || null
                                  };
                                });
                                await supabase.from("fixtures").insert(payload);
                              }

                              showToast('PlayHQ Team Synced Successfully! Reloading...');
                              setTimeout(() => window.location.reload(), 1500);
                            } catch (e: any) {
                              showToast(e.message, 'error');
                              setIsSaving(false);
                            }
                          }} className="px-4 py-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-[#0051e5] hover:bg-blue-600 rounded-lg transition-all shadow-sm active:scale-95 disabled:opacity-50">
                            Sync
                          </button>
                        </div>
                      </div>
                    )}

                    {/* INLINE ROSTER ACCORDION */}
                    {expandedRosterTeamId === t.id && activeRosterTeam?.id === t.id && (
                      <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700 animate-in slide-in-from-top-2">
                        <input 
                          type="text" 
                          placeholder="Search players..." 
                          value={playerSearch || ""} 
                          onChange={(e) => setPlayerSearch(e.target.value)} 
                          className="w-full bg-zinc-50 dark:bg-[#1A1A1A] border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-zinc-500 transition-colors mb-4" 
                        />
                        
                        <div className="space-y-6">
                          {/* CURRENT TEAM */}
                          {currentTeamPlayers.length > 0 && (
                            <div>
                              <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 mb-3">Current Lineup</h3>
                              <div className="flex flex-wrap gap-2.5">
                                {currentTeamPlayers.map(p => {
                                  const isSelected = rosterPlayerIds.includes(p.id);
                                  return (
                                    <button key={p.id} onClick={() => toggleRosterPlayer(p.id)} disabled={isSaving} className={`px-4 py-3 rounded-xl font-black text-[11px] uppercase transition-all flex items-center gap-2 ${isSelected ? 'text-white bg-emerald-600 dark:bg-emerald-500 scale-[1.02] shadow-[0_0_15px_rgba(16,185,129,0.3)] border-transparent' : 'bg-white dark:bg-[#1A1A1A] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-400 dark:hover:border-zinc-600'} disabled:opacity-50`}>
                                      {p.nickname || `${p.first_name} ${p.last_name?.charAt(0) || ''}.`}
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
                                      {p.nickname || `${p.first_name} ${p.last_name?.charAt(0) || ''}.`}
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
                                  const otherTeamName = teams.find((tt: any) => tt.id === p.default_team_id)?.name;
                                  return (
                                    <button key={p.id} onClick={() => toggleRosterPlayer(p.id)} disabled={isSaving} className={`px-4 py-3 rounded-xl font-black text-[11px] uppercase transition-all flex items-center gap-2 ${isSelected ? 'text-white bg-emerald-600 dark:bg-emerald-500 scale-[1.02] shadow-[0_0_15px_rgba(16,185,129,0.3)] border-transparent' : 'bg-white dark:bg-[#1A1A1A] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-400 dark:hover:border-zinc-600'} disabled:opacity-50`}>
                                      {p.nickname || `${p.first_name} ${p.last_name?.charAt(0) || ''}.`}
                                      {!isSelected && <span className="text-[9px] text-orange-500 normal-case tracking-normal ml-1">({otherTeamName})</span>}
                                      {isSelected ? <i className="fa-solid fa-check text-[10px]"></i> : <i className="fa-solid fa-plus text-[10px] opacity-50"></i>}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="mt-6 flex gap-3">
                          <button onClick={() => setExpandedRosterTeamId(null)} className="flex-1 py-3 rounded-xl text-xs font-black uppercase text-zinc-600 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-800/50 hover:bg-zinc-300 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
                          <button onClick={saveTeamRoster} disabled={isSaving} className="flex-1 py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50">{isSaving ? 'Saving...' : 'Save Players'}</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
            </>
          )}
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
                className="w-full py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 mt-2"
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
          isSuperAdmin={profile?.role === 'super_admin'}
          loadClubData={loadClubData} 
          showToast={showToast} 
          profile={profile}
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
          clubPlayers={players}
          profile={profile}
          clubLogoUrl={logoUrl}
          activeSeasonName={clubRecord?.season_name || null}
        />
      )}

      {/* --- REPORTS TAB --- */}
      {clubId && clubId !== 'new' && activeTab === 'reports' && (
        <AutomationsTab 
          clubId={clubId} 
          teams={teams} 
          showToast={showToast} 
          clubUsers={clubUsers}
          planTier={clubRecord?.plan_tier || 'free'}
        />
      )}

      {/* --- TEAM WALLET TAB --- */}
      {clubId && clubId !== 'new' && activeTab === 'wallet' && (
        <TeamWalletTab 
          clubId={clubId} 
          teams={teams} 
          showToast={showToast} 
          planTier={clubRecord?.plan_tier || 'free'}
        />
      )}

    </div>
  );
}