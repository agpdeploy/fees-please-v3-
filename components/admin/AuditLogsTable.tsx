"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";

export default function AuditLogsTable({ onResetView }: { onResetView: () => void }) {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(25);

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      // Fetch up to 1000 logs for local pagination/searching
      const { data: result, error } = await supabase
        .from('audit_logs')
        .select(`
          id,
          table_name,
          record_id,
          action_type,
          actor_id,
          timestamp,
          old_data,
          new_data
        `)
        .order('timestamp', { ascending: false })
        .limit(1000);
        
      if (!error && result) {
        // Fetch profile names for actors
        const actorIds = [...new Set(result.map(r => r.actor_id).filter(Boolean))];
        const profilesMap: Record<string, string> = {};
        
        if (actorIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', actorIds);
            
          if (profiles) {
            profiles.forEach(p => {
              profilesMap[p.id] = p.full_name || p.email || p.id;
            });
          }
        }

        const enrichedData = result.map(log => ({
          ...log,
          actor_name: profilesMap[log.actor_id] || log.actor_id || 'System'
        }));

        setData(enrichedData);
      } else {
        console.error("Error fetching audit logs:", error);
      }
      setIsLoading(false);
    };

    fetchLogs();
  }, []);

  const totalPages = Math.max(1, Math.ceil(data.length / limit));
  const paginatedData = data.slice(page * limit, (page + 1) * limit);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  };

  const getActionColor = (action: string) => {
    switch(action?.toUpperCase()) {
      case 'INSERT': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400';
      case 'UPDATE': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400';
      case 'DELETE': return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400';
      default: return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400';
    }
  };

  const getRecordName = (log: any) => {
    const data = log.new_data || log.old_data;
    if (!data) return log.record_id;

    if (log.table_name === 'players') {
      return `${data.first_name || ''} ${data.last_name || ''}`.trim() || log.record_id;
    }
    if (log.table_name === 'clubs' || log.table_name === 'teams') {
      return data.name || log.record_id;
    }
    if (log.table_name === 'fixtures') {
      if (data.date) {
        return `Fixture: ${new Date(data.date).toLocaleDateString()}`;
      }
      return 'Fixture';
    }
    
    // For anything else, see if it has a generic name or title
    return data.name || data.title || log.record_id;
  };

  const getChangedFields = (log: any) => {
    if (log.action_type !== 'UPDATE' || !log.old_data || !log.new_data) return null;
    
    const changed: string[] = [];
    Object.keys(log.new_data).forEach(key => {
      // Ignore timestamp updates and identical values
      if (key !== 'updated_at' && key !== 'created_at' && JSON.stringify(log.new_data[key]) !== JSON.stringify(log.old_data[key])) {
        changed.push(key);
      }
    });
    
    if (changed.length === 0) return null;
    
    // Format them nicely
    return changed.map(c => c.replace(/_/g, ' ')).join(', ');
  };

  return (
    <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-xl relative flex flex-col min-h-[500px]">
      
      {/* Header */}
      <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-[#151515]">
        <div className="flex items-center gap-3">
          <button 
            onClick={onResetView}
            className="w-8 h-8 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors shadow-sm"
            title="Back to Default View"
          >
            <i className="fa-solid fa-arrow-left text-xs"></i>
          </button>
          <h3 className="font-black italic uppercase tracking-widest text-zinc-900 dark:text-white text-sm">
            System Audit Logs
          </h3>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Rows:</span>
              <select 
                value={limit} 
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(0); }}
                className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-zinc-900 dark:text-white cursor-pointer focus:ring-0"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
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

      {isLoading ? (
        <div className="p-12 flex flex-col items-center justify-center">
          <i className="fa-solid fa-circle-notch text-emerald-500 text-3xl animate-spin mb-4"></i>
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Loading Logs...</span>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-[#181818]">
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">Date/Time</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">Action</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">Table</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">Record ID</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">User ID</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {paginatedData.map((log) => (
                <tr key={log.id} className="border-b border-zinc-50 dark:border-zinc-800/30 hover:bg-zinc-50 dark:hover:bg-[#151515] transition-colors group">
                  <td className="p-4 font-medium text-zinc-900 dark:text-zinc-100">
                    <div className="text-xs">{formatDate(log.timestamp)}</div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col items-start gap-1">
                      <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${getActionColor(log.action_type)}`}>
                        {log.action_type}
                      </span>
                      {log.action_type === 'UPDATE' && getChangedFields(log) && (
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 capitalize max-w-[150px] truncate" title={getChangedFields(log)!}>
                          {getChangedFields(log)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    {log.table_name}
                  </td>
                  <td className="p-4 truncate max-w-[150px]" title={log.record_id}>
                    <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
                      {getRecordName(log)}
                    </div>
                    {getRecordName(log) !== log.record_id && (
                      <div className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                        {log.record_id}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate max-w-[150px]" title={log.actor_id}>
                    {log.actor_name}
                  </td>
                </tr>
              ))}
              {paginatedData.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-400 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest">
                    No logs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
