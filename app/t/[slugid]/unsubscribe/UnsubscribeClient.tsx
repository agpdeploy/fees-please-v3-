"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface ClientProps {
  teamId: string;
  teamName: string;
}

export default function UnsubscribeClient({ teamId, teamName }: ClientProps) {
  const searchParams = useSearchParams();
  const playerId = searchParams.get("player");
  
  const [teamInfo, setTeamInfo] = useState<any>({ team_id: teamId, team_name: teamName });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'resubscribed' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState("");
  
  const [hasLoggedImpression, setHasLoggedImpression] = useState(false);
  const [sponsors, setSponsors] = useState<any[]>([]);

  useEffect(() => {
    async function loadSponsors() {
      if (teamId) {
        const { data } = await supabase.from('team_sponsors').select('*').eq('team_id', teamId).eq('is_active', true);
        if (data) setSponsors(data);
      }
    }
    loadSponsors();
  }, [teamId]);

  useEffect(() => {
    async function loadTeamInfo() {
      if (!playerId) {
        setStatus('error');
        setErrorMessage("Missing player ID.");
        return;
      }

      try {
        const { data: publicProfile } = await supabase
          .from("public_team_profiles")
          .select("*")
          .eq("team_id", teamId)
          .maybeSingle();
        
        if (publicProfile) {
          setTeamInfo(publicProfile);
        }
      } catch (err: any) {
        console.error("Team info error:", err);
      }
    }
    loadTeamInfo();
  }, [teamId, playerId]);

  const handleUnsubscribe = async () => {
    setStatus('loading');
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to unsubscribe");
      
      setStatus('success');
    } catch (err: any) {
      console.error("Unsubscribe error:", err);
      setStatus('error');
      setErrorMessage(err.message || "An error occurred while unsubscribing.");
    }
  };

  const handleResubscribe = async () => {
    setStatus('loading');
    try {
      const res = await fetch("/api/resubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to opt back in");
      
      setStatus('resubscribed');
    } catch (err: any) {
      console.error("Resubscribe error:", err);
      setStatus('error');
      setErrorMessage(err.message || "An error occurred while opting back in.");
    }
  };

  // Removed static sponsors assignment

  useEffect(() => {
    if (sponsors.length > 0 && !hasLoggedImpression && teamId) {
      setHasLoggedImpression(true);
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
  }, [sponsors, teamId, hasLoggedImpression]);

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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0a] text-zinc-900 dark:text-white pb-6 font-sans transition-colors relative flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">
        
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-center overflow-hidden">
            {teamInfo.club_logo_url ? <img src={teamInfo.club_logo_url} className="w-full h-full object-contain p-1" /> : <i className="fa-solid fa-shield-halved text-zinc-300 dark:text-zinc-700 text-2xl"></i>}
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black uppercase italic tracking-tighter leading-none">{teamInfo.team_name}</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mt-1">Notifications</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl shadow-xl w-full text-center">
          {status === 'idle' && (
            <div className="flex flex-col items-center animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-4 text-amber-600 dark:text-amber-500">
                <i className="fa-solid fa-bell-slash text-2xl"></i>
              </div>
              <h2 className="text-xl font-black uppercase italic tracking-tight mb-2">Unsubscribe?</h2>
              <p className="text-sm text-zinc-500 mb-8">Are you sure you want to stop receiving availability reminders for {teamInfo.team_name}?</p>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button 
                  onClick={handleUnsubscribe}
                  className="flex-1 py-3 px-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-colors"
                >
                  Yes, Unsubscribe
                </button>
                <a 
                  href={`/t/${teamInfo.slug || teamId}`}
                  className="flex-1 py-3 px-4 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white rounded-xl font-black text-xs uppercase tracking-widest transition-colors"
                >
                  Cancel
                </a>
              </div>
            </div>
          )}

          {status === 'loading' && (
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-sm font-bold uppercase text-zinc-500 tracking-widest">Processing...</p>
            </div>
          )}
          
          {status === 'success' && (
            <div className="flex flex-col items-center animate-in zoom-in-95">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4 text-red-600 dark:text-red-500">
                <i className="fa-solid fa-check text-2xl"></i>
              </div>
              <h2 className="text-xl font-black uppercase italic tracking-tight mb-2">Unsubscribed</h2>
              <p className="text-sm text-zinc-500 mb-8">You will no longer receive availability reminders for {teamInfo.team_name}.</p>
              
              <button 
                onClick={handleResubscribe}
                className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-colors"
              >
                Wait, Opt Back In
              </button>
            </div>
          )}

          {status === 'resubscribed' && (
            <div className="flex flex-col items-center animate-in zoom-in-95">
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-4 text-emerald-600 dark:text-emerald-500">
                <i className="fa-solid fa-bell text-2xl"></i>
              </div>
              <h2 className="text-xl font-black uppercase italic tracking-tight mb-2">Subscribed!</h2>
              <p className="text-sm text-zinc-500 mb-6">You have successfully opted back into reminders for {teamInfo.team_name}.</p>
              <a 
                  href={`/t/${teamInfo.slug || teamId}`}
                  className="w-full inline-block py-3 px-4 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white rounded-xl font-black text-xs uppercase tracking-widest transition-colors"
                >
                  Return to Hub
              </a>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center animate-in zoom-in-95">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4 text-red-600 dark:text-red-500">
                <i className="fa-solid fa-xmark text-2xl"></i>
              </div>
              <h2 className="text-xl font-black uppercase italic tracking-tight mb-2">Error</h2>
              <p className="text-sm text-zinc-500 mb-6">{errorMessage}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto w-full bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800/80 pt-4 pb-6 sm:pb-4">
        <div className="max-w-md mx-auto px-4 flex flex-col items-center">
          {sponsors.length > 0 && (
            <>
              <p className="text-[8px] font-black uppercase tracking-[0.4em] text-zinc-400 dark:text-zinc-600 text-center mb-3">Proudly Supported By</p>
              <div className="flex flex-wrap justify-center gap-6 sm:gap-8 mb-5">
                {sponsors.slice(0, 4).map((s: any, i) => (
                  <a key={s.id || i} href={s.url || '#'} onClick={(e) => {
                    if (s.url) { e.preventDefault(); handleSponsorClick(s.id, s.url); }
                  }} className={`h-10 flex grayscale hover:grayscale-0 transition-all ${!s.url ? 'cursor-default pointer-events-none' : 'cursor-pointer hover:scale-105'}`}>
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
