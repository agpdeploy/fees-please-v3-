"use client";

import { useState, useEffect } from "react";
import { useProfile } from "@/lib/useProfile";
import { supabase } from "@/lib/supabase";

export default function Referral() {
  const { profile } = useProfile();
  const [referrals, setReferrals] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      if (!profile?.id) return;
      try {
        const res = await fetch('/api/referrals');
        if (res.ok) {
          const data = await res.json();
          setReferrals(data.referrals || []);
        }
      } catch (err) {
        console.error("Failed to fetch referrals", err);
      }
    }
    fetchStats();
  }, [profile]);

  if (!profile) return null;

  const referralLink = `${typeof window !== 'undefined' ? window.location.origin : 'https://app.feesplease.app'}/auth/register?ref=${profile.referral_code || ''}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      <div className="flex items-center gap-4 mb-2">
        <div className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center shadow-md border border-zinc-200 dark:border-zinc-800 shrink-0">
          <i className="fa-solid fa-gift text-emerald-500 text-lg"></i>
        </div>
        <div>
          <h2 className="text-xl font-black uppercase italic tracking-tighter text-zinc-900 dark:text-white">
            Refer a Friend
          </h2>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
            Affiliate Portal
          </p>
        </div>
      </div>

      <div className="bg-emerald-500 rounded-3xl p-6 shadow-lg shadow-emerald-500/20 relative overflow-hidden text-white">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
        
        <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-2">
          Share the love
        </h2>
        <p className="text-emerald-50 mb-6 text-xs leading-relaxed max-w-[280px]">
          Give your unique link to friends and teams. When they sign up, they'll be tracked as your referral.
        </p>

        <div className="bg-emerald-600/50 border border-emerald-400/30 rounded-xl p-1.5 flex items-center backdrop-blur-md">
          <input 
            type="text" 
            readOnly 
            value={referralLink}
            className="bg-transparent flex-1 px-3 text-emerald-50 outline-none text-[10px] font-medium w-full truncate"
          />
          <button 
            onClick={copyToClipboard}
            className="bg-white text-emerald-600 hover:bg-emerald-50 px-4 py-2 rounded-lg font-black uppercase tracking-widest text-[10px] transition-colors whitespace-nowrap flex items-center gap-2 shadow-sm shrink-0"
          >
            {copied ? (
              <><i className="fa-solid fa-check"></i> Copied</>
            ) : (
              <><i className="fa-regular fa-copy"></i> Copy</>
            )}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest text-[10px] mb-1">Pending</h3>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black tracking-tighter text-amber-500">
                {referrals.filter(r => !r.onboarding_completed).length}
              </span>
              <span className="text-amber-500 font-bold tracking-widest uppercase text-[10px] mb-1.5">Users</span>
            </div>
          </div>
          <div className="border-l border-zinc-200 dark:border-zinc-800 pl-4">
            <h3 className="text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest text-[10px] mb-1">Actual</h3>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black tracking-tighter text-emerald-500">
                {referrals.filter(r => r.onboarding_completed).length}
              </span>
              <span className="text-emerald-500 font-bold tracking-widest uppercase text-[10px] mb-1.5">Users</span>
            </div>
          </div>
        </div>

        {referrals.length > 0 && (
          <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800/80">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">Referred Users</h4>
            <div className="space-y-3">
              {referrals.map(ref => {
                let displayName = ref.email.split('@')[0];
                if (ref.full_name) {
                  const parts = ref.full_name.trim().split(' ');
                  const firstName = parts[0];
                  const initial = parts.length > 1 ? ` ${parts[parts.length - 1][0]}.` : '';
                  displayName = `${firstName}${initial}`;
                }
                
                return (
                  <div key={ref.id} className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <div>
                      <div className="text-xs font-bold text-zinc-900 dark:text-white">{displayName}</div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-widest">{new Date(ref.updated_at || new Date()).toLocaleDateString('en-AU')}</div>
                    </div>
                    <div>
                      {ref.onboarding_completed ? (
                        <span className="text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border border-emerald-500/20 shadow-sm flex items-center gap-1.5">
                          <i className="fa-solid fa-check-circle"></i> Active
                        </span>
                      ) : (
                        <span className="text-amber-500 bg-amber-500/10 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border border-amber-500/20 shadow-sm flex items-center gap-1.5">
                          <i className="fa-solid fa-clock"></i> Pending
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {(!profile.role || profile.role === 'player') && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 relative overflow-hidden group flex flex-col gap-4">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none"></div>
          <div>
            <h3 className="text-base font-black uppercase tracking-tight italic text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
              <i className="fa-solid fa-flag text-emerald-500"></i> Collect fees for your team?
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
              Track match fees, players, pay umpires, and send automatic payment reminders. Get your own team set up in minutes.
            </p>
          </div>
          <button 
            onClick={() => setShowRegisterModal(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-md shadow-emerald-500/25 active:scale-95 flex items-center justify-center gap-2 w-full"
          >
            <i className="fa-solid fa-plus"></i> Register a New Team
          </button>
        </div>
      )}

      {showRegisterModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowRegisterModal(false)}></div>
          <div className="bg-white dark:bg-[#111] rounded-3xl w-full max-w-sm relative z-10 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-zinc-200 dark:border-zinc-800">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl border-4 border-white dark:border-[#111] shadow-lg">
                <i className="fa-solid fa-flag"></i>
              </div>
              <h3 className="text-xl font-black uppercase italic tracking-tighter text-zinc-900 dark:text-white mb-2">Register New Team?</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                Are you sure you want to register a new team? This will begin the setup process for a new team.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    setShowRegisterModal(false);
                    if (typeof window !== 'undefined') {
                      sessionStorage.setItem('creating_team', 'true');
                      window.location.assign('/');
                    }
                  }}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm transition-colors shadow-lg shadow-emerald-500/25"
                >
                  Yes, Create Team
                </button>
                <button onClick={() => setShowRegisterModal(false)} className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-2xl font-black uppercase tracking-widest text-sm transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
