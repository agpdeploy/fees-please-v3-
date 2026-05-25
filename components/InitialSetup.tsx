"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function InitialSetup({ user, onComplete }: { user: any, onComplete: (clubId?: string) => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [sportType, setSportType] = useState("");
  const [showSportsDropdown, setShowSportsDropdown] = useState(false);

  const predefinedSports = [
    "AFL",
    "Basketball",
    "Cricket",
    "Cricket (Last Man Standing)",
    "Dodgeball",
    "Football / Soccer",
    "Futsal",
    "Hockey",
    "Indoor Cricket",
    "Indoor Netball",
    "Indoor Soccer",
    "Indoor Volleyball",
    "Netball",
    "Rugby League",
    "Rugby Union",
    "Tennis",
    "Touch Football",
    "Volleyball"
  ];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !teamName || !sportType) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 1. Update Auth Metadata for Name
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: `${firstName} ${lastName}` }
      });
      if (authError) throw authError;

      // 2. Update Profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          has_onboarded: true
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // 2. Create Club
      const baseSlug = teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      const clubSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
      
      const { data: clubData, error: clubError } = await supabase
        .from('clubs')
        .insert([{ 
          name: teamName,
          owner_id: user.id,
          slug: clubSlug,
          is_club: false,
          club_cat: "Other",
          entity_type: "Team",
          sport_type: sportType
        }])
        .select()
        .single();

      if (clubError) throw clubError;

      // 3. Create Team
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .insert([{ 
          name: teamName, 
          club_id: clubData.id,
          owner_id: user.id,
          slug: `${clubSlug}-team`
        }])
        .select()
        .single();

      if (teamError) throw teamError;

      // 4. Create Role (Club Admin & Team Admin)
      const { error: rolesError } = await supabase
        .from('user_roles') // <-- Wait, is the table 'roles' or 'user_roles'? In useProfile it's 'user_roles'
        .insert([
          { user_id: user.id, email: user.email, club_id: clubData.id, role: 'club_admin' },
          { user_id: user.id, email: user.email, club_id: clubData.id, team_id: teamData.id, role: 'team_admin' }
        ]);

      if (rolesError) throw rolesError;

      // 5. Complete Setup
      onComplete(clubData.id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('fp_active_club_id', clubData.id);
        window.location.reload(); // Force a hard reload to sync activeClubId and context immediately
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during setup.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-sm animate-in fade-in duration-300">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-user-astronaut text-2xl"></i>
          </div>
          <h2 className="text-2xl font-black italic uppercase text-zinc-900 dark:text-white tracking-tighter">Welcome Aboard</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-widest mt-2">
            Let&apos;s get you set up.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
                placeholder="First"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
                placeholder="Last"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Team Name</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
              placeholder="e.g. The Mighty Ducks"
              required
            />
          </div>

          <div className="relative z-50">
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Sport Type</label>
            <input
              type="text"
              value={sportType}
              onChange={(e) => {
                setSportType(e.target.value);
                setShowSportsDropdown(true);
              }}
              onFocus={() => setShowSportsDropdown(true)}
              onBlur={() => setTimeout(() => setShowSportsDropdown(false), 200)}
              placeholder="e.g. Cricket"
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
            />
            {showSportsDropdown && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {predefinedSports.filter(s => s.toLowerCase().includes(sportType.toLowerCase())).map(s => (
                  <div
                    key={s}
                    className="px-4 py-2 text-sm text-zinc-900 dark:text-white hover:bg-emerald-50 dark:hover:bg-emerald-900/20 cursor-pointer transition-colors"
                    onClick={() => {
                      setSportType(s);
                      setShowSportsDropdown(false);
                    }}
                  >
                    {s}
                  </div>
                ))}
                {sportType && predefinedSports.filter(s => s.toLowerCase().includes(sportType.toLowerCase())).length === 0 && (
                  <div className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400 italic">
                    Press continue to use "{sportType}"
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest p-3 rounded-xl border border-red-500/20 text-center">
              <i className="fa-solid fa-triangle-exclamation mr-1"></i> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs transition-colors shadow-md disabled:opacity-50 mt-4"
          >
            {loading ? "Setting Up..." : "Continue to Dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}
