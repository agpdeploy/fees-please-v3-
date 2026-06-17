"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/useProfile";
import Login from "@/components/Login";
import ThemeToggle from "@/components/ThemeToggle";

export default function AffiliatesPage() {
  const { profile, loading } = useProfile();
  const router = useRouter();

  useEffect(() => {
    if (!loading && profile) {
      router.replace("/?tab=referral");
    }
  }, [profile, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <i className="fa-solid fa-circle-notch fa-spin text-emerald-500 text-4xl"></i>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="relative min-h-screen bg-zinc-950">
        <div className="absolute top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <div className="absolute top-4 left-0 right-0 z-50 text-center pointer-events-none">
          <p className="text-emerald-400 font-black tracking-widest uppercase text-xs">Affiliate Portal</p>
        </div>
        <Login redirectTo="/?tab=referral" />
      </div>
    );
  }

  return null;
}

