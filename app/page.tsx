// Deploy version 3.9 - Native dAIve Overlay Integration
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

  const [session, setSession] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  const { profile, roles, loading: profileLoading } = useProfile();
  const { activeClubId, setActiveClubId } = useActiveClub();
  
  const [theme, setTheme] = useState({ name: 'FP', color: '#10b981', font: 'Inter', logo: '' });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showClubMenu, setShowClubMenu] = useState(false);

  // God Mode Switcher State
  const [allClubs, setAllClubs] = useState<any[]>([]);
  
  // Onboarding State
  const [showOnboarding, setShowOnboarding] = useState(false);

  // NEW STATE: Manage dAIve as an overlay, not a standard tab
  const [isDaiveOpen, setIsDaiveOpen] = useState(false);

  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'club_admin';

  // Fetch all clubs if user is super_admin
  useEffect(() => {
    if (profile?.role === 'super_admin') {
      supabase.from('clubs').select('id, name, logo_url').order('name').then(({ data }) => {
        if (data) setAllClubs(data);
      });
    }
  }, [profile]);

  // Build the list of clubs to show in the dropdown based on role
  const uniqueClubs = profile?.role === 'super_admin' 
    ? allClubs 
    : Array.from(new Map(roles?.map((r: any) => [r.club_id, r.clubs])).values()).filter(Boolean);

  // UPDATED: Handle dAIve toggling separately from core tabs
  const handleTabChange = (tab: string) => {
    if (tab === "daive") {
      setIsDaiveOpen((prev) => !prev);
      setIsSidebarOpen(false);
      return;
    }
    setActiveTab(tab);
    sessionStorage.setItem('activeTab', tab);
    setIsDaiveOpen(false); // Auto-close dAIve if they click GameDay or Ledger
    setIsSidebarOpen(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsCheckingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!activeClubId && profile?.club_id && profile?.role !== 'super_admin') {
      setActiveClubId(profile.club_id);
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
  }, [profile, activeClubId, setActiveClubId]);

  useEffect(() => {
    if (profile && !isAdmin && activeTab === 'setup') {
      handleTabChange('gameday');
    }
  }, [profile, isAdmin, activeTab]);

  // --- CHECK ONBOARDING STATUS ---
  useEffect(() => {
    if (profile && profile.has_onboarded === false) {
      setShowOnboarding(true);
    }
  }, [profile]);

  // --- ROBUST LOGOUT ---
  const handleLogout = async () => {
    setIsSidebarOpen(false);
    setIsCheckingAuth(true); 
    
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Logout Error:", error);
    } finally {
      sessionStorage.clear();
      window.location.href = '/'; 
    }
  };

  if (isCheckingAuth || profileLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center">
        <i className="fa-solid fa-bolt-lightning text-emerald-500 text-3xl animate-pulse mb-4"></i>
        <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Loading Workspace...</div>
      </div>
    );
  }

  if (!session) return <Login />;

  const currentClubRole = roles?.find((r: any) => r.club_id === activeClubId)?.role || profile?.role;
  const displayRole = profile?.role === 'super_admin' ? 'God Mode' : 
                      currentClubRole === 'club_admin' ? 'Club Admin' : 
                      currentClubRole === 'team_admin' ? 'Team Captain' : 'Player';

  return (
    <>
      {/* --- ONBOARDING OVERLAY --- */}
      {showOnboarding && (
        <OnboardingFlow 
          user={session.user} 
          onComplete={() => setShowOnboarding(false)} 
        />
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --brand-color: ${theme.color};
          --brand-font: '${theme.font}', sans-serif;
        }
        body { font-family: var(--brand-font) !important; }
      `}} />

      {/* FIXED CONTAINER: Height set to screen to handle the flex layout */}
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
          
          <button onClick={() => setIsSidebarOpen(true)} className="text-zinc-500 w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center transition-colors">
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

        {/* --- MAIN CONTENT AREA WITH OVERLAY --- */}
        <main className="flex-1 relative z-30 flex flex-col overflow-hidden">
          
          {/* BASE CONTENT: Always renders so it doesn't unmount when dAIve opens */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "gameday" && <div className="p-4"><GameDay /></div>}
            {activeTab === "ledger" && <div className="p-4"><Ledger /></div>}
            {activeTab === "setup" && isAdmin && <div className="p-4"><Setup /></div>}
          </div>

          {/* OVERLAY: dAIve slides up over the base content */}
          {isDaiveOpen && (
            <div className="absolute inset-0 z-50 bg-white dark:bg-zinc-950 animate-in slide-in-from-bottom-8 duration-200 shadow-[0_-10px_40px_rgba(0,0,0,0.08)]">
              <ChatWidget onClose={() => setIsDaiveOpen(false)} />
            </div>
          )}
        </main>

        {/* --- BOTTOM NAVIGATION BAR --- */}
        <nav className="shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black pb-8 pt-4 z-40 relative">
          <div className="flex text-[11px] max-w-[480px] mx-auto font-black uppercase text-zinc-500">
            {/* Highlight rules updated to respect isDaiveOpen */}
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
              
              <div className="p-6 flex justify-between items-start border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="overflow-hidden">
                  <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 truncate" title={profile?.email}>
                    {profile?.email || 'Logged In'}
                  </div>
                  <div className="text-sm font-black text-brand uppercase tracking-widest">{displayRole}</div>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors ml-4 shrink-0"><i className="fa-solid fa-xmark text-xl"></i></button>
              </div>

              <div className="flex-1 py-4 space-y-1">
                {isAdmin && (
                  <button onClick={() => handleTabChange('setup')} className="w-full text-left px-6 py-4 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-widest">
                    <i className="fa-solid fa-sliders text-zinc-500 w-5"></i> Admin Setup
                  </button>
                )}
                
                <button onClick={() => { alert('Fees Please v3.9\nCreated for sports clubs.'); setIsSidebarOpen(false); }} className="w-full text-left px-6 py-4 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-widest">
                  <i className="fa-solid fa-circle-info text-zinc-500 w-5"></i> About App
                </button>
                <button onClick={() => window.location.reload()} className="w-full text-left px-6 py-4 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-widest">
                  <i className="fa-solid fa-cloud-arrow-down text-zinc-500 w-5"></i> Force Sync
                </button>
              </div>

              <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800">
                <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">
                  Appearance
                </div>
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