// Deploy version 5.3 - Exclusive Render + Clean House Logout
"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useProfile } from "../lib/useProfile";
import { useActiveClub } from "../contexts/ClubContext";
import GameDay from "../components/GameDay";
import Ledger from "../components/Ledger";
import Setup from "../components/Setup";
import Login from "../components/Login";
import ThemeToggle from "../components/ThemeToggle"; 
import OnboardingFlow from "../components/OnboardingFlow"; 
import ChatWidget from "../components/ChatWidget";

export default function Home() {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('activeTab') || 'gameday';
    }
    return 'gameday';
  });

  const [setupTab, setSetupTab] = useState<'config' | 'access' | 'teams' | 'players' | 'fixtures'>('config');

  const [session, setSession] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  const { profile, roles, loading: profileLoading } = useProfile();
  const { activeClubId, setActiveClubId } = useActiveClub();
  
  const currentClubRole = roles?.find((r: any) => r.club_id === activeClubId)?.role;
  const isAdmin = profile?.role === 'super_admin' || currentClubRole === 'club_admin';
  
  const [theme, setTheme] = useState({ name: 'FP', color: '#10b981', font: 'Inter', logo: '' });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showClubMenu, setShowClubMenu] = useState(false);
  
  // THE LOCK: Default is TRUE. You are in the wizard until proven otherwise.
  const [showOnboarding, setShowOnboarding] = useState(true); 
  const [isDaiveOpen, setIsDaiveOpen] = useState(false);
  const [allClubs, setAllClubs] = useState<any[]>([]);

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
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsCheckingAuth(false);
    }, 4000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsCheckingAuth(false);
      clearTimeout(timer);
    }).catch(err => {
      console.error("Auth initialization error:", err);
      setIsCheckingAuth(false);
      clearTimeout(timer);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setIsCheckingAuth(false); 
      clearTimeout(timer);

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!activeClubId && profile?.role !== 'super_admin') {
      if (profile?.club_id) {
        setActiveClubId(profile.club_id);
      } else if (roles && roles.length > 0) {
        setActiveClubId(roles[0].club_id);
      }
    }

    if (activeClubId) {
      const fetchTheme = async () => {
        const { data } = await supabase.from('clubs').select('name, theme_color, theme_font, logo_url').eq('id', activeClubId).single();
        if (data) {
          setTheme({ 
            name: data.name || 'FP',
            color: data.theme_color || '#10b981', 
            font: data.theme_font || 'Inter',
            logo: data.logo_url || ''
          });
        }
      };
      fetchTheme();
    }
  }, [profile, roles, activeClubId, setActiveClubId]);

  useEffect(() => {
    if (profile && !isAdmin && activeTab === 'setup') {
      handleTabChange('gameday');
    }
  }, [profile, isAdmin, activeTab]);

  // THE KEY: The only way to unlock the dashboard
  useEffect(() => {
    if (profileLoading) return;

    if (profile?.role === 'super_admin') {
      setShowOnboarding(false);
      return;
    }

    if (profile?.onboarding_completed === true) {
      setShowOnboarding(false);
      return;
    }

  }, [profile, profileLoading]);

  // THE MANUAL OVERRIDE LISTENER
  useEffect(() => {
    const triggerWizard = () => setShowOnboarding(true);
    window.addEventListener('trigger-onboarding', triggerWizard);
    return () => window.removeEventListener('trigger-onboarding', triggerWizard);
  }, []);

  const handleLogout = async () => {
    setIsSidebarOpen(false);
    setIsCheckingAuth(true); 
    try {
      // 1. Sign out of the server
      await supabase.auth.signOut();
      
      // 2. INCINERATE local memory to prevent "wigging out" on re-entry
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
    } catch (error) {
      console.error("Logout Error:", error);
    } finally {
      // 3. Force a hard reload to the root
      window.location.href = '/'; 
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center">
        <i className="fa-solid fa-bolt-lightning text-emerald-500 text-3xl animate-pulse mb-4"></i>
        <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Authenticating...</div>
      </div>
    );
  }

  if (!session) return <Login />;

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center">
        <i className="fa-solid fa-bolt-lightning text-emerald-500 text-3xl animate-pulse mb-4"></i>
        <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Loading Workspace...</div>
      </div>
    );
  }

  // --- THE EXCLUSIVE RENDER ---
  // If the wizard is triggered, completely unmount the dashboard.
  if (showOnboarding) {
    return (
      <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
        <OnboardingFlow 
          user={session.user} 
          onComplete={() => {
            console.log("Wizard officially requested closure.");
            setShowOnboarding(false);
          }} 
        />
      </div>
    );
  }

  const displayRole = profile?.role === 'super_admin' ? 'Super Admin' : 
                      currentClubRole === 'club_admin' ? 'Club Admin' : 
                      currentClubRole === 'team_admin' ? 'Team Captain' : 'Player';

  const userMeta = session?.user?.user_metadata;
  const avatarUrl = userMeta?.avatar_url;
  const fullName = userMeta?.full_name || '';
  const emailStr = profile?.email || '';
  
  let userInitials = 'U';
  if (fullName) {
    const parts = fullName.split(' ');
    userInitials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();
  } else if (emailStr) {
    userInitials = emailStr.substring(0, 2).toUpperCase();
  }
  const displayFirstName = fullName ? fullName.split(' ')[0] : (emailStr.split('@')[0] || 'User');

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --brand-color: ${theme.color};
          --brand-font: '${theme.font}', sans-serif;
        }
        body { font-family: var(--brand-font) !important; }
      `}} />

      <div className="flex flex-col h-screen max-w-[480px] mx-auto bg-zinc-50 dark:bg-zinc-950 shadow-2xl relative overflow-hidden transition-colors duration-300">
        
        <header className="shrink-0 p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-black z-40">
          <button 
            onClick={() => uniqueClubs.length > 1 && setShowClubMenu(true)} 
            className={`flex items-center gap-3 text-left ${uniqueClubs.length > 1 ? 'group cursor-pointer' : 'cursor-default'}`}
          >
            {theme.logo ? (
              <img src={theme.logo} className="w-9 h-9 rounded-lg object-cover border border-zinc-200 dark:border-zinc-800" alt="Club Logo" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center font-black text-xs text-brand uppercase">
                {theme.name.substring(0, 2)}
              </div>
            )}
            <div>
              <h1 className="text-xl font-black italic uppercase tracking-tighter text-brand">Fees Please</h1>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-none mt-0.5">
                <span className="truncate max-w-[160px]">{theme.name || 'Select Workspace'}</span>
                {uniqueClubs.length > 1 && <i className="fa-solid fa-caret-down text-zinc-400"></i>}
              </div>
            </div>
          </button>
          
          <button onClick={() => setIsSidebarOpen(true)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center transition-colors">
            <i className="fa-solid fa-bars text-sm"></i>
          </button>
        </header>

        {showClubMenu && uniqueClubs.length > 1 && (
          <div className="fixed inset-0 z-[200] flex justify-center items-start pt-20 px-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowClubMenu(false)}></div>
            <div className="w-full max-w-[320px] bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl relative z-10 animate-in slide-in-from-top-4 fade-in duration-200 overflow-hidden">
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
                 <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Switch Workspace</h3>
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

        <main className="flex-1 relative z-30 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {activeTab === "gameday" && <div className="p-4"><GameDay /></div>}
            {activeTab === "ledger" && <div className="p-4"><Ledger /></div>}
            {activeTab === "setup" && isAdmin && <div className="p-4"><Setup activeTab={setupTab} /></div>}
          </div>

          {isDaiveOpen && (
            <div className="absolute inset-0 z-50 bg-white dark:bg-zinc-950 animate-in slide-in-from-bottom-8 duration-200 shadow-[0_-10px_40px_rgba(0,0,0,0.08)]">
              <ChatWidget onClose={() => setIsDaiveOpen(false)} />
            </div>
          )}
        </main>

        <nav className="shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black pb-8 pt-4 z-40 relative">
          <div className="flex text-[11px] max-w-[480px] mx-auto font-black uppercase text-zinc-500">
            <button onClick={() => handleTabChange("gameday")} className={`flex-1 flex flex-col items-center transition-colors ${activeTab === "gameday" && !isDaiveOpen ? "text-brand" : "hover:text-zinc-700 dark:hover:text-zinc-300"}`}>
              <i className="fa-solid fa-bolt-lightning text-2xl mb-1"></i><span>GameDay</span>
            </button>
            <button onClick={() => handleTabChange("ledger")} className={`flex-1 flex flex-col items-center transition-colors ${activeTab === "ledger" && !isDaiveOpen ? "text-brand" : "hover:text-zinc-700 dark:hover:text-zinc-300"}`}>
              <i className="fa-solid fa-wallet text-2xl mb-1"></i><span>Ledger</span>
            </button>
            <button onClick={() => handleTabChange("daive")} className={`flex-1 flex flex-col items-center transition-colors ${isDaiveOpen ? "text-emerald-600 dark:text-emerald-500" : "hover:text-zinc-700 dark:hover:text-zinc-300"}`}>
              <i className="fa-solid fa-robot text-2xl mb-1"></i><span>dAIve</span>
            </button>
          </div>
        </nav>

        {isSidebarOpen && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm transition-colors" onClick={() => setIsSidebarOpen(false)}></div>
            <div className="w-[280px] bg-white dark:bg-[#111] h-full relative flex flex-col border-l border-zinc-200 dark:border-zinc-800 shadow-2xl animate-in slide-in-from-right duration-300 transition-colors">
              
              <div className="p-6 flex flex-col items-center justify-center border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 relative">
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

              <div className="flex-1 py-4 space-y-1">
                {isAdmin && (
                  <div className="mb-2">
                    <div className="px-6 py-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Administration</div>
                    <button onClick={() => { handleTabChange('setup'); setSetupTab('config'); setIsSidebarOpen(false); }} className={`w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest ${activeTab === 'setup' && setupTab === 'config' ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-r-2 border-emerald-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                      <i className="fa-solid fa-sliders w-5 text-center"></i> Configuration
                    </button>
                    <button onClick={() => { handleTabChange('setup'); setSetupTab('access'); setIsSidebarOpen(false); }} className={`w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest ${activeTab === 'setup' && setupTab === 'access' ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-r-2 border-emerald-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                      <i className="fa-solid fa-shield-halved w-5 text-center"></i> Access
                    </button>
                    <button onClick={() => { handleTabChange('setup'); setSetupTab('teams'); setIsSidebarOpen(false); }} className={`w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest ${activeTab === 'setup' && setupTab === 'teams' ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-r-2 border-emerald-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                      <i className="fa-solid fa-users-viewfinder w-5 text-center"></i> Teams
                    </button>
                    <button onClick={() => { handleTabChange('setup'); setSetupTab('players'); setIsSidebarOpen(false); }} className={`w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest ${activeTab === 'setup' && setupTab === 'players' ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-r-2 border-emerald-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                      <i className="fa-solid fa-clipboard-user w-5 text-center"></i> Roster
                    </button>
                    <button onClick={() => { handleTabChange('setup'); setSetupTab('fixtures'); setIsSidebarOpen(false); }} className={`w-full text-left px-6 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black uppercase tracking-widest ${activeTab === 'setup' && setupTab === 'fixtures' ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-r-2 border-emerald-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                      <i className="fa-solid fa-calendar-days w-5 text-center"></i> Fixtures
                    </button>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800">
                <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Appearance</div>
                <ThemeToggle />
              </div>

              <div className="p-6 border-t border-zinc-200 dark:border-zinc-800">
                <button onClick={handleLogout} className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-black py-4 rounded-xl uppercase tracking-widest text-xs transition-colors flex items-center justify-center gap-3">
                  <i className="fa-solid fa-arrow-right-from-bracket"></i> Log Out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}