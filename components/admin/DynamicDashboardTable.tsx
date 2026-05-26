"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";

type ActiveView = 'teams' | 'players' | 'funds' | 'onboarding';

interface DynamicDashboardTableProps {
  activeView: ActiveView;
  onResetView: () => void;
}

export default function DynamicDashboardTable({ activeView, onResetView }: DynamicDashboardTableProps) {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sorting
  const [sortKey, setSortKey] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination (Local)
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(25);

  useEffect(() => {
    setPage(0); // Reset page when limit or view changes
  }, [activeView, limit]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      let rpcName = '';
      let params = {};

      if (activeView === 'teams') {
        rpcName = 'get_active_teams_paginated';
        params = { limit_val: 10000, offset_val: 0 }; // Fetch all for local sorting
      } else if (activeView === 'players') {
        rpcName = 'get_players_drilldown';
      } else if (activeView === 'funds') {
        rpcName = 'get_funds_by_team';
      } else if (activeView === 'onboarding') {
        rpcName = 'get_onboarding_drilldown';
      }

      const { data: result, error } = await supabase.rpc(rpcName, params);
      
      if (!error && result) {
        setData(result);
      } else {
        console.error("Error fetching table data:", error);
      }
      setIsLoading(false);
    };

    fetchData();
  }, [activeView]);

  // Local Sorting
  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];
      
      // Handle nulls
      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });
  }, [data, sortKey, sortOrder]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc'); // Default to descending when clicking a new column
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortKey !== columnKey) return <i className="fa-solid fa-sort ml-1 opacity-20 group-hover:opacity-100 transition-opacity"></i>;
    return <i className={`fa-solid fa-sort-${sortOrder === 'asc' ? 'up' : 'down'} ml-1 text-emerald-500`}></i>;
  };

  // Local Pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / limit));
  const paginatedData = sortedData.slice(page * limit, (page + 1) * limit);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  };

  // CSV Export Logic
  const exportToCSV = () => {
    if (!data || data.length === 0) return;

    // 1. Generate CSV Headers dynamically based on the first row (excluding ID)
    const keys = Object.keys(data[0]).filter(k => k !== 'id');
    
    // 2. Map data rows
    const csvContent = [
      keys.join(','), // Header row
      ...data.map(row => 
        keys.map(k => {
          let val = row[k];
          if (val === null || val === undefined) val = '';
          // Quote strings if they contain commas
          if (typeof val === 'string' && val.includes(',')) {
            val = `"${val}"`;
          }
          return val;
        }).join(',')
      )
    ].join('\n');

    // 3. Trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `platform_export_${activeView}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const viewTitles = {
    teams: "Active Teams",
    players: "Players Analysis",
    funds: "Processed Funds Breakdown",
    onboarding: "Setup Checklist Status"
  };

  const onboardingSteps = [
    { key: 'has_club', label: 'Team' },
    { key: 'has_players', label: 'Players' },
    { key: 'has_season', label: 'Season' },
    { key: 'has_fixtures', label: 'Fixtures' },
    { key: 'has_financials', label: 'Finance' },
  ];

  return (
    <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-xl relative flex flex-col min-h-[500px]">
      
      {/* Header */}
      <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-[#151515]">
        <div className="flex items-center gap-3">
          {activeView !== 'teams' && (
            <button 
              onClick={onResetView}
              className="w-8 h-8 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors shadow-sm"
              title="Back to Default View"
            >
              <i className="fa-solid fa-arrow-left text-xs"></i>
            </button>
          )}
          <h3 className="font-black italic uppercase tracking-widest text-zinc-900 dark:text-white text-sm">
            {viewTitles[activeView]}
          </h3>
        </div>
        
        <div className="flex items-center gap-3">
          {/* CSV Export Button */}
          <button
            onClick={exportToCSV}
            disabled={isLoading || data.length === 0}
            className="px-4 py-2 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors shadow-sm disabled:opacity-50 disabled:pointer-events-none"
          >
            <i className="fa-solid fa-file-csv mr-2"></i> Export CSV
          </button>

          {/* Pagination */}
          <div className="flex items-center gap-4">
            
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Rows:</span>
              <select 
                value={limit} 
                onChange={(e) => setLimit(Number(e.target.value))}
                className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-zinc-900 dark:text-white cursor-pointer focus:ring-0"
              >
                <option value={10} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">10</option>
                <option value={25} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">25</option>
                <option value={50} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">50</option>
                <option value={100} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">100</option>
              </select>
            </div>

            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Page {page + 1} of {totalPages}
            </div>

            <div className="flex gap-1">
              <button 
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0 || isLoading}
                className="w-8 h-8 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-emerald-500 hover:border-emerald-500 transition-colors disabled:opacity-50"
              >
                <i className="fa-solid fa-chevron-left text-xs"></i>
              </button>
              <button 
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages - 1 || isLoading}
                className="w-8 h-8 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-emerald-500 hover:border-emerald-500 transition-colors disabled:opacity-50"
              >
                <i className="fa-solid fa-chevron-right text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 dark:bg-[#181818]">
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 cursor-pointer group hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors" onClick={() => handleSort('team_name')}>
                Team Name <SortIcon columnKey="team_name" />
              </th>
              
              {activeView === 'teams' && (
                <>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 cursor-pointer group hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors" onClick={() => handleSort('club_name')}>
                    Club <SortIcon columnKey="club_name" />
                  </th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 cursor-pointer group hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors" onClick={() => handleSort('created_at')}>
                    Created <SortIcon columnKey="created_at" />
                  </th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 text-center cursor-pointer group hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors" onClick={() => handleSort('player_count')}>
                    Players <SortIcon columnKey="player_count" />
                  </th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 text-center">
                    Admins
                  </th>
                </>
              )}

              {activeView === 'players' && (
                <>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 text-center cursor-pointer group hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors" onClick={() => handleSort('total_players')}>
                    Total Players <SortIcon columnKey="total_players" />
                  </th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 text-center cursor-pointer group hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors" onClick={() => handleSort('players_with_contact')}>
                    Contact Info <SortIcon columnKey="players_with_contact" />
                  </th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 text-right cursor-pointer group hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors" onClick={() => handleSort('players_with_contact')}>
                    Completion Rate <SortIcon columnKey="players_with_contact" />
                  </th>
                </>
              )}

              {activeView === 'funds' && (
                <>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 text-right cursor-pointer group hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors" onClick={() => handleSort('card_collected')}>
                    Card <SortIcon columnKey="card_collected" />
                  </th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 text-right cursor-pointer group hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors" onClick={() => handleSort('cash_collected')}>
                    Cash <SortIcon columnKey="cash_collected" />
                  </th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 text-right cursor-pointer group hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors" onClick={() => handleSort('total_collected')}>
                    Total <SortIcon columnKey="total_collected" />
                  </th>
                </>
              )}

              {activeView === 'onboarding' && (
                <>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">Inferred Stuck Area</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 text-center">Progress</th>
                </>
              )}

            </tr>


          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-zinc-400 text-xs font-bold uppercase tracking-widest">
                  <i className="fa-solid fa-circle-notch fa-spin mr-2 text-emerald-500 text-lg mb-2"></i><br/>Loading Data...
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-zinc-400 text-xs font-bold uppercase tracking-widest">
                  No data found.
                </td>
              </tr>
            ) : (
              paginatedData.map((row) => (
                <tr key={row.id} className="group/row hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors border-b border-zinc-50 dark:border-zinc-800/50 last:border-0">
                  
                  {/* Shared Team Column */}
                  <td className="p-4 text-sm font-bold text-zinc-900 dark:text-white group-hover/row:text-emerald-500 transition-colors">
                    {row.team_name}
                  </td>

                  {/* TEAMS VIEW */}
                  {activeView === 'teams' && (
                    <>
                      <td className="p-4">
                        {row.club_name ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest">
                            <i className="fa-solid fa-building text-[10px]"></i> {row.club_name}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                            <i className="fa-solid fa-users-slash text-[10px]"></i> Independent
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        {formatDate(row.created_at)}
                      </td>
                      <td className="p-4 text-xs font-bold text-zinc-700 dark:text-zinc-300 text-center">
                        {row.player_count > 0 ? row.player_count : '-'}
                      </td>
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 px-3 py-1 rounded-full text-[10px] font-black text-zinc-600 dark:text-zinc-400">
                          <span title="Club Admins"><i className="fa-solid fa-building mr-1"></i>{row.club_admins ?? 0}</span>
                          <span className="text-zinc-300 dark:text-zinc-700">|</span>
                          <span title="Team Admins"><i className="fa-solid fa-users-gear mr-1"></i>{row.team_admins ?? 0}</span>
                        </div>
                      </td>
                    </>
                  )}

                  {/* PLAYERS VIEW */}
                  {activeView === 'players' && (
                    <>
                      <td className="p-4 text-sm font-bold text-zinc-700 dark:text-zinc-300 text-center">{row.total_players}</td>
                      <td className="p-4 text-sm font-bold text-emerald-600 dark:text-emerald-400 text-center">{row.players_with_contact}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-24 h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${row.total_players > 0 && Math.round((row.players_with_contact / row.total_players) * 100) === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                              style={{ width: `${row.total_players > 0 ? Math.round((row.players_with_contact / row.total_players) * 100) : 0}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-black w-10 text-zinc-600 dark:text-zinc-400">
                            {row.total_players > 0 ? Math.round((row.players_with_contact / row.total_players) * 100) : 0}%
                          </span>
                        </div>
                      </td>
                    </>
                  )}

                  {/* FUNDS VIEW */}
                  {activeView === 'funds' && (
                    <>
                      <td className="p-4 text-sm font-medium text-amber-600 dark:text-amber-400 text-right">{formatMoney(row.card_collected)}</td>
                      <td className="p-4 text-sm font-medium text-emerald-600 dark:text-emerald-400 text-right">{formatMoney(row.cash_collected)}</td>
                      <td className="p-4 text-sm font-black text-zinc-900 dark:text-white text-right">{formatMoney(row.total_collected)}</td>
                    </>
                  )}

                  {/* ONBOARDING VIEW */}
                  {activeView === 'onboarding' && (
                    <>
                      <td className="p-4">
                        {(() => {
                          const completed = onboardingSteps.filter(s => row[s.key]).length;
                          if (completed === onboardingSteps.length) {
                            return (
                              <span className="inline-block px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                                <i className="fa-solid fa-check mr-1"></i> Completed
                              </span>
                            );
                          }
                          const firstMissing = onboardingSteps.find(s => !row[s.key]);
                          return (
                            <span className="inline-block px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 text-[10px] font-black uppercase tracking-widest">
                              <i className="fa-solid fa-triangle-exclamation mr-1"></i> Missing {firstMissing?.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1">
                          {onboardingSteps.map((step, i) => (
                            <div 
                              key={i} 
                              className={`w-6 h-2 rounded-full ${row[step.key] ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-800'}`}
                              title={`${step.label}: ${row[step.key] ? 'Done' : 'Missing'}`}
                            />
                          ))}
                        </div>
                      </td>
                    </>
                  )}

                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
