// Deploy version 3.2 - Clean Bottom Nav
"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useProfile } from "../lib/useProfile";
import { useActiveClub } from "../contexts/ClubContext";
import GameDay from "../components/GameDay";
import Ledger from "../components/Ledger";
import Setup from "../components/Setup";
import Login from "../components/Login";
import ClubSwitcher from "../components/ClubSwitcher";
import ThemeToggle from "../components/ThemeToggle"; 

export default function Home() {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('activeTab') || 'gameday';
    }
    return 'gameday';
  });

  const [session, setSession] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  const { profile, loading: profileLoading } = useProfile();
  const { activeClubId, setActiveClubId } = useActiveClub();
  
  const [theme, setTheme] = useState({ name: 'FP', color: '#10b981', font: 'Inter', logo: '' });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'club_admin';

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    sessionStorage.setItem('activeTab', tab);
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
    const targetClubId = profile?.role === 'super_admin' ? activeClubId : (profile?.club_id || activeClubId);
    
    if (targetClubId && targetClubId !== activeClubId) {
      setActiveClubId(targetClubId);
    }

    if (targetClubId) {
      const fetchTheme = async () => {
        const { data } = await supabase.from('clubs').select('name, theme_color, theme_font, logo_url').eq('id', targetClubId).single();
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem("activeTab");
    window.location.reload(); 
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

  const displayRole = profile?.role === 'super_admin' ? 'God Mode' : 
                      profile?.role === 'club_admin' ? 'Club Admin' : 
                      profile?.role === 'team_admin' ? 'Team Captain' : 'Player';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --brand-color: ${theme.color};
          --brand-font: '${theme.font}', sans-serif;
        }
        body { font-family: var(--brand-font) !important; }
      `}} />

      <div className="flex flex-col min-h-screen max-w-[480px] mx-auto bg-zinc-50 dark:bg-zinc-950 shadow-2xl relative overflow-hidden transition-colors duration-300">
        
        <header className="sticky top-0 p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white/80 dark:bg-black/80 backdrop-blur-md z-40 transition-colors">
          <div className="flex items-center gap-3">
            {theme.logo ? (
              <img src={theme.logo} className="w-9 h-9 rounded-lg object-cover bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800" alt="Club Logo" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center font-black text-xs text-brand uppercase tracking-tighter shadow-inner transition-colors">
                {theme.name.substring(0, 2)}
              </div>
            )}
            <div>
              <h1 className="text-xl font-black italic uppercase tracking-tighter text-brand">Fees Please</h1>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-none">
                {displayRole} Access
              </p>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center transition-colors">
            <i className="fa-solid fa-bars text-sm"></i>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4">
          <div className="mb-6 z-30 relative">
            <ClubSwitcher />
          </div>

          {activeTab === "gameday" && <GameDay />}
          {activeTab === "ledger" && <Ledger />}
          {activeTab === "setup" && isAdmin && <Setup />}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-black/95 backdrop-blur-md pb-8 pt-4 z-40 transition-colors">
          <div className="flex text-[11px] max-w-[480px] mx-auto font-black uppercase text-zinc-500">
            <button onClick={() => handleTabChange("gameday")} className={`flex-1 flex flex-col items-center transition-colors ${activeTab === "gameday" ? "text-brand" : "hover:text-zinc-700 dark:hover:text-zinc-300"}`}>
              <i className="fa-solid fa-bolt-lightning text-2xl mb-1"></i><span>GameDay</span>
            </button>
            <button onClick={() => handleTabChange("ledger")} className={`flex-1 flex flex-col items-center transition-colors ${activeTab === "ledger" ? "text-brand" : "hover:text-zinc-700 dark:hover:text-zinc-300"}`}>
              <i className="fa-solid fa-wallet text-2xl mb-1"></i><span>Ledger</span>
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
                
                <button onClick={() => { alert('Fees Please v3.2\nCreated for sports clubs.'); setIsSidebarOpen(false); }} className="w-full text-left px-6 py-4 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 text-xs font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-widest">
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