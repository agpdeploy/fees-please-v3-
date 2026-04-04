"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });

    if (error) setError(error.message);
    else setSubmitted(true);
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter text-emerald-500 mb-2">Fees Please</h1>
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
            Sports team management, simplified.
          </p>
        </div>

        {submitted ? (
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl text-center shadow-2xl animate-in zoom-in-95 fade-in duration-300">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-envelope-open-text text-2xl"></i>
            </div>
            <h2 className="text-white font-black uppercase tracking-widest text-sm mb-2">Check Your Email</h2>
            <p className="text-zinc-500 text-sm mb-6 leading-relaxed">
              We sent a magic sign-in link to <br/><span className="text-emerald-500 font-bold">{email}</span>
            </p>
            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mb-6">
              You can close this window.
            </p>
            <button 
              onClick={() => setSubmitted(false)}
              className="text-[10px] text-zinc-500 hover:text-white uppercase font-black tracking-widest underline decoration-zinc-800 underline-offset-4 transition-colors"
            >
              Try a different email
            </button>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl shadow-2xl animate-in fade-in duration-300">
            <h2 className="text-white font-black uppercase tracking-widest text-sm mb-6 text-center">Welcome</h2>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                disabled={loading || !email}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs active:scale-95 transition-all disabled:opacity-50 shadow-lg"
              >
                {loading ? "Sending..." : "Continue with Email"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}