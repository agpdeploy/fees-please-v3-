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
  
  const [nextGame, setNextGame] = useState<any>(null);

  useEffect(() => {
    async function fetchTeams() {
      if (!profile) return;
      setLoading(true);

      let query = supabase.from("teams").select("*");
      
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

  useEffect(() => {
    async function fetchNextGame() {
      if (!selectedTeamId) {
        setNextGame(null);
        return;
      }

      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('fixtures') 
        .select('*')
        .eq('team_id', selectedTeamId)
        .gte('match_date', today)
        .order('match_date', { ascending: true })
        .limit(1)
        .single();

      if (error) {
        setNextGame(null); 
      } else {
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
      
      {teams.length > 1 && (
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-[2rem]">
          <label className="text-[10px] font-black text-brand uppercase tracking-widest mb-2 block pl-2">
            Admin View
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
          {nextGame ? (
            <div>
              {/* RESTORED SLEEK UI */}
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-[2rem] p-5 flex justify-between items-center relative overflow-hidden shadow-lg">
                
                {/* Left accent line */}
                <div className="absolute left-0 top-0 bottom-0 w-2 bg-brand"></div>

                <div className="pl-3">
                  <h2 className="text-brand font-black italic uppercase tracking-widest text-xl mb-1">
                    VS {nextGame.opponent}
                  </h2>
                  <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">
                    {new Date(nextGame.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase()}
                  </p>
                </div>

                <button className="w-12 h-12 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 rounded-full flex items-center justify-center text-brand transition-colors shadow-inner shrink-0">
                  <i className="fa-solid fa-user-plus text-lg"></i>
                </button>
              </div>

              {/* Restored 'TO PAY' section */}
              <div className="mt-8 px-4">
                <h3 className="text-brand font-black italic uppercase tracking-widest text-[11px]">To Pay (0)</h3>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-6 text-center shadow-lg">
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