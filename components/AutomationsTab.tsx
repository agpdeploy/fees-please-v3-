"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";

interface AutomationsTabProps {
  clubId: string;
  teams: any[];
  clubUsers: any[];
  showToast: (msg: string, type?: "success" | "error") => void;
}

export default function AutomationsTab({ clubId, teams, clubUsers, showToast }: AutomationsTabProps) {
  const { profile, roles } = useProfile();
  const [reportsConfig, setReportsConfig] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingId, setIsSendingId] = useState<string | null>(null);

  // Form State for editing
  const [editingReport, setEditingReport] = useState<any | null>(null);
  
  const [frequency, setFrequency] = useState<"weekly" | "fortnightly">("weekly");
  const [scheduleDay, setScheduleDay] = useState<string>("monday");
  const [scheduleTime, setScheduleTime] = useState<string>("08:00");

  // Role Checks
  const isSuperAdmin = profile?.role === 'super_admin';
  const isClubAdmin = roles?.some(r => r.club_id === clubId && (r.role === 'club_admin' || r.role === 'super_admin')) || isSuperAdmin;
  
  // Teams the current user can manage reports for
  const manageableTeams = isClubAdmin 
    ? teams 
    : teams.filter(t => roles?.some(r => r.team_id === t.id && r.role === 'team_admin'));

  const fetchReports = async () => {
    setIsLoading(true);
    let query = supabase
      .from("email_reports")
      .select("*")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false }); // Ensure newest reports take precedence if duplicates exist
    
    if (!isClubAdmin) {
      const teamIds = manageableTeams.map(t => t.id);
      if (teamIds.length > 0) {
        query = query.in("team_id", teamIds);
      } else {
        setReportsConfig([]);
        setIsLoading(false);
        return;
      }
    }

    // Fetch reports
    const { data, error } = await query;
    if (error) {
      showToast(error.message, "error");
    } else if (data) {
      setReportsConfig(data);
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    if (clubId && clubId !== 'new') {
      fetchReports();
    }
  }, [clubId]);

  const upsertReport = async (payload: any) => {
    const cleanPayload = { ...payload };
    delete cleanPayload.id; // remove virtual id if present
    delete cleanPayload._teamName; // remove UI helper

    if (payload.id && payload.id !== 'virtual') {
      const { data, error } = await supabase.from("email_reports").update(cleanPayload).eq("id", payload.id).select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Update blocked by Database Security (RLS) - 0 rows affected.");
      }
      return payload.id;
    } else {
      const { data, error } = await supabase.from("email_reports").insert([cleanPayload]).select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Insert blocked by Database Security (RLS) - 0 rows created.");
      }
      return data[0].id;
    }
  };

  const toggleReportStatus = async (report: any) => {
    try {
      const newStatus = !report.is_active;
      const updatedReport = { ...report, is_active: newStatus };
      await upsertReport(updatedReport);
      showToast(newStatus ? "Report activated!" : "Report paused.");
      fetchReports();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const [confirmSendReport, setConfirmSendReport] = useState<any | null>(null);

  const getPreviewRecipients = (report: any) => {
    let emails = new Set<string>();
    clubUsers.forEach(ur => {
      if (!ur.email) return;
      if (report.report_type === 'club_summary') {
        if (ur.role === 'club_admin' || ur.role === 'super_admin') emails.add(ur.email);
      } else {
        if (ur.role === 'club_admin' || ur.role === 'super_admin') emails.add(ur.email);
        else if (ur.role === 'team_admin' && ur.team_id === report.team_id) emails.add(ur.email);
      }
    });
    // Add current user if super admin and not explicitly in user_roles
    if (isSuperAdmin && profile?.email) {
      emails.add(profile.email);
    }
    return Array.from(emails);
  };

  const handleConfirmSend = async () => {
    const report = confirmSendReport;
    if (!report) return;
    setConfirmSendReport(null);
    
    setIsSendingId(report.id || 'virtual');
    showToast("Triggering email... please wait.");
    
    try {
      let targetId = report.id;
      if (targetId === 'virtual') {
         targetId = await upsertReport({ ...report, is_active: true });
      }

      const res = await fetch(`/api/cron/weekly-summary?report_id=${targetId}`, { method: 'GET' });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to trigger email');
      
      showToast(`Emails sent successfully! (${data.sentCount || 0} sent)`);
      fetchReports();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsSendingId(null);
    }
  };

  const startEdit = (report: any) => {
    setEditingReport(report);
    setFrequency(report.frequency);
    setScheduleDay(report.schedule_day);
    setScheduleTime(report.schedule_time);
  };

  const handleScheduleClick = (report: any) => {
    if (report.is_active) {
      toggleReportStatus(report);
    } else {
      startEdit(report);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReport) return;

    try {
      const payload = {
        ...editingReport,
        frequency,
        schedule_day: scheduleDay,
        schedule_time: scheduleTime,
        is_active: true // Always activate when they submit a new schedule
      };
      
      await upsertReport(payload);
      showToast("Report schedule updated!");
      setEditingReport(null);
      fetchReports();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const triggerManualSend = (report: any) => {
    setConfirmSendReport(report);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-[10px] uppercase font-black tracking-widest text-zinc-500">Loading Reports...</div>;
  }

  // --- BUILD VIRTUAL REPORTS LIST ---
  // This ensures there is always exactly one card per entity (Club + manageable teams).
  const displayReports = [];

  // Club Wide Report
  if (isClubAdmin) {
    const clubReport = reportsConfig.find(r => r.report_type === 'club_summary');
    displayReports.push(clubReport || {
      id: 'virtual',
      club_id: clubId,
      team_id: null,
      report_type: 'club_summary',
      frequency: 'weekly',
      schedule_day: 'monday',
      schedule_time: '08:00',
      is_active: false
    });
  }

  // Team Reports
  manageableTeams.forEach(team => {
    const teamReport = reportsConfig.find(r => r.report_type === 'team_summary' && r.team_id === team.id);
    displayReports.push(teamReport || {
      id: 'virtual',
      club_id: clubId,
      team_id: team.id,
      report_type: 'team_summary',
      frequency: 'weekly',
      schedule_day: 'monday',
      schedule_time: '08:00',
      is_active: false,
      _teamName: team.name // helper for UI
    });
  });

  return (
    <div className="space-y-4 animate-in slide-in-from-right-4 fade-in">
      
      {/* Confirmation Modal */}
      {confirmSendReport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-xl max-w-md w-full animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white">Confirm Manual Send</h2>
              <button onClick={() => setConfirmSendReport(null)} className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center transition-colors">
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>
            
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              This will immediately trigger the report generation. It will be sent to the following admins:
            </p>
            
            <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 max-h-48 overflow-y-auto mb-6">
              {getPreviewRecipients(confirmSendReport).length > 0 ? (
                <ul className="space-y-2">
                  {getPreviewRecipients(confirmSendReport).map(e => (
                    <li key={e} className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                      <i className="fa-solid fa-envelope text-zinc-400"></i> {e}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs font-bold text-red-500 flex items-center gap-2">
                  <i className="fa-solid fa-triangle-exclamation"></i> No admins found to receive this report!
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setConfirmSendReport(null)} className="flex-1 py-3 text-xs font-black uppercase text-zinc-700 dark:text-zinc-300 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl transition-colors">
                Cancel
              </button>
              <button 
                onClick={handleConfirmSend}
                disabled={getPreviewRecipients(confirmSendReport).length === 0}
                className="flex-[2] py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                Send Now
              </button>
            </div>
          </div>
        </div>
      )}
      
      {editingReport && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm mb-6">
          <div className="flex justify-between items-center mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div>
              <h2 className="text-[11px] font-black uppercase italic text-emerald-600 dark:text-emerald-500">Configure Schedule</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                {editingReport.report_type === 'club_summary' ? 'Club Summary Report' : `Team Summary Report: ${editingReport._teamName || teams.find(t=>t.id === editingReport.team_id)?.name}`}
              </p>
            </div>
            <button onClick={() => setEditingReport(null)} className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center transition-colors">
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>
          
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Frequency</label>
                <select value={frequency} onChange={(e) => setFrequency(e.target.value as any)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none">
                  <option value="weekly">Weekly</option>
                  <option value="fortnightly">Fortnightly</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Day of Week</label>
                <select value={scheduleDay} onChange={(e) => setScheduleDay(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none">
                  <option value="monday">Monday</option>
                  <option value="tuesday">Tuesday</option>
                  <option value="wednesday">Wednesday</option>
                  <option value="thursday">Thursday</option>
                  <option value="friday">Friday</option>
                  <option value="saturday">Saturday</option>
                  <option value="sunday">Sunday</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Time of Day (Local)</label>
              <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none" required />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" className="w-full py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50">
                Schedule Send
              </button>
            </div>
          </form>
        </div>
      )}

      {!editingReport && (
        <div className="space-y-3">
          {displayReports.map((report, idx) => {
            const isVirtual = report.id === 'virtual';
            const isActive = report.is_active;
            const title = report.report_type === 'club_summary' ? 'Club Summary Report' : `Team Summary Report: ${report._teamName || teams.find(t=>t.id === report.team_id)?.name}`;
            const isSending = isSendingId === (isVirtual ? 'virtual' : report.id);

            return (
              <div key={isVirtual ? `virtual-${idx}` : report.id} className={`bg-white dark:bg-zinc-900 border ${isActive ? 'border-emerald-500/30 shadow-md' : 'border-zinc-200 dark:border-zinc-800'} rounded-xl p-5 transition-all duration-300 relative overflow-hidden group`}>
                
                {/* Visual Indicator Line for Active */}
                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>}

                {/* Email Icon Top Right */}
                <i className={`fa-solid fa-envelope absolute top-5 right-5 text-lg transition-colors ${isActive ? 'text-emerald-500' : 'text-zinc-500 dark:text-zinc-600'}`}></i>

                {/* Title */}
                <h3 className={`text-sm font-black transition-colors w-full pr-8 ${isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'}`}>
                  {title}
                </h3>
                
                {/* Subtitle */}
                <div className={`text-[10px] font-bold uppercase tracking-widest mt-1 mb-5 ${isActive ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
                  {isActive ? `To send ${report.frequency} on ${report.schedule_day}s @ ${report.schedule_time}` : 'Not Scheduled'}
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-2">
                  
                  {/* Send Now Button */}
                  <button 
                    onClick={() => triggerManualSend(report)}
                    disabled={isSending}
                    className={`h-9 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50 ${isActive ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-500' : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500'}`}
                  >
                    <i className={`fa-solid ${isSending ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i> 
                    <span>Send Now</span>
                  </button>

                  {/* Schedule Button */}
                  <button 
                    onClick={() => handleScheduleClick(report)}
                    className={`h-9 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest ${isActive ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-500' : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500'}`}
                  >
                    <i className="fa-solid fa-clock"></i> 
                    <span>{isActive ? 'Scheduled' : 'Schedule'}</span>
                  </button>

                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
