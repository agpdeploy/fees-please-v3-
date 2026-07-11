"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";

interface AutomationsTabProps {
  clubId: string;
  teams: any[];
  clubUsers: any[];
  showToast: (msg: string, type?: "success" | "error") => void;
  planTier: string;
}

export default function AutomationsTab({ clubId, teams, clubUsers, showToast, planTier }: AutomationsTabProps) {
  const { profile, roles } = useProfile();
  const [reportsConfig, setReportsConfig] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingId, setIsSendingId] = useState<string | null>(null);

  const [editingReport, setEditingReport] = useState<any | null>(null);
  
  // Edit Form State
  const [frequency, setFrequency] = useState<"weekly" | "fortnightly" | "instant_event">("weekly");
  const [scheduleDay, setScheduleDay] = useState<string>("monday");
  const [scheduleTime, setScheduleTime] = useState<string>("08:00");
  const [sendToAllAdmins, setSendToAllAdmins] = useState(true);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [customEmails, setCustomEmails] = useState("");

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
      .order("created_at", { ascending: false });
    
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

    const { data, error } = await query;
    if (error) {
      showToast(error.message, "error");
    } else if (data) {
      setReportsConfig(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (clubId && clubId !== 'new' && roles !== undefined) {
      fetchReports();
    }
  }, [clubId, isClubAdmin]);

  const upsertReport = async (payload: any) => {
    const cleanPayload = { ...payload };
    delete cleanPayload.id;
    delete cleanPayload._groupTitle;

    if (payload.id && payload.id !== 'new') {
      const { data, error } = await supabase.from("email_reports").update(cleanPayload).eq("id", payload.id).select();
      if (error) throw error;
      return payload.id;
    } else {
      const { data, error } = await supabase.from("email_reports").insert([cleanPayload]).select();
      if (error) throw error;
      return data[0].id;
    }
  };

  const deleteReport = async (id: string) => {
    if (!confirm("Are you sure you want to delete this schedule?")) return;
    try {
      const { error } = await supabase.from("email_reports").delete().eq("id", id);
      if (error) throw error;
      showToast("Schedule deleted!");
      fetchReports();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const toggleReportStatus = async (report: any) => {
    try {
      const newStatus = !report.is_active;
      const updatedReport = { ...report, is_active: newStatus };
      await upsertReport(updatedReport);
      showToast(newStatus ? "Schedule activated!" : "Schedule paused.");
      fetchReports();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const [confirmSendReport, setConfirmSendReport] = useState<any | null>(null);

  const getAvailableAdmins = (reportType: string, teamId: string | null) => {
    const admins = new Map<string, any>();
    clubUsers.forEach(ur => {
      if (!ur.email) return;
      if (reportType === 'club_summary') {
        if (ur.role === 'club_admin' || ur.role === 'super_admin') admins.set(ur.email, ur);
      } else {
        if (ur.role === 'club_admin' || ur.role === 'super_admin' || (ur.role === 'team_admin' && ur.team_id === teamId)) {
          admins.set(ur.email, ur);
        }
      }
    });
    return Array.from(admins.values());
  };

  const handleConfirmSend = async () => {
    const report = confirmSendReport;
    if (!report) return;
    setConfirmSendReport(null);
    
    setIsSendingId(report.id);
    showToast("Triggering email... please wait.");
    
    try {
      const res = await fetch(`/api/cron/weekly-summary?report_id=${report.id}`, { method: 'GET' });
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
    setFrequency(report.frequency || 'weekly');
    setScheduleDay(report.schedule_day || 'monday');
    setScheduleTime(report.schedule_time || '08:00');
    
    const sendToAll = report.send_to_all_admins !== false;
    setSendToAllAdmins(sendToAll);
    
    const allEmails = report.recipient_emails ? report.recipient_emails.split(',').map((e:string) => e.trim()).filter(Boolean) : [];
    const availableAdmins = getAvailableAdmins(report.report_type, report.team_id).map(a => a.email);
    
    const selected = allEmails.filter((e:string) => availableAdmins.includes(e));
    const custom = allEmails.filter((e:string) => !availableAdmins.includes(e));
    
    setSelectedRecipients(selected);
    setCustomEmails(custom.join(', '));
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReport) return;

    try {
      let finalEmails = [];
      if (!sendToAllAdmins) {
        finalEmails.push(...selectedRecipients);
      }
      if (customEmails) {
        finalEmails.push(...customEmails.split(',').map(e => e.trim()).filter(Boolean));
      }

      const payload = {
        ...editingReport,
        frequency,
        schedule_day: scheduleDay,
        schedule_time: scheduleTime,
        send_to_all_admins: sendToAllAdmins,
        recipient_emails: finalEmails.join(','),
        is_active: true
      };
      
      await upsertReport(payload);
      showToast(editingReport.id === 'new' ? "Schedule created!" : "Schedule updated!");
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

  // --- BUILD GROUPS ---
  const reportGroups: any[] = [];

  if (isClubAdmin) {
    reportGroups.push({
      key: `club_summary_null`,
      team_id: null,
      report_type: 'club_summary',
      title: 'Account Summary Report',
      reports: reportsConfig.filter(r => r.report_type === 'club_summary')
    });
  }

  manageableTeams.forEach(team => {
    reportGroups.push({
      key: `team_summary_${team.id}`,
      team_id: team.id,
      report_type: 'team_summary',
      title: `Team Summary Report: ${team.name}`,
      reports: reportsConfig.filter(r => r.report_type === 'team_summary' && r.team_id === team.id)
    });
    reportGroups.push({
      key: `availability_report_${team.id}`,
      team_id: team.id,
      report_type: 'availability_report',
      title: `Availability Report: ${team.name}`,
      reports: reportsConfig.filter(r => r.report_type === 'availability_report' && r.team_id === team.id)
    });
  });

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
      
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
            
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              This will immediately trigger this specific report schedule.
            </p>

            <div className="flex gap-3">
              <button onClick={() => setConfirmSendReport(null)} className="flex-1 py-3 text-xs font-black uppercase text-zinc-700 dark:text-zinc-300 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl transition-colors">
                Cancel
              </button>
              <button 
                onClick={handleConfirmSend}
                className="flex-[2] py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95"
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
              <h2 className="text-[11px] font-black uppercase italic text-emerald-600 dark:text-emerald-500">
                {editingReport.id === 'new' ? 'Add Schedule' : 'Edit Schedule'}
              </h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                {editingReport._groupTitle}
              </p>
            </div>
            <button onClick={() => setEditingReport(null)} className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center transition-colors">
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>
          
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Frequency</label>
                <select value={frequency} onChange={(e) => setFrequency(e.target.value as any)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none">
                  <option value="weekly">Weekly</option>
                  <option value="fortnightly">Fortnightly</option>
                  {editingReport.report_type === 'availability_report' && (
                    <option value="instant_event">Instant (Event-Based)</option>
                  )}
                </select>
              </div>
              {frequency !== 'instant_event' && (
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
              )}
            </div>

            {frequency !== 'instant_event' && (
              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Time of Day (Local)</label>
                <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none" required />
              </div>
            )}

            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/50">
              <label className="text-[9px] text-zinc-500 uppercase font-black block mb-3">Recipients</label>
              
              <label className="flex items-center gap-3 cursor-pointer mb-4">
                <input type="checkbox" checked={sendToAllAdmins} onChange={(e) => setSendToAllAdmins(e.target.checked)} className="w-4 h-4 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500" />
                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Send to all {editingReport.report_type === 'club_summary' ? 'Account' : 'Team'} Admins</span>
              </label>

              {!sendToAllAdmins && (
                <div className="space-y-2 mb-4 pl-7">
                  {getAvailableAdmins(editingReport.report_type, editingReport.team_id).map(admin => (
                    <label key={admin.email} className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectedRecipients.includes(admin.email)} 
                        onChange={(e) => {
                          if (e.target.checked) setSelectedRecipients([...selectedRecipients, admin.email]);
                          else setSelectedRecipients(selectedRecipients.filter(em => em !== admin.email));
                        }} 
                        className="w-4 h-4 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500" 
                      />
                      <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                        {admin.profiles?.nickname || admin.profiles?.first_name || 'Admin'} <span className="opacity-50">({admin.email})</span>
                      </span>
                    </label>
                  ))}
                  {getAvailableAdmins(editingReport.report_type, editingReport.team_id).length === 0 && (
                    <p className="text-xs text-zinc-500 italic">No explicit admins found. Use custom emails below.</p>
                  )}
                </div>
              )}

              <div className="mt-4">
                <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Additional Custom Emails (Comma Separated)</label>
                <input type="text" placeholder="e.g. coach@team.com" value={customEmails} onChange={(e) => setCustomEmails(e.target.value)} className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-white outline-none" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" className="w-full py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50">
                Save Schedule
              </button>
            </div>
          </form>
        </div>
      )}

      {!editingReport && (
        <div className="space-y-6">
          {reportGroups.map((group) => {
            return (
              <div key={group.key} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                
                {/* Group Header */}
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                      <i className={`fa-solid ${group.report_type === 'availability_report' ? 'fa-calendar-check' : 'fa-chart-pie'}`}></i>
                    </div>
                    <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider">{group.title}</h3>
                  </div>
                </div>

                {/* Free Tier Gate */}
                {planTier === 'free' && (
                  <div className="p-6 text-center">
                    <button 
                      onClick={() => window.dispatchEvent(new CustomEvent('navigate-setup', { detail: 'billing' }))}
                      className="inline-flex h-9 px-4 bg-amber-400 hover:bg-amber-300 text-amber-900 rounded-lg transition-colors items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-sm shadow-amber-500/20"
                    >
                      <i className="fa-solid fa-lock"></i> 
                      <span>Upgrade to Plus to unlock</span>
                    </button>
                  </div>
                )}

                {/* Schedules List */}
                {planTier !== 'free' && group.reports.length === 0 && (
                  <div className="p-8 flex flex-col items-center justify-center gap-4">
                    <p className="text-zinc-400 dark:text-zinc-600 text-xs font-medium italic">
                      No schedules configured for this report.
                    </p>
                    <button 
                      onClick={() => startEdit({
                        id: 'new',
                        club_id: clubId,
                        team_id: group.team_id,
                        report_type: group.report_type,
                        _groupTitle: group.title
                      })}
                      className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <i className="fa-solid fa-plus"></i> Create First Schedule
                    </button>
                  </div>
                )}

                {planTier !== 'free' && group.reports.length > 0 && (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                    {group.reports.map((report: any) => (
                      <div key={report.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors">
                        
                        <div className="flex items-center gap-4">
                          {/* Toggle Switch */}
                          <button 
                            onClick={() => toggleReportStatus(report)}
                            className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none ${report.is_active ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                          >
                            <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${report.is_active ? 'transform translate-x-5' : ''}`}></div>
                          </button>
                          
                          <div>
                            <p className={`text-sm font-bold ${report.is_active ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-400 dark:text-zinc-600'}`}>
                              {report.frequency === 'instant_event' ? 'Instant (Event-Based)' : `${report.frequency.charAt(0).toUpperCase() + report.frequency.slice(1)} on ${report.schedule_day.charAt(0).toUpperCase() + report.schedule_day.slice(1)}s at ${report.schedule_time}`}
                            </p>
                            <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-0.5">
                              {report.send_to_all_admins ? 'Sending to all admins' : 'Sending to custom recipients'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => triggerManualSend(report)}
                            disabled={isSendingId === report.id}
                            title="Trigger Now"
                            className="w-8 h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 flex items-center justify-center transition-colors disabled:opacity-50"
                          >
                            <i className={`fa-solid ${isSendingId === report.id ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
                          </button>
                          <button 
                            onClick={() => startEdit({...report, _groupTitle: group.title})}
                            title="Edit Schedule"
                            className="w-8 h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 flex items-center justify-center transition-colors"
                          >
                            <i className="fa-solid fa-pen"></i>
                          </button>
                          <button 
                            onClick={() => deleteReport(report.id)}
                            title="Delete Schedule"
                            className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-colors"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>

                      </div>
                    ))}
                    
                    <div className="p-4 bg-zinc-50/30 dark:bg-zinc-800/10 flex justify-center">
                      <button 
                        onClick={() => startEdit({
                          id: 'new',
                          club_id: clubId,
                          team_id: group.team_id,
                          report_type: group.report_type,
                          _groupTitle: group.title
                        })}
                        className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <i className="fa-solid fa-plus"></i> Add Another Schedule
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

