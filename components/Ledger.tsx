"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { useActiveClub } from "@/contexts/ClubContext";

export default function Ledger() {
  const { profile } = useProfile();
  const { activeClubId } = useActiveClub();
  
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Fetch Teams and handle Auto-Select
  useEffect(() => {
    async function fetchTeams() {
      if (!profile) return;
      setLoading(true);

      let query = supabase.from("teams").select("*");
      
      // If they are a club admin/super admin, show all teams in the active club
      if (profile.role === 'club_admin' || profile.role === 'super_admin') {
        if (activeClubId) query = query.eq('club_id', activeClubId);
      } else {
        // Otherwise, only show teams they explicitly have captain access to
        const { data: roles } = await supabase.from('user_roles').select('team_id').eq('user_id', profile.id).eq('role', 'team_admin');
        const teamIds = roles?.map(r => r.team_id).filter(Boolean) || [];
        if (teamIds.length > 0) {
          query = query.in('id', teamIds);
        } else {
          setTeams([]);
          setLoading(false);
          return; // No teams found
        }
      }

      const { data, error } = await query;

      if (!error && data) {
        setTeams(data);
        
        // THE AUTO-SELECT LOGIC
        if (data.length === 1) {
          setSelectedTeamId(data[0].id);
        } else if (data.length > 0 && !data.find(t => t.id === selectedTeamId)) {
          setSelectedTeamId(""); // Reset if previous selection is no longer valid
        }
      }
      setLoading(false);
    }

    fetchTeams();
  }, [profile, activeClubId]);

  if (loading) {
    return <div className="text-center p-6 text-zinc-500 text-xs font-black uppercase tracking-widest animate-pulse">Loading Ledger...</div>;
  }

  if (teams.length === 0) {
    return <div className="text-center p-6 text-zinc-500 text-xs font-black uppercase tracking-widest">No teams assigned yet.</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* CONDITIONAL UI: 
        Only show the dropdown if the user manages MORE than 1 team 
      */}
      {teams.length > 1 && (
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
          <label className="text-[10px] font-black text-brand uppercase tracking-widest mb-2 block">
            Viewing Ledger As
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
          {/* Season Audit Box */}
          <div className="bg-zinc-900 border border-zinc-800 border-t-2 border-t-cyan-500 rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-cyan-500 font-black italic uppercase tracking-widest text-sm">Season Audit</h2>
              <div className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest border border-emerald-500/20">
                $0 Net
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-[10px] text-zinc-500 uppercase tracking-widest font-black">
                    <th className="pb-3 pr-4">VS</th>
                    <th className="pb-3 px-4 text-right">Fee</th>
                    <th className="pb-3 px-4 text-right">Cash</th>
                    <th className="pb-3 px-4 text-right">Card</th>
                    <th className="pb-3 pl-4 text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-zinc-800/50 text-sm font-bold text-white last:border-0">
                    <td className="py-4 pr-4 whitespace-nowrap">First Game</td>
                    <td className="py-4 px-4 text-right text-zinc-400">$0</td>
                    <td className="py-4 px-4 text-right text-emerald-500">$0</td>
                    <td className="py-4 px-4 text-right text-blue-500">$0</td>
                    <td className="py-4 pl-4 text-right text-emerald-500">$0</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Outstanding Debts Box */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg">
            <h2 className="text-red-500 font-black italic uppercase tracking-widest text-sm mb-6">Outstanding Debts</h2>
            <div className="py-8 text-center text-zinc-600 font-black uppercase tracking-widest text-xs">
              All Clear!
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-zinc-600 font-black italic uppercase tracking-widest text-[10px]">Recent Activity</h2>
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs"></i>
                <input 
                  type="text" 
                  placeholder="Filter..." 
                  className="bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-brand transition-colors w-32 focus:w-48"
                />
              </div>
            </div>
            {/* Activity List will go here */}
          </div>
        </>
      ) : (
        teams.length > 1 && (
          <div className="text-center p-10 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl">
            <i className="fa-solid fa-arrow-up text-zinc-600 text-2xl mb-3 animate-bounce"></i>
            <div className="text-zinc-500 text-xs font-black uppercase tracking-widest">Select a team above to view ledger</div>
          </div>
        )
      )}
    </div>
  );
}