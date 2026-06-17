"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface SetupChecklistProps {
  user?: any;
  activeClubId: string | null;
  clubInfo: any;
  onUpdateClubInfo?: (info: any) => void;
  teamFees: any;
  teamsCount: number;
  teams: any[];
  onDismiss: () => void;
  onClubCreated?: (clubId: string) => void;
}

export default function SetupChecklist({ user, activeClubId, clubInfo, onUpdateClubInfo, teamFees, teamsCount, teams, onDismiss, onClubCreated }: SetupChecklistProps) {
  const [hasPlayers, setHasPlayers] = useState(false);
  const [hasFixtures, setHasFixtures] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedStep, setExpandedStep] = useState<string | null>(activeClubId ? null : 'club');
  const [dismissedSteps, setDismissedSteps] = useState<Record<string, boolean>>({});

  // Club Creation State
  const [ownerFirstName, setOwnerFirstName] = useState(user?.full_name ? user.full_name.split(' ')[0] : "");
  const [ownerLastName, setOwnerLastName] = useState(user?.full_name ? user.full_name.split(' ').slice(1).join(' ') : "");
  const [teamName, setTeamName] = useState("");
  const [sportType, setSportType] = useState("");
  const [clubEmail, setClubEmail] = useState("");
  const [clubWebsite, setClubWebsite] = useState("");
  const [clubAddress, setClubAddress] = useState("");
  const [showSportsDropdown, setShowSportsDropdown] = useState(false);
  const [isCreatingClub, setIsCreatingClub] = useState(false);
  const [clubCreateError, setClubCreateError] = useState("");
  const [daiveError, setDaiveError] = useState<string | null>(null);

  const predefinedSports = [
    "AFL", "Basketball", "Cricket", "Dodgeball", "Football / Soccer", "Futsal",
    "Hockey", "Netball", "Rugby League", "Rugby Union", "Tennis", "Touch Football", "Volleyball"
  ];

  // PlayHQ state
  const [playhqUrl, setPlayhqUrl] = useState("");
  const [isImportingPlayhq, setIsImportingPlayhq] = useState(false);
  const [playhqImportError, setPlayhqImportError] = useState("");
  const [isPlayhqImported, setIsPlayhqImported] = useState(false);
  const [setupPath, setSetupPath] = useState<'playhq' | 'manual' | null>(null);
  
  const isPlayhq = clubInfo?.club_cat === 'PlayHQ';
  const [showPlayhqBox, setShowPlayhqBox] = useState(!isPlayhq);

  // Logo state
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Player state
  const [playerMode, setPlayerMode] = useState<'daive'|'manual'>('daive');
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nickname, setNickname] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [isMember, setIsMember] = useState(true);
  const [isSavingPlayer, setIsSavingPlayer] = useState(false);
  const [draftPlayers, setDraftPlayers] = useState<any[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);

  // Fixture state
  const [fixtureMode, setFixtureMode] = useState<'daive'|'manual'>('daive');
  const [opponent, setOpponent] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [location, setLocation] = useState("");
  const [isSavingFixture, setIsSavingFixture] = useState(false);
  const [draftFixtures, setDraftFixtures] = useState<any[]>([]);
  const [isExtractingFixture, setIsExtractingFixture] = useState(false);
  const [fixtureNeedsAlias, setFixtureNeedsAlias] = useState(false);
  const [fixtureDrawAlias, setFixtureDrawAlias] = useState("");
  const [fixtureCachedUpload, setFixtureCachedUpload] = useState<any>(null);

  // Financials state
  const initialMemberFeeRaw = (teams && teams.length > 0 && teams[0].member_fee != null) ? teams[0].member_fee : "";
  const initialMemberFee = initialMemberFeeRaw === 0 ? "" : initialMemberFeeRaw;
  const [memberFee, setMemberFee] = useState<number | "">(initialMemberFee);
  const [payIdType, setPayIdType] = useState<'mobile'|'email'|'bank_account'>(clubInfo?.pay_id_type || 'mobile');
  const [payId, setPayId] = useState(clubInfo?.pay_id_value || "");
  const [acceptsCash, setAcceptsCash] = useState(clubInfo?.accepts_cash ?? true);
  const [acceptsCard, setAcceptsCard] = useState(clubInfo?.accepts_card ?? true);
  const [expenseLabel, setExpenseLabel] = useState(clubInfo?.expense_label || "");
  const initialUmpireFeeRaw = clubInfo?.default_umpire_fee;
  const initialUmpireFee = (initialUmpireFeeRaw == null || initialUmpireFeeRaw === 0) ? "" : initialUmpireFeeRaw;
  const [defaultUmpireFee, setDefaultUmpireFee] = useState<number | "">(initialUmpireFee);

  const [squareToken, setSquareToken] = useState(clubInfo?.square_access_token || "");
  const [squareLocationId, setSquareLocationId] = useState(clubInfo?.square_location_id || "");
  const [seasonName, setSeasonName] = useState(clubInfo?.season_name || "");
  const [seasonStart, setSeasonStart] = useState(clubInfo?.season_start || "");
  const [seasonEnd, setSeasonEnd] = useState(clubInfo?.season_end || "");
  const [isSavingSeason, setIsSavingSeason] = useState(false);
  const [isSavingFinancials, setIsSavingFinancials] = useState(false);

  useEffect(() => {
    if (clubInfo) {
      setPayIdType(clubInfo.pay_id_type || 'mobile');
      setPayId(clubInfo.pay_id_value || "");
      setAcceptsCash(clubInfo.accepts_cash ?? true);
      setAcceptsCard(clubInfo.accepts_card ?? true);
      setExpenseLabel(clubInfo.expense_label || "");
      setDefaultUmpireFee((clubInfo.default_umpire_fee == null || clubInfo.default_umpire_fee === 0) ? "" : clubInfo.default_umpire_fee);
      setSquareToken(clubInfo.square_access_token || "");
      setSquareLocationId(clubInfo.square_location_id || "");
      setSeasonName(clubInfo.season_name || "");
      setSeasonStart(clubInfo.season_start || "");
      setSeasonEnd(clubInfo.season_end || "");

      if (activeClubId && setupPath === null) {
        if (isPlayhq) {
          setSetupPath('playhq');
        } else {
          setSetupPath('manual');
        }
      }
    }
  }, [clubInfo, activeClubId, setupPath, isPlayhq]);

  const teamId = teams && teams.length > 0 ? teams[0].id : null;

  const [loadingText, setLoadingText] = useState("");

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isExtracting || isExtractingFixture) {
      const messages = ["Reading terrible handwriting...", "Crunching the data...", "Formatting names...", "Almost ready..."];
      let i = 0;
      setLoadingText(messages[0]);
      interval = setInterval(() => { 
        i = (i + 1) % messages.length;
        setLoadingText(messages[i]); 
      }, 2500); 
    }
    return () => clearInterval(interval);
  }, [isExtracting, isExtractingFixture]);

  useEffect(() => {
    async function checkStatus() {
      if (!activeClubId) {
        setLoading(false);
        return;
      }
      const { count: playerCount } = await supabase.from('players').select('*', { count: 'exact', head: true }).eq('club_id', activeClubId);
      const { count: fixtureCount } = await supabase.from('fixtures').select('*', { count: 'exact', head: true }).eq('club_id', activeClubId);
      
      setHasPlayers((playerCount || 0) > 0);
      setHasFixtures((fixtureCount || 0) > 0);
      setLoading(false);
    }
    checkStatus();
  }, [activeClubId]);

  const hasSeason = !!clubInfo?.season_name && !!clubInfo?.season_start && !!clubInfo?.season_end && clubInfo?.default_umpire_fee != null && teamsCount > 0 && memberFee !== "";
  const hasLogo = !!clubInfo?.logo;
  const hasTeams = teamsCount > 0;
  const hasFinancials = !!clubInfo?.pay_id_value || !!clubInfo?.square_access_token;

  const steps = [
    { id: 'club', title: 'Create Your Team', icon: 'fa-flag', completed: !!activeClubId, required: true },
    { id: 'logo', title: 'Upload Club Logo', icon: 'fa-image', completed: !!clubInfo?.logo, required: false },
    { id: 'players', title: 'Add Players', icon: 'fa-users', completed: hasPlayers, required: true },
    { id: 'season', title: 'Season Setup', icon: 'fa-calendar', completed: hasSeason, required: true },
    { id: 'fixtures', title: 'Add Fixtures', icon: 'fa-list-ol', completed: hasFixtures, required: false },
    { id: 'financials', title: 'Payment Methods', icon: 'fa-sack-dollar', completed: hasFinancials, required: true }
  ];

  const advanceToNextUncompleted = (afterStepId: string) => {
    const startIndex = steps.findIndex(s => s.id === afterStepId);
    if (startIndex === -1) return;
    for (let i = startIndex + 1; i < steps.length; i++) {
      if (!steps[i].completed && steps[i].id !== afterStepId) {
        setExpandedStep(steps[i].id);
        return;
      }
    }
    for (let i = 0; i < startIndex; i++) {
      if (!steps[i].completed && steps[i].id !== afterStepId) {
        setExpandedStep(steps[i].id);
        return;
      }
    }
    setExpandedStep(null);
  };

  const visibleSteps = steps.filter(s => {
    if (isPlayhqImported || isPlayhq) {
       if (['club', 'logo', 'fixtures'].includes(s.id)) return false;
    }
    if (setupPath === 'playhq') {
       if (!['players', 'season', 'financials'].includes(s.id)) return false;
       return true;
    } else {
       if (!activeClubId && s.id !== 'club') return false;
       if (s.id === 'logo' && dismissedSteps['logo']) return false;
       if (s.id === 'fixtures' && dismissedSteps['fixtures']) return false;
       return true;
    }
  });
  
  const allCompleted = visibleSteps.every(s => s.completed) && visibleSteps.length > 0;

  useEffect(() => {
    if (allCompleted) {
      const timer = setTimeout(() => {
        onDismiss();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [allCompleted, onDismiss]);

  const handlePlayhqImport = async () => {
    if (!playhqUrl) return;
    setIsImportingPlayhq(true);
    setPlayhqImportError("");
    try {
      const res = await fetch("/api/playhq-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: playhqUrl }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to import from PlayHQ");
      }
      const data = await res.json();
      
      let currentClubId = activeClubId;
      let currentTeamId = teamId;

      if (!currentClubId) {
        if (!user) throw new Error("Not logged in");
        await supabase.from('profiles').update({ has_onboarded: true }).eq('id', user.id);

        const baseSlug = data.clubName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        const clubSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
        
        let playhqTenant = null;
        let playhqOrgId = null;
        try {
          const urlObj = new URL(playhqUrl);
          const parts = urlObj.pathname.split('/').filter(Boolean);
          playhqTenant = parts[0];
          playhqOrgId = parts[3];
        } catch(e) {}

        const { data: clubData, error: clubError } = await supabase
          .from('clubs').insert([{ 
            name: data.clubName, owner_id: user.id, slug: clubSlug, is_club: false, club_cat: "PlayHQ", entity_type: "Team", sport_type: "Other",
            logo_url: data.logoUrl || null,
            season_name: data.seasonName || null,
            season_start: data.seasonStart || null,
            season_end: data.seasonEnd || null,
            default_casual_fee: null,
            default_member_fee: null,
            default_umpire_fee: null,
            expense_label: null,
            income_label: null,
            settings: { playhq_tenant: playhqTenant, playhq_org_id: playhqOrgId }
          }]).select().single();
        if (clubError) throw clubError;
        currentClubId = clubData.id;

        const { data: teamData, error: teamError } = await supabase
          .from('teams').insert([{ 
            name: data.clubName, club_id: clubData.id, owner_id: user.id, slug: `${clubSlug}-team`,
            member_fee: null,
            casual_fee: null,
            settings: { playhq_url: playhqUrl }
          }]).select().single();
        if (teamError) throw teamError;
        currentTeamId = teamData.id;

        const { error: rolesError } = await supabase.from('user_roles').insert([
            { user_id: user.id, email: user.email, club_id: clubData.id, role: 'club_admin' },
            { user_id: user.id, email: user.email, club_id: clubData.id, team_id: teamData.id, role: 'team_admin' }
        ]);
        if (rolesError) throw rolesError;

        if (onClubCreated) onClubCreated(clubData.id);
      } else {
        if (data.logoUrl && !clubInfo?.logo_url) {
           await supabase.from('clubs').update({ logo_url: data.logoUrl }).eq('id', currentClubId);
           if (onUpdateClubInfo) {
             onUpdateClubInfo({ ...clubInfo, logo: data.logoUrl });
           } else if (clubInfo) {
             clubInfo.logo = data.logoUrl;
           }
        }
      }

      if (data.seasonName || data.seasonStart || data.seasonEnd) {
        const updatePayload: any = {};
        if (data.seasonName) updatePayload.season_name = data.seasonName;
        if (data.seasonStart) updatePayload.season_start = data.seasonStart;
        if (data.seasonEnd) updatePayload.season_end = data.seasonEnd;
        // Ensure default umpire fee is wiped if we are syncing PlayHQ
        updatePayload.default_umpire_fee = null;

        await supabase.from('clubs').update(updatePayload).eq('id', currentClubId);
        
        if (onUpdateClubInfo) {
          onUpdateClubInfo({ 
            ...clubInfo, 
            ...updatePayload
          });
        }
        if (data.seasonName) setSeasonName(data.seasonName);
        if (data.seasonStart) setSeasonStart(data.seasonStart);
        if (data.seasonEnd) setSeasonEnd(data.seasonEnd);
        setDefaultUmpireFee("");
      }

      if (data.fixtures && data.fixtures.length > 0) {
        if (!currentTeamId) {
          const { data: tData } = await supabase.from('teams').select('id').eq('club_id', currentClubId).limit(1);
          if (tData && tData.length > 0) currentTeamId = tData[0].id;
        }

        if (currentTeamId) {
            const payload = data.fixtures.map((f: any) => ({
              club_id: currentClubId,
              team_id: currentTeamId,
              opponent: f.opponent,
              opponent_logo_url: f.opponent_logo_url || null,
              match_date: f.match_date,
              start_time: f.start_time,
              location: f.location,
              status: 'scheduled',
              umpire_fee: clubInfo?.default_umpire_fee || 0,
              season_name: clubInfo?.season_name || seasonName || null
            }));
            await supabase.from('fixtures').insert(payload);
           setHasFixtures(true);
        }
      }

      setIsPlayhqImported(true);
      setSetupPath('playhq');
      setShowPlayhqBox(false);
      setExpandedStep('season');
      setPlayhqUrl("");

    } catch (err: any) {
      console.error(err);
      setPlayhqImportError(err.message || "An error occurred.");
    } finally {
      setIsImportingPlayhq(false);
    }
  };

  const handleCreateClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerFirstName || !ownerLastName || !teamName || !sportType || !user) {
      setClubCreateError("Please fill in all fields");
      return;
    }
    setIsCreatingClub(true);
    setClubCreateError("");

    try {
      if (user.full_name !== `${ownerFirstName} ${ownerLastName}`) {
        await supabase.auth.updateUser({ data: { full_name: `${ownerFirstName} ${ownerLastName}` } });
      }
      await supabase.from('profiles').update({ has_onboarded: true, full_name: `${ownerFirstName} ${ownerLastName}` }).eq('id', user.id);

      const baseSlug = teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      const clubSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
      
      const { data: clubData, error: clubError } = await supabase
        .from('clubs').insert([{ 
          name: teamName, owner_id: user.id, slug: clubSlug, is_club: false, club_cat: "Other", entity_type: "Team", sport_type: sportType,
          settings: { public_email: clubEmail || null, public_website: clubWebsite || null, public_address: clubAddress || null },
          season_name: null, default_casual_fee: null, default_member_fee: null, default_umpire_fee: null, expense_label: null, income_label: null
        }]).select().single();
      if (clubError) throw clubError;

      const { data: teamData, error: teamError } = await supabase
        .from('teams').insert([{ 
          name: teamName, club_id: clubData.id, owner_id: user.id, slug: `${clubSlug}-team`,
          member_fee: null, casual_fee: null
        }]).select().single();
      if (teamError) throw teamError;

      const { error: rolesError } = await supabase
        .from('user_roles').insert([
          { user_id: user.id, email: user.email, club_id: clubData.id, role: 'club_admin' },
          { user_id: user.id, email: user.email, club_id: clubData.id, team_id: teamData.id, role: 'team_admin' }
        ]);
      if (rolesError) throw rolesError;

      if (onClubCreated) {
        onClubCreated(clubData.id);
      }
    } catch (err: any) {
      console.error(err);
      setClubCreateError(err.message || "An error occurred.");
    } finally {
      setIsCreatingClub(false);
    }
  };

  const cropAndCompressImage = async (file: File): Promise<File> => {
    try {
      if (typeof createImageBitmap !== 'undefined') {
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement("canvas");
        const size = Math.min(bitmap.width, bitmap.height);
        canvas.width = 300; canvas.height = 300;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const startX = (bitmap.width - size) / 2; const startY = (bitmap.height - size) / 2;
          ctx.drawImage(bitmap, startX, startY, size, size, 0, 0, 300, 300);
          return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
              if (blob) resolve(new File([blob], file.name, { type: "image/jpeg" }));
              else reject("Blob error");
            }, "image/jpeg", 0.7);
          });
        }
      }
    } catch (e) {
      console.warn("createImageBitmap failed, falling back to legacy", e);
    }
    
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement("canvas");
        const size = Math.min(img.width, img.height);
        canvas.width = 300; canvas.height = 300;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject("Canvas error");
        const startX = (img.width - size) / 2; const startY = (img.height - size) / 2;
        ctx.drawImage(img, startX, startY, size, size, 0, 0, 300, 300);
        canvas.toBlob((blob) => {
          if (blob) resolve(new File([blob], file.name, { type: "image/jpeg" }));
          else reject("Blob error");
        }, "image/jpeg", 0.7);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    try {
      const processedFile = await cropAndCompressImage(file);
      const fileName = `${activeClubId}-logo-${Math.random()}.webp`;
      const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, processedFile);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
      
      const { error } = await supabase.from('clubs').update({ logo_url: data.publicUrl }).eq('id', activeClubId);
      if (error) throw error;
      
      // Update local state instantly so GameDay header updates and the checkmark appears
      if (onUpdateClubInfo) {
        onUpdateClubInfo({ ...clubInfo, logo: data.publicUrl });
      } else {
        clubInfo.logo = data.publicUrl;
      }

      advanceToNextUncompleted('logo');
    } catch (err) {
      console.error(err);
      alert("Error uploading logo");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const fileToBase64 = (f: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(f);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const getOrCreateTeam = async (): Promise<string | null> => {
    if (teamId) return teamId;
    
    // First, fallback to query
    const { data } = await supabase.from('teams').select('id').eq('club_id', activeClubId).limit(1);
    if (data && data.length > 0) {
      return data[0].id;
    }

    if (!activeClubId || !user) return null;

    // Still no team? Create one!
    try {
       const clubSlug = clubInfo?.slug || `club-${activeClubId.substring(0,6)}`;
       const { data: teamData, error: teamError } = await supabase
        .from('teams').insert([{ 
          name: `${clubInfo?.name || 'Club'} First Team`, club_id: activeClubId, owner_id: user.id, slug: `${clubSlug}-team`
        }]).select().single();
       if (teamError) throw teamError;

       // Also insert role for this team
       await supabase.from('user_roles').insert([
          { user_id: user.id, email: user.email, club_id: activeClubId, team_id: teamData.id, role: 'team_admin' }
       ]);
       
       return teamData.id;
    } catch (err) {
       console.error("Failed to auto-create team", err);
       return null;
    }
  };

  const compressImage = async (file: File): Promise<string> => {
    try {
      if (typeof createImageBitmap !== 'undefined') {
        const bitmap = await createImageBitmap(file, { resizeWidth: 1000 });
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0);
          return canvas.toDataURL('image/jpeg', 0.6);
        }
      }
    } catch (e) {
      console.warn("createImageBitmap failed, falling back to legacy", e);
    }
    
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000; 
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
    });
  };

  // --- PLAYERS ---
  const handleDaiveUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setDaiveError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    let targetTeamId = await getOrCreateTeam();

    if (!targetTeamId) {
      setDaiveError("Error: No team found to attach players to. Please save the club settings and refresh.");
      return;
    }

    setIsExtracting(true);
    try {
      let payload: any = {};
      if (file.type.startsWith('image/')) {
        payload.fileBase64 = await compressImage(file);
        payload.mimeType = 'image/jpeg';
      } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        if (file.size > 5 * 1024 * 1024) throw new Error("PDF must be smaller than 5MB.");
        payload.fileBase64 = await fileToBase64(file);
        payload.mimeType = 'application/pdf';
      } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        payload.csvText = await file.text();
      } else {
        throw new Error("Unsupported file format for inline dAIve. Try Image, PDF, or CSV.");
      }
      
      const res = await fetch("/api/extract-roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errStr = `Server Error: ${res.status}`;
        try {
          const errData = await res.json();
          errStr = errData.error || errStr;
        } catch(e) {
          if (res.status === 504) errStr = "The request timed out. Please try a smaller or clearer image.";
        }
        throw new Error(errStr);
      }

      const data = await res.json();
      
      if (data.players && Array.isArray(data.players) && data.players.length > 0) {
        setDraftPlayers(data.players.map((p: any) => ({
          first_name: p.firstName || p.first_name || "",
          last_name: p.lastName || p.last_name || "",
          nickname: p.nickname || "",
          mobile_number: p.mobile || p.mobile_number || "",
          email: p.email || "",
          is_member: p.is_member ?? true 
        })));
      } else {
        setDaiveError(data.error || "We couldn't extract any players from that file. Please make sure the image is clear and contains a list of names.");
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = typeof err === 'string' ? err : (err.message || "Couldn't process the file.");
      if (errMsg.includes("Unexpected token") || errMsg.includes("JSON")) {
        errMsg = "Server returned an invalid response. The file might be too large or the server timed out.";
      } else if (errMsg.includes("err") || errMsg.includes("Event")) {
        errMsg = "Failed to load image. If you are using an iPhone HEIC photo or an unsupported screenshot format, please convert to JPEG or upload a PDF.";
      }
      setDaiveError(errMsg);
    } finally {
      setIsExtracting(false);
      e.target.value = '';
    }
  };

  const updateDraftPlayer = (index: number, field: string, value: any) => {
    const updated = [...draftPlayers];
    updated[index] = { ...updated[index], [field]: value };
    setDraftPlayers(updated);
  };

  const removeDraftPlayer = (index: number) => {
    setDraftPlayers(draftPlayers.filter((_, i) => i !== index));
  };

  const saveBulkPlayers = async () => {
    const targetTeamId = await getOrCreateTeam();
    if (draftPlayers.length === 0) return;
    if (!targetTeamId) {
      alert("Error: Could not find or automatically create a team for this club. Please go to Setup and manually create a team.");
      return;
    }
    setIsSavingPlayer(true);
    const payload = draftPlayers.map(p => ({ 
      first_name: p.firstName || p.first_name,
      last_name: p.lastName || p.last_name || "",
      nickname: p.nickname || null,
      email: p.email || null,
      mobile_number: p.mobile_number || null,
      is_member: true,
      club_id: activeClubId,
      default_team_id: targetTeamId, 
    }));

    const { error } = await supabase.from("players").insert(payload);
    setIsSavingPlayer(false);
    if (!error) {
      setHasPlayers(true);
      advanceToNextUncompleted('players');
      setDraftPlayers([]);
    } else {
      alert("Error saving players");
    }
  };

  const handleSavePlayerManual = async (e?: React.MouseEvent) => {
    if(e) e.preventDefault();
    const targetTeamId = await getOrCreateTeam();
    if (!firstName) return;
    if (!targetTeamId) {
      alert("Error: Could not find or automatically create a team. Please go to Setup and manually create a team.");
      return;
    }
    setIsSavingPlayer(true);
    const { error } = await supabase.from('players').insert([{
      club_id: activeClubId,
      default_team_id: targetTeamId,
      first_name: firstName,
      last_name: lastName,
      nickname: nickname || null,
      mobile_number: mobileNumber || null,
      email: emailAddress || null,
      is_member: isMember
    }]);
    setIsSavingPlayer(false);
    if (!error) {
      setHasPlayers(true);
      advanceToNextUncompleted('players');
    } else {
      alert("Error saving player: " + error.message);
    }
  };

  // --- FIXTURES ---
  const runFixtureExtraction = async (payload: any, searchName: string) => {
    setIsExtractingFixture(true);
    setFixtureNeedsAlias(false);
    try {
      const res = await fetch("/api/extract-fixtures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, teamName: searchName }),
      });

      const data = await res.json();
      
      if (!res.ok || data.error) {
        throw new Error(data.error || `Server Error: ${res.status}`);
      }

      if (data.fixtures && Array.isArray(data.fixtures)) {
        if (data.fixtures.length === 0) {
          setFixtureNeedsAlias(true);
        } else {
          setDraftFixtures(data.fixtures.map((f: any) => ({
            opponent: f.opponent || f.opponentName || "",
            match_date: f.date || f.match_date || "",
            start_time: f.time || f.start_time || "",
            location: f.location || f.venue || ""
          })));
        }
      } else {
        setDaiveError("We couldn't extract any matches from that file. Please make sure the image is clear and contains a fixture list.");
      }
    } catch (error: any) {
      console.error("Extraction error:", error);
      setDaiveError(error.message || "Couldn't parse the draw. Switch to manual.");
    } finally {
      setIsExtractingFixture(false);
    }
  };

  const handleDaiveFixtureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setDaiveError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    let targetTeamId = await getOrCreateTeam();

    if (!targetTeamId) {
      setDaiveError("Error: No team found to attach fixtures to. Please refresh.");
      return;
    }

    const teamName = teams.find(t => t.id === targetTeamId)?.name || "";

    try {
      let payload: any = {};

      if (file.type.startsWith('image/')) {
        payload.fileBase64 = await compressImage(file);
        payload.mimeType = 'image/jpeg';
      } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        if (file.size > 5 * 1024 * 1024) throw new Error("PDF must be smaller than 5MB.");
        payload.fileBase64 = await fileToBase64(file);
        payload.mimeType = 'application/pdf';
      } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        payload.csvText = await file.text();
      } else {
        throw new Error("Unsupported file format.");
      }
      
      setFixtureCachedUpload(payload);
      await runFixtureExtraction(payload, teamName);

    } catch (error: any) {
      console.error(error);
      setDaiveError(error.message || "Couldn't process the file.");
    } finally {
      e.target.value = ''; 
    }
  };

  const updateDraftFixture = (index: number, field: string, value: any) => {
    const updated = [...draftFixtures];
    updated[index] = { ...updated[index], [field]: value };
    setDraftFixtures(updated);
  };

  const removeDraftFixture = (index: number) => {
    setDraftFixtures(draftFixtures.filter((_, i) => i !== index));
  };

  const saveBulkFixtures = async () => {
    const targetTeamId = await getOrCreateTeam();
    const validFixtures = draftFixtures.filter(f => f.opponent.trim() !== "" && f.match_date);
    if (validFixtures.length === 0) return alert("No valid fixtures to save.");
    if (!targetTeamId) return alert("Error: Could not find or automatically create a team for this club.");
    
    setIsSavingFixture(true);
    const payload = validFixtures.map(f => ({ 
      ...f, 
      team_id: targetTeamId, 
      club_id: activeClubId,
      umpire_fee: clubInfo?.default_umpire_fee || 0 
    }));

    const { error } = await supabase.from("fixtures").insert(payload);
    
    setIsSavingFixture(false);
    if (error) {
      alert(error.message);
    } else { 
      setHasFixtures(true);
      setDraftFixtures([]); 
      setFixtureNeedsAlias(false);
      setFixtureCachedUpload(null);
      setFixtureDrawAlias("");
      advanceToNextUncompleted('fixtures');
    }
  };

  const handleSaveFixtureManual = async (e?: React.MouseEvent) => {
    if(e) e.preventDefault();
    const targetTeamId = await getOrCreateTeam();
    if (!opponent || !matchDate) return;
    if (!targetTeamId) {
      alert("Error: Could not find or automatically create a team.");
      return;
    }
    setIsSavingFixture(true);
    const { error } = await supabase.from('fixtures').insert([{
      club_id: activeClubId,
      team_id: targetTeamId,
      opponent,
      match_date: matchDate,
      start_time: startTime,
      location: location,
      status: 'scheduled',
      season_name: clubInfo?.season_name || seasonName || null
    }]);
    setIsSavingFixture(false);
    if (!error) {
      setHasFixtures(true);
      advanceToNextUncompleted('fixtures');
    } else {
      alert("Error saving fixture: " + error.message);
    }
  };

  // --- SEASON DETAILS ---
  const handleSaveSeason = async (e?: React.MouseEvent) => {
    if(e) e.preventDefault();
    const targetTeamId = await getOrCreateTeam();
    setIsSavingSeason(true);
    
    // Save team-level defaults if team exists
    if (targetTeamId) {
      await supabase.from('teams').update({ 
        member_fee: memberFee !== "" ? memberFee : null
      }).eq('id', targetTeamId);
    }

    // Save club-level season & defaults
    const { data: clubData, error: clubError } = await supabase.from('clubs').update({ 
      season_name: seasonName || null,
      season_start: seasonStart || null,
      season_end: seasonEnd || null,
      expense_label: expenseLabel || null,
      default_umpire_fee: defaultUmpireFee !== "" ? defaultUmpireFee : null
    }).eq('id', activeClubId).select();
    
    setIsSavingSeason(false);
    
    if (clubError) {
      alert("Failed to save club season settings: " + clubError.message);
      return;
    }
    
    if (!clubData || clubData.length === 0) {
      alert("Error: Database rejected the season update. Permission denied or club not found.");
      return;
    }

    if (seasonName) {
      // Run background update queries to backfill any existing untagged fixtures/transactions
      await Promise.all([
        supabase.from('fixtures').update({ season_name: seasonName }).in('team_id', teams.map(t => t.id)).is('season_name', null),
        supabase.from('transactions').update({ season_name: seasonName }).eq('club_id', activeClubId).is('season_name', null)
      ]);
    }
    
    if (onUpdateClubInfo) {
      onUpdateClubInfo({ 
        ...clubInfo, 
        season_name: seasonName || null,
        season_start: seasonStart || null,
        season_end: seasonEnd || null,
        expense_label: expenseLabel || null,
        default_umpire_fee: defaultUmpireFee !== "" ? defaultUmpireFee : null
      });
    } else {
      clubInfo.season_name = seasonName || null;
      clubInfo.expense_label = expenseLabel || null;
      clubInfo.default_umpire_fee = defaultUmpireFee !== "" ? defaultUmpireFee : null;
    }
    
    setIsSavingSeason(false);
    advanceToNextUncompleted('season');
  };

  // --- FINANCIALS ---
  const handleSaveFinancials = async (e?: React.MouseEvent) => {
    if(e) e.preventDefault();
    setIsSavingFinancials(true);
    
    const { data: finData, error: finError } = await supabase.from('clubs').update({ 
      pay_id_type: payIdType,
      pay_id_value: payId || null,
      accepts_cash: acceptsCash,
      accepts_card: acceptsCard,
      square_access_token: squareToken || null,
      square_location_id: squareLocationId || null
    }).eq('id', activeClubId).select();
    
    if (finError) {
      alert("Failed to save financial settings: " + finError.message);
      setIsSavingFinancials(false);
      return;
    }

    if (!finData || finData.length === 0) {
      alert("Error: Database rejected the financial update. Permission denied or club not found.");
      setIsSavingFinancials(false);
      return;
    }
    
    // Mutate local object so it checks off
    if (onUpdateClubInfo) {
      onUpdateClubInfo({ 
        ...clubInfo, 
        pay_id_value: payId || null, 

        pay_id_type: payIdType,
        square_access_token: squareToken || null,
        square_location_id: squareLocationId || null
      });
    } else {
      clubInfo.pay_id_type = payIdType;
      clubInfo.pay_id_value = payId || null;
      clubInfo.accepts_cash = acceptsCash;
      clubInfo.accepts_card = acceptsCard;
    }
    
    setIsSavingFinancials(false);
    advanceToNextUncompleted('financials');
  };

  if (loading) return null;



  return (
    <div className="mb-8 animate-in slide-in-from-top-4 relative">
      <div className="flex justify-center items-center mb-6 text-center">
        <div>
          <h3 className={`font-black text-xl mb-1 flex items-center justify-center gap-2 ${isPlayhqImported || isPlayhq ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-900 dark:text-white'}`}>
            {isPlayhqImported || isPlayhq 
              ? 'Success!' 
              : setupPath === 'playhq' 
                ? 'Import from PlayHQ' 
                : 'Get Started'}
          </h3>
          <p className="text-sm font-bold text-zinc-500">
            {isPlayhqImported || isPlayhq
              ? 'Your team & fixtures have been successfully added from PlayHQ. Now add your Players and Financial Settings to complete your setup.'
              : setupPath === 'playhq' 
                ? 'Paste your public team URL to instantly fetch your team logo and upcoming fixtures.' 
                : 'Set up your account with teams, fixtures, players and payment methods.'}
          </p>
        </div>
      </div>

      {!setupPath ? (
        <div className="flex flex-col gap-3 mb-6">
          <button onClick={() => setSetupPath('playhq')} className="group relative flex items-center p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:border-[#0051e5] hover:shadow-md transition-all text-left w-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-[#0051e5]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative h-14 w-14 rounded-full flex items-center justify-center bg-white border border-zinc-100 dark:border-zinc-800 shadow-sm mr-4 shrink-0 group-hover:scale-105 transition-transform">
              <img src="/branding/playhq_Logo.svg" alt="PlayHQ" className="w-8 h-8 object-contain" />
            </div>
            <div className="flex-1 relative">
              <h3 className="font-black text-sm text-zinc-900 dark:text-white uppercase tracking-widest mb-1 group-hover:text-[#0051e5] transition-colors">PlayHQ Setup</h3>
              <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 leading-snug">Quick start using your public PlayHQ team url.</p>
            </div>
            <i className="fa-solid fa-chevron-right text-zinc-300 dark:text-zinc-700 group-hover:text-[#0051e5] transition-colors ml-4 text-lg"></i>
          </button>

          <button onClick={() => setSetupPath('manual')} className="group relative flex items-center p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:border-emerald-500 hover:shadow-md transition-all text-left w-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative h-14 w-14 rounded-full overflow-hidden flex items-center justify-center bg-[#09B67A] border border-zinc-100 dark:border-zinc-800 shadow-sm mr-4 shrink-0 group-hover:scale-105 transition-transform">
              <img src="/branding/icon-192.png" alt="Fees Please" className="w-full h-full object-cover scale-[0.85]" />
            </div>
            <div className="flex-1 relative">
              <h3 className="font-black text-sm text-zinc-900 dark:text-white uppercase tracking-widest mb-1 group-hover:text-emerald-600 transition-colors">Standard Setup</h3>
              <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 leading-snug">Set up your account fast with Fees Please.</p>
            </div>
            <i className="fa-solid fa-chevron-right text-zinc-300 dark:text-zinc-700 group-hover:text-emerald-500 transition-colors ml-4 text-lg"></i>
          </button>
        </div>
      ) : (
        <>
            {!isPlayhq && !activeClubId && (
              <div className="flex items-center justify-between mb-4">
                 <button onClick={() => setSetupPath(null)} className="text-[10px] font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 uppercase tracking-widest transition-colors flex items-center">
                   <i className="fa-solid fa-arrow-left mr-1"></i> Back
                 </button>
                 {setupPath === 'playhq' && !showPlayhqBox && (
                   <button onClick={() => setShowPlayhqBox(true)} className="text-[10px] font-bold text-zinc-400 hover:text-[#0051e5] uppercase tracking-widest transition-colors flex items-center">
                     <i className="fa-solid fa-rotate-right mr-1"></i> Resync PlayHQ
                   </button>
                 )}
              </div>
            )}
            
            {setupPath === 'playhq' && showPlayhqBox && (
              <div className="mb-6">
                 {activeClubId && (
                   <div className="flex justify-end mb-2">
                     <button onClick={() => setShowPlayhqBox(false)} className="text-zinc-400 hover:text-zinc-600 transition-colors">
                       <i className="fa-solid fa-xmark"></i>
                     </button>
                   </div>
                 )}
                 {isImportingPlayhq ? (
                   <div className="flex flex-col items-center justify-center py-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm text-center">
                     <div className="relative h-16 w-16 mb-4 flex items-center justify-center">
                       <div className="absolute inset-0 bg-[#0051e5]/20 rounded-full animate-ping"></div>
                       <div className="relative bg-white h-12 w-12 rounded-full flex items-center justify-center shadow-sm border border-zinc-100 dark:border-zinc-800 z-10">
                         <img src="/branding/playhq_Logo.svg" alt="PlayHQ" className="h-8 w-8 object-contain animate-pulse" />
                       </div>
                     </div>
                     <h4 className="font-black text-sm text-[#0051e5] uppercase tracking-widest mb-1">Importing team from PlayHQ</h4>
                     <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Fetching logo and fixtures...</p>
                   </div>
                 ) : (
                   <div className="flex flex-col gap-2">
                     <input type="url" value={playhqUrl} onChange={e => setPlayhqUrl(e.target.value)} placeholder="Paste PlayHQ Team URL..." className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:border-[#0051e5] transition-colors shadow-sm" />
                     <div className="text-center mb-1">
                       <span className="text-[10px] font-bold text-zinc-400">Example reference: </span>
                       <a href="https://www.playhq.com/cricket-australia/org/ferny-districts-cricket-club/462e4428/senior-competition-winter-2026/teams/ferny-districts-bin-chickens/b7cf852d" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-[#0051e5] hover:underline">
                         Ferny Districts Bin Chickens
                       </a>
                     </div>
                     <button onClick={handlePlayhqImport} disabled={!playhqUrl} className="relative overflow-hidden w-full py-3 bg-[#0051e5] hover:bg-[#0041b5] text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50 shadow-sm">
                       Import Team
                     </button>
                   </div>
                 )}
                 {playhqImportError && <p className="text-red-500 text-[10px] font-bold mt-2 text-center">{playhqImportError}</p>}
              </div>
            )}

      {(setupPath !== 'playhq' || isPlayhqImported || activeClubId) && (
        <div className="space-y-3">
          {visibleSteps.map(step => (
            <div key={step.id} className={`flex flex-col p-4 rounded-xl border transition-colors ${step.completed ? 'bg-emerald-600 border-emerald-700 shadow-sm' : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${step.completed ? 'bg-white text-emerald-600 shadow-sm' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400'}`}>
                  {step.completed ? <i className="fa-solid fa-check text-[10px]"></i> : <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500"></span>}
                </div>
                <span className={`text-sm font-bold ${step.completed ? 'text-white' : 'text-zinc-900 dark:text-white'}`}>
                  {step.title}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setDismissedSteps(prev => ({ ...prev, [step.id]: true }));
                    if (expandedStep === step.id) setExpandedStep(null);
                  }}
                  title="Dismiss step"
                  className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${step.completed ? 'text-emerald-100 hover:text-white hover:bg-emerald-700' : 'text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
                >
                  <i className="fa-solid fa-xmark text-sm"></i>
                </button>
                <button 
                  onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                  title={expandedStep === step.id ? "Collapse" : "Expand"}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${expandedStep === step.id ? (step.completed ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400') : (step.completed ? 'text-emerald-100 hover:bg-emerald-700 hover:text-white' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20')}`}
                >
                  <i className={`fa-solid fa-chevron-${expandedStep === step.id ? 'up' : 'down'} text-xs`}></i>
                </button>
              </div>
            </div>

            {/* Inline expansion area */}
            {expandedStep === step.id && (
              <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700 animate-in slide-in-from-top-2">
                
                {/* Club Setup Inline */}
                {step.id === 'club' && !activeClubId && (
                  <form onSubmit={handleCreateClub} className="space-y-4">
                    <div>
                      <h4 className="text-xs text-zinc-500 uppercase font-black tracking-widest mb-4">Your Details</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2 ml-1">First Name</label>
                          <input type="text" value={ownerFirstName} onChange={(e) => setOwnerFirstName(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors shadow-sm" placeholder="First Name" required />
                        </div>
                        <div>
                          <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2 ml-1">Last Name</label>
                          <input type="text" value={ownerLastName} onChange={(e) => setOwnerLastName(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors shadow-sm" placeholder="Last Name" required />
                        </div>
                      </div>
                    </div>
                    <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800">
                      <h4 className="text-xs text-zinc-500 uppercase font-black tracking-widest mb-4">Team Details</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2 ml-1">Team Name</label>
                          <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors shadow-sm" placeholder="e.g. The Mighty Ducks" required />
                        </div>
                        <div className="relative">
                          <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2 ml-1">Sport Type</label>
                          <input type="text" value={sportType} onChange={(e) => { setSportType(e.target.value); setShowSportsDropdown(true); }} onFocus={() => setShowSportsDropdown(true)} onBlur={() => setTimeout(() => setShowSportsDropdown(false), 200)} placeholder="e.g. Football / Soccer" className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors shadow-sm" required />
                          {showSportsDropdown && (
                            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg max-h-48 overflow-y-auto py-2">
                              {predefinedSports.filter(s => s.toLowerCase().includes(sportType.toLowerCase())).map(s => (
                                <div key={s} className="px-4 py-2 text-sm font-bold text-zinc-900 dark:text-white hover:bg-emerald-50 dark:hover:bg-emerald-900/20 cursor-pointer transition-colors" onClick={() => { setSportType(s); setShowSportsDropdown(false); }}>{s}</div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2 ml-1">Email <span className="text-[10px] text-zinc-400 font-bold lowercase tracking-normal ml-1">(Optional)</span></label>
                          <input type="email" value={clubEmail} onChange={(e) => setClubEmail(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors shadow-sm" placeholder="e.g. contact@yourteam.com" />
                        </div>
                        <div>
                          <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2 ml-1">Website <span className="text-[10px] text-zinc-400 font-bold lowercase tracking-normal ml-1">(Optional)</span></label>
                          <input type="url" value={clubWebsite} onChange={(e) => setClubWebsite(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors shadow-sm" placeholder="e.g. https://yourteam.com" />
                        </div>
                        <div>
                          <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2 ml-1">Main Address <span className="text-[10px] text-zinc-400 font-bold lowercase tracking-normal ml-1">(Optional)</span></label>
                          <input type="text" value={clubAddress} onChange={(e) => setClubAddress(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors shadow-sm" placeholder="e.g. 123 Sports Court, City" />
                        </div>
                      </div>
                    </div>
                {clubCreateError && <div className="text-red-500 text-[10px] font-black uppercase tracking-widest text-center mt-2">{clubCreateError}</div>}
                <button type="submit" disabled={isCreatingClub} className="w-full py-4 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 mt-6 group">
                      {isCreatingClub ? "Setting up..." : "Let's Go"}
                    </button>
                  </form>
                )}
                {step.id === 'club' && activeClubId && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-xl flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-200 dark:bg-emerald-800 rounded-full flex items-center justify-center shrink-0">
                       <i className="fa-solid fa-check text-emerald-600 dark:text-emerald-400"></i>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-400">Club Created!</h4>
                      <p className="text-[9px] font-bold text-emerald-600/70 dark:text-emerald-500">Your team is set up. Continue below.</p>
                    </div>
                  </div>
                )}

                {/* Logo Upload Inline */}
                {step.id === 'logo' && (
                  <div className="relative group border-2 border-dashed border-emerald-500/50 dark:border-emerald-600/50 rounded-xl p-6 text-center hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors bg-white dark:bg-zinc-800 cursor-pointer">
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className="w-12 h-12 mx-auto bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm">
                      {isUploadingLogo ? <i className="fa-solid fa-circle-notch fa-spin text-xl text-emerald-600 dark:text-emerald-500"></i> : <i className="fa-solid fa-cloud-arrow-up text-xl text-emerald-600 dark:text-emerald-500"></i>}
                    </div>
                    <h3 className="font-black tracking-widest text-xs text-emerald-800 dark:text-emerald-400 mb-1">{isUploadingLogo ? 'Uploading...' : 'Tap to Upload Logo'}</h3>
                  </div>
                )}

                {/* Players Inline */}
                {step.id === 'players' && (
                  <div>
                      <div className="flex bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-1 mb-4 transition-colors">
                        <button onClick={() => setPlayerMode('daive')} className={`flex-1 py-3 text-xs font-black tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${playerMode === 'daive' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}>
                          <i className="fa-solid fa-wand-magic-sparkles"></i> SMART IMPORT
                        </button>
                        <button onClick={() => setPlayerMode('manual')} className={`flex-1 py-3 text-xs font-black tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${playerMode === 'manual' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}>
                          <i className="fa-solid fa-keyboard"></i> MANUAL
                        </button>
                      </div>

                    {playerMode === 'daive' ? (
                      draftPlayers.length === 0 ? (
                        isExtracting ? (
                          <div className="flex flex-col items-center justify-center py-12 animate-in fade-in duration-500 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
                            <i className="fa-solid fa-wand-magic-sparkles text-4xl text-emerald-500 animate-pulse mb-4"></i>
                            <p className="font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 animate-pulse text-xs text-center">{loadingText}</p>
                          </div>
                        ) : (
                          <div key="daive-upload" className="relative text-center p-8 border-2 border-dashed border-emerald-500/50 rounded-xl bg-white dark:bg-zinc-800 cursor-pointer hover:bg-emerald-50/50 transition-colors">
                            {daiveError && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold">{daiveError}</div>}
                            <input type="file" accept="image/*,.csv,.pdf" onChange={handleDaiveUpload} disabled={isExtracting} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                            <i className="fa-solid fa-wand-magic-sparkles text-3xl text-emerald-500 mb-3"></i>
                            <div className="flex flex-col items-center">
                              <p className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-400 mb-1">
                                Upload Image, PDF, or CSV
                              </p>
                              <p className="text-[10px] text-zinc-500 font-bold max-w-[220px] text-center leading-snug">
                                Upload a screenshot, photo, or CSV file of your team roster. Include email addresses if you have them.
                              </p>
                            </div>
                          </div>
                        )
                      ) : (
                        <div key="daive-results" className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                          <button 
                            onClick={() => setDraftPlayers([])} 
                            className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 uppercase tracking-widest transition-colors flex items-center mb-2"
                          >
                            <i className="fa-solid fa-arrow-left mr-2"></i> Upload Different File
                          </button>
                          
                          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col mb-4">
                            <div className="bg-zinc-900 dark:bg-black px-4 py-3 flex justify-between items-center text-white shrink-0">
                              <span className="font-black text-[10px] uppercase tracking-widest">Review Players</span>
                              <span className="font-bold text-[10px] uppercase tracking-widest text-emerald-400">{draftPlayers.length} Found</span>
                            </div>
                            
                            <div className="overflow-y-auto p-3 space-y-3 max-h-[40vh] bg-zinc-50 dark:bg-zinc-800/50">
                              {draftPlayers.map((p, i) => (
                                <div key={i} className="flex flex-col gap-2 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm relative">
                                  <button onClick={() => removeDraftPlayer(i)} className="absolute top-2 right-2 text-zinc-400 hover:text-red-500 transition-colors w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"><i className="fa-solid fa-xmark"></i></button>
                                  
                                  <div className="flex flex-col gap-2 pr-6">
                                    <div>
                                      <label className="block text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1">First Name</label>
                                      <input type="text" placeholder="First Name" value={p.first_name || p.firstName || ""} onChange={(e) => updateDraftPlayer(i, 'first_name', e.target.value)} className="w-full min-w-0 px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 dark:text-white transition-colors font-bold" />
                                    </div>
                                    <div>
                                      <label className="block text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1">Last Name</label>
                                      <input type="text" placeholder="Last Name" value={p.last_name || p.lastName || ""} onChange={(e) => updateDraftPlayer(i, 'last_name', e.target.value)} className="w-full min-w-0 px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 dark:text-white transition-colors font-bold" />
                                    </div>
                                    <div>
                                      <label className="block text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1">Nickname</label>
                                      <input type="text" placeholder="Nickname" value={p.nickname || ""} onChange={(e) => updateDraftPlayer(i, 'nickname', e.target.value)} className="w-full min-w-0 px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 dark:text-white transition-colors" />
                                    </div>
                                    <div>
                                      <label className="block text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1">Mobile</label>
                                      <input type="tel" placeholder="Mobile" value={p.mobile_number || ""} onChange={(e) => updateDraftPlayer(i, 'mobile_number', e.target.value)} className="w-full min-w-0 px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 dark:text-white transition-colors" />
                                    </div>
                                    <div>
                                      <label className="block text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1">Email</label>
                                      <input type="email" placeholder="Email" value={p.email || ""} onChange={(e) => updateDraftPlayer(i, 'email', e.target.value)} className="w-full min-w-0 px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 dark:text-white transition-colors" />
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between mt-1 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-800">
                                     <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">Status</span>
                                     <button 
                                       onClick={() => updateDraftPlayer(i, 'is_member', p.is_member === undefined ? false : !p.is_member)}
                                       className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors shadow-sm ${(p.is_member !== false) ? 'bg-emerald-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}
                                     >
                                       {(p.is_member !== false) ? 'MEMBER' : 'CASUAL'}
                                     </button>
                                  </div>
                                </div>
                              ))}
                              {draftPlayers.length === 0 && <div className="text-center py-6 text-zinc-400 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest">No players extracted</div>}
                            </div>
                          </div>

                          <button onClick={saveBulkPlayers} disabled={isSavingPlayer || draftPlayers.length === 0} className="w-full py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50">
                            {isSavingPlayer ? 'Saving...' : `Import ${draftPlayers.length} Players`}
                          </button>
                        </div>
                      )
                    ) : (
                      <div key="manual-entry" className="space-y-4">
                        <div className="flex flex-col gap-4">
                          <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2 ml-1">First Name</label>
                            <input type="text" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors shadow-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2 ml-1">Last Name</label>
                            <input type="text" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors shadow-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2 ml-1">Nickname</label>
                            <input type="text" placeholder="Nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors shadow-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2 ml-1">Mobile Number</label>
                            <input type="tel" placeholder="Mobile Number" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors shadow-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2 ml-1">Email Address</label>
                            <input type="email" placeholder="Email Address" value={emailAddress} onChange={(e) => setEmailAddress(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors shadow-sm" />
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 bg-zinc-50 dark:bg-zinc-800/50 transition-colors">
                           <span className="text-xs font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">Status</span>
                           <button 
                             onClick={() => setIsMember(!isMember)}
                             className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-colors shadow-sm ${isMember ? 'bg-emerald-600 text-white' : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'}`}
                           >
                             {isMember ? 'MEMBER' : 'CASUAL'}
                           </button>
                        </div>

                        <button disabled={isSavingPlayer || !firstName} onClick={handleSavePlayerManual} className="w-full py-4 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 mt-6">
                          {isSavingPlayer ? 'Saving...' : 'Add Player'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Fixtures Inline */}
                {step.id === 'fixtures' && (
                  <div>
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-1 mb-4 transition-colors">
                      <button onClick={() => setFixtureMode('daive')} className={`flex-1 py-3 text-xs font-black tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${fixtureMode === 'daive' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}>
                        <i className="fa-solid fa-wand-magic-sparkles"></i> SMART IMPORT
                      </button>
                      <button onClick={() => setFixtureMode('manual')} className={`flex-1 py-3 text-xs font-black tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${fixtureMode === 'manual' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}>
                        <i className="fa-solid fa-keyboard"></i> MANUAL
                      </button>
                    </div>

                    {fixtureMode === 'daive' ? (
                      draftFixtures.length === 0 ? (
                        !fixtureNeedsAlias ? (
                          isExtractingFixture ? (
                            <div className="flex flex-col items-center justify-center py-12 animate-in fade-in duration-500 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
                              <i className="fa-solid fa-wand-magic-sparkles text-4xl text-emerald-500 animate-pulse mb-4"></i>
                              <p className="font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 animate-pulse text-xs text-center">{loadingText}</p>
                            </div>
                          ) : (
                            <div key="daive-fixture-upload" className="relative text-center p-8 border-2 border-dashed border-emerald-500/50 rounded-xl bg-white dark:bg-zinc-800 cursor-pointer hover:bg-emerald-50/50 transition-colors">
                              {daiveError && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold">{daiveError}</div>}
                              <input type="file" accept="image/*,.csv,.pdf" onChange={handleDaiveFixtureUpload} disabled={isExtractingFixture} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                              <i className="fa-solid fa-wand-magic-sparkles text-3xl text-emerald-500 mb-3"></i>
                              <p className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-400">
                                Upload Master Draw (PDF/IMG/CSV)
                              </p>
                            </div>
                          )
                        ) : (
                          <div key="daive-fixture-alias" className="border border-orange-200 bg-orange-50 dark:bg-orange-900/10 p-5 rounded-xl">
                            <h3 className="font-black uppercase tracking-widest text-xs text-orange-800 dark:text-orange-400 mb-2">Team Not Found</h3>
                            <p className="text-[10px] font-bold text-orange-600/70 dark:text-orange-500 uppercase tracking-widest mb-3">Did they use an abbreviation on the draw?</p>
                            
                            <div className="flex flex-col gap-2">
                              <input type="text" placeholder="e.g. Ferny Dist 1" value={fixtureDrawAlias} onChange={(e) => setFixtureDrawAlias(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-orange-500 transition-colors" />
                              <button onClick={() => runFixtureExtraction(fixtureCachedUpload, fixtureDrawAlias)} disabled={!fixtureDrawAlias} className="w-full py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-[10px] font-black uppercase transition-colors disabled:opacity-50">Try Again</button>
                            </div>
                            <button onClick={() => setFixtureNeedsAlias(false)} className="w-full mt-3 text-[9px] font-bold text-orange-600/70 hover:text-orange-800 dark:text-orange-500 uppercase tracking-widest underline">
                              Cancel and upload different file
                            </button>
                          </div>
                        )
                      ) : (
                        <div key="daive-fixture-results" className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                          <button 
                            onClick={() => setDraftFixtures([])} 
                            className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 uppercase tracking-widest transition-colors flex items-center mb-2"
                          >
                            <i className="fa-solid fa-arrow-left mr-2"></i> Upload Different File
                          </button>

                          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col mb-4">
                            <div className="bg-zinc-900 dark:bg-black px-4 py-3 flex justify-between items-center text-white shrink-0">
                              <span className="font-black text-[10px] uppercase tracking-widest">Review Fixtures</span>
                              <span className="font-bold text-[10px] uppercase tracking-widest text-emerald-400">{draftFixtures.length} Found</span>
                            </div>
                            
                            <div className="overflow-y-auto p-3 space-y-3 max-h-[40vh] bg-zinc-50 dark:bg-zinc-800/50">
                              {draftFixtures.map((f, i) => (
                                <div key={i} className="flex flex-col gap-2 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm relative">
                                  <button onClick={() => removeDraftFixture(i)} className="absolute top-2 right-2 text-zinc-400 hover:text-red-500 transition-colors w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"><i className="fa-solid fa-xmark"></i></button>
                                  
                                  <div className="flex flex-col gap-2 pr-6">
                                    <div>
                                      <label className="block text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1">Opponent</label>
                                      <input type="text" placeholder="Opponent" value={f.opponent || ""} onChange={(e) => updateDraftFixture(i, 'opponent', e.target.value)} className="w-full min-w-0 px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 dark:text-white transition-colors font-bold" />
                                    </div>
                                    <div>
                                      <label className="block text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1">Date</label>
                                      <input type="date" value={f.match_date || ""} onChange={(e) => updateDraftFixture(i, 'match_date', e.target.value)} className="w-full min-w-0 px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 dark:text-white transition-colors color-scheme-light dark:color-scheme-dark" />
                                    </div>
                                    <div>
                                      <label className="block text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1">Time</label>
                                      <input type="text" placeholder="Time" value={f.start_time || ""} onChange={(e) => updateDraftFixture(i, 'start_time', e.target.value)} className="w-full min-w-0 px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 dark:text-white transition-colors" />
                                    </div>
                                    <div>
                                      <label className="block text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1">Venue/Location</label>
                                      <input type="text" placeholder="Venue/Location" value={f.location || ""} onChange={(e) => updateDraftFixture(i, 'location', e.target.value)} className="w-full min-w-0 px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 dark:text-white transition-colors" />
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {draftFixtures.length === 0 && <div className="text-center py-6 text-zinc-400 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest">No matches found for this team</div>}
                            </div>
                          </div>

                          <button onClick={saveBulkFixtures} disabled={isSavingFixture || draftFixtures.length === 0} className="w-full py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50">
                            {isSavingFixture ? 'Saving...' : `Import ${draftFixtures.length} Matches`}
                          </button>
                        </div>
                      )
                    ) : (
                      <div key="manual-fixture-entry" className="space-y-4">
                        <div className="flex flex-col gap-4">
                          <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2 ml-1">Opponent Name</label>
                            <input type="text" placeholder="Opponent Name" value={opponent} onChange={(e) => setOpponent(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors shadow-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2 ml-1">Date</label>
                            <input type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 color-scheme-light dark:color-scheme-dark transition-colors shadow-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2 ml-1">Time</label>
                            <input type="text" placeholder="Time (e.g. 1:00 PM)" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors shadow-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2 ml-1">Location</label>
                            <input type="text" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors shadow-sm" />
                          </div>
                        </div>
                        
                        <button disabled={isSavingFixture || !opponent || !matchDate} onClick={handleSaveFixtureManual} className="w-full py-4 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 mt-6">
                          {isSavingFixture ? 'Saving...' : 'Save Fixture'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Season Details */}
                {step.id === 'season' && (
                  <div className="space-y-4">
                    <div className="p-5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors space-y-4">
                      <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Season Name</label>
                        <input type="text" placeholder="e.g. Winter 2026" value={seasonName} onChange={(e) => setSeasonName(e.target.value)} disabled={isPlayhqImported || isPlayhq} className={`w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors ${(isPlayhqImported || isPlayhq) ? 'opacity-70 cursor-not-allowed' : ''}`} />
                      </div>
                      
                      <div className="flex flex-col gap-3">
                        <div>
                          <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Start Date</label>
                          <input type="date" value={seasonStart} onChange={(e) => setSeasonStart(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 color-scheme-light dark:color-scheme-dark transition-colors" />
                        </div>
                        <div>
                          <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">End Date</label>
                          <input type="date" value={seasonEnd} onChange={(e) => setSeasonEnd(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 color-scheme-light dark:color-scheme-dark transition-colors" />
                        </div>
                      </div>
                    </div>

                    <div className="p-5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors space-y-4">
                      <h4 className="text-xs text-zinc-500 uppercase font-black tracking-widest mb-3">Defaults & Labels</h4>
                      
                      <div className="flex flex-col gap-4">
                        <div>
                          <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Player Match Fee ($)</label>
                          <input type="number" value={memberFee} onChange={(e) => setMemberFee(e.target.value === "" ? "" : Number(e.target.value))} className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                        </div>

                        <div>
                          <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Match Expense Label</label>
                          <input type="text" placeholder="e.g. Match Fees" value={expenseLabel} onChange={(e) => setExpenseLabel(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                          <p className="text-[10px] text-zinc-400 mt-1.5 font-bold leading-snug">This is for your match expenses that are not player fees (e.g., ground/court hire, umpire fees).</p>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Match Expense Amount ($)</label>
                          <input type="number" value={defaultUmpireFee} onChange={(e) => setDefaultUmpireFee(e.target.value === "" ? "" : Number(e.target.value))} className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                          <p className="text-[9px] text-zinc-400 mt-1.5 uppercase tracking-widest font-black leading-tight">E.G. GROUND FEES, COURT HIRE, UMPIRE FEES</p>
                        </div>
                      </div>
                    </div>

                    <button onClick={handleSaveSeason} disabled={isSavingSeason || !seasonName || memberFee === ""} className="w-full py-4 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 mt-6">
                      {isSavingSeason ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>
                )}

                {/* Financials Inline */}
                {step.id === 'financials' && (
                  <div className="space-y-4">
                    <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-xl border border-zinc-300 dark:border-zinc-700">
                      {squareToken ? (
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 font-bold text-sm">
                            <i className="fa-solid fa-circle-check"></i>
                            <span>Connected to Square</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          <p className="text-xs text-zinc-600 dark:text-zinc-400">
                            Connect your Square account to process card payments directly via your club page. Don't have a Square account? <a href="https://squareup.com/signup" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold">Create one for free</a>.
                          </p>
                          <a 
                            href={`/api/pay/square/connect?clubId=${activeClubId}`}
                            className="w-full flex items-center justify-center gap-2 bg-[#3D3A3B] hover:bg-black text-white px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-sm"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" fillRule="evenodd" clipRule="evenodd"><path d="M19 2H5C3.3 2 2 3.3 2 5V19C2 20.7 3.3 22 5 22H19C20.7 22 22 20.7 22 19V5C22 3.3 20.7 2 19 2ZM16 16H8V8H16V16Z" /></svg> Connect Square
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="p-5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors space-y-4 mb-4">
                      <h4 className="text-xs text-zinc-500 uppercase font-black tracking-widest mb-3">Accepted Payment Methods</h4>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <div className={`w-10 h-6 rounded-full p-1 transition-colors ${acceptsCash ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${acceptsCash ? 'translate-x-4' : 'translate-x-0'}`}></div>
                          </div>
                          <input type="checkbox" className="hidden" checked={acceptsCash} onChange={(e) => {
                            if (!e.target.checked && !acceptsCard) {
                              alert("You must accept at least one payment method");
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
                              alert("You must accept at least one payment method");
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

                    <div className="p-5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors space-y-4">
                      <h4 className="text-xs text-zinc-500 uppercase font-black tracking-widest mb-2">Manual Payment Fallback</h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold mb-4 leading-relaxed">If you skip Square, players can self-report payments using these details.</p>
                      
                      <div className="flex flex-col gap-3">
                        <div className="w-full">
                          <label className="text-[10px] text-zinc-500 uppercase font-black ml-1 block mb-2">Type</label>
                          <select 
                            value={payIdType || ""} 
                            onChange={(e) => setPayIdType(e.target.value as any)} 
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
                          >
                            <option value="mobile">PayID (Mobile)</option>
                            <option value="email">PayID (Email)</option>
                            <option value="bank_account">Bank Account</option>
                          </select>
                        </div>
                        <div className="w-full">
                          <label className="text-[10px] text-zinc-500 uppercase font-black ml-1 block mb-2">Details</label>
                          <input 
                            type="text" 
                            value={payId || ""} 
                            onChange={(e) => setPayId(e.target.value)} 
                            placeholder={payIdType === 'mobile' ? 'e.g. 0400 000 000' : payIdType === 'email' ? 'e.g. admin@club.com' : 'e.g. BSB: 123-456 ACC: 12345678'}
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" 
                          />
                        </div>
                      </div>
                    </div>

                    <button onClick={handleSaveFinancials} disabled={isSavingFinancials || (!squareToken && !payId)} className="w-full py-4 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 mt-6">
                      {isSavingFinancials ? 'Saving...' : 'Save Payment Methods'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      )}
      </>
      )}

      {allCompleted && activeClubId && (
        <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-bottom-4">
          <button 
            disabled
            className="w-full py-4 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-white bg-emerald-600 rounded-xl transition-all shadow-md opacity-70"
          >
            <i className="fa-solid fa-circle-notch fa-spin"></i> Setup Complete! Redirecting...
          </button>
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mt-3 font-medium">
            Continue to Match Day to assign players from your teams to your matches
          </p>
        </div>
      )}
    </div>
  );
}
