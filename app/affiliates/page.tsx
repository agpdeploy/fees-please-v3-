"use client";

import { useState, useEffect } from "react";
import { useProfile } from "@/lib/useProfile";
import { supabase } from "@/lib/supabase";
import Login from "@/components/Login";
import ThemeToggle from "@/components/ThemeToggle";
import { Inter, Roboto_Mono } from 'next/font/google';

const interItalic = Inter({ subsets: ['latin'], style: 'italic' });
const robotoMono = Roboto_Mono({ subsets: ['latin'] });

export default function PartnersPage() {
  const { profile, loading } = useProfile();
  const [referralCount, setReferralCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");


  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('creating_team');
    }
    
    async function fetchStats() {
      if (!profile?.id) return;
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('referred_by', profile.id);
      
      setReferralCount(count || 0);
    }
    
    if (profile) {
      if (profile.full_name) {
        const parts = profile.full_name.split(" ");
        setFirstName(parts[0] || "");
        setLastName(parts.slice(1).join(" ") || "");
      }
      fetchStats();
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <i className="fa-solid fa-circle-notch fa-spin text-emerald-500 text-4xl"></i>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="relative">
        <div className="absolute top-4 left-0 right-0 z-50 text-center pointer-events-none">
          <p className="text-emerald-400 font-black tracking-widest uppercase text-xs">Affiliate Portal</p>
        </div>
        <Login redirectTo="/affiliates" />
      </div>
    );
  }

  const referralLink = `${typeof window !== 'undefined' ? window.location.origin : 'https://app.feesplease.app'}/auth/register?ref=${profile.referral_code || ''}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };


  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !firstName.trim() || !lastName.trim()) return;
    setIsUpdatingName(true);
    setErrorMsg("");
    
    const { error } = await supabase.from('profiles').update({
      full_name: `${firstName.trim()} ${lastName.trim()}`
    }).eq('id', profile.id);
    
    setIsUpdatingName(false);
    if (!error) {
      window.location.reload();
    } else {
      setErrorMsg(error.message);
    }
  };

  if (profile && !profile.full_name) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.15)_0%,rgba(9,9,11,0)_70%)] pointer-events-none"></div>
        <div className="w-full max-w-sm relative z-10 bg-white dark:bg-[#111] backdrop-blur-xl border border-zinc-200 dark:border-zinc-800/80 p-8 rounded-3xl shadow-2xl animate-in zoom-in-95 fade-in duration-300">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-white dark:bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden">
              <img src="/branding/Icon-1000x1000.png" alt="Fees Please" className="w-12 h-12 drop-shadow-md" />
            </div>
            <h2 className={`${interItalic.className} text-2xl font-black uppercase tracking-tighter text-zinc-900 dark:text-white mb-2`}>Almost there!</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Please enter your name to access the Affiliate Portal.</p>
          </div>
          <form onSubmit={handleUpdateName} className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block text-left">First Name</label>
              <input 
                type="text" 
                required 
                value={firstName} 
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
                placeholder="e.g. John"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block text-left">Last Name</label>
              <input 
                type="text" 
                required 
                value={lastName} 
                onChange={(e) => setLastName(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
                placeholder="e.g. Doe"
              />
            </div>
            
            {errorMsg && (
              <div className="text-red-500 text-[10px] font-black uppercase tracking-widest text-center mt-2 bg-red-500/10 p-2 rounded-xl border border-red-500/20">
                {errorMsg}
              </div>
            )}
            
            <button 
              type="submit" 
              disabled={isUpdatingName}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs active:scale-95 transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50 mt-4"
            >
              {isUpdatingName ? "Saving..." : "Continue"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 md:p-12 relative overflow-hidden transition-colors selection:bg-emerald-500/30">
      {/* Background gradients */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.15),transparent_50%)] pointer-events-none transition-colors duration-1000"></div>
      
      <div className="max-w-4xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white dark:bg-zinc-900 rounded-2xl flex items-center justify-center shadow-lg border border-zinc-200 dark:border-zinc-800">
              <img src="/branding/Icon-1000x1000.png" alt="Fees Please" className="w-8 h-8" />
            </div>
            <div>
              <h1 className={`${interItalic.className} text-2xl font-black uppercase tracking-tighter text-zinc-900 dark:text-white`}>
                Affiliate Portal
              </h1>
              <p className={`${robotoMono.className} text-[10px] text-zinc-500 font-bold uppercase tracking-widest`}>
                Fees Please Affiliates
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowRegisterModal(true)}
              className="px-4 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-colors border border-emerald-500/20 shadow-sm whitespace-nowrap"
            >
              <i className="fa-solid fa-plus mr-2"></i> Register Team
            </button>
            <ThemeToggle />
            <button 
              onClick={handleLogout}
              className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center shadow-sm border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-red-500 transition-colors shrink-0"
            >
              <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Stats Card */}
          <div className="md:col-span-1 bg-white dark:bg-zinc-900 rounded-3xl p-8 shadow-xl shadow-zinc-200/50 dark:shadow-none border border-zinc-200 dark:border-zinc-800 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
            
            <h3 className="text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest text-xs mb-2">Total Referrals</h3>
            <div className="flex items-end gap-3">
              <span className="text-6xl font-black tracking-tighter text-zinc-900 dark:text-white">
                {referralCount !== null ? referralCount : '-'}
              </span>
              <span className="text-emerald-500 font-bold tracking-widest uppercase text-xs mb-2">Users</span>
            </div>
          </div>

          {/* Link Card */}
          <div className="md:col-span-2 bg-emerald-500 rounded-3xl p-8 shadow-xl shadow-emerald-500/20 relative overflow-hidden text-white">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
            
            <h2 className={`${interItalic.className} text-3xl font-black uppercase tracking-tighter mb-2`}>
              Share the love
            </h2>
            <p className="text-emerald-50 mb-8 max-w-md text-sm leading-relaxed">
              Give your unique link to friends and teams. When they sign up, they'll be tracked as your referral automatically.
            </p>

            <div className="bg-emerald-600/50 border border-emerald-400/30 rounded-2xl p-2 flex items-center backdrop-blur-md">
              <input 
                type="text" 
                readOnly 
                value={referralLink}
                className="bg-transparent flex-1 px-4 text-emerald-50 outline-none text-sm font-medium w-full"
              />
              <button 
                onClick={copyToClipboard}
                className="bg-white text-emerald-600 hover:bg-emerald-50 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-colors whitespace-nowrap flex items-center gap-2 shadow-lg"
              >
                {copied ? (
                  <><i className="fa-solid fa-check"></i> Copied</>
                ) : (
                  <><i className="fa-regular fa-copy"></i> Copy Link</>
                )}
              </button>
            </div>
          </div>

          {/* Register Team Banner CTA Card (Full Width) */}
          <div className="md:col-span-3 bg-white dark:bg-zinc-900 rounded-3xl p-8 shadow-xl shadow-zinc-200/50 dark:shadow-none border border-zinc-200 dark:border-zinc-800 relative overflow-hidden group flex flex-col md:flex-row md:items-center md:justify-between gap-6 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full pointer-events-none"></div>
            <div className="max-w-xl">
              <h3 className={`${interItalic.className} text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white mb-2 flex items-center gap-2`}>
                <i className="fa-solid fa-flag text-emerald-500"></i> Want to collect fees for your own team?
              </h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs font-medium leading-relaxed">
                Fees Please makes it incredibly simple to track match fees, players, pay umpires, and send automatic payment reminders. Get your own team set up in minutes.
              </p>
            </div>
            <button 
              onClick={() => setShowRegisterModal(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all duration-200 shadow-lg shadow-emerald-500/25 active:scale-95 shrink-0 flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-plus"></i> Register a New Team
            </button>
          </div>

        </div>

        {/* Safeguard Register Modal */}
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
        
        {/* Footer info */}
        <div className="mt-12 text-center">
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
            Need help? Contact support at support@feesplease.app
          </p>
        </div>
      </div>
    </div>
  );
}
