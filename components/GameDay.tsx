"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { useActiveClub } from "@/contexts/ClubContext";

export default function GameDay() {
  const { profile } = useProfile();
  const { activeClubId } = useActiveClub();
  
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  
  // State to hold the upcoming game
  const [nextGame, setNextGame] = useState<any>(null);

  // Fetch Teams and handle Auto-Select
  useEffect(() => {
    async function fetchTeams() {
      if (!profile) return;
      setLoading(true);

      let query = supabase.from("teams").select("*");
      
      // Admin vs Captain routing
      if (profile.role === 'club_admin' || profile.role === 'super_admin') {
        if (activeClubId) query = query.eq('club_id', activeClubId);
      } else {
        const { data: roles } = await supabase.from('user_roles').select('team_id').eq('user_id', profile.id).eq('role', 'team_admin');
        const teamIds = roles?.map(r => r.team_id).filter(Boolean) || [];
        if (teamIds.length > 0) {
          query = query.in('id', teamIds);
        } else {
          setTeams([]);
          setLoading(false);
          return; 
        }
      }

      const { data, error } = await query;

      if (!error && data) {
        setTeams(data);
        // AUTO-SELECT LOGIC
        if (data.length === 1) {
          setSelectedTeamId(data[0].id);
        } else if (data.length > 0 && !data.find(t => t.id === selectedTeamId)) {
          setSelectedTeamId(""); 
        }
      }
      setLoading(false);
    }

    fetchTeams();
  }, [profile, activeClubId]);

  // Fetch the next game whenever the selected team changes
  useEffect(() => {
    async function fetchNextGame() {
      if (!selectedTeamId) {
        setNextGame(null);
        return;
      }

      // Get today's date to ensure we don't show past games
      const today = new Date().toISOString().split('T')[0];

      // UPDATED TO LOOK FOR THE 'fixtures' TABLE
      const { data, error } = await supabase
        .from('fixtures') 
        .select('*')
        .eq('team_id', selectedTeamId)
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(1)
        .single();

      if (error) {
        console.error("SUPABASE GAME FETCH ERROR:", error.message);
        setNextGame(null); // Clear state on error
      } else {
        console.log("FOUND NEXT GAME:", data);
        setNextGame(data);
      }
    }
    
    fetchNextGame();
  }, [selectedTeamId]);

  if (loading) {
    return <div className="text-center p-6 text-zinc-500 text-xs font-black uppercase tracking-widest animate-pulse">Loading GameDay...</div>;
  }

  if (teams.length === 0) {
    return <div className="text-center p-6 text-zinc-500 text-xs font-black uppercase tracking-widest">No teams assigned yet.</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Only show the dropdown if the user manages MORE than 1 team */}
      {teams.length > 1 && (
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
          <label className="text-[10px] font-black text-brand uppercase tracking-widest mb-2 block">
            Managing Team
          </label>
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white font-bold outline-none focus:border-brand transition-colors"
          >
            <option value="" disabled>Select a team...</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {selectedTeamId ? (
        <>
          {/* DYNAMIC GAME DISPLAY */}
          {nextGame ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center shadow-lg border-t-2 border-t-brand">
              <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2">
                Next Fixture • {new Date(nextGame.date).toLocaleDateString()}
              </div>
              <h2 className="text-white font-black italic uppercase tracking-widest text-2xl mb-6">
                VS {nextGame.opponent}
              </h2>
              <button className="w-full bg-brand hover:bg-emerald-500 text-black font-black py-4 rounded-xl uppercase tracking-widest text-xs transition-colors shadow-lg">
                <i className="fa-solid fa-users mr-2"></i> Pre-Game Squad
              </button>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center shadow-lg">
              <div className="w-16 h-16 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto mb-4 border border-brand/20 shadow-inner">
                <i className="fa-solid fa-trophy text-2xl"></i>
              </div>
              <h2 className="text-white font-black italic uppercase tracking-widest text-lg mb-2">Next Fixture</h2>
              <p className="text-zinc-500 text-xs uppercase font-bold tracking-widest">
                No upcoming games scheduled.
              </p>
            </div>
          )}
        </>
      ) : (
        teams.length > 1 && (
          <div className="text-center p-10 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl">
            <i className="fa-solid fa-arrow-up text-zinc-600 text-2xl mb-3 animate-bounce"></i>
            <div className="text-zinc-500 text-xs font-black uppercase tracking-widest">Select a team above to start GameDay</div>
          </div>
        )
      )}
    </div>
  );
}