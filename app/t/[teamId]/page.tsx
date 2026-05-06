"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";

export default function PublicTeamAvailability() {
  const params = useParams();
  const teamId = params.teamId as string;

  const [teamInfo, setTeamInfo] = useState<any>(null);
  const [allClubPlayers, setAllClubPlayers] = useState<any[]>([]);
  const [upcomingFixtures, setUpcomingFixtures] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [clubAnnouncement, setClubAnnouncement] = useState<string | null>(null);
  const [hasMultipleTeams, setHasMultipleTeams] = useState(true);
  
  // Replaced explicit confirmed list with anonymous response data
  const [fixtureResponses, setFixtureResponses] = useState<Record<string, {player_id: string, status: string}[]>>({});

  // Player selection and responses
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [playerSearch, setPlayerSearch] = useState("");
  const [availabilities, setAvailabilities] = useState<Record<string, string>>({});
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Ref to ensure we only log impressions once per page load
  const hasLoggedImpression = useRef(false);

  useEffect(() => {
    async function loadPublicData() {
      if (!teamId) return;

      const { data: publicProfile } = await supabase
        .from("public_team_profiles")
        .select("*")
        .eq("team_id", teamId)
        .single();
      
      if (publicProfile) {
        setTeamInfo(publicProfile);

        const { data: teamPrivate } = await supabase.from('teams').select('club_id').eq('id', teamId).single();
        
        if (teamPrivate) {
           const clubId = teamPrivate.club_id;

           // Fetch Club Announcement
           const { data: clubData } = await supabase.from('clubs').select('announcement').eq('id', clubId).single();
           if (clubData?.announcement) setClubAnnouncement(clubData.announcement);

           // Check how many teams exist in this club to toggle search
           const { count: teamCount } = await supabase.from('teams').select('*', { count: 'exact', head: true }).eq('club_id', clubId);
           setHasMultipleTeams((teamCount || 0) > 1);

           const { data: rosterData } = await supabase
             .from("players")
             .select("id, first_name, last_name, nickname, default_team_id")
             .eq("club_id", clubId)
             .order("first_name");
           
           if (rosterData) setAllClubPlayers(rosterData);
        }
      }

      const today = new Date().toISOString();
      const { data: fixtureData } = await supabase
        .from("fixtures")
        .select("id, match_date, opponent, start_time, location")
        .eq("team_id", teamId)
        .gte("match_date", today)
        .order("match_date", { ascending: true });
      
      if (fixtureData) {
        setUpcomingFixtures(fixtureData);

        // Fetch Global Anonymous Response Data for the progress bar
        const fixtureIds = fixtureData.map(f => f.id);
        const { data: globalAvail } = await supabase
          .from("availability")
          .select("fixture_id, player_id, status")
          .in("fixture_id", fixtureIds);
        
        if (globalAvail) {
          const responseMap: Record<string, {player_id: string, status: string}[]> = {};
          globalAvail.forEach(row => {
            if (!responseMap[row.fixture_id]) responseMap[row.fixture_id] = [];
            responseMap[row.fixture_id].push({ player_id: row.player_id, status: row.status });
          });
          setFixtureResponses(responseMap);
        }
      }

      setIsLoading(false);
    }

    loadPublicData();
  }, [teamId]);

  useEffect(() => {
    async function loadPlayerAvailabilities() {
      if (!selectedPlayer || upcomingFixtures.length === 0) {
        setAvailabilities({});
        return;
      }

      const fixtureIds = upcomingFixtures.map(f => f.id);
      const { data } = await supabase
        .from("availability")
        .select("fixture_id, status")
        .eq("player_id", selectedPlayer.id)
        .in("fixture_id", fixtureIds);

      if (data) {
        const mapping: Record<string, string> = {};
        data.forEach(row => {
          mapping[row.fixture_id] = row.status;
        });
        setAvailabilities(mapping);
      }
    }

    loadPlayerAvailabilities();
  }, [selectedPlayer, upcomingFixtures]);

  // --- ANALYTICS TRACKING ---
  const sponsors = teamInfo ? [
    { logo: teamInfo.sponsor_1_logo, url: teamInfo.sponsor_1_url, index: 1 },
    { logo: teamInfo.sponsor_2_logo, url: teamInfo.sponsor_2_url, index: 2 },
    { logo: teamInfo.sponsor_3_logo, url: teamInfo.sponsor_3_url, index: 3 }
  ].filter(s => s.logo) : [];

  useEffect(() => {
    if (sponsors.length > 0 && !hasLoggedImpression.current) {
      hasLoggedImpression.current = true;
      const impressionData = sponsors.map(s => ({
        team_id: teamId,
        sponsor_index: s.index,
        event_type: 'impression'
      }));
      
      supabase.from('sponsor_analytics').insert(impressionData).then(({error}) => {
        if (error) console.error("Failed to log impression:", error);
      });
    }
  }, [sponsors, teamId]);

  const handleSponsorClick = (sponsorIndex: number, url: string) => {
    supabase.from('sponsor_analytics').insert([{
      team_id: teamId,
      sponsor_index: sponsorIndex,
      event_type: 'click'
    }]);
    
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };
  // --------------------------

  async function handleStatusClick(fixtureId: string, status: 'yes' | 'maybe' | 'no') {
    if (!selectedPlayer) return;
    setIsUpdating(fixtureId);
    setAvailabilities(prev => ({ ...prev, [fixtureId]: status }));

    // Optimistically update the global anonymous stats for instant UI feedback
    setFixtureResponses(prev => {
      const currentResponses = prev[fixtureId] || [];
      const filteredResponses = currentResponses.filter(r => r.player_id !== selectedPlayer.id);
      return {
        ...prev,
        [fixtureId]: [...filteredResponses, { player_id: selectedPlayer.id, status }]
      };
    });

    const { error } = await supabase
      .from("availability")
      .upsert(
        { player_id: selectedPlayer.id, fixture_id: fixtureId, status: status },
        { onConflict: 'player_id, fixture_id' }
      );

    if (error) console.error("Error saving availability:", error);
    setIsUpdating(null);
  }

  const isSearching = playerSearch.trim().length > 0;
  const displayedPlayers = isSearching 
    ? allClubPlayers.filter(p => `${p.first_name} ${p.last_name} ${p.nickname || ''}`.toLowerCase().includes(playerSearch.toLowerCase()))
    : allClubPlayers.filter(p => p.default_team_id === teamId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0a] flex flex-col items-center justify-center p-6 transition-colors">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!teamInfo) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0a] flex flex-col items-center justify-center p-6 transition-colors">
        <h1 className="text-zinc-900 dark:text-white font-black uppercase text-xl">Team Not Found</h1>
        <p className="text-zinc-500 text-sm mt-2 text-center max-w-xs">Ask your manager to log in and hit 'Save' on the Team Settings to activate this page.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0a] text-zinc-900 dark:text-white pb-6 font-sans selection:bg-emerald-500/30 transition-colors relative">
      
      {/* Announcement Banner */}
      {clubAnnouncement && (
        <div className="w-full bg-emerald-600 text-white px-4 py-2.5 text-center text-xs font-bold shadow-sm flex items-center justify-center gap-2 relative z-50 animate-in slide-in-from-top-4">
          <i className="fa-solid fa-bullhorn"></i> {clubAnnouncement}
        </div>
      )}

      <div className="max-w-md mx-auto space-y-6 animate-in fade-in duration-500 mt-6 px-4 sm:px-6">
        
        {/* HEADER / CLUB BRANDING */}
        <div className="flex flex-col items-center gap-2 mb-8 mt-2">
          <div className="w-16 h-16 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-center overflow-hidden">
            {teamInfo.club_logo_url ? <img src={teamInfo.club_logo_url} className="w-full h-full object-contain p-1" alt="Club Logo" /> : <i className="fa-solid fa-shield-halved text-zinc-300 dark:text-zinc-700 text-2xl"></i>}
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black uppercase italic tracking-tighter text-zinc-900 dark:text-white leading-none">{teamInfo.team_name}</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mt-1">Availability Hub</p>
          </div>
        </div>

        {/* PLAYER SELECT / IDENTIFIED VIEW */}
        {!selectedPlayer ? (
          <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 rounded-3xl shadow-xl animate-in zoom-in-95 transition-colors">
            <label className="text-[10px] text-zinc-500 dark:text-zinc-400 font-black uppercase tracking-widest block mb-4 text-center">
              Who are you?
            </label>
            
            {hasMultipleTeams ? (
              <input 
                type="text" 
                placeholder="Search across club..." 
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                className="w-full bg-zinc-100 dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors mb-4 text-center font-bold"
              />
            ) : (
              <div className="h-px w-12 bg-zinc-200 dark:bg-zinc-800 mx-auto mb-5"></div>
            )}

            <div className="flex flex-wrap gap-2.5 justify-center max-h-[45vh] overflow-y-auto pb-2">
              {displayedPlayers.map(p => {
                const displayName = p.nickname ? p.nickname : `${p.first_name} ${p.last_name?.charAt(0) || ''}.`;
                return (
                  <button 
                    key={p.id}
                    onClick={() => setSelectedPlayer(p)}
                    className="px-5 py-3.5 rounded-xl font-black text-[11px] uppercase transition-all bg-zinc-50 dark:bg-[#1A1A1A] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-zinc-900 dark:hover:text-white active:scale-95 shadow-sm"
                  >
                    {displayName}
                  </button>
                );
              })}
              {displayedPlayers.length === 0 && (
                <div className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold py-4">No players found.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex justify-between items-center animate-in fade-in transition-colors">
            <div className="pl-2">
              <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-0.5">Playing As</p>
              <p className="font-bold text-zinc-900 dark:text-white uppercase tracking-wide text-sm">
                 {selectedPlayer.nickname ? selectedPlayer.nickname : `${selectedPlayer.first_name} ${selectedPlayer.last_name?.charAt(0) || ''}.`}
              </p>
            </div>
            <button 
              onClick={() => setSelectedPlayer(null)} 
              className="w-10 h-10 bg-zinc-100 dark:bg-[#1A1A1A] rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            >
              <i className="fa-solid fa-arrows-rotate"></i>
            </button>
          </div>
        )}

        {/* Upcoming Fixtures */}
        {selectedPlayer && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 fade-in duration-300 pt-2">
            {upcomingFixtures.length === 0 ? (
              <div className="text-center p-8 bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-3xl transition-colors">
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">No upcoming fixtures.</p>
              </div>
            ) : (
              upcomingFixtures.map((fixture) => {
                const currentStatus = availabilities[fixture.id];
                const dateObj = new Date(fixture.match_date);
                const dayNum = dateObj.getDate();
                const monthName = dateObj.toLocaleDateString('en-AU', { month: 'short' }).toUpperCase();
                const formattedDate = `${dayNum} ${monthName}`;
                
                // Analytics Line Math Logic
                const responses = fixtureResponses[fixture.id] || [];
                const yesCount = responses.filter(r => r.status === 'yes').length;
                const maybeCount = responses.filter(r => r.status === 'maybe').length;
                const noCount = responses.filter(r => r.status === 'no').length;
                
                // Determine base team roster vs people who answered
                const teamRosterIds = allClubPlayers.filter(p => p.default_team_id === teamId).map(p => p.id);
                const involvedIds = new Set([...teamRosterIds, ...responses.map(r => r.player_id)]);
                
                const totalPlayers = involvedIds.size || 1; // prevent div-by-zero
                const unconfirmedCount = involvedIds.size - (yesCount + maybeCount + noCount);

                const yesPct = (yesCount / totalPlayers) * 100;
                const maybePct = (maybeCount / totalPlayers) * 100;
                const noPct = (noCount / totalPlayers) * 100;
                const unconfirmedPct = (unconfirmedCount / totalPlayers) * 100;
                
                return (
                  <div key={fixture.id} className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] shadow-lg relative overflow-hidden transition-all flex flex-col">
                    
                    {/* Status Indicator Glow */}
                    {currentStatus === 'yes' && <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] z-10"></div>}
                    {currentStatus === 'no' && <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] z-10"></div>}
                    {currentStatus === 'maybe' && <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)] z-10"></div>}

                    <div className="flex justify-between items-center p-4 border-b border-zinc-100 dark:border-zinc-800/50 ml-1">
                      <div className="flex items-center gap-3 pl-2">
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded text-white tracking-widest bg-emerald-600 dark:bg-emerald-500">
                          Upcoming
                        </span>
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                          {formattedDate}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 flex items-center justify-between gap-2 ml-1">
                      <div className="flex items-center gap-3 flex-1 pl-2">
                        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
                          {teamInfo.club_logo_url ? (
                            <img src={teamInfo.club_logo_url} alt="Club Logo" className="w-full h-full object-cover bg-white" />
                          ) : (
                            <span className="text-[10px] font-black text-zinc-500">{teamInfo.team_name?.substring(0, 2).toUpperCase()}</span>
                          )}
                        </div>
                        <span className="font-black text-xs uppercase tracking-wide text-zinc-900 dark:text-white leading-tight break-words">
                          {teamInfo.team_name}
                        </span>
                      </div>

                      <div className="shrink-0 px-2 text-center">
                        <span className="text-[10px] font-black text-zinc-300 dark:text-zinc-700 italic uppercase tracking-widest">VS</span>
                      </div>

                      <div className="flex items-center justify-end gap-3 flex-1">
                        <span className="font-black text-xs uppercase tracking-wide text-zinc-900 dark:text-white text-right leading-tight break-words">
                          {fixture.opponent}
                        </span>
                        <div className="w-8 h-8 rounded-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shrink-0">
                          <i className="fa-solid fa-shield text-zinc-300 dark:text-zinc-700 text-xs"></i>
                        </div>
                      </div>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-950/50 px-6 py-3 border-t border-zinc-100 dark:border-zinc-800/50 ml-1">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
                        {fixture.start_time && `${fixture.start_time} • `}
                        {fixture.location || 'Location TBA'}
                      </p>
                    </div>

                    {/* Anonymous Squad Analytics Bar */}
                    <div className="bg-zinc-50 dark:bg-zinc-950/50 px-5 py-4 border-t border-zinc-100 dark:border-zinc-800/50 ml-1">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Squad Status</h4>
                        <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{yesCount} / {involvedIds.size} Confirmed</span>
                      </div>
                      
                      {/* Segmented Progress Bar */}
                      <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-zinc-200 dark:bg-zinc-800 mb-3">
                        <div style={{ width: `${yesPct}%` }} className="bg-emerald-500 transition-all duration-500"></div>
                        <div style={{ width: `${maybePct}%` }} className="bg-amber-500 transition-all duration-500"></div>
                        <div style={{ width: `${noPct}%` }} className="bg-red-500 transition-all duration-500"></div>
                        <div style={{ width: `${unconfirmedPct}%` }} className="bg-zinc-300 dark:bg-zinc-700 transition-all duration-500"></div>
                      </div>
                      
                      {/* Legends */}
                      <div className="grid grid-cols-4 gap-1 text-center">
                        <div>
                          <div className="text-sm font-black text-zinc-900 dark:text-white">{yesCount}</div>
                          <div className="text-[8px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-500 mt-0.5">Avail</div>
                        </div>
                        <div>
                          <div className="text-sm font-black text-zinc-900 dark:text-white">{maybeCount}</div>
                          <div className="text-[8px] font-bold uppercase tracking-widest text-amber-500 mt-0.5">Maybe</div>
                        </div>
                        <div>
                          <div className="text-sm font-black text-zinc-900 dark:text-white">{noCount}</div>
                          <div className="text-[8px] font-bold uppercase tracking-widest text-red-500 mt-0.5">Out</div>
                        </div>
                        <div>
                          <div className="text-sm font-black text-zinc-900 dark:text-white">{unconfirmedCount}</div>
                          <div className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mt-0.5">Unconf</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 flex gap-2.5 bg-zinc-50 dark:bg-zinc-950/50 ml-1 pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
                      <button 
                        onClick={() => handleStatusClick(fixture.id, 'yes')}
                        disabled={isUpdating === fixture.id}
                        className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${currentStatus === 'yes' ? 'bg-emerald-600 dark:bg-emerald-500 text-white shadow-md scale-[1.02]' : 'bg-white dark:bg-[#1A1A1A] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700'}`}
                      >
                        IN
                      </button>
                      <button 
                        onClick={() => handleStatusClick(fixture.id, 'maybe')}
                        disabled={isUpdating === fixture.id}
                        className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${currentStatus === 'maybe' ? 'bg-amber-500 text-black shadow-md scale-[1.02]' : 'bg-white dark:bg-[#1A1A1A] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700'}`}
                      >
                        MAYBE
                      </button>
                      <button 
                        onClick={() => handleStatusClick(fixture.id, 'no')}
                        disabled={isUpdating === fixture.id}
                        className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${currentStatus === 'no' ? 'bg-[#ff3b40] text-white shadow-md scale-[1.02]' : 'bg-white dark:bg-[#1A1A1A] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700'}`}
                      >
                        <i className="fa-solid fa-xmark mr-1.5"></i> OUT
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 👇 BULLETPROOF SPACER BLOCK 👇 */}
        {/* Ensures content clears the fixed footer */}
        <div className="h-44 w-full shrink-0 opacity-0 pointer-events-none"></div>

      </div>

      {/* ALWAYS RENDERED FIXED FOOTER */}
      <div className="fixed bottom-0 left-0 w-full bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800/80 pt-3 pb-6 sm:pb-4 z-50 transition-colors">
        <div className="max-w-md mx-auto px-4 flex flex-col items-center">
          
          {sponsors.length > 0 && (
            <>
              <p className="text-[8px] font-black uppercase tracking-[0.4em] text-zinc-400 dark:text-zinc-600 text-center mb-3">Proudly Supported By</p>
              <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-8 mb-5">
                {sponsors.map((s) => (
                  <button 
                    key={s.index} 
                    onClick={() => handleSponsorClick(s.index, s.url)}
                    disabled={!s.url}
                    className={`h-10 flex items-center justify-center grayscale hover:grayscale-0 transition-all duration-300 ${!s.url ? 'cursor-default' : 'cursor-pointer hover:scale-105 active:scale-95'}`}
                  >
                    <img src={s.logo} alt={`Sponsor ${s.index}`} className="max-h-full max-w-[120px] object-contain opacity-70 hover:opacity-100" />
                  </button>
                ))}
              </div>
            </>
          )}

          {/* New Powered By Link */}
          <a 
            href="https://feesplease.app" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="italic font-integer text-emerald-500 text-[10px] tracking-widest hover:opacity-80 transition-opacity mt-1"
          >
            Powered By Fees Please
          </a>
        </div>
      </div>
    </div>
  );
}