// Deploy version 6.1.2 - Stripped Greeting & Enforced Custom Spacing
"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useProfile } from "../lib/useProfile";
import { useActiveClub } from "../contexts/ClubContext";
import GameDay from "../components/GameDay";
import Ledger from "../components/Ledger";
import Setup from "../components/Setup";
import Analytics from "../components/Analytics"; 
import MyTeam from "../components/MyTeam"; 
import Login from "../components/Login";
import ThemeToggle from "../components/ThemeToggle"; 
import OnboardingFlow from "../components/OnboardingFlow"; 
import ChatWidget from "../components/ChatWidget";
import { useOfflineSync } from "../lib/useOfflineSync";

export default function Home() {
  useOfflineSync(); 

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('activeTab') || 'gameday';
    }
    return 'gameday';
  });

  const [setupTab, setSetupTab] = useState<'config' | 'access' | 'teams' | 'players' | 'fixtures'>('config');

  const [session, setSession] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  
  const { profile, roles, loading: profileLoading } = useProfile();
  const { activeClubId, setActiveClubId } = useActiveClub();
  
  // --- ROLE CHECKING LOGIC ---
  const currentClubRole = roles?.find((r: any) => r.club_id === activeClubId)?.role;
  const isAdmin = profile?.role === 'super_admin' || currentClubRole === 'club_admin';
  const isTeamAdmin = roles?.some((r: any) => r.role === 'team_admin' && r.club_id === activeClubId);
  const canManage = isAdmin || isTeamAdmin;
  
  const [clubMeta, setClubMeta] = useState({ name: 'FP', logo: '' });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showClubMenu, setShowClubMenu] = useState(false);
  
  const [showOnboarding, setShowOnboarding] = useState(true); 
  const [isDaiveOpen, setIsDaiveOpen] = useState(false);
  const [allClubs, setAllClubs] = useState<any[]>([]);

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
      supabase.from('clubs').select('id, name, logo_url').order('name').then(({ data }) => {
        if (data) setAllClubs(data);
      });
    }
  }, [profile]);

  const uniqueClubs = profile?.role === 'super_admin' 
    ? allClubs 
    : Array.from(new Map(roles?.map((r: any) => [r.club_id, r.clubs])).values()).filter(Boolean);

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
    const savedClubId = typeof window !== 'undefined' ? localStorage.getItem('fp_active_club_id') : null;

    if (!activeClubId) {
      if (savedClubId) {
        setActiveClubId(savedClubId);
      } else if (profile?.role === 'super_admin') {
        if (allClubs.length > 0) setActiveClubId(allClubs[0].id);
      } else if (profile?.club_id) {
        setActiveClubId(profile.club_id);
      } else if (roles && roles.length > 0) {
        setActiveClubId(roles[0].club_id);
      }
    }

    if (activeClubId) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('fp_active_club_id', activeClubId);
      }

      const fetchClubMeta = async () => {
        const { data } = await supabase.from('clubs').select('name, logo_url').eq('id', activeClubId).single();
        if (data) {
          setClubMeta({ name: data.name || 'FP', logo: data.logo_url || '' });
        }
      };
      fetchClubMeta();
    }
  }, [profile, roles, activeClubId, setActiveClubId, allClubs]);

  useEffect(() => {
    if (profile && !isAdmin && activeTab === 'setup') {
      handleTabChange('gameday');
    }
  }, [profile, isAdmin, activeTab]);

  useEffect(() => {
    if (profileLoading) return;
    if (profile?.role === 'super_admin' || profile?.onboarding_completed === true) {
      setShowOnboarding(false);
      return;
    }
    const hasAdminOrCaptainRole = roles?.some((r: any) => ['club_admin', 'team_admin'].includes(r.role));
    if (hasAdminOrCaptainRole) {
      setShowOnboarding(false); 
      if (profile?.id) {
        supabase.from('profiles').update({ onboarding_completed: true }).eq('id', profile.id).then();
      }
      return;
    }
    setShowOnboarding(true);
  }, [profile, profileLoading, roles]);

  useEffect(() => {
    const triggerWizard = () => setShowOnboarding(true);
    window.addEventListener('trigger-onboarding', triggerWizard);
    return () => window.removeEventListener('trigger-onboarding', triggerWizard);
  }, []);

  useEffect(() => {
    const handleNavigateSetup = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setSetupTab(customEvent.detail);
        handleTabChange('setup'); 
      }
    };
    window.addEventListener('navigate-setup', handleNavigateSetup);
    return () => window.removeEventListener('navigate-setup', handleNavigateSetup);
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
        <i className="fa-solid fa-bolt-lightning text-emerald-500 text-3xl animate-pulse mb-4"></i>
        <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
          {isCheckingAuth ? 'Authenticating...' : 'Loading Organization...'}
        </div>
      </div>
    );
  }

  if (!session) return <Login />;

  if (showOnboarding) {
    return (
      <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
        <OnboardingFlow user={session.user} onComplete={() => setShowOnboarding(false)} />
      </div>
    );
  }

  const displayRole = profile?.role === 'super_admin' ? 'Super Admin' : 
                      currentClubRole === 'club_admin' ? 'Club Manager' : 
                      currentClubRole === 'team_admin' ? 'Team Manager' : 'Player';

  const userMeta = session?.user?.user_metadata || {};
  const avatarUrl = userMeta?.avatar_url;
  const fullName = userMeta?.full_name;
  const emailStr = profile?.email || session?.user?.email;
  
  let userInitials = 'U';
  try {
    if (fullName && typeof fullName === 'string') {
      const parts = fullName.trim().split(' ');
      userInitials = parts.length > 1 && parts[parts.length - 1]
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() 
        : parts[0].substring(0, 2).toUpperCase();
    } else if (emailStr && typeof emailStr === 'string') {
      userInitials = emailStr.substring(0, 2).toUpperCase();
    }
  } catch (e) {
    userInitials = 'U'; 
  }
  
  const displayFirstName = fullName?.split(' ')?.[0] || emailStr?.split('@')?.[0] || 'User';

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
          onClick={() => uniqueClubs.length > 1 && setShowClubMenu(true)} 
          className={`flex items-center gap-3 text-left ${uniqueClubs.length > 1 ? 'group cursor-pointer' : 'cursor-default'}`}
        >
          {clubMeta.logo ? (
            <img src={clubMeta.logo} className="w-9 h-9 rounded-lg object-cover border border-zinc-200 dark:border-zinc-800" alt="Club Logo" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center font-black text-xs text-emerald-600 dark:text-emerald-500 uppercase">
              {clubMeta.name.substring(0, 2)}
            </div>
          )}
          <div>
            <h1 className="text-xl font-black italic uppercase tracking-tighter text-emerald-600 dark:text-emerald-500">Fees Please</h1>
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-none mt-0.5">
              <span className="truncate max-w-[160px]">{clubMeta.name || 'Select Club'}</span>
              {uniqueClubs.length > 1 && <i className="fa-solid fa-caret-down text-zinc-400"></i>}
            </div>
          </div>
        </button>
        
        <button onClick={() => setIsSidebarOpen(true)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center transition-colors relative">
          {updateAvailable && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-zinc-900"></span>}
          <i className="fa-solid fa-bars text-sm"></i>
        </button>
      </header>

      {showClubMenu && uniqueClubs.length > 1 && (
        <div className="fixed inset-0 z-[200] flex justify-center items-start pt-20 px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowClubMenu(false)}></div>
          <div className="w-full max-w-[320px] bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl relative z-10 animate-in slide-in-from-top-4 fade-in duration-200 overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Switch Club</h3>
               <button onClick={() => setShowClubMenu(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-2 max-h-[60vh] overflow-y-auto">
               {uniqueClubs.map((club: any) => (
                  <button
                     key={club.id}
                     onClick={() => { setActiveClubId(club.id); setShowClubMenu(false); }}
                     className={`w-full flex items-center gap-4 p-3 rounded-2xl transition-colors text-left ${activeClubId === club.id ? 'bg-emerald-500/10 dark:bg-emerald-500/20' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                  >
                     {club.logo_url ? (
                       <img src={club.logo_url} className="w-10 h-10 rounded-xl object-cover shadow-sm" alt={club.name} />
                     ) : (
                       <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-black text-xs text-zinc-500 uppercase">{club.name.substring(0,2)}</div>
                     )}
                     <div className="flex-1">
                       <div className={`font-black uppercase tracking-wide text-sm ${activeClubId === club.id ? 'text-emerald-600 dark:text-emerald-500' : 'text-zinc-900 dark:text-white'}`}>{club.name}</div>
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
          {activeTab === "gameday" && <div className="p-4"><GameDay /></div>}
          {activeTab === "ledger" && <div className="p-4"><Ledger /></div>}
          {activeTab === "analytics" && <div className="p-4"><Analytics /></div>}
          {activeTab === "my-team" && <div className="p-4"><MyTeam /></div>}
          {activeTab === "setup" && isAdmin && <div className="p-4"><Setup activeTab={setupTab} /></div>}
        </div>

        {isDaiveOpen && (
          <div className="absolute inset-0 z-50 bg-white dark:bg-zinc-950 animate-in slide-in-from-bottom-8 duration-200 shadow-[0_-10px_40px_rgba(0,0,0,0.08)]">
            <ChatWidget onClose={() => setIsDaiveOpen(false)} />
          </div>
        )}
      </main>

      {/* RESTORED BOTTOM NAVIGATION FOR PWA */}
      <nav className="absolute bottom-0 left-0 w-full shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black z-40 pt-3 pb-2">
        <div className="flex text-[11px] max-w-[480px] mx-auto font-black uppercase text-zinc-500">
          <button onClick={() => handleTabChange("gameday")} className={`flex-1 flex flex-col items-center transition-colors ${activeTab === "gameday" && !isDaiveOpen ? "text-emerald-600 dark:text-emerald-500" : "hover:text-zinc-700 dark:hover:text-zinc-300"}`}>
            <i className="fa-solid fa-bolt-lightning text-xl mb-1"></i><span>GameDay</span>
          </button>
          <button onClick={() => handleTabChange("ledger")} className={`flex-1 flex flex-col items-center transition-colors ${activeTab === "ledger" && !isDaiveOpen ? "text-emerald-600 dark:text-emerald-500" : "hover:text-zinc-700 dark:hover:text-zinc-300"}`}>
            <i className="fa-solid fa-wallet text-xl mb-1"></i><span>Ledger</span>
          </button>
          <button onClick={() => handleTabChange("analytics")} className={`flex-1 flex flex-col items-center transition-colors ${activeTab === "analytics" ? "text-emerald-600 dark:text-emerald-500" : "hover:text-zinc-700 dark:hover:text-zinc-300"}`}>
            <i className="fa-solid fa-chart-simple text-xl mb-1"></i><span>Insights</span>
          </button>
        </div>
      </nav>

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
              
              <div className="mt-3 inline-block px-3 py-1 bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm">
                {displayRole}
              </div>
            </div>

            <div className="flex-1 py-4 space-y-4 overflow-y-auto">
              {canManage && (
                <div>
                  <div className="px-6 py-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Management</div>
                  
                  <button onClick={() => handleTabChange('my-team')} className={`w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest ${activeTab === 'my-team' ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-r-2 border-emerald-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                    <i className="fa-solid fa-users w-5 text-center"></i> My Team
                  </button>

                  <button onClick={() => { setIsDaiveOpen(true); setIsSidebarOpen(false); }} className="w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300">
                    <i className="fa-solid fa-robot w-5 text-center text-emerald-500"></i> Ask dAIve
                  </button>

                  {isAdmin && (
                    <>
                      <button onClick={() => { handleTabChange('setup'); setSetupTab('config'); }} className={`w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest ${activeTab === 'setup' && setupTab === 'config' ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-r-2 border-emerald-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        <i className="fa-solid fa-sliders w-5 text-center"></i> Configuration
                      </button>
                      <button onClick={() => { handleTabChange('setup'); setSetupTab('access'); }} className={`w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest ${activeTab === 'setup' && setupTab === 'access' ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-r-2 border-emerald-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        <i className="fa-solid fa-shield-halved w-5 text-center"></i> Admins
                      </button>
                      <button onClick={() => { handleTabChange('setup'); setSetupTab('teams'); }} className={`w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest ${activeTab === 'setup' && setupTab === 'teams' ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-r-2 border-emerald-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        <i className="fa-solid fa-users-viewfinder w-5 text-center"></i> Teams
                      </button>
                      <button onClick={() => { handleTabChange('setup'); setSetupTab('players'); }} className={`w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest ${activeTab === 'setup' && setupTab === 'players' ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-r-2 border-emerald-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        <i className="fa-solid fa-clipboard-user w-5 text-center"></i> Players
                      </button>
                      <button onClick={() => { handleTabChange('setup'); setSetupTab('fixtures'); }} className={`w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest ${activeTab === 'setup' && setupTab === 'fixtures' ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-r-2 border-emerald-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        <i className="fa-solid fa-calendar-days w-5 text-center"></i> Fixtures
                      </button>
                    </>
                  )}
                  
                  {/* MANUAL FORCE REFRESH FOR ADMINS (Bypass Cache) */}
                  <div className="mt-4 border-t border-zinc-200 dark:border-zinc-800 pt-4">
                    <button onClick={applyUpdate} className="w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500">
                      <i className="fa-solid fa-arrows-rotate w-5 text-center"></i> Force Update App
                    </button>
                  </div>
                </div>
              )}
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
    </div>
  );
}