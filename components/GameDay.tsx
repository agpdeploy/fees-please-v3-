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
  
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchSquad, setMatchSquad] = useState<any[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);

  // 1. Fetch Teams
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
        if (data.length === 1) setSelectedTeamId(data[0].id);
        else if (data.length > 0 && !data.find(t => t.id === selectedTeamId)) setSelectedTeamId(""); 
      }
      setLoading(false);
    }
    fetchTeams();
  }, [profile, activeClubId]);

  // 2. Fetch Fixture
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

      if (!error) setNextGame(data);
      else setNextGame(null);
    }
    fetchNextGame();
  }, [selectedTeamId]);

  // 3. Fetch Match Squad & Available Players (FIXED)
  useEffect(() => {
    async function loadSquadData() {
      // Added activeClubId to ensure we have the necessary ID before fetching players
      if (!nextGame || !selectedTeamId || !activeClubId) return;

      // Fetch existing squad - Explicitly declared foreign key join
      const { data: squadData, error: squadError } = await supabase
        .from('match_squads')
        .select('*, players:player_id(*)') 
        .eq('fixture_id', nextGame.id);
      
      if (squadError) console.error("SQUAD FETCH ERROR:", squadError.message);
      if (squadData) setMatchSquad(squadData);

      // Fetch available players - Fixed to query by club_id
      const { data: playersData, error: playersError } = await supabase
        .from('players') 
        .select('*')
        .eq('club_id', activeClubId); 

      if (playersError) {
        console.error("PLAYERS FETCH ERROR:", playersError.message);
      } else if (playersData) {
        console.log("PLAYERS LOADED:", playersData.length);
        setAvailablePlayers(playersData);
      }
    }
    loadSquadData();
  }, [nextGame, selectedTeamId, activeClubId]); // Added activeClubId to dependency array

  const handleAddToSquad = async (player: any) => {
    if (!nextGame) return;

    setMatchSquad([...matchSquad, { players: player }]);
    setShowQuickAdd(false);
    setSearchQuery("");

    await supabase.from('match_squads').insert({
      fixture_id: nextGame.id,
      player_id: player.id 
    });
  };

  // BULLETPROOF SEARCH LOGIC (FIXED)
  const filteredPlayers = availablePlayers.filter(p => {
    // 1. Prevent crashes if a player object is malformed
    if (!p) return false;

    // 2. Prevent showing players in the search who are ALREADY in the match squad
    const isAlreadyInSquad = matchSquad.some(squadItem => {
      const squadPlayer = squadItem.players || squadItem;
      return squadPlayer.id === p.id;
    });
    
    if (isAlreadyInSquad) return false;

    // 3. Safe string matching
    const firstName = p.first_name || "";
    const lastName = p.last_name || "";
    const email = p.email || "";
    const searchLower = (searchQuery || "").toLowerCase();
    
    return (
      (firstName + " " + lastName).toLowerCase().includes(searchLower) ||
      email.toLowerCase().includes(searchLower)
    );
  });

  if (loading) return <div className="text-center p-6 text-zinc-500 text-xs font-black uppercase tracking-widest animate-pulse">Loading GameDay...</div>;
  if (teams.length === 0) return <div className="text-center p-6 text-zinc-500 text-xs font-black uppercase tracking-widest">No teams assigned yet.</div>;

  return (
    <div className="animate-in fade-in duration-300 space-y-6 pb-20 relative">
      
      {teams.length > 1 && (
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-3xl shadow-lg">
          <label className="text-[10px] text-brand uppercase font-black block mb-2 ml-1 tracking-widest">
            Admin View
          </label>
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white outline-none font-bold"
          >
            <option value="" disabled>-- Select a Team --</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {selectedTeamId ? (
        <>
          {nextGame ? (
            <>
              <div className="bg-[#111] border border-zinc-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-brand"></div>
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-black italic text-brand uppercase tracking-tighter">
                      vs {nextGame.opponent}
                    </h2>
                    <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest mt-1">
                       {new Date(nextGame.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowQuickAdd(true)}
                    className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 text-brand flex items-center justify-center transition-colors hover:bg-zinc-800"
                  >
                    <i className="fa-solid fa-user-plus"></i>
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <h2 className="text-[11px] font-black uppercase italic text-brand tracking-widest mb-4 px-1">
                  To Pay ({matchSquad.length})
                </h2>
                <div className="flex flex-wrap gap-2.5">
                  {matchSquad.length > 0 ? (
                    matchSquad.map((squadItem, i) => {
                      const p = squadItem.players || squadItem; 
                      return (
                        <button key={i} className="px-4 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all relative bg-[#1A1A1A] text-zinc-300 border border-zinc-800/50 hover:border-zinc-600">
                          {p.first_name || 'Unknown'} {p.last_name?.charAt(0) || p.email?.charAt(0) || ''}
                        </button>
                      );
                    })
                  ) : (
                    <div className="text-zinc-600 text-[10px] font-black uppercase tracking-widest px-1">Squad is empty</div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-[#111] border border-zinc-800 rounded-3xl p-6 text-center shadow-2xl">
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
            <div className="text-zinc-500 text-xs font-black uppercase tracking-widest">Select a team above</div>
          </div>
        )
      )}

      {showQuickAdd && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-zinc-800 rounded-3xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[80vh]">
            
            <div className="flex justify-between items-center p-5 border-b border-zinc-800/50">
              <h3 className="text-brand font-black italic uppercase tracking-widest text-[11px]">Quick Add</h3>
              <button onClick={() => setShowQuickAdd(false)} className="text-zinc-500 hover:text-white transition-colors">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="p-4 border-b border-zinc-800/50">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-brand transition-colors"
                autoFocus
              />
            </div>

            <div className="overflow-y-auto p-4 space-y-2">
              {filteredPlayers.length > 0 ? (
                filteredPlayers.map((player) => (
                  <div key={player.id} className="flex justify-between items-center bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                    <span className="text-white font-bold text-sm">
                      {player.first_name || player.email} <span className="text-zinc-500 font-normal">({player.role || 'Player'})</span>
                    </span>
                    <button 
                      onClick={() => handleAddToSquad(player)}
                      className="text-brand text-2xl font-light hover:scale-110 transition-transform"
                    >
                      +
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                  No players found
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}