"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface ActiveClub {
  id: string;
  name: string;
  created_at: string;
  team_count: number;
  player_count: number;
}

export default function ClubsTable() {
  const [clubs, setClubs] = useState<ActiveClub[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 10;

  const fetchClubs = async (currentPage: number) => {
    setIsLoading(true);
    const { data, error } = await supabase.rpc('get_active_clubs_paginated', {
      limit_val: limit,
      offset_val: currentPage * limit
    });
    
    if (data && !error) {
      setClubs(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchClubs(page);
  }, [page]);

  const handleArchive = async (clubId: string) => {
    if (!confirm("Are you sure you want to archive this club?")) return;
    
    const { error } = await supabase
      .from('clubs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', clubId);
      
    if (!error) {
      setClubs(clubs.filter(c => c.id !== clubId));
    } else {
      alert("Error archiving club");
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
        <h2 className="font-black uppercase tracking-widest text-sm text-zinc-900 dark:text-white">
          Active Accounts
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white disabled:opacity-50 transition-colors"
          >
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <button 
            onClick={() => setPage(page + 1)}
            disabled={clubs.length < limit}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white disabled:opacity-50 transition-colors"
          >
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-950/50 text-[10px] font-black uppercase tracking-widest text-zinc-500">
            <tr>
              <th className="px-5 py-3">Account Name</th>
              <th className="px-5 py-3">Created</th>
              <th className="px-5 py-3 text-center">Teams</th>
              <th className="px-5 py-3 text-center">Players</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-5 py-4"><div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-32"></div></td>
                  <td className="px-5 py-4"><div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-24"></div></td>
                  <td className="px-5 py-4"><div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-8 mx-auto"></div></td>
                  <td className="px-5 py-4"><div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-8 mx-auto"></div></td>
                  <td className="px-5 py-4"><div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></td>
                </tr>
              ))
            ) : clubs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-zinc-500 text-xs font-bold uppercase tracking-widest">
                  No active clubs found.
                </td>
              </tr>
            ) : (
              clubs.map(club => (
                <tr key={club.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-5 py-4 font-bold text-zinc-900 dark:text-white truncate max-w-[200px]">
                    {club.name}
                  </td>
                  <td className="px-5 py-4 text-zinc-500 text-xs">
                    {new Date(club.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 text-center font-bold text-zinc-900 dark:text-white">
                    {club.team_count}
                  </td>
                  <td className="px-5 py-4 text-center font-bold text-zinc-900 dark:text-white">
                    {club.player_count}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button 
                      onClick={() => handleArchive(club.id)}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors"
                    >
                      Archive
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
