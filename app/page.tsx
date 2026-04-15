// Deploy version 4.0 - Clean Navigation & No Floating Bubble
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
  const [activeTab, setActiveTab] = useState('gameday');
  const [session, setSession] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const { profile, roles, loading: profileLoading } = useProfile();
  const { activeClubId, setActiveClubId } = useActiveClub();
  const [theme, setTheme] = useState({ name: 'FP', color: '#10b981', font: 'Inter', logo: '' });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDaiveOpen, setIsDaiveOpen] = useState(false);

  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'club_admin';

  const handleTabChange = (tab: string) => {
    if (tab === "daive") {
      setIsDaiveOpen(!isDaiveOpen);
      return;
    }
    setActiveTab(tab);
    setIsDaiveOpen(false);
    setIsSidebarOpen(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsCheckingAuth(false);
    });
  }, []);

  if (isCheckingAuth || profileLoading) return null;
  if (!session) return <Login />;

  return (
    <div className="flex flex-col h-screen max-w-[480px] mx-auto bg-zinc-50 dark:bg-zinc-950 shadow-2xl relative overflow-hidden">
      
      {/* HEADER */}
      <header className="shrink-0 p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-black z-40">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-black italic uppercase tracking-tighter text-brand">Fees Please</h1>
        </div>
        <button onClick={() => setIsSidebarOpen(true)} className="text-zinc-500 w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
          <i className="fa-solid fa-bars"></i>
        </button>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 relative z-30 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "gameday" && <GameDay />}
          {activeTab === "ledger" && <Ledger />}
          {activeTab === "setup" && <Setup />}
        </div>

        {/* dAIve OVERLAY: Slides up from the bottom */}
        {isDaiveOpen && (
          <div className="absolute inset-0 z-50 bg-white dark:bg-zinc-950 animate-in slide-in-from-bottom-full duration-300">
            <ChatWidget onClose={() => setIsDaiveOpen(false)} />
          </div>
        )}
      </main>

      {/* BOTTOM NAVIGATION: Purely functional, no floating bits */}
      <nav className="shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black pb-8 pt-4 z-40">
        <div className="flex text-[11px] font-black uppercase text-zinc-500">
          <button onClick={() => handleTabChange("gameday")} className={`flex-1 flex flex-col items-center ${activeTab === "gameday" && !isDaiveOpen ? "text-emerald-600" : ""}`}>
            <i className="fa-solid fa-bolt-lightning text-2xl mb-1"></i><span>GameDay</span>
          </button>
          <button onClick={() => handleTabChange("ledger")} className={`flex-1 flex flex-col items-center ${activeTab === "ledger" && !isDaiveOpen ? "text-emerald-600" : ""}`}>
            <i className="fa-solid fa-wallet text-2xl mb-1"></i><span>Ledger</span>
          </button>
          <button onClick={() => handleTabChange("daive")} className={`flex-1 flex flex-col items-center ${isDaiveOpen ? "text-emerald-600" : ""}`}>
            <i className="fa-solid fa-robot text-2xl mb-1"></i><span>dAIve</span>
          </button>
        </div>
      </nav>
    </div>
  );
}