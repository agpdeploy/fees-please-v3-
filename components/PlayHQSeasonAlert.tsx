"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface PlayHQSeasonAlertProps {
  clubRecord: any;
  teams: any[];
  newSeasons: any[];
  setNewSeasons?: (seasons: any[] | ((prev: any[]) => any[])) => void;
  isRedirectOnly?: boolean;
}

export default function PlayHQSeasonAlert({
  clubRecord,
  teams,
  newSeasons,
  setNewSeasons,
  isRedirectOnly = false
}: PlayHQSeasonAlertProps) {
  const [isSaving, setIsSaving] = useState(false);

  if (!newSeasons || newSeasons.length === 0) return null;

  // Extract orgSlug from the first team that has a playhq_url
  let orgSlug = "";
  for (const team of teams) {
    if (team.settings?.playhq_url) {
      try {
        const url = new URL(team.settings.playhq_url);
        const parts = url.pathname.split('/').filter(Boolean);
        const orgIndex = parts.indexOf('org');
        if (orgIndex !== -1 && parts.length > orgIndex + 1) {
          orgSlug = parts[orgIndex + 1];
          break;
        }
      } catch (e) {}
    }
  }

  // Fallback orgSlug to tenant if missing
  if (!orgSlug && clubRecord?.settings?.playhq_tenant) {
     orgSlug = clubRecord.settings.playhq_tenant;
  }

  const handleMute = async (competitionId: string) => {
    setIsSaving(true);
    try {
      const currentSettings = typeof clubRecord?.settings === 'object' && clubRecord.settings !== null ? clubRecord.settings : {};
      const currentIgnored = currentSettings.ignored_playhq_competition_ids || [];
      const updatedIgnored = [...new Set([...currentIgnored, competitionId])];
      const newSettings = {
        ...currentSettings,
        ignored_playhq_competition_ids: updatedIgnored
      };

      const { error } = await supabase
        .from('clubs')
        .update({ settings: newSettings })
        .eq('id', clubRecord.id);

      if (error) throw error;

      if (setNewSeasons) {
        setNewSeasons(prev => prev.filter(item => item.competitionId !== competitionId));
      }
      
      alert("Competition muted successfully!");
    } catch (err: any) {
      console.error(err);
      alert("Error muting competition.");
    } finally {
      setIsSaving(false);
    }
  };

  const tenant = clubRecord?.settings?.playhq_tenant || 'cricket-australia';
  const orgId = clubRecord?.settings?.playhq_org_id || '';

  if (isRedirectOnly) {
    return (
      <div 
        onClick={() => {
           window.dispatchEvent(new CustomEvent('navigate-setup', { detail: 'teams' }));
        }}
        className="cursor-pointer bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-4 rounded-xl shadow-sm transition-colors mb-6 hover:bg-amber-100 dark:hover:bg-amber-500/20 active:scale-[0.99] group"
      >
        <div className="flex gap-4 items-start">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-bell text-amber-600 dark:text-amber-500"></i>
          </div>
          <div>
            <h3 className="text-sm font-black text-amber-700 dark:text-amber-500 uppercase tracking-wide">
              New PlayHQ Seasons Detected
            </h3>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-bold leading-relaxed mt-1">
              A new season has started! Click here to update your teams in Team Management.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-5 space-y-4 transition-all animate-in fade-in slide-in-from-top-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
          <i className="fa-solid fa-bell text-sm animate-bounce"></i>
        </div>
        <div className="flex-1">
          <h3 className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-2">
            New PlayHQ Seasons Detected
          </h3>
          <p className="text-[11px] text-amber-700 dark:text-amber-400/80 font-medium mt-1">
            The following competitions are now live on PlayHQ. Click "Get Link from PlayHQ" to find your team URL, then paste it in the team cards below to sync fixtures.
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        {newSeasons.map((s) => {
          // Construct the playhq link correctly
          // Example: https://www.playhq.com/cricket-australia/org/ferny-districts-cricket-club/462e4428/senior-competition-winter-2026/5eb3dc88/teams
          const playhqLink = `https://www.playhq.com/${tenant}/org/${orgSlug}/${orgId}/${s.seasonSlug}/${s.seasonId}/teams`;
          
          return (
            <div key={`${s.competitionId}-${s.seasonId}`} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-155 dark:border-zinc-800/80 px-4 py-3 rounded-xl shadow-sm text-xs font-bold text-zinc-800 dark:text-zinc-200 gap-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
                <span>{s.competitionName}</span>
                <span className="text-[10px] text-zinc-400 font-normal">({s.seasonName})</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  disabled={isSaving}
                  onClick={() => handleMute(s.competitionId)}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 disabled:opacity-50"
                >
                  Mute
                </button>
                <a
                  href={playhqLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 transition-colors text-[10px] font-bold uppercase tracking-wider text-white disabled:opacity-50 flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-external-link"></i>
                  PlayHQ Link
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
