"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { useActiveClub } from "@/contexts/ClubContext";

export default function MyTeam() {
  const { profile, roles } = useProfile();
  const { activeClubId } = useActiveClub();

  const [isLoading, setIsLoading] = useState(true);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [players, setPlayers] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const isClubAdmin = profile?.role === 'super_admin' || roles?.some((r: any) => r.role === 'club_admin' && r.club_id === activeClubId);

  useEffect(() => {
    async function fetchTeamData() {
      if (!profile || !activeClubId) return;
      setIsLoading(true);

      // 1. Determine Teams
      let teamQuery = supabase.from("teams").select("id, name, slug").eq("club_id", activeClubId);
      if (!isClubAdmin) {
        const allowedTeamIds = roles?.filter((r: any) => r.role === 'team_admin' && r.club_id === activeClubId).map((r: any) => r.team_id) || [];
        if (allowedTeamIds.length === 0) { setIsLoading(false); return; }
        teamQuery = teamQuery.in('id', allowedTeamIds);
      }
      
      const { data: teamData } = await teamQuery;
      const validTeams = teamData || [];
      setTeams(validTeams);
      
      if (validTeams.length > 0) {
        const initialTeamId = validTeams[0].id;
        setSelectedTeamId(initialTeamId);
        await loadRoster(initialTeamId);
      } else {
        setIsLoading(false);
      }
    }

    fetchTeamData();
  }, [profile, activeClubId, roles, isClubAdmin]);

  async function loadRoster(teamId: string) {
    setIsLoading(true);
    const { data } = await supabase
      .from("players")
      .select("id, first_name, last_name, nickname")
      .eq("default_team_id", teamId)
      .order("first_name");
    
    setPlayers(data || []);
    setIsLoading(false);
  }

  const handleTeamChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tid = e.target.value;
    setSelectedTeamId(tid);
    await loadRoster(tid);
  };

  const copyTeamLink = () => {
    if (!selectedTeamId) return;
    const team = teams.find(t => t.id === selectedTeamId);
    const identifier = team?.slug || selectedTeamId;
    const link = `${window.location.origin}/t/${identifier}`;
    navigator.clipboard.writeText(link);
    setToast("Public Link Copied!");
    setTimeout(() => setToast(null), 2000);
  };

  const formatName = (p: any) => p.nickname ? p.nickname : `${p.first_name} ${p.last_name?.charAt(0) || ''}.`;

  if (isLoading && teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="p-10 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl mt-6 shadow-sm">
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">You are not assigned to manage any teams yet.</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 space-y-6 pb-20 relative">
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-emerald-500 text-black px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg z-50 animate-in slide-in-from-bottom-2 fade-in whitespace-nowrap">
          <i className="fa-solid fa-check mr-2"></i> {toast}
        </div>
      )}

      {/* HEADER & TEAM SELECT */}
      {teams.length > 1 && (
        <div className="flex justify-end items-center bg-white dark:bg-[#111] p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <select 
            value={selectedTeamId} 
            onChange={handleTeamChange} 
            className="w-full sm:w-auto bg-zinc-50 dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors cursor-pointer"
          >
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {/* PUBLIC LINK CARD */}
      <div className="bg-emerald-600 dark:bg-emerald-500 rounded-3xl p-6 shadow-lg text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-10 translate-x-10"></div>
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100 dark:text-emerald-900 mb-2 relative z-10">Share With Players</h2>
        <p className="text-2xl font-black italic tracking-tighter mb-4 relative z-10">Public Availability Hub</p>
        <p className="text-xs text-emerald-50 dark:text-emerald-950 font-bold mb-6 relative z-10 max-w-[280px]">
          Share this unique link in your team WhatsApp or group chat so players can RSVP for upcoming games.
        </p>
        <button 
          onClick={copyTeamLink}
          className="w-full py-4 bg-white text-emerald-600 dark:bg-[#0a0a0a] dark:text-emerald-500 rounded-xl text-xs font-black uppercase tracking-widest shadow-md hover:scale-[1.02] active:scale-95 transition-all relative z-10 flex items-center justify-center gap-2"
        >
          <i className="fa-solid fa-copy text-sm"></i> Copy Hub Link
        </button>
      </div>

      {/* EMBEDDED HUB */}
      <div className="bg-zinc-100 dark:bg-[#0a0a0a] rounded-[2rem] overflow-hidden border-4 border-zinc-800 shadow-2xl h-[800px] max-w-md mx-auto relative flex flex-col">
        <div className="bg-zinc-800 py-2 flex items-center justify-center gap-2 relative">
          <div className="w-16 h-4 bg-zinc-900 rounded-full"></div>
        </div>
        <iframe 
          src={`/t/${teams.find(t => t.id === selectedTeamId)?.slug || selectedTeamId}`} 
          className="w-full h-full border-none bg-zinc-50 dark:bg-[#0a0a0a]"
        ></iframe>
      </div>

    </div>
  );
}