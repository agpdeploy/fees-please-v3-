"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface SetupChecklistProps {
  activeClubId: string;
  clubInfo: any;
  teamFees: any;
  teamsCount: number;
  onDismiss: () => void;
}

export default function SetupChecklist({ activeClubId, clubInfo, teamFees, teamsCount, onDismiss }: SetupChecklistProps) {
  const [hasPlayers, setHasPlayers] = useState(false);
  const [hasFixtures, setHasFixtures] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      if (!activeClubId) return;
      const { count: playerCount } = await supabase.from('players').select('*', { count: 'exact', head: true }).eq('club_id', activeClubId);
      const { count: fixtureCount } = await supabase.from('fixtures').select('*', { count: 'exact', head: true }).eq('club_id', activeClubId);
      
      setHasPlayers((playerCount || 0) > 0);
      setHasFixtures((fixtureCount || 0) > 0);
      setLoading(false);
    }
    checkStatus();
  }, [activeClubId]);

  const hasLogo = !!clubInfo.logo;
  const hasTeams = teamsCount > 0;
  
  // They have financials if they've set a pay_id, OR if they've changed the default fees from 10/25 (or if they are already custom)
  // Actually, let's just check if pay_id is set or if they use square.
  const hasFinancials = !!clubInfo.pay_id_value || !!clubInfo.is_square_enabled;

  const steps = [
    {
      id: 'logo',
      title: 'Add a club logo',
      completed: hasLogo,
      action: () => window.dispatchEvent(new CustomEvent('navigate-setup', { detail: 'settings' }))
    },
    {
      id: 'teams',
      title: 'Add a team',
      completed: hasTeams,
      action: () => window.dispatchEvent(new CustomEvent('navigate-setup', { detail: 'teams' }))
    },
    {
      id: 'players',
      title: 'Add players to your squad',
      completed: hasPlayers,
      action: () => window.dispatchEvent(new CustomEvent('navigate-setup', { detail: 'teams' }))
    },
    {
      id: 'fixtures',
      title: 'Add your season fixtures',
      completed: hasFixtures,
      action: () => window.dispatchEvent(new CustomEvent('navigate-setup', { detail: 'fixtures' }))
    },
    {
      id: 'financials',
      title: 'Set payment details',
      completed: hasFinancials,
      action: () => window.dispatchEvent(new CustomEvent('navigate-setup', { detail: 'settings' }))
    }
  ];

  const allCompleted = steps.every(s => s.completed);

  if (loading) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-900/50 p-6 rounded-2xl shadow-sm mb-6 animate-in slide-in-from-top-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
      
      <div className="flex justify-between items-start mb-5">
        <div>
          <h3 className="font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 text-sm mb-1">Let's Get Started</h3>
          <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Complete these steps to set up your club.</p>
        </div>
        <button 
          onClick={onDismiss}
          className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        >
          Dismiss
        </button>
      </div>

      <div className="space-y-3">
        {steps.map(step => (
          <div key={step.id} className={`flex items-center justify-between p-3.5 rounded-xl border transition-colors ${step.completed ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${step.completed ? 'bg-emerald-500 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400'}`}>
                {step.completed ? <i className="fa-solid fa-check text-[10px]"></i> : <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500"></span>}
              </div>
              <span className={`text-xs font-bold ${step.completed ? 'line-through text-emerald-700/60 dark:text-emerald-500/60' : 'text-zinc-900 dark:text-white'}`}>
                {step.title}
              </span>
            </div>
            {!step.completed && (
              <button 
                onClick={step.action}
                className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 bg-emerald-100/50 dark:bg-emerald-500/10 hover:bg-emerald-200/50 dark:hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg transition-colors"
              >
                Go
              </button>
            )}
          </div>
        ))}
      </div>

      {allCompleted && (
        <button 
          onClick={onDismiss}
          className="w-full mt-5 bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white font-black uppercase tracking-widest text-xs py-3.5 rounded-xl transition-all shadow-md active:scale-95"
        >
          Complete Setup
        </button>
      )}
    </div>
  );
}
