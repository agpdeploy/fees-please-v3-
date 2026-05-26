"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface CrossClubPlayer {
  email: string;
  player_names: string[];
  club_names: string[];
  team_names: string[];
}

function PlayerAccordionItem({ match }: { match: CrossClubPlayer }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Helper to obfuscate name: "Emily Pitt" -> "Emily P."
  const obfuscateName = (fullName: string) => {
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  };

  // Only show the first unique obfuscated name to avoid "Emily P., Emily P."
  const displayName = Array.from(new Set(match.player_names.map(obfuscateName))).join(', ');

  return (
    <div 
      className={`p-4 rounded-xl border transition-all duration-300 ${isExpanded ? 'bg-white dark:bg-zinc-800 shadow-md border-zinc-300 dark:border-zinc-700' : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer'}`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 transition-colors ${isExpanded ? 'bg-blue-500 text-white' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'}`}>
            {match.player_names[0]?.substring(0, 2).toUpperCase() || 'P'}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-zinc-900 dark:text-white truncate">
              {displayName}
            </div>
            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest truncate">
              {match.club_names.length} Clubs • {match.team_names?.length || 0} Teams
            </div>
          </div>
        </div>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-zinc-400 transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-zinc-100 dark:bg-zinc-700' : ''}`}>
          <i className="fa-solid fa-chevron-down text-[10px]"></i>
        </div>
      </div>
      
      <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-700' : 'grid-rows-[0fr] opacity-0 mt-0 pt-0'}`}>
        <div className="overflow-hidden">
          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-3 truncate flex items-center gap-2">
            <i className="fa-solid fa-envelope"></i> {match.email}
          </div>
          <div className="flex flex-wrap gap-2">
            {match.club_names.map((club, j) => (
              <span key={`club-${j}`} className="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md text-[9px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400 shadow-sm flex items-center gap-1">
                <i className="fa-solid fa-shield-halved"></i> {club}
              </span>
            ))}
            {match.team_names?.filter(Boolean).map((team, j) => (
              <span key={`team-${j}`} className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 border border-transparent rounded-md text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-500 shadow-sm flex items-center gap-1">
                <i className="fa-solid fa-users"></i> {team}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlayerMatcher() {
  const [matches, setMatches] = useState<CrossClubPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      setIsLoading(true);
      const { data, error } = await supabase.rpc('get_cross_club_players');
      
      if (data && !error) {
        setMatches(data);
      }
      setIsLoading(false);
    };

    fetchMatches();
  }, []);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm flex flex-col h-full">
      <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-950/50">
        <h2 className="font-black uppercase tracking-widest text-sm text-zinc-900 dark:text-white flex items-center gap-3">
          <i className="fa-solid fa-users-between-lines text-blue-500"></i>
          Cross-Club Players
        </h2>
        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
          {matches.length} Found
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0"></div>
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2"></div>
                  <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-8">
            <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
              <i className="fa-solid fa-user-shield text-2xl text-zinc-400"></i>
            </div>
            <h3 className="font-black text-sm text-zinc-900 dark:text-white uppercase tracking-widest">No Matches Found</h3>
            <p className="text-xs text-zinc-500 mt-2 max-w-[200px]">No players are currently associated with more than one club via the same email.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map((match, i) => (
              <PlayerAccordionItem key={i} match={match} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
