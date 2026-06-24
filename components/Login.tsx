"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Inter, Roboto_Mono } from 'next/font/google';

const interItalic = Inter({ subsets: ['latin'], style: 'italic' });
const robotoMono = Roboto_Mono({ subsets: ['latin'] });

export default function Login({ redirectTo = '/' }: { redirectTo?: string }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [needsName, setNeedsName] = useState(false);
  const [error, setError] = useState("");
  const [isLocalhost, setIsLocalhost] = useState(false);

  useEffect(() => {
    setIsLocalhost(
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1'
    );
  }, []);

  const handleGoogleLogin = async () => {
    document.cookie = `fp_next_url=${redirectTo}; path=/; max-age=300`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // FIX: This query parameter forces Google to prompt the user to select an account
        // instead of automatically logging them in with a cached session.
        queryParams: {
          prompt: 'select_account',
        },
      },
    });
    if (error) setError(error.message);
  };

  const handleFacebookLogin = async () => {
    document.cookie = `fp_next_url=${redirectTo}; path=/; max-age=300`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setError(error.message);
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError("");

    // Step 1: If we haven't asked for a name yet, check if the user exists
    if (!needsName) {
      try {
        const res = await fetch("/api/auth/check-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        
        if (res.ok) {
          const { exists } = await res.json();
          if (!exists) {
            // User does not exist, ask for name
            setNeedsName(true);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error("Error checking email:", err);
        // Fall back to asking for name if we can't verify
        setNeedsName(true);
        setLoading(false);
        return;
      }
    }

    // Step 2: If we need a name and it's missing, show error
    if (needsName && !fullName.trim()) {
      setError("Please provide your full name.");
      setLoading(false);
      return;
    }

    document.cookie = `fp_next_url=${redirectTo}; path=/; max-age=300`;

    const options: any = { 
      emailRedirectTo: `${window.location.origin}/auth/callback` 
    };

    if (needsName && fullName.trim()) {
      options.data = { full_name: fullName.trim() };
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options,
    });

    if (error) setError(error.message);
    else setSubmitted(true);
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.15)_0%,rgba(9,9,11,0)_70%)] pointer-events-none"></div>

      <div className="w-full max-w-sm relative z-10 flex flex-col items-center">
        <div className="text-center mb-10 flex flex-col items-center">
          <img src="/branding/Icon-1000x1000.png" alt="Fees Please" className="w-24 h-24 mb-3 drop-shadow-2xl" />
          <h1 className={`${interItalic.className} text-4xl font-black uppercase tracking-tighter text-emerald-500 mb-1`}>Fees Please</h1>
          <p className={`${robotoMono.className} text-[0.72em] text-zinc-400 font-bold uppercase tracking-[0.1em]`}>
           Less chasing. More Playing.
          </p>
        </div>

        {/* Submitted State */}
        <div className={`bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/80 w-full p-8 rounded-3xl text-center shadow-2xl animate-in zoom-in-95 fade-in duration-300 ${submitted ? 'block' : 'hidden'}`}>
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-envelope-open-text text-2xl"></i>
          </div>
          <h2 className="text-white font-black uppercase tracking-widest text-sm mb-2">Check Your Email</h2>
          <p className="text-zinc-500 text-sm mb-6 leading-relaxed">
            We sent a magic sign-in link to <br/><span className="text-emerald-500 font-bold">{email}</span>
          </p>
          <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mb-2">
            You can close this window.
          </p>
          <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mb-6 bg-emerald-500/10 inline-block px-3 py-1.5 rounded-lg border border-emerald-500/20">
            <i className="fa-solid fa-triangle-exclamation mr-1"></i> Don't forget to check your junk/spam folder!
          </p>
          <div className="block">
            <button 
              onClick={() => { setSubmitted(false); setShowEmailForm(false); setNeedsName(false); setFullName(""); }}
              className="text-[10px] text-zinc-500 hover:text-white uppercase font-black tracking-widest underline decoration-zinc-800 underline-offset-4 transition-colors"
            >
              Try a different email
            </button>
          </div>
        </div>

        {/* Login Form State */}
        <div className={`bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/80 w-full p-6 rounded-3xl shadow-2xl animate-in fade-in duration-300 ${submitted ? 'hidden' : 'block'}`}>
          <div className="space-y-4">
            <button
              onClick={handleGoogleLogin}
              className="w-full bg-white hover:bg-gray-100 text-black font-black py-4 rounded-xl uppercase tracking-widest text-xs active:scale-95 transition-all shadow-lg flex items-center justify-center gap-3"
            >
              <i className="fa-brands fa-google text-base"></i>
              Continue with Google
            </button>

            {isLocalhost && (
              <button
                onClick={handleFacebookLogin}
                className="w-full bg-[#1877F2] hover:bg-[#166fe5] text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs active:scale-95 transition-all shadow-lg flex items-center justify-center gap-3"
              >
                <i className="fa-brands fa-facebook text-base"></i>
                Continue with Facebook
              </button>
            )}

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800"></div></div>
              <div className="relative flex justify-center"><span className="bg-zinc-900 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-600">Or use email</span></div>
            </div>

            {!showEmailForm ? (
              <button
                onClick={() => setShowEmailForm(true)}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs active:scale-95 transition-all shadow-lg flex items-center justify-center gap-3"
              >
                <i className="fa-regular fa-envelope text-base"></i>
                Continue with Email
              </button>
            ) : (
              <form onSubmit={handleEmailLogin} className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                {needsName && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 ml-1 text-center">
                      Looks like you're new! What's your name?
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Full Name (e.g. Ashley Pitt)"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-4 text-sm text-white outline-none focus:border-emerald-500 transition-colors text-center"
                    />
                  </div>
                )}
              <div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setNeedsName(false); setFullName(""); }}
                  placeholder="name@example.com"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-4 text-sm text-white outline-none focus:border-emerald-500 transition-colors text-center"
                />
              </div>
              
              {error && (
                <div className="text-red-500 text-[10px] uppercase tracking-widest font-black bg-red-500/10 p-3 rounded-xl border border-red-500/20 text-center">
                  <i className="fa-solid fa-triangle-exclamation mr-1"></i> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email || (needsName && !fullName.trim())}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? (needsName ? "Sending..." : "Checking...") : "Continue"}
              </button>
              <button 
                type="button"
                onClick={() => { setShowEmailForm(false); setNeedsName(false); setFullName(""); }}
                className="w-full py-2 text-[10px] text-zinc-500 hover:text-white uppercase font-black tracking-widest transition-colors"
              >
                Cancel
              </button>
            </form>
            )}
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">
              No password required.
            </p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 text-[9px] text-zinc-700 font-black tracking-widest uppercase">
       
      </div>
    </div>
  );
}