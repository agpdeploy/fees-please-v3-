"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/useProfile";
import { supabase } from "@/lib/supabase";

import StatCard from "@/components/admin/StatCard";
import DynamicDashboardTable from "@/components/admin/DynamicDashboardTable";
import PlayerMatcher from "@/components/admin/PlayerMatcher";
import ThemeToggle from "@/components/ThemeToggle";

interface AdminStats {
  total_clubs: number;
  total_teams: number;
  total_fixtures: number;
  total_players: number;
  players_with_contact: number;
  total_funds: number;
  cash_funds: number;
  card_funds: number;
  total_profiles: number;
  onboarded_profiles: number;
  google_logins: number;
  email_logins: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfile();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Dynamic Table View State
  const [activeView, setActiveView] = useState<'teams' | 'players' | 'funds' | 'onboarding'>('teams');

  useEffect(() => {
    if (!profileLoading && profile?.role !== 'super_admin') {
      router.push('/');
    }
  }, [profile, profileLoading, router]);

  useEffect(() => {
    if (profile?.role === 'super_admin') {
      const fetchStats = async () => {
        setStatsLoading(true);
        const { data, error } = await supabase.rpc('get_super_admin_stats');
        if (data && !error) {
          setStats(data as AdminStats);
        }
        setStatsLoading(false);
      };
      fetchStats();
    }
  }, [profile]);

  if (profileLoading || profile?.role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center">
        <i className="fa-solid fa-circle-notch text-emerald-500 text-3xl animate-spin mb-4"></i>
        <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
          Authenticating...
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
  };

  const calculatePercentage = (part: number, whole: number) => {
    if (whole === 0) return 0;
    return Math.round((part / whole) * 100);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-300">
      {/* Admin Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/')} className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div>
            <h1 className="text-xl font-black italic uppercase tracking-tighter text-amber-500">Platform Admin</h1>
            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Super Admin Dashboard</div>
          </div>
        </div>
        <div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        
        {/* STATS GRID */}
        <section>
          <div className="flex items-center gap-3 mb-4 px-2">
            <i className="fa-solid fa-chart-line text-zinc-400"></i>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Platform Overview</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              title="Active Teams"
              value={stats?.total_teams ?? 0}
              subtitle={`${stats?.total_clubs ?? 0} Clubs · ${stats?.total_fixtures ?? 0} Fixtures`}
              icon="fa-shield-halved"
              gradientFrom="#3b82f6"
              gradientTo="#8b5cf6"
              isLoading={statsLoading}
              onClick={() => setActiveView('teams')}
            />
            <StatCard 
              title="Total Players"
              value={stats?.total_players ?? 0}
              subtitle={`${stats ? calculatePercentage(stats.players_with_contact, stats.total_players) : 0}% w/ Contact Info`}
              icon="fa-users"
              gradientFrom="#10b981"
              gradientTo="#3b82f6"
              isLoading={statsLoading}
              onClick={() => setActiveView('players')}
            />
            <StatCard 
              title="Processed Funds"
              value={stats ? formatCurrency(stats.total_funds) : '$0'}
              subtitle="Total All-Time Payments"
              secondaryInfo={stats ? `Card: ${formatCurrency(stats.card_funds)} • Cash: ${formatCurrency(stats.cash_funds)}` : undefined}
              icon="fa-sack-dollar"
              gradientFrom="#f59e0b"
              gradientTo="#ef4444"
              isLoading={statsLoading}
              onClick={() => setActiveView('funds')}
            />
            <StatCard 
              title="User Onboarding"
              value={`${stats ? calculatePercentage(stats.onboarded_profiles, stats.total_profiles) : 0}%`}
              subtitle={`${stats?.onboarded_profiles ?? 0} / ${stats?.total_profiles ?? 0} Setup Complete`}
              secondaryInfo={stats ? `Google: ${stats.google_logins} • Email: ${stats.email_logins}` : undefined}
              icon="fa-user-check"
              gradientFrom="#ec4899"
              gradientTo="#8b5cf6"
              isLoading={statsLoading}
              onClick={() => setActiveView('onboarding')}
            />
          </div>
        </section>

        {/* MAIN DASHBOARD CONTENT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-8">
            <section>
              <DynamicDashboardTable activeView={activeView} onResetView={() => setActiveView('teams')} />
            </section>
          </div>

          <div className="lg:col-span-1">
            <section className="h-full">
              <PlayerMatcher />
            </section>
          </div>

        </div>

      </main>
    </div>
  );
}
