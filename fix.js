const fs = require('fs');
const path = 'components/Team.tsx';
let content = fs.readFileSync(path, 'utf8');

const replacementAvail = `<div className="mt-2 animate-in slide-in-from-top-2">
                                        {(() => {
                                           const sentLogs = emailLogDetails.filter(log => log.email_type !== 'squad_notification');
                                           const uniquePlayersMap = new Map();
                                           sentLogs.forEach(log => {
                                             if (log.players && !uniquePlayersMap.has(log.players.id)) {
                                               uniquePlayersMap.set(log.players.id, { player: log.players, status: log.status, id: log.id });
                                             } else if (!log.players) {
                                               uniquePlayersMap.set(log.id, { player: null, status: log.status, id: log.id });
                                             }
                                           });
                                           const uniqueSentList = Array.from(uniquePlayersMap.values());

                                           return (
                                             <>
                                               <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 px-1">
                                                 Players Sent ({uniqueSentList.length})
                                               </h4>
                                               <div className="space-y-1">
                                                 {uniqueSentList.length === 0 ? (
                                                   <p className="text-xs text-zinc-500 italic p-2">No emails sent yet.</p>
                                                 ) : (
                                                   uniqueSentList.map((item, index) => {
                                                     const p = item.player;
                                                     return (
                                                       <div key={item.id || index} className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
                                                         <div className="flex items-center gap-2">
                                                           <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                                             <i className={\`fa-solid \${p ? 'fa-user' : 'fa-user-slash'} text-[10px] text-zinc-400\`}></i>
                                                           </div>
                                                           <div className="flex flex-col overflow-hidden">
                                                             <span className={\`text-xs font-bold truncate \${p ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 italic'}\`}>
                                                               {p ? \`\${p.first_name} \${p.last_name || ''} \${p.nickname ? \`"\${p.nickname}"\` : ''}\` : 'Deleted Player'}
                                                             </span>
                                                             <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate max-w-[150px]">
                                                               {p ? (p.email || 'No email') : 'Record removed'}
                                                             </span>
                                                           </div>
                                                         </div>
                                                         <span className="shrink-0 ml-2 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                                                           SENT
                                                         </span>
                                                       </div>
                                                     );
                                                   })
                                                 )}
                                               </div>
                                             </>
                                           );
                                        })()}
                                      </div>`;

const replacementSquad = `<div className="mt-2 animate-in slide-in-from-top-2">
                                              {(() => {
                                                 const squadLogs = emailLogDetails.filter(log => log.email_type === 'squad_notification');
                                                 const uniquePlayersMap = new Map();
                                                 squadLogs.forEach(log => {
                                                   if (log.players && !uniquePlayersMap.has(log.players.id)) {
                                                     uniquePlayersMap.set(log.players.id, { player: log.players, status: log.status, id: log.id });
                                                   } else if (!log.players) {
                                                     uniquePlayersMap.set(log.id, { player: null, status: log.status, id: log.id });
                                                   }
                                                 });
                                                 const uniqueSentList = Array.from(uniquePlayersMap.values());
      
                                                 return (
                                                   <>
                                                     <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 px-1">
                                                       Players Sent ({uniqueSentList.length})
                                                     </h4>
                                                     <div className="space-y-1">
                                                       {uniqueSentList.length === 0 ? (
                                                         <p className="text-xs text-zinc-500 italic p-2">No emails sent yet.</p>
                                                       ) : (
                                                         uniqueSentList.map((item, index) => {
                                                           const p = item.player;
                                                           return (
                                                             <div key={item.id || index} className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
                                                               <div className="flex items-center gap-2">
                                                                 <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                                                   <i className={\`fa-solid \${p ? 'fa-user' : 'fa-user-slash'} text-[10px] text-zinc-400\`}></i>
                                                                 </div>
                                                                 <div className="flex flex-col overflow-hidden">
                                                                   <span className={\`text-xs font-bold truncate \${p ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 italic'}\`}>
                                                                     {p ? \`\${p.first_name} \${p.last_name || ''} \${p.nickname ? \`"\${p.nickname}"\` : ''}\` : 'Deleted Player'}
                                                                   </span>
                                                                   <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate max-w-[150px]">
                                                                     {p ? (p.email || 'No email') : 'Record removed'}
                                                                   </span>
                                                                 </div>
                                                               </div>
                                                               <span className="shrink-0 ml-2 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                                                                 SENT
                                                               </span>
                                                             </div>
                                                           );
                                                         })
                                                       )}
                                                     </div>
                                                   </>
                                                 );
                                              })()}
                                            </div>`;

// First replace the availability mode block
const availStart = content.indexOf('<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">');
let availEnd = -1;
if (availStart !== -1) {
    let activeStatFilterStr = '{activeStatFilter && (';
    let afterActiveStatFilter = content.indexOf(activeStatFilterStr, availStart);
    if (afterActiveStatFilter !== -1) {
        // Need to find the end of activeStatFilter
        // Just find the </button> for bounced
        availEnd = content.indexOf('</>', afterActiveStatFilter);
    }
}

if (availStart !== -1 && availEnd !== -1) {
  content = content.substring(0, availStart - 40) + replacementAvail + content.substring(availEnd + 3);
  console.log('Replaced availability block');
}

// Then replace the squad mode block
const squadStart = content.indexOf('<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">', availStart + 10);
let squadEnd = -1;
if (squadStart !== -1) {
    let afterActiveStatFilter = content.indexOf('{activeStatFilter && (', squadStart);
    if (afterActiveStatFilter !== -1) {
        squadEnd = content.indexOf('</>', afterActiveStatFilter);
    }
}

if (squadStart !== -1 && squadEnd !== -1) {
  content = content.substring(0, squadStart - 40) + replacementSquad + content.substring(squadEnd + 3);
  console.log('Replaced squad block');
}

fs.writeFileSync(path, content);
