// Deploy version 6.1.2 - Stripped Greeting & Enforced Custom Spacing
"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useProfile } from "../lib/useProfile";
import { useActiveClub } from "../contexts/ClubContext";
import GameDay from "../components/GameDay";
import Ledger from "../components/Ledger";
import Setup from "../components/Setup";
import Team from "../components/Team"; 
import MyTeam from "../components/MyTeam"; 
import SeasonHistory from "../components/SeasonHistory";
import Login from "../components/Login";
import ThemeToggle from "../components/ThemeToggle"; 
import PlayerHub from "../components/PlayerHub";
import Referral from "../components/Referral";
import { APP_VERSION } from "../lib/version";
import ChatWidget from "../components/ChatWidget";
import { useOfflineSync } from "../lib/useOfflineSync";
import { hasFeature } from "../lib/features";

export default function Home() {
  useOfflineSync(); 

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('activeTab') || 'gameday';
    }
    return 'gameday';
  });

  const [creatingTeam, setCreatingTeam] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('creating_team') === 'true';
    }
    return false;
  });

  const [setupTab, setSetupTab] = useState<'config' | 'access' | 'teams' | 'players' | 'fixtures' | 'reports' | 'wallet' | 'payments' | 'billing' | 'sponsors'>(() => {
    if (typeof window !== 'undefined') {
      return (sessionStorage.getItem('setupTab') as any) || 'config';
    }
    return 'config';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('setupTab', setupTab);
    }
  }, [setupTab]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab') === 'referral') {
        setActiveTab('referral');
        sessionStorage.setItem('activeTab', 'referral');
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []);

  const [session, setSession] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  
  const { profile, roles, loading: profileLoading } = useProfile();
  const { activeClubId, setActiveClubId } = useActiveClub();
  
  // --- ROLE CHECKING LOGIC ---
  const isSuperAdmin = profile?.role === 'super_admin';
  const rolesForClub = roles?.filter((r: any) => r.club_id === activeClubId) || [];
    const currentClubRole = isSuperAdmin ? 'super_admin' : (
      activeClubId ? (
        rolesForClub.some((r: any) => r.role === 'club_admin') ? 'club_admin' :
        rolesForClub.some((r: any) => r.role === 'team_admin') ? 'team_admin' :
        rolesForClub[0]?.role
      ) : (
        roles?.some((r: any) => r.role === 'club_admin') ? 'club_admin' :
        roles?.some((r: any) => r.role === 'team_admin') ? 'team_admin' :
        profile?.role
      )
    );
  const isAdmin = isSuperAdmin || currentClubRole === 'club_admin';
  const isTeamAdmin = rolesForClub.some((r: any) => r.role === 'team_admin');
  const canManage = isAdmin || isTeamAdmin;
  
  const [clubMeta, setClubMeta] = useState({ name: 'FP', logo: '' });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showClubMenu, setShowClubMenu] = useState(false);
  const [clubSearchTerm, setClubSearchTerm] = useState('');
  
  const [isDaiveOpen, setIsDaiveOpen] = useState(false);
  const [allClubs, setAllClubs] = useState<any[]>([]);
  const [showNewAccountModal, setShowNewAccountModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);

  // --- PWA UPDATE LISTENER (Fix for aggressive caching) ---
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg) {
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setUpdateAvailable(true);
                }
              });
            }
          });
        }
      });

      // Also check for updates when user switches back to the tab
      const checkUpdate = async () => {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          reg?.update();
        } catch(e) {}
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkUpdate();
      });
    }
  }, []);

  const applyUpdate = () => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  };

  useEffect(() => {
    if (profile?.role === 'super_admin') {
      supabase.from('clubs').select('id, name, logo_url, is_active, plan_tier').order('name').then(({ data }) => {
        if (data) setAllClubs(data.filter((c: any) => c.is_active !== false));
      });
    }
  }, [profile]);

  const uniqueClubs = profile?.role === 'super_admin' 
    ? allClubs 
    : Array.from(new Map(roles?.map((r: any) => [r.club_id, r.clubs])).values()).filter((c: any) => c && c.is_active !== false);

  const filteredClubs = uniqueClubs.filter((c: any) => 
    c.name.toLowerCase().includes(clubSearchTerm.toLowerCase())
  );

  const activeClub = uniqueClubs.find((c: any) => c.id === activeClubId);

  const handleTabChange = (tab: string) => {
    if (tab === "daive") {
      setIsDaiveOpen((prev) => !prev);
      setIsSidebarOpen(false);
      return;
    }
    setActiveTab(tab);
    sessionStorage.setItem('activeTab', tab);
    setIsDaiveOpen(false); 
    setIsSidebarOpen(false); 
  };

  useEffect(() => {
    let isMounted = true;
    async function initAuth() {
      const timeoutId = setTimeout(() => {
        if (isMounted) setIsCheckingAuth(false);
      }, 5000);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        clearTimeout(timeoutId); 
        
        if (isMounted) {
          setSession(session);
          setIsCheckingAuth(false);
          
          if (session && typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
             setTimeout(() => {
               if (isMounted) window.history.replaceState(null, '', window.location.pathname);
             }, 500);
          }
        }
      } catch (err) {
        clearTimeout(timeoutId);
        if (isMounted) setIsCheckingAuth(false);
      }
    }

    const startDelay = setTimeout(() => initAuth(), 100);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (isMounted) {
        setSession(session);
        setIsCheckingAuth(false);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(startDelay);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (profileLoading) return;

    const savedClubId = typeof window !== 'undefined' ? localStorage.getItem('fp_active_club_id') : null;

    let targetClubId = activeClubId;

    if (!targetClubId && !creatingTeam) {
      if (savedClubId) {
        targetClubId = savedClubId;
      } else if (profile?.role === 'super_admin') {
        if (allClubs.length > 0) targetClubId = allClubs[0].id;
      } else if (profile?.club_id) {
        targetClubId = profile.club_id;
      } else if (roles && roles.length > 0) {
        targetClubId = roles[0].club_id;
      }
    }

    // Auto-correct if the targetClubId is no longer valid for this user
    if (targetClubId && profile?.role !== 'super_admin' && !creatingTeam) {
      const justCreatedClub = typeof window !== 'undefined' ? sessionStorage.getItem('creating_team') : null;
      if (targetClubId !== justCreatedClub) {
        const isValid = roles && roles.some((r: any) => r.club_id === targetClubId);
        const isProfileClub = profile?.club_id === targetClubId;
        
        if (!isValid && !isProfileClub) {
          targetClubId = roles && roles.length > 0 ? roles[0].club_id : null;
        }
      }
    }

    // Allow the activeClubId to remain whatever it was set to by the club-created event
    // if (creatingTeam) {
    //   targetClubId = null;
    // }

    if (targetClubId !== activeClubId) {
      setActiveClubId(targetClubId);
    }

    if (targetClubId) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('fp_active_club_id', targetClubId);
      }

      const fetchClubMeta = async () => {
        const { data } = await supabase.from('clubs').select('name, logo_url').eq('id', targetClubId).single();
        if (data) {
          setClubMeta({ name: data.name || 'FP', logo: data.logo_url || '' });
        }
      };
      fetchClubMeta();
    } else {
      setClubMeta({ name: 'FP', logo: '' });
      if (typeof window !== 'undefined') {
        localStorage.removeItem('fp_active_club_id');
      }
    }
  }, [profile, roles, activeClubId, setActiveClubId, allClubs, creatingTeam, profileLoading]);

  useEffect(() => {
    if (profile && !isAdmin && activeTab === 'setup') {
      handleTabChange('gameday');
    }
  }, [profile, isAdmin, activeTab]);



  // Auto-redirect logic
  useEffect(() => {
    if (!profileLoading && profile && !creatingTeam) {
      // Brand new accounts (no roles, no onboarding) should stay on gameday to complete setup
      // unless they explicitly arrived on the referral tab (e.g. via /affiliates).
      if ((!roles || roles.length === 0) && !profile.onboarding_completed) {
        if (activeTab !== 'referral' && activeTab !== 'gameday') {
          setActiveTab('gameday');
        }
        if (activeTab === 'gameday') {
          return; // Stop further redirects so they stay on the onboarding checklist
        }
      }

      // Auto-redirect pure affiliates to partner portal
      const hasActiveTeam = profile.team_id || profile.club_id;
      if (!roles || roles.length === 0) {
        if (profile.onboarding_completed && !hasActiveTeam) {
          setActiveTab('referral');
        }
      }

      // Auto-switch to player_hub if they are on an admin tab but are only a player
      if (currentClubRole === 'player' && ['gameday', 'ledger', 'setup'].includes(activeTab)) {
        setActiveTab('player_hub');
      } else if (currentClubRole !== 'player' && activeTab === 'player_hub') {
        setActiveTab('gameday');
      }
    }
  }, [profileLoading, profile, roles, creatingTeam, currentClubRole, activeTab]);

  useEffect(() => {
    const handleNavigateSetup = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setSetupTab(customEvent.detail);
        handleTabChange('setup'); 
      }
    };
    const handleNavigateTab = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        handleTabChange(customEvent.detail); 
      }
    };
    const handleClubCreated = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setActiveClubId(customEvent.detail);
        localStorage.setItem('fp_active_club_id', customEvent.detail);
      }
    };
    window.addEventListener('navigate-setup', handleNavigateSetup);
    window.addEventListener('navigate-tab', handleNavigateTab);
    window.addEventListener('club-created', handleClubCreated);
    return () => {
      window.removeEventListener('navigate-setup', handleNavigateSetup);
      window.removeEventListener('navigate-tab', handleNavigateTab);
      window.removeEventListener('club-created', handleClubCreated);
    };
  }, []);

  const handleLogout = async () => {
    setIsSidebarOpen(false);
    setIsCheckingAuth(true); 
    try {
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      await supabase.auth.signOut();
    } catch (error) {} finally {
      window.location.replace('/'); 
    }
  };

  if (isCheckingAuth || profileLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center">
        <i className="fa-solid fa-circle-notch animate-spin text-emerald-500 text-3xl mb-4"></i>
        <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
          {isCheckingAuth ? 'Authenticating...' : 'Loading...'}
        </div>
      </div>
    );
  }

  if (!session) return <Login />;

  const displayRole = profile?.role === 'super_admin' ? 'Super Admin' : 
                      currentClubRole === 'club_admin' ? 'Account Admin' : 
                      currentClubRole === 'team_admin' ? 'Team Admin' : 
                      (!roles || roles.length === 0) ? (activeTab === 'referral' ? 'Affiliate' : 'Account Admin') : 
                      currentClubRole === 'player' ? 'Player' : 'Unknown';

  const userMeta = session?.user?.user_metadata || {};
  const avatarUrl = userMeta?.avatar_url;
  const fullName = userMeta?.full_name;
  const emailStr = profile?.email || session?.user?.email;
  
  let userInitials = 'U';
  try {
    const nameToUse = profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : fullName;
    if (nameToUse && typeof nameToUse === 'string') {
      const parts = nameToUse.split(' ');
      userInitials = parts.length > 1 && parts[parts.length - 1]
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() 
        : parts[0].substring(0, 2).toUpperCase();
    } else if (emailStr && typeof emailStr === 'string') {
      userInitials = emailStr.substring(0, 2).toUpperCase();
    }
  } catch (e) {
    userInitials = 'U'; 
  }
  
  const displayFirstName = profile?.first_name || fullName?.split(' ')?.[0] || emailStr?.split('@')?.[0] || 'User';

  return (
    <div className="flex flex-col h-screen max-w-[480px] mx-auto bg-zinc-50 dark:bg-zinc-950 shadow-2xl relative overflow-hidden transition-colors duration-300">
      
      {/* UPDATE TOASTER */}
      {updateAvailable && (
        <div 
          onClick={applyUpdate}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-[300] bg-emerald-600 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-3 cursor-pointer animate-in slide-in-from-top-4"
        >
           <i className="fa-solid fa-arrows-rotate animate-spin-slow"></i>
           <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Update Available - Click to Refresh</span>
        </div>
      )}

      <header className="shrink-0 p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-black z-40">
        <button 
          onClick={() => uniqueClubs.length > 1 ? setShowClubMenu(true) : null} 
          className={`flex items-center gap-3 text-left group ${uniqueClubs.length > 1 ? 'cursor-pointer' : 'cursor-default'}`}
        >
          {clubMeta.logo ? (
            <img src={clubMeta.logo} className="w-9 h-9 rounded-lg object-cover border border-zinc-200 dark:border-zinc-800" alt="Account Logo" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center font-black text-xs text-emerald-600 dark:text-emerald-500 uppercase">
              {clubMeta.name.substring(0, 2)}
            </div>
          )}
          <div>
            <h1 className="text-xl font-black italic uppercase tracking-tighter text-emerald-600 dark:text-emerald-500">Fees Please</h1>
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-none mt-0.5">
              <span className="truncate max-w-[160px]">{clubMeta.name || 'Select Account'}</span>
              {uniqueClubs.length > 1 && <i className="fa-solid fa-caret-down text-zinc-400"></i>}
            </div>
          </div>
        </button>
        
        <button onClick={() => setIsSidebarOpen(true)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center transition-colors relative">
          {updateAvailable && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-zinc-900"></span>}
          <i className="fa-solid fa-bars text-sm"></i>
        </button>
      </header>

      {showClubMenu && (
        <div className="fixed inset-0 z-[200] flex justify-center items-start pt-20 px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowClubMenu(false)}></div>
          <div className="w-full max-w-[320px] bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl relative z-10 animate-in slide-in-from-top-4 fade-in duration-200 overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Switch Account</h3>
               <button onClick={() => setShowClubMenu(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><i className="fa-solid fa-xmark"></i></button>
            </div>
            {uniqueClubs.length > 5 && (
              <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-[#111]">
                <div className="relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs"></i>
                  <input 
                    type="text" 
                    value={clubSearchTerm}
                    onChange={(e) => setClubSearchTerm(e.target.value)}
                    placeholder="Search clubs..."
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            )}
            <div className="p-2 max-h-[60vh] overflow-y-auto">
               {filteredClubs.map((club: any) => (
                  <button
                     key={club.id}
                     onClick={() => { setActiveClubId(club.id); setShowClubMenu(false); setClubSearchTerm(''); }}
                     className={`w-full flex items-center gap-4 p-3 rounded-2xl transition-colors text-left ${activeClubId === club.id ? 'bg-emerald-500/10 dark:bg-emerald-500/20' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                  >
                     {club.logo_url ? (
                       <img src={club.logo_url} className="w-10 h-10 rounded-xl object-cover shadow-sm" alt={club.name} />
                     ) : (
                       <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-black text-xs text-zinc-500 uppercase">{club.name.substring(0,2)}</div>
                     )}
                     <div className="flex-1">
                       <div className={`font-black uppercase tracking-wide text-sm ${activeClubId === club.id ? 'text-emerald-600 dark:text-emerald-500' : 'text-zinc-900 dark:text-white'}`}>{club.name} {club.is_active === false && <span className="text-[10px] text-red-500 ml-1">(Deactivated)</span>}</div>
                     </div>
                     {activeClubId === club.id && <i className="fa-solid fa-circle-check text-emerald-500 text-lg"></i>}
                  </button>
               ))}
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 relative z-30 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {activeTab === "player_hub" && <div className="p-0"><PlayerHub /></div>}
          {activeTab === "gameday" && <div className="p-4"><GameDay /></div>}
          {activeTab === "ledger" && <div className="p-4"><Ledger /></div>}
          {activeTab === "team" && <div className="p-4"><Team /></div>}
          {activeTab === "my-team" && <div className="p-4"><MyTeam /></div>}
          {activeTab === "history" && <div className="p-4"><SeasonHistory planTier={activeClub?.plan_tier} /></div>}
          {activeTab === "setup" && isAdmin && <div className="p-4"><Setup activeTab={setupTab} /></div>}
          {activeTab === "referral" && <div className="p-4"><Referral /></div>}
        </div>

        {isDaiveOpen && (
          <div className="absolute inset-0 z-50 bg-white dark:bg-zinc-950 animate-in slide-in-from-bottom-8 duration-200 shadow-[0_-10px_40px_rgba(0,0,0,0.08)]">
            <ChatWidget onClose={() => setIsDaiveOpen(false)} />
          </div>
        )}
      </main>

      {/* RESTORED BOTTOM NAVIGATION FOR PWA */}
      {!isDaiveOpen && (isSuperAdmin || (roles && roles.length > 0)) && currentClubRole !== 'player' && (
        <nav className="absolute bottom-0 left-0 w-full shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black z-40 pt-3 pb-2">
        <div className="flex text-[11px] max-w-[480px] mx-auto font-black uppercase text-zinc-500">
            <>
              <button onClick={() => handleTabChange("gameday")} className={`flex-1 flex flex-col items-center transition-colors ${activeTab === "gameday" && !isDaiveOpen ? "text-emerald-600 dark:text-emerald-500" : "hover:text-zinc-700 dark:hover:text-zinc-300"}`}>
                <i className="fa-solid fa-stopwatch text-xl mb-1"></i><span>Game Day</span>
              </button>
              <button onClick={() => handleTabChange("ledger")} className={`flex-1 flex flex-col items-center transition-colors ${activeTab === "ledger" && !isDaiveOpen ? "text-emerald-600 dark:text-emerald-500" : "hover:text-zinc-700 dark:hover:text-zinc-300"}`}>
                <i className="fa-solid fa-wallet text-xl mb-1"></i><span>Ledger</span>
              </button>
              <button onClick={() => setActiveTab("team")} className={`flex-1 flex flex-col items-center transition-colors ${activeTab === "team" && !isDaiveOpen ? "text-emerald-600 dark:text-emerald-500" : "hover:text-zinc-700 dark:hover:text-zinc-300"}`}>
                <i className="fa-solid fa-users text-xl mb-1"></i><span>Team Hub</span>
              </button>
            </>
        </div>
      </nav>
      )}

      {/* SIDEBAR FOR MANAGEMENT */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm transition-colors" onClick={() => setIsSidebarOpen(false)}></div>
          <div className="w-[280px] bg-white dark:bg-[#111] h-full relative flex flex-col border-l border-zinc-200 dark:border-zinc-800 shadow-2xl animate-in slide-in-from-right duration-300 transition-colors">
            
            <div className="p-6 flex flex-col items-center justify-center border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 relative shrink-0">
              <button onClick={() => setIsSidebarOpen(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
              
              <div className="w-20 h-20 rounded-full border-2 border-emerald-500 p-1 mb-3 relative bg-white dark:bg-black">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xl font-black text-zinc-500 uppercase">
                    {userInitials}
                  </div>
                )}
              </div>
              
              <h2 className="text-lg font-black text-zinc-900 dark:text-white truncate w-full text-center">
                Hi, {displayFirstName}!
              </h2>
              <div className="text-[10px] font-bold text-zinc-500 mt-0.5 truncate w-full text-center">
                {emailStr}
              </div>
              
              <div className="flex justify-center items-center gap-2 mt-3">
                <div className="inline-block px-3 py-1 bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm">
                  {displayRole}
                </div>
                {activeClub && activeClub.plan_tier && activeClub.plan_tier !== 'free' && currentClubRole !== 'player' && (
                  <div className={`inline-block px-3 py-1 border rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${
                    activeClub.plan_tier === 'pro' 
                      ? 'bg-amber-100 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400'
                      : 'bg-indigo-100 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-400'
                  }`}>
                    {activeClub.plan_tier} PLAN
                  </div>
                )}
                {activeClub && (!activeClub.plan_tier || activeClub.plan_tier === 'free') && currentClubRole !== 'player' && (
                  <div className="inline-block px-3 py-1 bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm">
                    FREE PLAN
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 py-4 space-y-4 overflow-y-auto">
              <div>
                <button onClick={() => { setIsDaiveOpen(true); setIsSidebarOpen(false); }} className="w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300">
                  <i className="fa-solid fa-life-ring w-5 text-center text-emerald-500"></i> Get Help
                </button>
              </div>

              {isAdmin && (
                <div>
                  {/* APP MANAGEMENT SECTION */}
                  <div className="px-6 py-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest">App Management</div>
                  
                  {profile?.role === 'super_admin' && (
                    <button onClick={() => window.location.assign('/admin')} className="w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300">
                      <i className="fa-solid fa-crown w-5 text-center text-amber-500"></i> Platform Admin
                    </button>
                  )}
                  
                  {isAdmin && (
                    <>
                      <button onClick={() => { handleTabChange('setup'); setSetupTab('config'); }} className={`w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest ${activeTab === 'setup' && setupTab === 'config' ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-r-2 border-emerald-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        <i className="fa-solid fa-sliders w-5 text-center"></i> Account Details
                      </button>
                      <button onClick={() => { handleTabChange('setup'); setSetupTab('billing'); }} className={`w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest ${activeTab === 'setup' && setupTab === 'billing' ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-r-2 border-emerald-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        <i className="fa-solid fa-file-invoice-dollar w-5 text-center"></i> Billing
                      </button>
                      <button onClick={() => { handleTabChange('setup'); setSetupTab('payments'); }} className={`w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest ${activeTab === 'setup' && setupTab === 'payments' ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-r-2 border-emerald-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        <i className="fa-solid fa-credit-card w-5 text-center"></i> Payments
                      </button>
                      <button onClick={() => { handleTabChange('setup'); setSetupTab('access'); }} className={`w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest ${activeTab === 'setup' && setupTab === 'access' ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-r-2 border-emerald-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        <i className="fa-solid fa-shield-halved w-5 text-center"></i> Admins
                      </button>
                      <button onClick={() => { handleTabChange('setup'); setSetupTab('reports'); }} className={`w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest ${activeTab === 'setup' && setupTab === 'reports' ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-r-2 border-emerald-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        <i className="fa-solid fa-chart-pie w-5 text-center"></i> Reports
                      </button>
                      <button onClick={() => { handleTabChange('setup'); setSetupTab('wallet'); }} className={`w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest ${activeTab === 'setup' && setupTab === 'wallet' ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-r-2 border-emerald-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        <i className="fa-solid fa-wallet w-5 text-center"></i> Team Wallet
                      </button>
                    </>
                  )}

                  {/* TEAM MANAGEMENT SECTION */}
                  {isAdmin && (
                    <div className="px-6 py-2 mt-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Team Management</div>
                  )}

                  {isAdmin && (
                    <button onClick={() => { handleTabChange('setup'); setSetupTab('teams'); }} className={`w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest ${activeTab === 'setup' && setupTab === 'teams' ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-r-2 border-emerald-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                      <i className="fa-solid fa-users-viewfinder w-5 text-center"></i> Teams
                    </button>
                  )}
                  {isAdmin && (
                    <>
                      <button onClick={() => { handleTabChange('setup'); setSetupTab('players'); }} className={`w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest ${activeTab === 'setup' && setupTab === 'players' ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-r-2 border-emerald-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        <i className="fa-solid fa-clipboard-user w-5 text-center"></i> Players
                      </button>
                      <button onClick={() => { handleTabChange('setup'); setSetupTab('fixtures'); }} className={`w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest ${activeTab === 'setup' && setupTab === 'fixtures' ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-r-2 border-emerald-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        <i className="fa-solid fa-calendar-days w-5 text-center"></i> Fixtures
                      </button>
                      <button onClick={() => { handleTabChange('setup'); setSetupTab('sponsors'); }} className={`w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest ${activeTab === 'setup' && setupTab === 'sponsors' ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-r-2 border-emerald-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        <i className="fa-solid fa-bullhorn w-5 text-center"></i> Sponsors
                      </button>
                      <button onClick={() => { handleTabChange('history'); }} className={`w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest ${activeTab === 'history' ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-r-2 border-emerald-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        <i className="fa-solid fa-clock-rotate-left w-5 text-center"></i> Season History
                      </button>
                    </>
                  )}
                </div>
              )}

              {canManage && (
                <div className="border-t border-zinc-200 dark:border-zinc-800 pt-2">
                  {/* MANUAL FORCE REFRESH FOR ADMINS (Bypass Cache) */}
                  <div className="mt-2">
                    <button onClick={applyUpdate} className="w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500">
                      <i className="fa-solid fa-arrows-rotate w-5 text-center"></i> Force Update App
                    </button>
                    <div className="px-6 py-2 text-[8px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                      Version: {APP_VERSION}
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-zinc-200 dark:border-zinc-800 pt-2">
                {currentClubRole === 'player' && (roles && roles.length > 0) && activeTab !== 'player_hub' && (
                  <button onClick={() => { setIsSidebarOpen(false); handleTabChange('player_hub'); }} className="w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300">
                    <i className="fa-solid fa-house w-5 text-center text-emerald-500"></i> Dashboard
                  </button>
                )}

                <button onClick={() => { setIsSidebarOpen(false); handleTabChange('referral'); }} className="w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300">
                  <i className="fa-solid fa-gift w-5 text-center text-emerald-500"></i> Refer a Friend
                </button>
                <button 
                  onClick={() => { 
                    setIsSidebarOpen(false); 
                    setShowNewAccountModal(true); 
                  }} 
                  className="w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300"
                >
                  <i className="fa-solid fa-plus w-5 text-center text-zinc-400"></i> Register New Account
                </button>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
              <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Appearance</div>
              <ThemeToggle />
            </div>

            <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
              <button onClick={handleLogout} className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-black py-4 rounded-xl uppercase tracking-widest text-xs transition-colors flex items-center justify-center gap-3">
                <i className="fa-solid fa-arrow-right-from-bracket"></i> Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW ACCOUNT MODAL */}
      {showNewAccountModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNewAccountModal(false)}></div>
          <div className="bg-white dark:bg-[#111] rounded-3xl w-full max-w-sm relative z-10 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl border-4 border-white dark:border-[#111] shadow-lg">
                <i className="fa-solid fa-sitemap"></i>
              </div>
              <h3 className="text-xl font-black uppercase italic tracking-tighter text-zinc-900 dark:text-white mb-2">Register New Account?</h3>
              {(!roles || roles.length === 0) ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                  Are you sure you want to register a new team? This will begin the setup process for a new team.
                </p>
              ) : (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                  Create a new account if you want new teams & players <span className="font-bold">separate to your current team</span>.
                  <br/><br/>
                  If you wish to add a new team to this account, please contact your Account Admin.
                </p>
              )}
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    setShowNewAccountModal(false);
                    setActiveClubId(null);
                    setActiveTab('gameday');
                    sessionStorage.setItem('activeTab', 'gameday');
                    sessionStorage.setItem('creating_team', 'true');
                    setCreatingTeam(true);
                  }}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm transition-colors shadow-lg shadow-emerald-500/25"
                >
                  Yes, Create Account
                </button>
                <button onClick={() => setShowNewAccountModal(false)} className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-2xl font-black uppercase tracking-widest text-sm transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REFERRAL MODAL */}
      {showReferralModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowReferralModal(false)}></div>
          <div className="bg-white dark:bg-[#111] rounded-3xl w-full max-w-sm relative z-10 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl border-4 border-white dark:border-[#111] shadow-lg">
                <i className="fa-solid fa-gift"></i>
              </div>
              <h3 className="text-xl font-black uppercase italic tracking-tighter text-center text-zinc-900 dark:text-white mb-2">Refer a Friend</h3>
              <p className="text-sm text-center text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                Invite friends and earn rewards when they join and lock in matches!
              </p>
              
              <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-2xl mb-6 border border-zinc-200 dark:border-zinc-800">
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Your Personal Link</div>
                <div className="flex items-center gap-2">
                  <input 
                    readOnly 
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/auth/register?ref=${profile?.referral_code || ''}`}
                    className="flex-1 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none"
                  />
                  <button 
                    onClick={() => navigator.clipboard.writeText(`${typeof window !== 'undefined' ? window.location.origin : ''}/auth/register?ref=${profile?.referral_code || ''}`)}
                    className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors shrink-0"
                  >
                    <i className="fa-regular fa-copy"></i>
                  </button>
                </div>
              </div>
              
              <button onClick={() => setShowReferralModal(false)} className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-2xl font-black uppercase tracking-widest text-sm transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}