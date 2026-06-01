import re

with open('components/Team.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# We want to replace the contents inside `{isExpanded && (...)}`
start_marker = "{/* INLINE MANAGE TEAM CONTENT (Availability Lists) */}"
# We'll find the start_marker
start_idx = content.find(start_marker)

# Then we find the closing div of the `isExpanded` block. 
# It's right before `</div>\n                        )}`
end_marker = "                           </div>\n                        )}"
end_idx = content.find(end_marker, start_idx)

new_content = """                             {canManageTeam(f.team_id) && (
                                <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/30 transition-colors mb-4 rounded-t-2xl">
                                  <div className="relative flex bg-emerald-50 dark:bg-emerald-950/40 p-1 rounded-xl">
                                    <div 
                                      className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-emerald-600 shadow-md rounded-lg transition-all duration-300 ease-out ${
                                        activeTab === 'squad' ? 'translate-x-full' : 'translate-x-0'
                                      }`}
                                    />
                                    
                                    <button 
                                      onClick={() => setActiveTab('availability')} 
                                      className={`flex-1 relative z-10 py-2.5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors duration-300 ${activeTab === 'availability' ? 'text-white' : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/50'}`}
                                    >
                                      <i className="fa-solid fa-bullhorn"></i> Availability
                                    </button>
                                    
                                    <button 
                                      onClick={() => setActiveTab('squad')} 
                                      className={`flex-1 relative z-10 py-2.5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors duration-300 ${activeTab === 'squad' ? 'text-white' : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/50'}`}
                                    >
                                      <i className="fa-solid fa-clipboard-check"></i> Match Squad
                                    </button>
                                  </div>
                                </div>
                             )}

                             {/* --- AVAILABILITY TAB --- */}
                             {activeTab === 'availability' && canManageTeam(f.team_id) && (
                               <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                                 {availabilityMode === 'menu' ? (
                                   <div className="flex flex-col gap-3">
                                     <button onClick={() => handleShareMatch(f)} className="w-full bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex items-center gap-4 hover:border-emerald-300 transition-colors text-left">
                                       <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500 shrink-0">
                                         <i className="fa-solid fa-share-nodes"></i>
                                       </div>
                                       <div>
                                         <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest">Share to Social</h4>
                                         <p className="text-[10px] font-medium text-zinc-500">Copy or share the availability link to your team group chat.</p>
                                       </div>
                                     </button>
                                     
                                     <button 
                                       onClick={() => {
                                         const respondedIds = new Set(modalAvailData.filter(a => ['yes', 'no', 'maybe'].includes(a.status)).map(a => a.player_id));
                                         const isSuperAdmin = profile?.role === 'super_admin';
                                         const pending = clubPlayers.filter(p => {
                                           const hasSent = emailLogDetails.some(log => log.email_type === 'availability_reminder' && log.players?.id === p.id);
                                           return p.default_team_id === f.team_id && 
                                                  !respondedIds.has(p.id) && 
                                                  p.email && 
                                                  p.unsubscribed !== true && 
                                                  (!hasSent || isSuperAdmin);
                                         });
                                         setEmailSelectedPlayerIds(pending.map(p => p.id));
                                         setAvailabilityMode('email_players');
                                       }}
                                       className="w-full bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex items-center gap-4 hover:border-blue-300 transition-colors text-left"
                                     >
                                       <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500 shrink-0">
                                         <i className="fa-solid fa-paper-plane"></i>
                                       </div>
                                       <div>
                                         <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest">Email Players</h4>
                                         <p className="text-[10px] font-medium text-zinc-500">Send an availability email directly to specific players.</p>
                                       </div>
                                     </button>
                                     
                                     {(f as any).reminder_sent && (
                                       <button onClick={async () => {
                                          setIsStatsLoading(true);
                                          setAvailabilityMode('email_stats');
                                          await fetchEmailLogs(f.id);
                                       }} className="w-full bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex items-center gap-4 hover:border-amber-300 transition-colors text-left">
                                         <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-500 shrink-0">
                                           <i className="fa-solid fa-chart-column"></i>
                                         </div>
                                         <div>
                                           <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest">Email Stats</h4>
                                           <p className="text-[10px] font-medium text-zinc-500">See who has received, opened or bounced the reminder email.</p>
                                         </div>
                                       </button>
                                     )}
                                   </div>
                                 ) : availabilityMode === 'email_stats' ? (
                                   <div className="space-y-4">
                                     <div className="flex items-center justify-between mb-2">
                                       <button onClick={() => setAvailabilityMode('menu')} className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-2">
                                         <i className="fa-solid fa-arrow-left"></i> Back
                                       </button>
                                     </div>
                                     
                                    {isStatsLoading ? (
                                      <div className="text-center p-4">
                                        <i className="fa-solid fa-circle-notch fa-spin text-zinc-400"></i>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-2">Loading Stats...</p>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                          <button onClick={() => setActiveStatFilter(activeStatFilter === 'sent' ? null : 'sent')} className={`p-3 rounded-xl border flex flex-col items-center transition-colors ${activeStatFilter === 'sent' ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'}`}>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Sent</span>
                                            <span className="text-xl font-black text-zinc-900 dark:text-white">{emailStats.sent}</span>
                                          </button>
                                          <button onClick={() => setActiveStatFilter(activeStatFilter === 'delivered' ? null : 'delivered')} className={`p-3 rounded-xl border flex flex-col items-center transition-colors ${activeStatFilter === 'delivered' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-100 dark:border-zinc-800 hover:border-emerald-200 dark:hover:border-emerald-800'}`}>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1">Delivered</span>
                                            <span className="text-xl font-black text-zinc-900 dark:text-white">{emailStats.delivered}</span>
                                          </button>
                                          <button onClick={() => setActiveStatFilter(activeStatFilter === 'opened' ? null : 'opened')} className={`p-3 rounded-xl border flex flex-col items-center transition-colors ${activeStatFilter === 'opened' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-100 dark:border-zinc-800 hover:border-blue-200 dark:hover:border-blue-800'}`}>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1">Opened</span>
                                            <span className="text-xl font-black text-zinc-900 dark:text-white">{emailStats.opened}</span>
                                          </button>
                                          <button onClick={() => setActiveStatFilter(activeStatFilter === 'bounced' ? null : 'bounced')} className={`p-3 rounded-xl border flex flex-col items-center transition-colors ${activeStatFilter === 'bounced' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-100 dark:border-zinc-800 hover:border-red-200 dark:hover:border-red-800'}`}>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1">Bounced</span>
                                            <span className="text-xl font-black text-zinc-900 dark:text-white">{emailStats.bounced}</span>
                                          </button>
                                        </div>
                                        
                                        {activeStatFilter && (
                                          <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 animate-in slide-in-from-top-2">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 px-1">
                                              Players ({activeStatFilter})
                                            </h4>
                                            <div className="space-y-1">
                                              {emailLogDetails.filter(log => {
                                                 if (log.email_type === 'squad_notification') return false;
                                                 if (activeStatFilter === 'sent') return true;
                                                 if (activeStatFilter === 'delivered') return ['delivered', 'opened', 'clicked', 'complained'].includes(log.status);
                                                 if (activeStatFilter === 'opened') return ['opened', 'clicked'].includes(log.status);
                                                 if (activeStatFilter === 'bounced') return log.status === 'bounced';
                                                 return false;
                                              }).map((log, index) => {
                                                 const p = log.players;
                                                 return (
                                                   <div key={log.id || index} className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
                                                     <div className="flex items-center gap-2">
                                                       <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                                         <i className={`fa-solid ${p ? 'fa-user' : 'fa-user-slash'} text-[10px] text-zinc-400`}></i>
                                                       </div>
                                                       <div className="flex flex-col overflow-hidden">
                                                         <span className={`text-xs font-bold truncate ${p ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 italic'}`}>
                                                           {p ? `${p.first_name} ${p.last_name || ''} ${p.nickname ? `"${p.nickname}"` : ''}` : 'Deleted Player'}
                                                         </span>
                                                         <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate max-w-[150px]">
                                                           {p ? (p.email || 'No email') : 'Record removed'}
                                                         </span>
                                                       </div>
                                                     </div>
                                                     <span className={`shrink-0 ml-2 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 ${
                                                       log.status === 'opened' || log.status === 'clicked' ? 'text-blue-500' :
                                                       log.status === 'bounced' ? 'text-red-500' :
                                                       ['delivered', 'complained'].includes(log.status) ? 'text-emerald-500' :
                                                       'text-zinc-500'
                                                     }`}>
                                                       {log.status}
                                                     </span>
                                                   </div>
                                                 );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                      </>
                                    )}
                                   </div>
                                 ) : (
                                   <div className="space-y-4">
                                     <div className="flex items-center justify-between mb-4">
                                       <button onClick={() => setAvailabilityMode('menu')} className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-2">
                                         <i className="fa-solid fa-arrow-left"></i> Back
                                       </button>
                                       <button 
                                         onClick={() => {
                                           const isSuperAdmin = profile?.role === 'super_admin';
                                           const eligible = clubPlayers.filter(p => {
                                             const hasSent = emailLogDetails.some(log => log.email_type === 'availability_reminder' && log.players?.id === p.id);
                                             const avail = modalAvailData.find(a => a.player_id === p.id);
                                             const hasResponded = avail && ['yes', 'no', 'maybe'].includes(avail.status);
                                             return p.default_team_id === f.team_id && p.email && p.email.trim() !== '' && p.unsubscribed !== true && (!hasSent || isSuperAdmin) && !hasResponded;
                                           });
                                           if (emailSelectedPlayerIds.length === eligible.length && eligible.length > 0) {
                                              setEmailSelectedPlayerIds([]);
                                           } else {
                                              setEmailSelectedPlayerIds(eligible.map(s => s.id));
                                           }
                                         }}
                                         className="text-[9px] font-black uppercase text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-md"
                                       >
                                          Select All
                                       </button>
                                     </div>
                                     
                                     <textarea 
                                       placeholder="Add a custom note (e.g. We need to know by Thursday)..."
                                       className="w-full text-xs p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1A1A1A] text-zinc-900 dark:text-white mb-3 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 shadow-sm focus:border-blue-500 transition-colors"
                                       rows={2}
                                       value={availabilityEmailNote}
                                       onChange={(e) => setAvailabilityEmailNote(e.target.value)}
                                     />

                                     <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
                                       {['yes', 'maybe', 'no_reply', 'no'].map((section) => {
                                         const sectionPlayers = clubPlayers.filter(p => {
                                           const avail = modalAvailData.find(a => a.player_id === p.id);
                                           const status = avail ? avail.status : 'no_reply';
                                           return p.default_team_id === f.team_id && status === section;
                                         });

                                         if (sectionPlayers.length === 0) return null;

                                         const config = {
                                           yes: { label: "Available", color: "text-emerald-500", icon: "fa-circle-check" },
                                           maybe: { label: "Maybe", color: "text-amber-500", icon: "fa-circle-question" },
                                           no_reply: { label: "No Reply", color: "text-zinc-400 dark:text-zinc-500", icon: "fa-circle" },
                                           no: { label: "Unavailable", color: "text-red-500", icon: "fa-circle-xmark" }
                                         }[section as 'yes' | 'maybe' | 'no_reply' | 'no'];

                                         const isSecExpanded = expandedEmailSections[section];
                                         const toggleSec = () => setExpandedEmailSections(prev => ({...prev, [section]: !prev[section]}));

                                         return (
                                           <div key={section} className="mb-2">
                                             <button onClick={toggleSec} className="w-full flex items-center justify-between py-2 text-left group">
                                               <h3 className={`text-[10px] font-black uppercase tracking-widest ${config.color} flex items-center gap-2`}>
                                                 <i className={`fa-solid ${config.icon}`}></i> {config.label} ({sectionPlayers.length})
                                               </h3>
                                               <i className={`fa-solid fa-chevron-${isSecExpanded ? 'up' : 'down'} text-[10px] text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors`}></i>
                                             </button>
                                             
                                             {isSecExpanded && (
                                               <div className="flex flex-wrap gap-2.5 pt-2 pb-1 animate-in fade-in">
                                                 {sectionPlayers.map(p => {
                                                   const avail = modalAvailData.find(a => a.player_id === p.id);
                                                   const isSelected = emailSelectedPlayerIds.includes(p.id);
                                                   const hasEmail = !!p.email;
                                                   const hasResponded = avail && ['yes', 'no', 'maybe'].includes(avail.status);
                                                   const hasSent = emailLogDetails.some(log => log.email_type === 'availability_reminder' && log.players?.id === p.id);
                                                   const isSuperAdmin = profile?.role === 'super_admin';
                                                   const isLocked = hasSent && !isSuperAdmin;
                                                   const isDisabled = !hasEmail || p.unsubscribed === true || isLocked;
                                                   
                                                   return (
                                                     <button 
                                                       key={p.id} 
                                                       onClick={() => {
                                                         if (isDisabled) return;
                                                         if (isSelected) {
                                                           setEmailSelectedPlayerIds(prev => prev.filter(id => id !== p.id));
                                                         } else {
                                                           setEmailSelectedPlayerIds(prev => [...prev, p.id]);
                                                         }
                                                       }}
                                                       disabled={isDisabled}
                                                       className={`px-4 py-3 rounded-xl font-black text-[11px] uppercase transition-all flex flex-col items-center gap-1.5 ${
                                                         isSelected 
                                                           ? 'text-white bg-emerald-600 dark:bg-emerald-500 scale-[1.02] shadow-[0_0_15px_rgba(16,185,129,0.3)] border-transparent' 
                                                           : 'bg-white dark:bg-[#1A1A1A] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-400 dark:hover:border-zinc-600'
                                                       } ${isDisabled ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                                                     >
                                                       <div className="flex items-center gap-2">
                                                         {p.nickname || `${p.first_name} ${p.last_name?.charAt(0) || ''}.`}
                                                         {isSelected ? (
                                                           <i className="fa-solid fa-check text-[10px]"></i>
                                                         ) : (
                                                           <i className="fa-solid fa-plus text-[10px] opacity-50"></i>
                                                         )}
                                                       </div>
                                                       
                                                       <div className={`text-[8px] font-black tracking-widest mt-0.5 flex items-center gap-1 ${isSelected ? 'text-emerald-100' : 'text-zinc-500'}`}>
                                                         {!hasEmail ? (
                                                           <><i className="fa-solid fa-envelope-circle-xmark text-red-500"></i> No Email</>
                                                         ) : p.unsubscribed ? (
                                                           <><i className="fa-solid fa-ban text-amber-500"></i> Unsub</>
                                                         ) : isLocked ? (
                                                           <><i className="fa-solid fa-paper-plane text-blue-500"></i> Sent</>
                                                         ) : hasResponded ? (
                                                           <><i className="fa-solid fa-reply text-emerald-500"></i> Responded</>
                                                         ) : hasSent ? (
                                                           <><i className="fa-solid fa-paper-plane text-blue-500"></i> Sent (Resend)</>
                                                         ) : (
                                                           <><i className="fa-regular fa-envelope"></i> Sendable</>
                                                         )}
                                                       </div>
                                                     </button>
                                                   );
                                                 })}
                                               </div>
                                             )}
                                           </div>
                                         );
                                       })}
                                     </div>
                                     
                                     <button 
                                       onClick={() => handleConfirmSendReminders(f)}
                                       disabled={emailSelectedPlayerIds.length === 0 || isSendingReminders}
                                       className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md flex justify-center items-center gap-2 disabled:opacity-50"
                                     >
                                       {isSendingReminders ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
                                       Send {emailSelectedPlayerIds.length > 0 ? `to ${emailSelectedPlayerIds.length} Player${emailSelectedPlayerIds.length !== 1 ? 's' : ''}` : 'Emails'}
                                     </button>
                                   </div>
                                 )}
                               </div>
                             )}

                             {/* --- SQUAD TAB --- */}
                             {activeTab === 'squad' && (
                               <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                  {squadMode === 'squad' ? (
                                    <>
                                     {canManageTeam(f.team_id) && (
                                        <div className="mb-6">
                                          <input 
                                            type="text" 
                                            placeholder="Search or add a player..." 
                                            value={playerSearch || ""} 
                                            onChange={(e) => setPlayerSearch(e.target.value)} 
                                            className="w-full bg-zinc-50 dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors mb-4 shadow-sm" 
                                          />

                                          <div className="space-y-3">
                                            {playerSearch.trim().length > 0 && !clubPlayers.some(p => `${p.first_name} ${p.last_name}`.toLowerCase() === playerSearch.trim().toLowerCase()) && (
                                              <button 
                                                onClick={() => createAndAddPlayer(playerSearch, f.id)}
                                                disabled={isSaving}
                                                className="w-full flex justify-between items-center bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors text-left group disabled:opacity-50"
                                              >
                                                <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                                                  + Add "{playerSearch}"
                                                </span>
                                                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/70 bg-emerald-200 dark:bg-emerald-900 px-2 py-1 rounded-md">New Casual</span>
                                              </button>
                                            )}

                                            {['yes', 'maybe', 'no_reply', 'no'].map((section) => {
                                              const sectionPlayers = clubPlayers.filter(p => {
                                                const avail = modalAvailData.find(a => a.player_id === p.id);
                                                const status = avail ? avail.status : 'no_reply';
                                                const isRelevant = p.default_team_id === f.team_id || squadPlayerIds.includes(p.id) || avail !== undefined;
                                                const matchesSearch = playerSearch ? `${p.first_name} ${p.last_name} ${p.nickname || ''}`.toLowerCase().includes(playerSearch.toLowerCase()) : true;

                                                return playerSearch ? (status === section && matchesSearch) : (status === section && isRelevant);
                                              });

                                              if (sectionPlayers.length === 0) return null;

                                              const config = {
                                                yes: { label: "Available", color: "text-emerald-500", icon: "fa-circle-check" },
                                                maybe: { label: "Maybe", color: "text-amber-500", icon: "fa-circle-question" },
                                                no_reply: { label: "No Reply", color: "text-zinc-400 dark:text-zinc-500", icon: "fa-circle" },
                                                no: { label: "Unavailable", color: "text-red-500", icon: "fa-circle-xmark" }
                                              }[section as 'yes' | 'maybe' | 'no_reply' | 'no'];

                                              const isSecExpanded = expandedPoolSections[section] || playerSearch.trim().length > 0;
                                              const toggleSec = () => setExpandedPoolSections(prev => ({...prev, [section]: !prev[section]}));

                                              return (
                                                <div key={section} className="mb-2">
                                                  <button onClick={toggleSec} className="w-full flex items-center justify-between py-2 text-left group">
                                                    <h3 className={`text-[10px] font-black uppercase tracking-widest ${config.color} flex items-center gap-2`}>
                                                      <i className={`fa-solid ${config.icon}`}></i> {config.label} ({sectionPlayers.length})
                                                    </h3>
                                                    <i className={`fa-solid fa-chevron-${isSecExpanded ? 'up' : 'down'} text-[10px] text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors`}></i>
                                                  </button>
                                                  
                                                  {isSecExpanded && (
                                                    <div className="flex flex-wrap gap-2.5 pt-2 pb-1 animate-in fade-in">
                                                      {sectionPlayers.map(p => {
                                                        const isSelected = squadPlayerIds.includes(p.id);
                                                        return (
                                                          <button 
                                                            key={p.id} 
                                                            onClick={() => toggleSquadPlayer(p.id)} 
                                                            disabled={isSaving} 
                                                            className={`px-4 py-3 rounded-xl font-black text-[11px] uppercase transition-all flex items-center gap-2 ${isSelected ? 'text-white bg-emerald-600 dark:bg-emerald-500 scale-[1.02] shadow-[0_0_15px_rgba(16,185,129,0.3)] border-transparent' : 'bg-zinc-50 dark:bg-[#1A1A1A] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-400 dark:hover:border-zinc-600'} disabled:opacity-50`}
                                                          >
                                                            {formatName(p)}
                                                            {isSelected ? <i className="fa-solid fa-check text-[10px]"></i> : <i className="fa-solid fa-plus text-[10px] opacity-50"></i>}
                                                          </button>
                                                        );
                                                      })}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                          
                                          <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                            <button onClick={() => saveSquad(f.id)} disabled={isSaving} className="w-full py-3 rounded-xl text-xs font-black uppercase text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-md">
                                              {isSaving ? 'Saving...' : 'Lock In Match Squad'}
                                            </button>
                                          </div>
                                        </div>
                                     )}

                                     {/* DETAILED SQUAD LIST WITH FINANCIALS */}
                                     {f.lists.squadIds.length > 0 ? (
                                       <div className="space-y-3 mt-6 pt-6 border-t-2 border-dashed border-zinc-200 dark:border-zinc-800">
                                         <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3 border-b border-zinc-100 dark:border-zinc-800 pb-1 flex justify-between">
                                           <span>Confirmed Squad</span>
                                           <span>{f.lists.squadIds.length} Players</span>
                                         </h4>
                                         {f.lists.squadIds.map((pid: string) => {
                                           const pStats = playerStats[pid];
                                           if (!pStats) return null;
                                           
                                           const isFinanceOpen = activeFinancePlayerId === `${f.id}-${pid}`;
                                           
                                           return (
                                             <div key={pid} className="bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 flex flex-col transition-all">
                                                <div className="flex justify-between items-center">
                                                  <div>
                                                    <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                                      {pStats.name}
                                                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${pStats.is_member ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                                        {pStats.is_member ? 'Member' : 'Casual'}
                                                      </span>
                                                    </div>
                                                    <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mt-1">
                                                      {pStats.gamesPlayed} Matches
                                                    </div>
                                                  </div>
                                                  
                                                  <div className="flex items-center gap-3">
                                                    {pStats.balance > 0 ? (
                                                      <span className="text-[11px] font-black text-red-500">-${pStats.balance.toFixed(0)}</span>
                                                    ) : pStats.balance < 0 ? (
                                                      <span className="text-[10px] font-black text-emerald-500">+${Math.abs(pStats.balance).toFixed(0)}</span>
                                                    ) : (
                                                      <span className="text-[9px] font-black text-zinc-400">Settled</span>
                                                    )}
                                                    
                                                    {canManageTeam(f.team_id) && (
                                                      <button 
                                                        onClick={() => {
                                                          if (isFinanceOpen) setActiveFinancePlayerId(null);
                                                          else { setActiveFinancePlayerId(`${f.id}-${pid}`); setManualType('payment'); setManualAmount(""); setManualNote(""); }
                                                        }}
                                                        className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 flex items-center justify-center transition-colors"
                                                      >
                                                        <i className={`fa-solid ${isFinanceOpen ? 'fa-times' : 'fa-dollar-sign'} text-[10px]`}></i>
                                                      </button>
                                                    )}
                                                    
                                                    {isClubAdmin && (
                                                      <button 
                                                        onClick={() => navigateToPlayer(pid)}
                                                        className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-blue-600 flex items-center justify-center transition-colors"
                                                      >
                                                        <i className="fa-solid fa-pen text-[10px]"></i>
                                                      </button>
                                                    )}
                                                  </div>
                                                </div>
                                                
                                                {/* Quick Finance Adjust Panel */}
                                                {isFinanceOpen && (
                                                  <form onSubmit={(e) => handleManualSave(e, pid, f.id)} className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 animate-in fade-in slide-in-from-top-2">
                                                    <div className="flex gap-2 mb-2">
                                                      <button type="button" onClick={() => setManualType('payment')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg ${manualType === 'payment' ? 'bg-emerald-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>Pay (+)</button>
                                                      <button type="button" onClick={() => setManualType('fee')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg ${manualType === 'fee' ? 'bg-red-500 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>Charge (-)</button>
                                                    </div>
                                                    <div className="flex gap-2">
                                                      <input type="number" placeholder="$" value={manualAmount} onChange={e => setManualAmount(Number(e.target.value))} required className="w-20 bg-white dark:bg-[#111] border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-2 text-xs font-bold text-center outline-none focus:border-emerald-500" />
                                                      <input type="text" placeholder="Note (Cash, Card, Match Fee)" value={manualNote} onChange={e => setManualNote(e.target.value)} className="flex-1 bg-white dark:bg-[#111] border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500" />
                                                    </div>
                                                    <button type="submit" disabled={isSaving} className="w-full mt-2 py-2 bg-zinc-800 text-white dark:bg-zinc-200 dark:text-black rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm hover:scale-[1.01] transition-transform">
                                                      {isSaving ? 'Saving...' : 'Confirm'}
                                                    </button>
                                                  </form>
                                                )}
                                             </div>
                                           );
                                         })}

                                         {canManageTeam(f.team_id) && (
                                           <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-3">
                                             <button 
                                               onClick={() => {
                                                 const isSuperAdmin = profile?.role === 'super_admin';
                                                 const eligible = f.lists.squadIds.filter((pid: string) => {
                                                   const p = clubPlayers.find(cp => cp.id === pid);
                                                   if (!p) return false;
                                                   const hasSent = emailLogDetails.some(log => log.email_type === 'squad_notification' && log.players?.id === p.id);
                                                   return p.email && p.email.trim() !== '' && p.unsubscribed !== true && (!hasSent || isSuperAdmin);
                                                 });
                                                 
                                                 setSquadEmailSelectedPlayerIds(eligible);
                                                 setSquadMode('email_players');
                                               }}
                                               className="w-full bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex items-center gap-4 hover:border-blue-300 transition-colors text-left shadow-sm"
                                             >
                                               <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500 shrink-0">
                                                 <i className="fa-solid fa-paper-plane"></i>
                                               </div>
                                               <div>
                                                 <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest">Email Team Members</h4>
                                                 <p className="text-[10px] font-medium text-zinc-500">Send selection & pre-pay links.</p>
                                               </div>
                                             </button>
                                             
                                             <button onClick={async () => {
                                                setIsStatsLoading(true);
                                                setSquadMode('email_stats');
                                                await fetchEmailLogs(f.id);
                                                setIsStatsLoading(false);
                                             }} className="w-full bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex items-center gap-4 hover:border-amber-300 transition-colors text-left shadow-sm">
                                               <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-500 shrink-0">
                                                 <i className="fa-solid fa-chart-column"></i>
                                               </div>
                                               <div>
                                                 <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest">Email Stats</h4>
                                                 <p className="text-[10px] font-medium text-zinc-500">See who has received, opened or bounced the selection email.</p>
                                               </div>
                                             </button>
                                           </div>
                                         )}
                                       </div>
                                     ) : (
                                       <div className="text-center text-zinc-500 text-[10px] font-black uppercase tracking-widest py-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl mt-6">No Squad Selected Yet</div>
                                     )}
                                    </>
                                  ) : squadMode === 'email_stats' ? (
                                    <div className="space-y-4">
                                      <div className="flex items-center justify-between mb-2">
                                        <button onClick={() => setSquadMode('squad')} className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-2">
                                          <i className="fa-solid fa-arrow-left"></i> Back
                                        </button>
                                      </div>
                                      
                                     {isStatsLoading ? (
                                       <div className="text-center p-4">
                                         <i className="fa-solid fa-circle-notch fa-spin text-zinc-400"></i>
                                         <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-2">Loading Stats...</p>
                                       </div>
                                     ) : (
                                       (() => {
                                         const squadLogs = emailLogDetails.filter(log => log.email_type === 'squad_notification');
                                         const sStats = { sent: squadLogs.length, delivered: 0, opened: 0, bounced: 0 };
                                         squadLogs.forEach(log => {
                                           if (['delivered', 'opened', 'clicked', 'complained'].includes(log.status)) sStats.delivered++;
                                           if (['opened', 'clicked'].includes(log.status)) sStats.opened++;
                                           if (log.status === 'bounced') sStats.bounced++;
                                         });

                                         return (
                                           <>
                                             <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                               <button onClick={() => setActiveStatFilter(activeStatFilter === 'sent' ? null : 'sent')} className={`p-3 rounded-xl border flex flex-col items-center transition-colors ${activeStatFilter === 'sent' ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'}`}>
                                                 <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Sent</span>
                                                 <span className="text-xl font-black text-zinc-900 dark:text-white">{sStats.sent}</span>
                                               </button>
                                               <button onClick={() => setActiveStatFilter(activeStatFilter === 'delivered' ? null : 'delivered')} className={`p-3 rounded-xl border flex flex-col items-center transition-colors ${activeStatFilter === 'delivered' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-100 dark:border-zinc-800 hover:border-emerald-200 dark:hover:border-emerald-800'}`}>
                                                 <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1">Delivered</span>
                                                 <span className="text-xl font-black text-zinc-900 dark:text-white">{sStats.delivered}</span>
                                                </button>
                                               <button onClick={() => setActiveStatFilter(activeStatFilter === 'opened' ? null : 'opened')} className={`p-3 rounded-xl border flex flex-col items-center transition-colors ${activeStatFilter === 'opened' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-100 dark:border-zinc-800 hover:border-blue-200 dark:hover:border-blue-800'}`}>
                                                 <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1">Opened</span>
                                                 <span className="text-xl font-black text-zinc-900 dark:text-white">{sStats.opened}</span>
                                               </button>
                                               <button onClick={() => setActiveStatFilter(activeStatFilter === 'bounced' ? null : 'bounced')} className={`p-3 rounded-xl border flex flex-col items-center transition-colors ${activeStatFilter === 'bounced' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-100 dark:border-zinc-800 hover:border-red-200 dark:hover:border-red-800'}`}>
                                                 <span className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1">Bounced</span>
                                                 <span className="text-xl font-black text-zinc-900 dark:text-white">{sStats.bounced}</span>
                                               </button>
                                             </div>
                                             
                                             {activeStatFilter && (
                                               <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 animate-in slide-in-from-top-2">
                                                 <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 px-1">
                                                   Players ({activeStatFilter})
                                                 </h4>
                                                 <div className="space-y-1">
                                                   {squadLogs.filter(log => {
                                                      if (activeStatFilter === 'sent') return true;
                                                      if (activeStatFilter === 'delivered') return ['delivered', 'opened', 'clicked', 'complained'].includes(log.status);
                                                      if (activeStatFilter === 'opened') return ['opened', 'clicked'].includes(log.status);
                                                      if (activeStatFilter === 'bounced') return log.status === 'bounced';
                                                      return false;
                                                   }).map((log, index) => {
                                                      const p = log.players;
                                                      return (
                                                        <div key={log.id || index} className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
                                                          <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                                              <i className={`fa-solid ${p ? 'fa-user' : 'fa-user-slash'} text-[10px] text-zinc-400`}></i>
                                                            </div>
                                                            <div className="flex flex-col overflow-hidden">
                                                              <span className={`text-xs font-bold truncate ${p ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 italic'}`}>
                                                                {p ? `${p.first_name} ${p.last_name || ''} ${p.nickname ? `"${p.nickname}"` : ''}` : 'Deleted Player'}
                                                              </span>
                                                              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate max-w-[150px]">
                                                                {p ? (p.email || 'No email') : 'Record removed'}
                                                              </span>
                                                            </div>
                                                          </div>
                                                          <span className={`shrink-0 ml-2 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 ${
                                                            log.status === 'opened' || log.status === 'clicked' ? 'text-blue-500' :
                                                            log.status === 'bounced' ? 'text-red-500' :
                                                            ['delivered', 'complained'].includes(log.status) ? 'text-emerald-500' :
                                                            'text-zinc-500'
                                                          }`}>
                                                            {log.status}
                                                          </span>
                                                        </div>
                                                      );
                                                   })}
                                                 </div>
                                               </div>
                                             )}
                                           </>
                                         );
                                       })()
                                     )}
                                    </div>
                                  ) : (
                                    <div className="space-y-4">
                                      <div className="flex items-center justify-between mb-4">
                                        <button onClick={() => setSquadMode('squad')} className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-2">
                                          <i className="fa-solid fa-arrow-left"></i> Back
                                        </button>
                                        <button 
                                          onClick={() => {
                                            const isSuperAdmin = profile?.role === 'super_admin';
                                            const eligible = f.lists.squadIds.filter((pid: string) => {
                                              const p = clubPlayers.find(cp => cp.id === pid);
                                              if (!p) return false;
                                              const hasSent = emailLogDetails.some(log => log.email_type === 'squad_notification' && log.players?.id === p.id);
                                              return p.email && p.email.trim() !== '' && p.unsubscribed !== true && (!hasSent || isSuperAdmin);
                                            });
                                            if (squadEmailSelectedPlayerIds.length === eligible.length && eligible.length > 0) {
                                               setSquadEmailSelectedPlayerIds([]);
                                            } else {
                                               setSquadEmailSelectedPlayerIds(eligible);
                                            }
                                          }}
                                          className="text-[9px] font-black uppercase text-emerald-600 hover:text-emerald-700 dark:text-emerald-500 dark:hover:text-emerald-400 px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-md"
                                        >
                                           Select All
                                        </button>
                                      </div>
                                      <textarea 
                                        placeholder="Add a custom note (e.g. We prefer cash but you can pay via card)..."
                                        className="w-full text-xs p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1A1A1A] text-zinc-900 dark:text-white mb-3 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 shadow-sm focus:border-blue-500 transition-colors"
                                        rows={2}
                                        value={squadEmailNote}
                                        onChange={(e) => setSquadEmailNote(e.target.value)}
                                      />
                                      <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar space-y-3 mb-4">
                                        {['yes', 'maybe', 'no_reply', 'no'].map((section) => {
                                          const sectionPlayers = f.lists.squadIds.filter((pid: string) => {
                                            const avail = modalAvailData.find(a => a.player_id === pid);
                                            const status = avail ? avail.status : 'no_reply';
                                            return status === section;
                                          }).map((pid: string) => clubPlayers.find(cp => cp.id === pid)).filter(Boolean);

                                          if (sectionPlayers.length === 0) return null;

                                          const config = {
                                            yes: { label: "Available", color: "text-emerald-500", icon: "fa-circle-check" },
                                            maybe: { label: "Maybe", color: "text-amber-500", icon: "fa-circle-question" },
                                            no_reply: { label: "No Reply", color: "text-zinc-400 dark:text-zinc-500", icon: "fa-circle" },
                                            no: { label: "Unavailable", color: "text-red-500", icon: "fa-circle-xmark" }
                                          }[section as 'yes' | 'maybe' | 'no_reply' | 'no'];

                                          const isSecExpanded = expandedEmailSections[section];
                                          const toggleSec = () => setExpandedEmailSections(prev => ({...prev, [section]: !prev[section]}));

                                          return (
                                            <div key={section} className="mb-2">
                                              <button onClick={toggleSec} className="w-full flex items-center justify-between py-2 text-left group">
                                                <h3 className={`text-[10px] font-black uppercase tracking-widest ${config.color} flex items-center gap-2`}>
                                                  <i className={`fa-solid ${config.icon}`}></i> {config.label} ({sectionPlayers.length})
                                                </h3>
                                                <i className={`fa-solid fa-chevron-${isSecExpanded ? 'up' : 'down'} text-[10px] text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors`}></i>
                                              </button>
                                              
                                              {isSecExpanded && (
                                                <div className="flex flex-wrap gap-2.5 pt-2 pb-1 animate-in fade-in">
                                                  {sectionPlayers.map((p: any) => {
                                                      const hasEmail = !!p.email;
                                                      const isSelected = squadEmailSelectedPlayerIds.includes(p.id);
                                                      const hasSent = emailLogDetails.some(log => log.email_type === 'squad_notification' && log.players?.id === p.id);
                                                      const isSuperAdmin = profile?.role === 'super_admin';
                                                      const isLocked = hasSent && !isSuperAdmin;
                                                      const isDisabled = !hasEmail || p.unsubscribed === true || isLocked;
                                                      
                                                      return (
                                                        <button 
                                                          key={p.id} 
                                                          onClick={() => {
                                                            if (isDisabled) return;
                                                            if (isSelected) {
                                                              setSquadEmailSelectedPlayerIds(prev => prev.filter(id => id !== p.id));
                                                            } else {
                                                              setSquadEmailSelectedPlayerIds(prev => [...prev, p.id]);
                                                            }
                                                          }}
                                                          disabled={isDisabled}
                                                          className={`px-4 py-3 rounded-xl font-black text-[11px] uppercase transition-all flex flex-col items-center gap-1.5 ${
                                                            isSelected 
                                                              ? 'text-white bg-emerald-600 dark:bg-emerald-500 scale-[1.02] shadow-[0_0_15px_rgba(16,185,129,0.3)] border-transparent' 
                                                              : 'bg-white dark:bg-[#1A1A1A] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-400 dark:hover:border-zinc-600'
                                                          } ${isDisabled ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                                                        >
                                                          <div className="flex items-center gap-2">
                                                            {p.nickname || `${p.first_name} ${p.last_name?.charAt(0) || ''}.`}
                                                            {isSelected ? (
                                                              <i className="fa-solid fa-check text-[10px]"></i>
                                                            ) : (
                                                              <i className="fa-solid fa-plus text-[10px] opacity-50"></i>
                                                            )}
                                                          </div>
                                                          
                                                          <div className={`text-[8px] font-black tracking-widest mt-0.5 flex items-center gap-1 ${isSelected ? 'text-emerald-100' : 'text-zinc-500'}`}>
                                                            {!hasEmail ? (
                                                              <><i className="fa-solid fa-envelope-circle-xmark text-red-500"></i> No Email</>
                                                            ) : p.unsubscribed ? (
                                                              <><i className="fa-solid fa-ban text-amber-500"></i> Unsub</>
                                                            ) : isLocked ? (
                                                              <><i className="fa-solid fa-paper-plane text-blue-500"></i> Sent</>
                                                            ) : hasSent ? (
                                                              <><i className="fa-solid fa-paper-plane text-blue-500"></i> Sent (Resend)</>
                                                            ) : (
                                                              <><i className="fa-regular fa-envelope"></i> Sendable</>
                                                            )}
                                                          </div>
                                                        </button>
                                                      )
                                                  })}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <button 
                                        onClick={() => handleSendSquadEmail(f.id)}
                                        disabled={squadEmailSelectedPlayerIds.length === 0 || isSendingSquadEmail}
                                        className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 disabled:opacity-50"
                                      >
                                        {isSendingSquadEmail ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
                                        Send to {squadEmailSelectedPlayerIds.length} Player{squadEmailSelectedPlayerIds.length !== 1 ? 's' : ''}
                                      </button>
                                    </div>
                                  )}
                               </div>
                             )}
