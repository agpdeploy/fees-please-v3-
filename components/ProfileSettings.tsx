"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { usePostHog } from "posthog-js/react";

export default function ProfileSettings() {
  const { profile } = useProfile();
  const ph = usePostHog();
  const [analyticsConsent, setAnalyticsConsent] = useState(false);
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isSocialAuth, setIsSocialAuth] = useState(false);

  useEffect(() => {
    setAnalyticsConsent(localStorage.getItem('fp_analytics_consent') !== 'declined');
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      const providers = session?.user?.app_metadata?.providers || [];
      const hasSocial = providers.some((p: string) => p !== 'email');
      setIsSocialAuth(hasSocial);
      
      if (profile) {
        setFullName(hasSocial ? (session?.user?.user_metadata?.full_name || profile.full_name || "") : (profile.full_name || ""));
        setNickname(profile.nickname || "");
        setPhone(profile.phone || "");
        setAvatarUrl(hasSocial ? (session?.user?.user_metadata?.avatar_url || profile.avatar_url || "") : (profile.avatar_url || ""));
      }
    });
  }, [profile]);

  const handleConsentToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    setAnalyticsConsent(isChecked);
    if (isChecked) {
      localStorage.setItem('fp_analytics_consent', 'accepted');
      ph?.opt_in_capturing();
    } else {
      localStorage.setItem('fp_analytics_consent', 'declined');
      ph?.opt_out_capturing();
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;
    
    if (file.size > 2 * 1024 * 1024) {
      setError("Avatar must be under 2MB");
      return;
    }

    setUploading(true);
    setError("");

    const fileExt = file.name.split('.').pop();
    const filePath = `${profile.id}/${Math.random().toString(36).substring(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file);

    if (uploadError) {
      console.error("Avatar upload error:", uploadError);
      setError("Upload failed: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    setAvatarUrl(publicUrl);
    setUploading(false);
    
    // Auto save the avatar immediately
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    if (!fullName.trim()) {
      setError("Full Name is required.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess(false);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        nickname: nickname.trim() || null,
        phone: phone.trim() || null,
        avatar_url: avatarUrl || null,
        details_confirmed: true // Just in case
      })
      .eq('id', profile.id);

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  if (!profile) return null;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300 max-w-2xl">
      <div className="flex items-center gap-4 mb-2">
        <div className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center shadow-md border border-zinc-200 dark:border-zinc-800 shrink-0">
          <i className="fa-solid fa-user-gear text-emerald-500 text-lg"></i>
        </div>
        <div>
          <h2 className="text-xl font-black uppercase italic tracking-tighter text-zinc-900 dark:text-white">
            Profile Settings
          </h2>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
            Manage your global account details
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#111] rounded-3xl p-6 md:p-8 shadow-sm border border-zinc-200 dark:border-zinc-800">
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8 leading-relaxed">
          Update your global account profile. These details are shared across any teams you manage or play for.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col items-center justify-center mb-8 pb-8 border-b border-zinc-200 dark:border-zinc-800">
            <div className={`relative ${!isSocialAuth ? 'group cursor-pointer' : ''} mb-4`}>
              <div className={`w-24 h-24 rounded-full border-4 border-zinc-100 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 overflow-hidden shadow-lg relative ${!isSocialAuth ? 'group-hover:border-emerald-500 transition-colors' : ''}`}>
                {!isSocialAuth && (
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleAvatarUpload} 
                    disabled={uploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50" 
                  />
                )}
                {uploading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                    <i className="fa-solid fa-circle-notch fa-spin text-white text-2xl"></i>
                  </div>
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover z-0 relative" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center z-0 relative">
                    <i className="fa-solid fa-user text-4xl text-zinc-300 dark:text-zinc-600"></i>
                  </div>
                )}
                {!isSocialAuth && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                    <i className="fa-solid fa-camera text-white text-xl mb-1"></i>
                    <span className="text-[8px] font-black uppercase tracking-widest text-white">Upload</span>
                  </div>
                )}
              </div>
            </div>
            {!isSocialAuth ? (
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">
                Click to change avatar
              </p>
            ) : (
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">
                Avatar managed by Google
              </p>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold uppercase tracking-widest text-center">
              {error}
            </div>
          )}
          
          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 text-xs font-bold uppercase tracking-widest text-center flex items-center justify-center gap-2 animate-in fade-in zoom-in duration-300">
              <i className="fa-solid fa-check-circle text-base"></i> Profile Updated Successfully
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2 ml-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Ashley Pitt"
                className={`w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-zinc-900 dark:text-white transition-all ${isSocialAuth ? 'opacity-70 cursor-not-allowed' : 'focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500'}`}
                required
                readOnly={isSocialAuth}
                disabled={isSocialAuth}
              />
              {isSocialAuth && (
                <p className="text-[10px] text-zinc-500 mt-2 ml-1 font-bold">Managed by your social login provider.</p>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2 ml-1">
                Nickname / Preferred Name (Optional)
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Ash"
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2 ml-1">
                Mobile Number (Optional)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 0412 345 678"
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-900 dark:text-white mb-1">
                  Share Anonymous Usage Data
                </label>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Help us troubleshoot bugs and improve the app. Completely optional.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={analyticsConsent} onChange={handleConsentToggle} />
                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
              </label>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-colors shadow-lg shadow-emerald-500/25 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading ? (
                <i className="fa-solid fa-circle-notch fa-spin text-base"></i>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk text-base"></i>
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
