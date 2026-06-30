// app/t/[slugid]/TeamAvailabilityClient.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import posthog from 'posthog-js'; // Ensure posthog is imported

interface ClientProps {
  teamId: string;
  clubId: string;
  teamName: string;
  initialPlayerId?: string;
  isEmbedded?: boolean;
}

export default function TeamAvailabilityClient({ teamId, clubId, teamName, initialPlayerId, isEmbedded = false }: ClientProps) {
  const [teamInfo, setTeamInfo] = useState<any>({ team_id: teamId, team_name: teamName });
  const searchParams = useSearchParams();
  const router = useRouter();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const [allClubPlayers, setAllClubPlayers] = useState<any[]>([]);
  const [upcomingFixtures, setUpcomingFixtures] = useState<any[]>([]);
  const [teamSponsors, setTeamSponsors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [clubAnnouncement, setClubAnnouncement] = useState<string | null>(null);
  const [hasMultipleTeams, setHasMultipleTeams] = useState(true);
  
  const [fixtureResponses, setFixtureResponses] = useState<Record<string, {player_id: string, status: string}[]>>({});

  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [playerSearch, setPlayerSearch] = useState("");
  const [availabilities, setAvailabilities] = useState<Record<string, string>>({});
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const hasLoggedImpression = useRef(false);

  useEffect(() => {
    async function loadPublicData() {
      try {
        // 🚨 FIX: Use .limit(1) so it doesn't crash if the profile isn't saved yet or blocked by RLS
        const { data: publicProfileArr } = await supabase
          .from("public_team_profiles")
          .select("*")
          .eq("team_id", teamId)
          .limit(1);
        const publicProfile = publicProfileArr?.[0] || null;
        
        // If it exists, overwrite our fallback data with the real logos/sponsors
        if (publicProfile) {
          setTeamInfo(publicProfile);
        }

        const [clubResArr, teamCountRes, playerRes, sponsorsRes] = await Promise.all([
          supabase.from('clubs').select('announcement').eq('id', clubId).limit(1),
          supabase.from('teams').select('id', { count: 'exact', head: true }).eq('club_id', clubId),
          supabase.from("players").select("id, user_id, first_name, last_name, nickname, default_team_id").eq("club_id", clubId).order("first_name"),
          supabase.from("team_sponsors").select("*").eq("team_id", teamId).eq("is_active", true)
        ]);

        if (sponsorsRes.data) {
          setTeamSponsors(sponsorsRes.data);
        }

        const clubRes = { data: clubResArr?.data?.[0] || null };
        if (clubRes.data?.announcement) setClubAnnouncement(clubRes.data.announcement);
        setHasMultipleTeams((teamCountRes.count || 0) > 1);
        if (playerRes.data) {
          setAllClubPlayers(playerRes.data);
          if (initialPlayerId) {
            const player = playerRes.data.find((p: any) => p.user_id === initialPlayerId || p.id === initialPlayerId);
            if (player) setSelectedPlayer(player);
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
          const fixtureIds = fixtureData.map(f => f.id);
          
          if (fixtureIds.length > 0) {
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
        }
      } catch (err) {
        console.error("Critical Page Error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadPublicData();
  }, [teamId, clubId, teamName]);

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

  useEffect(() => {
    // Auto-confirmation logic
    const urlPlayerId = searchParams.get('player');
    const urlFixtureId = searchParams.get('fixture');
    const urlStatus = searchParams.get('status') as 'yes' | 'maybe' | 'no';

    if (urlPlayerId && urlFixtureId && urlStatus && allClubPlayers.length > 0 && upcomingFixtures.length > 0) {
      const player = allClubPlayers.find(p => p.id === urlPlayerId);
      const fixture = upcomingFixtures.find(f => f.id === urlFixtureId);
      
      if (player && fixture) {
        // Clear params from URL so refresh doesn't trigger again
        const newUrl = window.location.pathname;
        router.replace(newUrl);

        (async () => {
          await handleStatusClick(urlFixtureId, urlStatus, player.id);
          setSelectedPlayer(player);
          setToastMessage("Thanks for confirming!");
          setTimeout(() => setToastMessage(null), 4000);
        })();
      }
    }
  }, [allClubPlayers, upcomingFixtures, searchParams, router]);

  const sponsors = teamSponsors;

  useEffect(() => {
    if (sponsors.length > 0 && !hasLoggedImpression.current && teamId) {
      hasLoggedImpression.current = true;
      const impressionData = sponsors.map(s => ({
        team_id: teamId,
        sponsor_id: s.id,
        event_type: 'impression',
        source: 'hub'
      }));
      fetch('/api/track-sponsor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(impressionData)
      }).catch(err => console.error("Tracking error", err));
    }
  }, [sponsors, teamId]);

  const handleSponsorClick = (sponsorId: string, url: string) => {
    if (teamId) {
        fetch('/api/track-sponsor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ team_id: teamId, sponsor_id: sponsorId, event_type: 'click', source: 'hub' })
        }).catch(err => console.error("Tracking error", err));
    }
    if (url) window.open(url, '_blank');
  };

  async function handleStatusClick(fixtureId: string, status: 'yes' | 'maybe' | 'no', overridePlayerId?: string) {
    const activePlayerId = overridePlayerId || selectedPlayer?.id;
    if (!activePlayerId) return;
    
    setIsUpdating(fixtureId);
    setAvailabilities(prev => ({ ...prev, [fixtureId]: status }));
    setFixtureResponses(prev => {
      const currentResponses = prev[fixtureId] || [];
      const filteredResponses = currentResponses.filter(r => r.player_id !== activePlayerId);
      return { ...prev, [fixtureId]: [...filteredResponses, { player_id: activePlayerId, status }] };
    });
    await supabase.from("availability").upsert({ player_id: activePlayerId, fixture_id: fixtureId, status: status }, { onConflict: 'player_id, fixture_id' });
    
    // --- POSTHOG TRACKING EVENT ---
    try {
      if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        posthog.capture('player_availability_set', {
          team_name: teamName,
          status: status,
          is_public_link: true
        });
      }
    } catch (e) {
        console.error('Posthog tracking failed', e)
    }

    setIsUpdating(null);
  }

  const isSearching = playerSearch.trim().length > 0;
  const displayedPlayers = isSearching 
    ? allClubPlayers.filter(p => `${p.first_name} ${p.last_name} ${p.nickname || ''}`.toLowerCase().includes(playerSearch.toLowerCase()))
    : allClubPlayers.filter(p => p.default_team_id === teamId);

  if (isLoading) {
    return (
      <div className={`${isEmbedded ? 'py-20' : 'min-h-screen bg-zinc-50 dark:bg-[#0a0a0a] transition-colors'} flex flex-col items-center justify-center p-6`}>
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!teamInfo) {
    return (
      <div className={`${isEmbedded ? 'py-20' : 'min-h-screen bg-zinc-50 dark:bg-[#0a0a0a] transition-colors'} flex flex-col items-center justify-center p-6`}>
        <h1 className="text-zinc-900 dark:text-white font-black uppercase text-xl">Team Not Found</h1>
        <p className="text-zinc-500 text-sm mt-2 text-center max-w-xs">Make sure the URL is correct, or ask your manager to hit 'Save' on the Team Settings.</p>
      </div>
    );
  }

  return (
    <div className={`${isEmbedded ? 'pb-6 relative' : 'min-h-screen bg-zinc-50 dark:bg-[#0a0a0a] pb-6 relative'} text-zinc-900 dark:text-white font-sans transition-colors`}>
      {clubAnnouncement && (
        <div className="w-full bg-emerald-600 text-white px-4 py-2.5 text-center text-xs font-bold shadow-sm flex items-center justify-center gap-2 relative z-50">
          <i className="fa-solid fa-bullhorn"></i> {clubAnnouncement}
        </div>
      )}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg z-[100] flex items-center gap-3 animate-in fade-in slide-in-from-top-5 duration-300">
          <i className="fa-solid fa-circle-check"></i>
          <span className="font-bold text-sm uppercase tracking-wide">{toastMessage}</span>
        </div>
      )}
      <div className="max-w-md mx-auto space-y-6 mt-6 px-4">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-center overflow-hidden">
            {teamInfo.club_logo_url ? <img src={teamInfo.club_logo_url} className="w-full h-full object-contain p-1" /> : <i className="fa-solid fa-shield-halved text-zinc-300 dark:text-zinc-700 text-2xl"></i>}
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black uppercase italic tracking-tighter leading-none">{teamInfo.team_name}</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mt-1">Availability Hub</p>
          </div>
        </div>

        {!selectedPlayer ? (
          <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-xl">
            <label className="text-[10px] text-zinc-500 uppercase font-black block mb-4 text-center">Who are you?</label>
            {hasMultipleTeams && (
              <input type="text" placeholder="Search..." value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)} className="w-full bg-zinc-100 dark:bg-[#1A1A1A] border border-zinc-200 rounded-xl px-4 py-3.5 text-sm mb-4 text-center font-bold outline-none" />
            )}
            <div className="flex flex-wrap gap-2.5 justify-center max-h-[45vh] overflow-y-auto">
              {displayedPlayers.map(p => (
                <button key={p.id} onClick={() => setSelectedPlayer(p)} className="px-5 py-3.5 rounded-xl font-black text-[11px] uppercase bg-zinc-50 dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400">
                  {p.nickname || `${p.first_name} ${p.last_name?.charAt(0)}.`}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#111] border border-zinc-200 p-4 rounded-2xl shadow-sm flex justify-between items-center">
            <div className="pl-2">
              <p className="text-[9px] text-zinc-500 font-black uppercase mb-0.5">Playing As</p>
              <p className="font-bold uppercase text-sm">{selectedPlayer.nickname || `${selectedPlayer.first_name} ${selectedPlayer.last_name?.charAt(0)}.`}</p>
            </div>
            <button onClick={() => setSelectedPlayer(null)} className="w-10 h-10 bg-zinc-100 dark:bg-[#1A1A1A] rounded-xl flex items-center justify-center text-zinc-500 border border-zinc-200 dark:border-transparent"><i className="fa-solid fa-arrows-rotate"></i></button>
          </div>
        )}

        {selectedPlayer && (
          <div className="space-y-4">
            {upcomingFixtures.length === 0 ? (
              <div className="text-center p-8 bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-3xl"><p className="text-zinc-500 text-xs font-bold uppercase">No upcoming fixtures.</p></div>
            ) : (
              upcomingFixtures.map((fixture, index) => {
                const currentStatus = availabilities[fixture.id];
                const responses = fixtureResponses[fixture.id] || [];
                const yesCount = responses.filter(r => r.status === 'yes').length;
                const maybeCount = responses.filter(r => r.status === 'maybe').length;
                const noCount = responses.filter(r => r.status === 'no').length;
                
                const teamRosterIds = allClubPlayers.filter(p => p.default_team_id === teamId).map(p => p.id);
                const involvedIds = new Set([...teamRosterIds, ...responses.map(r => r.player_id)]);
                
                const totalPlayers = involvedIds.size || 1; 
                const unconfirmedCount = involvedIds.size - (yesCount + maybeCount + noCount);

                const yesPct = (yesCount / totalPlayers) * 100;
                const maybePct = (maybeCount / totalPlayers) * 100;
                const noPct = (noCount / totalPlayers) * 100;
                const unconfirmedPct = (unconfirmedCount / totalPlayers) * 100;
                
                return (
                  <div key={fixture.id} className="flex flex-col gap-4">
                    <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] shadow-lg overflow-hidden flex flex-col relative">
                      {currentStatus === 'yes' && <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>}
                    {currentStatus === 'no' && <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500"></div>}
                    {currentStatus === 'maybe' && <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>}

                    <div className="p-4 border-b border-zinc-100 dark:border-zinc-800/50 flex justify-between items-start ml-1 w-full">
                      <div className="flex flex-col items-start gap-1 pl-1">
                        <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-emerald-600 text-white tracking-widest leading-none shadow-sm">Upcoming</span>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                          {new Date(fixture.match_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }).toUpperCase()}
                          {(fixture.start_time || fixture.location) && (
                            <>
                              <span className="mx-1.5">•</span>
                              {fixture.start_time && `${fixture.start_time} `}
                              {fixture.location && `@ ${fixture.location}`}
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="p-4 flex items-center justify-between gap-2 ml-1">
                        <div className="flex items-center gap-3 flex-1 pl-2">
                            <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                                {teamInfo.club_logo_url ? <img src={teamInfo.club_logo_url} className="w-full h-full object-cover bg-white" /> : <span className="text-[10px] font-black">{teamInfo.team_name?.substring(0, 2).toUpperCase()}</span>}
                            </div>
                            <span className="font-black text-xs uppercase leading-tight">{teamInfo.team_name}</span>
                        </div>
                        <div className="shrink-0 px-2 text-[10px] font-black text-zinc-300 dark:text-zinc-700 italic">VS</div>
                        <div className="flex items-center justify-end gap-3 flex-1">
                            <span className="font-black text-xs uppercase text-right leading-tight">{fixture.opponent}</span>
                            <div className="w-8 h-8 rounded-full bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center"><i className="fa-solid fa-shield text-zinc-300 dark:text-zinc-700 text-xs"></i></div>
                        </div>
                    </div>


                    <div className="bg-zinc-50 dark:bg-zinc-950/50 px-5 py-4 border-t border-zinc-100 dark:border-zinc-800/50 ml-1">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Lineup Status</h4>
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{yesCount} / {involvedIds.size} Confirmed</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-zinc-200 dark:bg-zinc-800 mb-3">
                        <div style={{ width: `${yesPct}%` }} className="bg-emerald-500 transition-all duration-500"></div>
                        <div style={{ width: `${maybePct}%` }} className="bg-amber-500 transition-all duration-500"></div>
                        <div style={{ width: `${noPct}%` }} className="bg-red-500 transition-all duration-500"></div>
                        <div style={{ width: `${unconfirmedPct}%` }} className="bg-zinc-300 dark:bg-zinc-700 transition-all duration-500"></div>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-center">
                        <div><div className="text-sm font-black">{yesCount}</div><div className="text-[8px] font-bold uppercase text-emerald-600 mt-0.5">Avail</div></div>
                        <div><div className="text-sm font-black">{maybeCount}</div><div className="text-[8px] font-bold uppercase text-amber-500 mt-0.5">Maybe</div></div>
                        <div><div className="text-sm font-black">{noCount}</div><div className="text-[8px] font-bold uppercase text-red-500 mt-0.5">Out</div></div>
                        <div><div className="text-sm font-black">{unconfirmedCount}</div><div className="text-[8px] font-bold uppercase text-zinc-400 mt-0.5">Unconf</div></div>
                      </div>
                    </div>

                    <div className="p-4 flex gap-2.5 bg-zinc-50 dark:bg-zinc-950/50 ml-1 pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
                      <button onClick={() => handleStatusClick(fixture.id, 'yes')} className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase ${currentStatus === 'yes' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white dark:bg-[#1A1A1A] border dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'}`}>AVAILABLE</button>
                      <button onClick={() => handleStatusClick(fixture.id, 'maybe')} className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase ${currentStatus === 'maybe' ? 'bg-amber-500 text-black shadow-md' : 'bg-white dark:bg-[#1A1A1A] border dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'}`}>MAYBE</button>
                      <button onClick={() => handleStatusClick(fixture.id, 'no')} className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase ${currentStatus === 'no' ? 'bg-red-500 text-white shadow-md' : 'bg-white dark:bg-[#1A1A1A] border dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'}`}>OUT</button>
                    </div>
                  </div>
                  {index === 0 && upcomingFixtures.filter(f => !availabilities[f.id]).length > 0 && (
                    <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl text-center shadow-sm">
                      <i className="fa-solid fa-calendar-check text-emerald-500 text-2xl mb-2"></i>
                      <h3 className="text-sm font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-tight mb-1">More Games Ahead!</h3>
                      <p className="text-xs font-medium text-emerald-600/80 dark:text-emerald-400/80">You have {upcomingFixtures.filter(f => !availabilities[f.id]).length} unconfirmed match{upcomingFixtures.filter(f => !availabilities[f.id]).length > 1 ? 'es' : ''}. Please update your availability for the rest of the season below.</p>
                    </div>
                  )}
                </div>
                );
              })
            )}
          </div>
        )}
        <div className="h-44"></div>
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800/80 pt-3 pb-6 sm:pb-4 z-50">
        <div className="max-w-md mx-auto px-4 flex flex-col items-center">
          {sponsors.length > 0 && (
            <>
              <p className="text-[8px] font-black uppercase tracking-[0.4em] text-zinc-400 dark:text-zinc-600 text-center mb-3">Proudly Supported By</p>
              <div className="flex flex-wrap justify-center gap-6 sm:gap-8 mb-5">
                {sponsors.slice(0, 4).map((s: any, i) => (
                <a key={s.id || i} href={s.url || '#'} onClick={(e) => {
                  if (s.url) { e.preventDefault(); handleSponsorClick(s.id, s.url); }
                }} className={`h-12 flex grayscale hover:grayscale-0 transition-all ${!s.url ? 'cursor-default pointer-events-none' : 'cursor-pointer hover:scale-105'}`}>
                  <img src={s.logo_url} alt={s.name || `Sponsor`} className="max-h-full max-w-[120px] object-contain opacity-70 hover:opacity-100" />
                  </a>
                ))}
              </div>
            </>
          )}
          <a href="https://feesplease.app" target="_blank" rel="noopener noreferrer" className="italic font-black text-emerald-500 text-[10px] tracking-widest hover:opacity-80 mt-1">
            Powered By Fees Please
          </a>
        </div>
      </div>
    </div>
  );
}