import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [loginMode, setLoginMode] = useState<'captain' | 'admin'>('captain');
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [clubs, setClubs] = useState<any[]>([]);
  const [selectedClub, setSelectedClub] = useState<any>(null);
  const [pin, setPin] = useState("");
  const [matchingTeams, setMatchingTeams] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true); setErrorMsg("");

    try {
      let authResult;
      if (isSignUp) {
        authResult = await supabase.auth.signUp({ email, password });
      } else {
        authResult = await supabase.auth.signInWithPassword({ email, password });
      }
      
      if (authResult.error) throw authResult.error;

      const { data: userData, error: userError } = await supabase.from('users').select('club_id').eq('auth_id', authResult.data.user?.id).single();

      if (userError || !userData) throw new Error("Login successful, but no club assigned. Contact admin.");

      localStorage.setItem("captainClubId", userData.club_id);
      window.location.reload();
      
    } catch (error: any) {
      setErrorMsg(error.message || "An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchClubs = async () => {
      if (searchTerm.length >= 2) {
        const { data } = await supabase.from('clubs').select('id, name').ilike('name', `%${searchTerm}%`).limit(5);
        if (data) setClubs(data);
      } else {
        setClubs([]);
      }
    };
    fetchClubs();
  }, [searchTerm]);

  const handleCaptainLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true); setErrorMsg("");

    const { data, error } = await supabase.from("teams").select("id, name, club_id").eq("club_id", selectedClub.id).eq("pin_code", pin);

    if (error || !data || data.length === 0) {
      setErrorMsg("Invalid PIN for this club.");
      setIsLoading(false);
      return;
    }

    if (data.length === 1) {
      loginToTeam(data[0]);
    } else {
      setMatchingTeams(data);
    }
    setIsLoading(false);
  };

  const loginToTeam = (team: any) => {
    localStorage.setItem("captainTeamId", team.id);
    localStorage.setItem("captainClubId", team.club_id); 
    window.location.reload();
  };

  const resetCaptainSearch = () => {
    setSelectedClub(null); setSearchTerm(""); setPin(""); setMatchingTeams([]); setErrorMsg("");
  };

  return (
    <div className="flex flex-col min-h-screen max-w-[480px] mx-auto bg-zinc-950 px-6 justify-center items-center pb-20">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-emerald-600/20 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
          <i className="fa-solid fa-bolt-lightning text-3xl text-emerald-500"></i>
        </div>
        <h1 className="text-3xl font-black italic text-emerald-500 uppercase tracking-tighter">Fees Please</h1>
      </div>

      <div className="flex w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-1 mb-6">
        <button onClick={() => { setLoginMode('captain'); setErrorMsg(""); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${loginMode === 'captain' ? 'bg-zinc-800 text-emerald-500 shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>Captain PIN</button>
        <button onClick={() => { setLoginMode('admin'); setErrorMsg(""); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${loginMode === 'admin' ? 'bg-zinc-800 text-emerald-500 shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>Admin Portal</button>
      </div>

      <div className="w-full bg-zinc-900 border border-zinc-800 p-6 rounded-3xl shadow-2xl min-h-[320px] flex flex-col justify-center">
        {errorMsg && <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-xs p-3 rounded-xl mb-4 text-center font-bold animate-in fade-in">{errorMsg}</div>}

        {loginMode === 'captain' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            {!selectedClub && (
              <div className="space-y-3">
                <h2 className="text-sm font-black uppercase italic text-white mb-2 text-center">Find Your Club</h2>
                <div className="relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"></i>
                  <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-12 pr-4 py-4 text-sm text-white outline-none focus:border-emerald-500 font-bold placeholder:font-normal" placeholder="Search e.g. 'Ferny'..." />
                </div>
                {clubs.length > 0 && (
                  <div className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden shadow-lg mt-2">
                    {clubs.map(club => (
                      <button key={club.id} onClick={() => setSelectedClub(club)} className="w-full text-left px-4 py-3 text-sm text-white font-bold border-b border-zinc-700/50 last:border-0 hover:bg-zinc-700 transition-colors flex justify-between items-center group">
                        {club.name}
                        <i className="fa-solid fa-chevron-right text-[10px] text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedClub && matchingTeams.length === 0 && (
              <form onSubmit={handleCaptainLogin} className="space-y-4 animate-in fade-in">
                <div className="text-center mb-6">
                  <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-1">Logging into</p>
                  <h2 className="text-sm font-black uppercase text-emerald-500">{selectedClub.name}</h2>
                </div>
                <input type="password" maxLength={4} required value={pin} onChange={(e) => setPin(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-4 text-3xl tracking-[1em] text-center text-white outline-none focus:border-emerald-500 font-black" placeholder="••••" />
                <button type="submit" disabled={isLoading || pin.length < 4} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all disabled:opacity-50">
                  {isLoading ? "Verifying..." : "Unlock Dashboard"}
                </button>
                <button type="button" onClick={resetCaptainSearch} className="w-full text-[10px] text-zinc-500 hover:text-zinc-300 font-bold uppercase pt-2 transition-colors">Change Club</button>
              </form>
            )}

            {matchingTeams.length > 0 && (
              <div className="space-y-3 animate-in fade-in">
                <p className="text-[10px] text-emerald-500 uppercase font-black text-center mb-2 tracking-widest">Select Your Team</p>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {matchingTeams.map(team => (
                    <button key={team.id} onClick={() => loginToTeam(team)} className="w-full bg-zinc-800 border border-zinc-700 hover:border-emerald-500 p-4 rounded-2xl text-white font-bold text-sm text-left flex justify-between items-center group transition-colors">
                      {team.name} <i className="fa-solid fa-chevron-right text-zinc-600 group-hover:text-emerald-500 transition-colors"></i>
                    </button>
                  ))}
                </div>
                <button onClick={() => setMatchingTeams([])} className="w-full text-[10px] text-zinc-500 hover:text-zinc-300 font-bold uppercase pt-2 transition-colors">Back to PIN</button>
              </div>
            )}
          </div>
        )}

        {loginMode === 'admin' && (
          <form onSubmit={handleAdminAuth} className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-sm font-black uppercase italic text-white mb-6 text-center">{isSignUp ? "Create Admin Account" : "Admin Login"}</h2>
            <input type="email" placeholder="Email Address" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500" />
            <input type="password" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500" />
            <button type="submit" disabled={isLoading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs mt-4 disabled:opacity-50">
              {isLoading ? "Authenticating..." : (isSignUp ? "Sign Up" : "Secure Login")}
            </button>
            <div className="mt-4 text-center">
              <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-[10px] text-zinc-500 font-bold hover:text-emerald-500 uppercase tracking-widest transition-colors">
                {isSignUp ? "Already have an account? Log in." : "Create an organization."}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}