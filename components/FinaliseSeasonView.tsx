"use client";

import { useState } from "react";

export default function FinaliseSeasonView({
  clubId,
  teams,
  seasonName,
  seasonStart,
  seasonEnd,
  onCancel,
  onComplete
}: {
  clubId: string;
  teams: any[];
  seasonName: string;
  seasonStart: string;
  seasonEnd: string;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const activeTeams = teams.filter(t => t.is_active !== false);

  const [teamConfigs, setTeamConfigs] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    activeTeams.forEach(t => {
      initial[t.id] = {
        selected: activeTeams.length === 1 ? true : false,
        rosterAction: 'keep', // 'keep' or 'clear'
        financialsAction: 'rollover' // 'rollover' or 'write_off'
      };
    });
    return initial;
  });

  const updateTeamConfig = (teamId: string, key: string, value: any) => {
    setTeamConfigs(prev => ({
      ...prev,
      [teamId]: {
        ...prev[teamId],
        [key]: value
      }
    }));
  };

  const selectedTeamIds = Object.keys(teamConfigs).filter(id => teamConfigs[id].selected);

  const handleSubmit = async () => {
    if (selectedTeamIds.length === 0) {
      setErrorMsg("Please select at least one team to finalise.");
      return;
    }

    setIsProcessing(true);
    setErrorMsg("");

    const payload = {
      clubId,
      selectedTeams: selectedTeamIds.map(id => ({
        teamId: id,
        ...teamConfigs[id]
      }))
    };

    try {
      const res = await fetch('/api/admin/finalise-season', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process finalisation.");
      
      onComplete();
    } catch (err: any) {
      setErrorMsg(err.message);
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in slide-in-from-bottom-4">
      
      <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-[#151515]">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 flex items-center gap-2">
            Wrap Up Season {seasonName && `— ${seasonName}`}
          </h2>
          <p className="text-[10px] text-zinc-500 uppercase font-bold mt-1">Finalise stats, financials, and rosters.</p>
        </div>
        <button onClick={onCancel} className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div className="p-6 space-y-8">
        {errorMsg && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs font-bold border border-red-200 dark:border-red-900/50">
            {errorMsg}
          </div>
        )}

        {/* Section A: Select Teams */}
        {activeTeams.length > 1 && (
          <div>
            <h3 className="text-sm font-black uppercase tracking-tight mb-3">Select Teams to Finalise</h3>
            <div className="space-y-2">
              {activeTeams.map(team => (
                <label key={team.id} className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${teamConfigs[team.id].selected ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-500' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'}`}>
                  <input 
                    type="checkbox" 
                    checked={teamConfigs[team.id].selected}
                    onChange={(e) => updateTeamConfig(team.id, 'selected', e.target.checked)}
                    className="w-5 h-5 rounded accent-emerald-500"
                  />
                  <span className="font-bold text-sm">{team.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {selectedTeamIds.length > 0 && (
          <div className="space-y-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
            
            {/* Section B: Ledger */}
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight mb-1">Ledger</h3>
              <p className="text-[11px] text-zinc-500 font-medium mb-4">What do you want to do with the outstanding ledger?</p>
              
              <div className="space-y-4">
                {selectedTeamIds.map(teamId => {
                  const team = teams.find(t => t.id === teamId);
                  return (
                    <div key={teamId} className="flex flex-col gap-4 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900/30">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {activeTeams.length > 1 && (
                          <h4 className="font-black text-xs uppercase">{team?.name}</h4>
                        )}
                        <div className="flex items-center bg-zinc-200 dark:bg-zinc-800 rounded-full p-1 shrink-0 w-max">
                          <button 
                            onClick={() => updateTeamConfig(teamId, 'financialsAction', 'rollover')}
                            className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${teamConfigs[teamId].financialsAction === 'rollover' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                          >
                            Rollover
                          </button>
                          <button 
                            onClick={() => updateTeamConfig(teamId, 'financialsAction', 'write_off')}
                            className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${teamConfigs[teamId].financialsAction === 'write_off' ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-black shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                          >
                            Settle
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-zinc-500">
                        {teamConfigs[teamId].financialsAction === 'rollover' 
                          ? 'Debts and credits will carry into the next season.' 
                          : 'Wipes all player balances to $0.00.'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section C: Team Roster */}
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight mb-1">Team Roster</h3>
              <p className="text-[11px] text-zinc-500 font-medium mb-4">What should happen to the player roster?</p>
              
              <div className="space-y-4">
                {selectedTeamIds.map(teamId => {
                  const team = teams.find(t => t.id === teamId);
                  return (
                    <div key={teamId} className="flex flex-col gap-4 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900/30">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {activeTeams.length > 1 && (
                          <h4 className="font-black text-xs uppercase">{team?.name}</h4>
                        )}
                        <div className="flex items-center bg-zinc-200 dark:bg-zinc-800 rounded-full p-1 shrink-0 w-max">
                          <button 
                            onClick={() => updateTeamConfig(teamId, 'rosterAction', 'keep')}
                            className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${teamConfigs[teamId].rosterAction === 'keep' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                          >
                            Rollover
                          </button>
                          <button 
                            onClick={() => updateTeamConfig(teamId, 'rosterAction', 'clear')}
                            className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${teamConfigs[teamId].rosterAction === 'clear' ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-black shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-zinc-500">
                        {teamConfigs[teamId].rosterAction === 'keep' 
                          ? 'Keep players currently assigned to this team.' 
                          : 'Unassign players from team so you can rebuild.'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

      </div>

      <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end bg-zinc-50 dark:bg-[#151515]">
        <button 
          onClick={handleSubmit}
          disabled={isProcessing || selectedTeamIds.length === 0}
          className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
        >
          {isProcessing ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-check"></i>}
          {isProcessing ? "Processing..." : "Finalise & Archive"}
        </button>
      </div>

    </div>
  );
}
