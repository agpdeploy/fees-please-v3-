"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface PlayersTabProps {
  clubId: string;
  teams: any[];
  players: any[];
  clubUsers: any[]; // <-- 1. ADDED TO RECEIVE PERMISSIONS
  loadClubData: () => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface DraftPlayer {
  first_name: string;
  last_name: string;
  nickname: string;
  mobile_number: string;
  email: string;
  is_member: boolean;
}

export default function PlayersTab({ clubId, teams, players, clubUsers = [], loadClubData, showToast }: PlayersTabProps) {
  const [isBulkMode, setIsBulkMode] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Manual Entry State
  const [addTeamId, setAddTeamId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nickname, setNickname] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [isMember, setIsMember] = useState(true);

  // Bulk / AI State
  const [bulkModeState, setBulkModeState] = useState<'upload' | 'review'>('upload');
  const [isExtracting, setIsExtracting] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [draftPlayers, setDraftPlayers] = useState<DraftPlayer[]>([]);

  useEffect(() => {
    if (teams && teams.length > 0 && !addTeamId) {
      setAddTeamId(teams[0].id);
    }
  }, [teams, addTeamId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isExtracting) {
      const messages = ["Scanning the roster...", "Identifying players...", "Formatting data...", "Almost ready..."];
      let i = 0;
      setLoadingText(messages[0]);
      interval = setInterval(() => { i++; if (i < messages.length) setLoadingText(messages[i]); }, 2500); 
    }
    return () => clearInterval(interval);
  }, [isExtracting]);

  async function saveManualPlayer() {
    // STRICT CHECK: Don't let them save without a valid team from the current club
    if (!firstName || !addTeamId || addTeamId === "") {
      return showToast("First name and a valid Team are required.", "error");
    }
    setIsSaving(true);
    
    const payload = { 
      club_id: clubId,
      default_team_id: addTeamId, 
      first_name: firstName, 
      last_name: lastName,
      nickname: nickname || null,
      mobile_number: mobileNumber || null,
      email: email || null,
      is_member: isMember 
    };

    const { error } = await supabase.from("players").insert([payload]);
    setIsSaving(false);
    if (error) {
      showToast(error.message, "error");
    } else {
      showToast("Player added successfully!");
      setFirstName(""); setLastName(""); setNickname(""); setMobileNumber(""); setEmail(""); setIsMember(true);
      loadClubData(); 
    }
  }

  const fileToBase64 = (f: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(f);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1000; 
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !addTeamId) return showToast("Please select a Team first.", "error");

    const dangerousExtensions = /\.(exe|bat|cmd|sh|js|ts|html|htm|php|py|vbs|ps1)$/i;
    if (dangerousExtensions.test(file.name)) {
      e.target.value = ''; 
      return showToast(`Security Block: Invalid file type.`, "error");
    }

    setIsExtracting(true);
    setLoadingText("Reading roster...");

    try {
      let payload: any = {};

      if (file.type.startsWith('image/')) {
        payload.fileBase64 = await compressImage(file);
        payload.mimeType = 'image/jpeg';
      } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        if (file.size > 5 * 1024 * 1024) throw new Error("PDF must be smaller than 5MB.");
        payload.fileBase64 = await fileToBase64(file);
        payload.mimeType = 'application/pdf';
      } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        payload.csvText = await file.text();
      } else {
        throw new Error("Unsupported file format.");
      }
      
      const res = await fetch("/api/extract-roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 404) throw new Error("Extraction route missing. Verify the API path.");

      const data = await res.json();

      if (data.players && Array.isArray(data.players)) {
        setDraftPlayers(data.players.map((p: any) => ({
          first_name: p.firstName || p.first_name || "",
          last_name: p.lastName || p.last_name || "",
          nickname: p.nickname || "",
          mobile_number: p.mobile || p.mobile_number || "",
          email: p.email || "",
          is_member: p.is_member ?? true 
        })));
        setBulkModeState('review');
      } else if (data.error) {
        throw new Error(data.error);
      }

    } catch (error: any) {
      console.error("Extraction error:", error);
      showToast(error.message || "Couldn't process the file. Switching to manual.", "error");
      setIsBulkMode(false); 
    } finally {
      setIsExtracting(false);
      e.target.value = ''; 
    }
  };

  const updateDraftPlayer = (index: number, field: keyof DraftPlayer, value: any) => {
    const updated = [...draftPlayers];
    updated[index] = { ...updated[index], [field]: value };
    setDraftPlayers(updated);
  };

  const removeDraftPlayer = (index: number) => {
    setDraftPlayers(draftPlayers.filter((_, i) => i !== index));
  };

  async function saveBulkPlayers() {
    const validPlayers = draftPlayers.filter(p => p.first_name.trim() !== "");
    if (validPlayers.length === 0) return showToast("No valid players to save.", "error");
    if (!addTeamId) return showToast("Please select a valid Team first.", "error");
    
    setIsSaving(true);
    const payload = validPlayers.map(p => ({ 
      first_name: p.first_name,
      last_name: p.last_name,
      nickname: p.nickname || null,
      mobile_number: p.mobile_number || null,
      email: p.email || null,
      is_member: p.is_member,
      club_id: clubId,
      default_team_id: addTeamId, 
    }));

    const { error } = await supabase.from("players").insert(payload);
    
    setIsSaving(false);
    if (error) {
      showToast(error.message, "error");
    } else { 
      showToast(`Imported ${validPlayers.length} players!`); 
      setDraftPlayers([]); 
      setBulkModeState('upload');
      setIsBulkMode(false); 
      loadClubData(); 
    }
  }

  // NEW LOGIC: If no team is selected, show everyone (unassigned first)
  // If a team is selected, show that team's players.
  const teamPlayers = players.filter(p => {
    if (!addTeamId) return true; // Show everyone if filter is empty
    return p.default_team_id === addTeamId;
  });

  return (
    <div className="space-y-6 animate-in slide-in-from-left-4 fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm relative transition-colors">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[11px] font-black uppercase italic text-emerald-600 dark:text-emerald-500">
            {isBulkMode ? 'Add Players' : 'Manual Entry'}
          </h2>
        </div>
        
        <select value={addTeamId || ""} onChange={(e) => setAddTeamId(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 mb-4 transition-colors font-bold">
          <option value="">-- View All Club Players --</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        {addTeamId && (
          <div className="flex bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-1 mb-5 transition-colors">
            <button
              onClick={() => setIsBulkMode(true)}
              className={`flex-1 py-3 text-[10px] font-black tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${isBulkMode ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
            >
              <i className="fa-solid fa-wand-magic-sparkles"></i> dAIve UPLOAD
            </button>
            <button
              onClick={() => {
                setIsBulkMode(false);
                setBulkModeState('upload');
                setDraftPlayers([]);
              }}
              className={`flex-1 py-3 text-[10px] font-black tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${!isBulkMode ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
            >
              <i className="fa-solid fa-keyboard"></i> MANUAL ENTRY
            </button>
          </div>
        )}

        {addTeamId ? (
          !isBulkMode ? (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              <div className="space-y-3 mb-4">
                <div className="flex gap-2">
                  <input type="text" placeholder="First Name" value={firstName || ""} onChange={(e) => setFirstName(e.target.value)} className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                  <input type="text" placeholder="Last Name" value={lastName || ""} onChange={(e) => setLastName(e.target.value)} className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder="Nickname/Preferred" value={nickname || ""} onChange={(e) => setNickname(e.target.value)} className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                  <input type="tel" placeholder="Mobile Number" value={mobileNumber || ""} onChange={(e) => setMobileNumber(e.target.value)} className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                </div>
                <input type="email" placeholder="Email Address (Optional - For App Link)" value={email || ""} onChange={(e) => setEmail(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                
                <div className="flex items-center justify-between border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-800 transition-colors mt-2">
                   <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">Status</span>
                   <button 
                     onClick={() => setIsMember(!isMember)}
                     className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-colors shadow-sm ${isMember ? 'bg-emerald-600 text-white' : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'}`}
                   >
                     {isMember ? 'MEMBER' : 'CASUAL'}
                   </button>
                </div>
              </div>
              <button disabled={isSaving} onClick={saveManualPlayer} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs active:scale-95 transition-all shadow-md disabled:opacity-50 mt-2">
                {isSaving ? "Saving..." : "Save Player"}
              </button>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              {bulkModeState === 'upload' && !isExtracting && (
                <div className="relative group border-2 border-dashed border-emerald-500 dark:border-emerald-600 rounded-2xl p-10 text-center hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors bg-zinc-50 dark:bg-zinc-800 cursor-pointer w-full">
                  <input type="file" accept="image/*,.csv,.pdf" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className="w-16 h-16 mx-auto bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                    <i className="fa-solid fa-wand-magic-sparkles text-3xl text-emerald-600 dark:text-emerald-500"></i>
                  </div>
                  <h3 className="font-black tracking-widest text-sm text-emerald-800 dark:text-emerald-400 mb-1">GIVE IT TO dAIve</h3>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Upload Roster (PDF/IMG/CSV)</p>
                </div>
              )}

              {isExtracting && (
                <div className="flex flex-col items-center justify-center py-12 animate-in fade-in duration-500">
                  <i className="fa-solid fa-microchip text-4xl text-emerald-500 animate-pulse mb-4"></i>
                  <p className="font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 animate-pulse text-[10px] text-center">{loadingText}</p>
                </div>
              )}

              {bulkModeState === 'review' && !isExtracting && (
                <div className="flex flex-col animate-in slide-in-from-bottom-4 fade-in">
                  <button 
                    onClick={() => { setBulkModeState('upload'); setDraftPlayers([]); }} 
                    className="self-start mb-4 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 uppercase tracking-widest transition-colors flex items-center"
                  >
                    <i className="fa-solid fa-arrow-left mr-2"></i> Try Upload Again
                  </button>

                  <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col mb-4">
                    <div className="bg-zinc-900 dark:bg-black px-4 py-3 flex justify-between items-center text-white shrink-0">
                      <span className="font-black text-[10px] uppercase tracking-widest">Review Players</span>
                    </div>
                    
                    <div className="overflow-y-auto p-3 space-y-3 max-h-[50vh] bg-zinc-50 dark:bg-zinc-800/50">
                      {draftPlayers.map((p, i) => (
                        <div key={i} className="flex flex-col gap-2 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm relative">
                          <button onClick={() => removeDraftPlayer(i)} className="absolute top-2 right-2 text-zinc-400 hover:text-red-500 transition-colors w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"><i className="fa-solid fa-xmark"></i></button>
                          
                          <div className="flex gap-2 pr-6">
                            <input type="text" placeholder="First Name" value={p.first_name || ""} onChange={(e) => updateDraftPlayer(i, 'first_name', e.target.value)} className="flex-1 min-w-0 px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 dark:text-white transition-colors font-bold" />
                            <input type="text" placeholder="Last Name" value={p.last_name || ""} onChange={(e) => updateDraftPlayer(i, 'last_name', e.target.value)} className="flex-1 min-w-0 px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 dark:text-white transition-colors font-bold" />
                          </div>
                          <div className="flex gap-2 pr-6 mt-1">
                            <input type="text" placeholder="Nickname" value={p.nickname || ""} onChange={(e) => updateDraftPlayer(i, 'nickname', e.target.value)} className="flex-1 min-w-0 px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 dark:text-white transition-colors" />
                            <input type="tel" placeholder="Mobile" value={p.mobile_number || ""} onChange={(e) => updateDraftPlayer(i, 'mobile_number', e.target.value)} className="flex-1 min-w-0 px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 dark:text-white transition-colors" />
                          </div>
                          <div className="flex items-center justify-between mt-1">
                             <button 
                               onClick={() => updateDraftPlayer(i, 'is_member', !p.is_member)}
                               className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${p.is_member ? 'bg-emerald-600 text-white shadow-sm' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}
                             >
                               {p.is_member ? 'MEMBER' : 'CASUAL'}
                             </button>
                          </div>
                        </div>
                      ))}
                      {draftPlayers.length === 0 && <div className="text-center py-6 text-zinc-400 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest">No players extracted</div>}
                    </div>
                  </div>

                  <button 
                    onClick={saveBulkPlayers}
                    disabled={isSaving || draftPlayers.length === 0}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-md disabled:opacity-50 active:scale-95"
                  >
                    {isSaving ? "Saving Players..." : `Import ${draftPlayers.filter(p => p.first_name.trim() !== "").length} Players`}
                  </button>
                </div>
              )}
            </div>
          )
        ) : (
          <div className="text-center py-8 text-zinc-400 dark:text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
            Select a specific team above to add new players.
          </div>
        )}
      </div>

      {/* PLAYER LIST */}
      <div className="space-y-2">
        {teamPlayers.length === 0 && (
           <p className="text-center text-zinc-400 dark:text-zinc-600 text-[10px] uppercase font-bold py-4">
             {addTeamId ? "No players in this team yet." : "No players in this club yet."}
           </p>
        )}
        {teamPlayers.map(p => (
          <PlayerRow 
            key={p.id} 
            player={p} 
            teams={teams} 
            clubUsers={clubUsers} // <-- 2. PASSING DOWN PERMISSIONS HERE
            loadClubData={loadClubData} 
            showToast={showToast} 
          />
        ))}
      </div>
    </div>
  );
}

// INLINE EDITING COMPONENT
function PlayerRow({ 
  player, 
  teams, 
  clubUsers, 
  loadClubData, 
  showToast 
}: { 
  player: any, 
  teams: any[], 
  clubUsers: any[], 
  loadClubData: () => Promise<void>, 
  showToast: (msg: string, type?: 'success'|'error') => void 
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [editForm, setEditForm] = useState({
    default_team_id: player.default_team_id || "",
    first_name: player.first_name || "",
    last_name: player.last_name || "",
    nickname: player.nickname || "",
    mobile_number: player.mobile_number || "",
    email: player.email || "",
    is_member: player.is_member ?? true
  });

  async function handleUpdate() {
    if (!editForm.first_name || !editForm.default_team_id) {
       return showToast("First name and a valid Team are required", "error");
    }
    setIsSaving(true);
    
    // Convert empty strings to null for the database
    const payload = {
      ...editForm,
      nickname: editForm.nickname || null,
      mobile_number: editForm.mobile_number || null,
      email: editForm.email || null,
    }
    
    const { error } = await supabase.from("players").update(payload).eq("id", player.id);
    setIsSaving(false);
    if (error) showToast(error.message, "error");
    else { showToast("Player updated!"); setIsEditing(false); loadClubData(); }
  }

  async function handleDelete() {
    if (!window.confirm(`Are you sure you want to delete ${player.first_name}?`)) return;
    const { error } = await supabase.from("players").delete().eq("id", player.id);
    if (error) showToast(error.message, "error"); 
    else { showToast("Player deleted."); loadClubData(); }
  }

  if (isEditing) {
    return (
      <div className="bg-white dark:bg-zinc-900 border-2 border-emerald-500 p-4 rounded-xl flex flex-col gap-3 shadow-md transition-colors animate-in fade-in">
        <select value={editForm.default_team_id || ""} onChange={(e) => setEditForm({...editForm, default_team_id: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors">
          <option value="" disabled>-- Select a valid team --</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        
        <div className="flex gap-2">
          <input type="text" placeholder="First Name" value={editForm.first_name || ""} onChange={(e) => setEditForm({...editForm, first_name: e.target.value})} className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
          <input type="text" placeholder="Last Name" value={editForm.last_name || ""} onChange={(e) => setEditForm({...editForm, last_name: e.target.value})} className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
        </div>

        <div className="flex gap-2">
          <input type="text" placeholder="Nickname/Preferred" value={editForm.nickname || ""} onChange={(e) => setEditForm({...editForm, nickname: e.target.value})} className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
          <input type="tel" placeholder="Mobile Number" value={editForm.mobile_number || ""} onChange={(e) => setEditForm({...editForm, mobile_number: e.target.value})} className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
        </div>

        <input type="email" placeholder="Email Address (Optional - For App Link)" value={editForm.email || ""} onChange={(e) => setEditForm({...editForm, email: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <button 
             onClick={() => setEditForm({...editForm, is_member: !editForm.is_member})}
             className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors shadow-sm ${editForm.is_member ? 'bg-emerald-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'}`}
          >
             {editForm.is_member ? 'MEMBER' : 'CASUAL'}
          </button>
          <div className="flex gap-2">
            <button onClick={() => setIsEditing(false)} className="px-5 py-2.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">Cancel</button>
            <button onClick={handleUpdate} disabled={isSaving} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50 shadow-md">Save</button>
          </div>
        </div>
      </div>
    );
  }

  // Detect if they have NO team vs. a BROKEN team ID
  const teamExists = teams.find(t => t.id === player.default_team_id);
  const currentTeamName = teamExists ? teamExists.name : (player.default_team_id ? "⚠️ GHOST TEAM ID" : "UNASSIGNED");

  // --- IDENTITY & PERMISSIONS LOGIC ---
  // Find all roles assigned to this specific player by matching user_id or email
  const userRoles = clubUsers?.filter(u => 
    (player.user_id && u.user_id === player.user_id) || 
    (player.email && u.email?.toLowerCase() === player.email?.toLowerCase())
  ) || [];

  const hasClubAdmin = userRoles.some(r => r.role === 'club_admin');
  const hasTeamAdmin = userRoles.some(r => r.role === 'team_admin');

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex justify-between items-center group shadow-sm transition-colors hover:border-zinc-300 dark:hover:border-zinc-700">
      <div>
        <div className="font-bold text-zinc-900 dark:text-white text-sm uppercase tracking-wide flex flex-wrap items-center gap-2">
          <span>{player.first_name} {player.last_name}</span>
          {player.nickname && <span className="text-zinc-400 dark:text-zinc-500 text-xs italic font-normal normal-case">"{player.nickname}"</span>}
          
          {/* RENDER MANAGER BADGES */}
          {hasClubAdmin && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
              Club Manager
            </span>
          )}
          {!hasClubAdmin && hasTeamAdmin && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
              Team Manager
            </span>
          )}
        </div>
        
        <div className="text-[9px] font-black uppercase tracking-widest mt-1 text-zinc-500 flex items-center gap-2">
          <span className={!teamExists ? "text-amber-500 dark:text-amber-600" : ""}>{currentTeamName}</span>
          <span className="text-zinc-300 dark:text-zinc-700">•</span>
          <span className={player.is_member ? 'text-emerald-600 dark:text-emerald-500' : 'text-zinc-400 dark:text-zinc-500'}>
            {player.is_member ? 'Member' : 'Casual'}
          </span>
        </div>
      </div>
      <div className="flex gap-2 shrink-0 ml-4">
        <button onClick={() => setIsEditing(true)} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center shadow-sm"><i className="fa-solid fa-pen text-xs"></i></button>
        <button onClick={handleDelete} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-red-500 transition-colors flex items-center justify-center shadow-sm"><i className="fa-solid fa-trash text-xs"></i></button>
      </div>
    </div>
  );
}