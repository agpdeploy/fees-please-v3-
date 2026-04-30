"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface PlayersTabProps {
  clubId: string;
  teams: any[];
  players: any[];
  loadClubData: () => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface DraftPlayer {
  first_name: string;
  last_name: string;
  nickname: string;
  email: string;
  mobile_number: string;
  is_member: boolean;
}

export default function PlayersTab({ clubId, teams, players, loadClubData, showToast }: PlayersTabProps) {
  const [isBulkMode, setIsBulkMode] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Single Player State
  const [playerTeamId, setPlayerTeamId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [playerNickname, setPlayerNickname] = useState(""); 
  const [playerMobile, setPlayerMobile] = useState(""); 
  const [playerEmail, setPlayerEmail] = useState("");
  const [isMember, setIsMember] = useState(true);

  // Bulk / AI Upload State
  const [bulkModeState, setBulkModeState] = useState<'upload' | 'review'>('upload');
  const [isExtracting, setIsExtracting] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [draftPlayers, setDraftPlayers] = useState<DraftPlayer[]>([]);

  useEffect(() => {
    if (teams && teams.length > 0 && !playerTeamId) {
      setPlayerTeamId(teams[0].id);
    }
  }, [teams, playerTeamId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isExtracting) {
      const messages = [
        "Scanning the roster...",
        "Deciphering terrible handwriting...",
        "Extracting player contact details...",
        "Almost there..."
      ];
      let i = 0;
      setLoadingText(messages[0]);
      interval = setInterval(() => {
        i++;
        if (i < messages.length) setLoadingText(messages[i]);
      }, 2500); 
    }
    return () => clearInterval(interval);
  }, [isExtracting]);

  async function savePlayer() {
    if (!firstName || !lastName) return showToast("Please enter player name.", "error");
    setIsSaving(true);
    
    const cleanEmail = playerEmail ? playerEmail.toLowerCase().trim() : null;
    const payload = { 
      first_name: firstName, 
      last_name: lastName, 
      nickname: playerNickname || null,
      mobile_number: playerMobile || null,
      email: cleanEmail,
      is_member: isMember, 
      default_team_id: playerTeamId || null, 
      club_id: clubId 
    };
    
    const { error } = await supabase.from("players").insert([payload]);
    
    setIsSaving(false);
    if (error) {
      showToast(error.message, "error");
    } else {
      showToast("Player saved!");
      setFirstName(""); 
      setLastName(""); 
      setPlayerNickname(""); 
      setPlayerMobile(""); 
      setPlayerEmail(""); 
      setIsMember(true);
      loadClubData(); 
    }
  }

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800; 
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          }
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const fileToBase64 = (f: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(f);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const dangerousExtensions = /\.(exe|bat|cmd|sh|js|ts|html|htm|php|py|vbs|ps1)$/i;
    if (dangerousExtensions.test(file.name)) {
      e.target.value = ''; 
      return showToast(`Security Block: .${file.name.split('.').pop()?.toUpperCase()} files are strictly prohibited.`, "error");
    }

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      e.target.value = ''; 
      return showToast("Please save your Excel file as a CSV or PDF first.", "error");
    }

    setIsExtracting(true);
    setBulkModeState('review'); 

    try {
      let payload = {};

      if (file.type.startsWith('image/')) {
        const base64Data = await compressImage(file);
        payload = { fileBase64: base64Data, mimeType: 'image/jpeg' };
      } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        if (file.size > 5 * 1024 * 1024) throw new Error("PDF must be smaller than 5MB.");
        const base64Data = await fileToBase64(file);
        payload = { fileBase64: base64Data, mimeType: 'application/pdf' };
      } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        const textData = await file.text();
        payload = { csvText: textData };
      } else {
        throw new Error("Unsupported file format. Please upload a PDF, CSV, or Image.");
      }
      
      const res = await fetch("/api/extract-roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.players && Array.isArray(data.players)) {
        setDraftPlayers(data.players.map((p: any) => ({
          first_name: p.firstName || p.first_name || p.name?.split(' ')[0] || "",
          last_name: p.lastName || p.last_name || p.name?.split(' ').slice(1).join(' ') || "",
          nickname: p.nickname || "",
          email: p.email || p.emailAddress || p.email_address || "",
          mobile_number: p.mobile || p.mobile_number || p.phone || p.phoneNumber || p.phone_number || "",
          is_member: true
        })));
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error("Failed to extract:", error);
      showToast(error.message || "Couldn't parse the file. Switching to manual entry!", "error");
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
    if (validPlayers.length === 0) return showToast("No players to save.", "error");
    
    setIsSaving(true);
    const payload = validPlayers.map(p => ({ 
      ...p, 
      default_team_id: playerTeamId || null, 
      club_id: clubId 
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

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm relative transition-colors">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[11px] font-black uppercase italic text-emerald-600 dark:text-emerald-500">
            {isBulkMode ? 'Add Players' : 'Manual Entry'}
          </h2>
        </div>
        
        <select value={playerTeamId || ""} onChange={(e) => setPlayerTeamId(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 mb-4 transition-colors font-bold">
          <option value="">-- No Default Team (Casual) --</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        {/* Removed 'uppercase' class to preserve dAIve casing */}
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
        
        {!isBulkMode ? (
          <div className="animate-in fade-in zoom-in-95 duration-200">
            <div className="flex gap-2 mb-3">
              <input type="text" placeholder="First Name" value={firstName || ""} onChange={(e) => setFirstName(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
              <input type="text" placeholder="Last Name" value={lastName || ""} onChange={(e) => setLastName(e.target.value)} className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
            </div>
            
            <div className="flex gap-2 mb-3">
              <input type="text" placeholder="Nickname (e.g. Aitcho)" value={playerNickname || ""} onChange={(e) => setPlayerNickname(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
              <input type="tel" placeholder="Mobile Number" value={playerMobile || ""} onChange={(e) => setPlayerMobile(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
            </div>
            
            <div className="mb-3">
              <input type="email" placeholder="Email Address (Optional - For App Link)" value={playerEmail || ""} onChange={(e) => setPlayerEmail(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 transition-colors" />
            </div>

            <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800 p-3 rounded-xl mb-4 border border-zinc-300 dark:border-zinc-700 transition-colors">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-300 uppercase">Status</span>
              <button onClick={() => setIsMember(!isMember)} className={`text-xs font-black uppercase px-3 py-1.5 rounded-lg transition-colors shadow-sm ${isMember ? 'bg-emerald-600 text-white' : 'bg-zinc-300 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-300'}`}>{isMember ? 'Member' : 'Casual'}</button>
            </div>
            <button disabled={isSaving} onClick={savePlayer} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl uppercase tracking-widest text-xs active:scale-95 transition-all shadow-md disabled:opacity-50">
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
                {/* Removed 'uppercase' class to preserve dAIve casing */}
                <h3 className="font-black tracking-widest text-sm text-emerald-800 dark:text-emerald-400 mb-1">GIVE IT TO dAIve</h3>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Auto-Extract PDF, CSV, or Image</p>
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
                          <input type="text" placeholder="First" value={p.first_name || ""} onChange={(e) => updateDraftPlayer(i, 'first_name', e.target.value)} className="flex-1 min-w-0 px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 dark:text-white transition-colors" />
                          <input type="text" placeholder="Last" value={p.last_name || ""} onChange={(e) => updateDraftPlayer(i, 'last_name', e.target.value)} className="flex-1 min-w-0 px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 dark:text-white transition-colors" />
                          <input type="text" placeholder="Nickname" value={p.nickname || ""} onChange={(e) => updateDraftPlayer(i, 'nickname', e.target.value)} className="flex-1 min-w-0 px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 dark:text-white transition-colors" />
                        </div>
                        <div className="flex gap-2 pr-6">
                          <input type="tel" placeholder="Mobile" value={p.mobile_number || ""} onChange={(e) => updateDraftPlayer(i, 'mobile_number', e.target.value)} className="flex-[0.8] min-w-0 px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 dark:text-white transition-colors" />
                          <input type="email" placeholder="Email" value={p.email || ""} onChange={(e) => updateDraftPlayer(i, 'email', e.target.value)} className="flex-1 min-w-0 px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 dark:text-white transition-colors" />
                        </div>
                        <div className="flex items-center gap-2 mt-1 pr-6">
                          <button onClick={() => updateDraftPlayer(i, 'is_member', !p.is_member)} className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg transition-colors shadow-sm ${p.is_member ? 'bg-emerald-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'}`}>
                            {p.is_member ? 'Member' : 'Casual'}
                          </button>
                        </div>
                      </div>
                    ))}
                    {draftPlayers.length === 0 && <div className="text-center py-6 text-zinc-400 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest">No players extracted</div>}
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl mb-4 transition-colors">
                  <i className="fa-solid fa-shield-halved text-emerald-600 mt-0.5 shrink-0"></i>
                  <p className="text-[10px] text-zinc-700 dark:text-zinc-300 font-bold leading-relaxed m-0">
                    By importing, you confirm you are authorised to provide contact details for these individuals and they consent to being contacted regarding team activities and fees.
                  </p>
                </div>

                <button 
                  onClick={saveBulkPlayers}
                  disabled={isSaving || draftPlayers.length === 0}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-md disabled:opacity-50 active:scale-95"
                >
                  {isSaving ? "Saving Profiles..." : `Import ${draftPlayers.filter(p => p.first_name.trim() !== "").length} Players`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* PLAYER LIST */}
      <div className="space-y-2">
        {players.map(p => (
          <PlayerRow 
            key={p.id} 
            player={p} 
            teams={teams} 
            loadClubData={loadClubData} 
            showToast={showToast} 
          />
        ))}
      </div>
    </div>
  );
}

// INLINE EDITING COMPONENT
function PlayerRow({ player, teams, loadClubData, showToast }: { player: any, teams: any[], loadClubData: () => Promise<void>, showToast: (msg: string, type?: 'success'|'error') => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [editForm, setEditForm] = useState({
    first_name: player.first_name || "",
    last_name: player.last_name || "",
    nickname: player.nickname || "",
    mobile_number: player.mobile_number || "",
    email: player.email || "",
    is_member: player.is_member,
    default_team_id: player.default_team_id || ""
  });

  async function handleUpdate() {
    setIsSaving(true);
    const { error } = await supabase.from("players").update({
      ...editForm,
      email: editForm.email ? editForm.email.toLowerCase().trim() : null,
      default_team_id: editForm.default_team_id || null
    }).eq("id", player.id);

    setIsSaving(false);
    if (error) {
      showToast(error.message, "error");
    } else {
      showToast("Player updated!");
      setIsEditing(false);
      loadClubData();
    }
  }

  async function handleDelete() {
    if (!window.confirm("Are you sure you want to delete this player?")) return;
    const { error } = await supabase.from("players").delete().eq("id", player.id);
    if (error) showToast(error.message, "error"); 
    else { showToast("Player deleted."); loadClubData(); }
  }

  if (isEditing) {
    return (
      <div className="bg-white dark:bg-zinc-900 border-2 border-emerald-500 p-4 rounded-xl flex flex-col gap-3 shadow-md transition-colors animate-in fade-in">
        <select value={editForm.default_team_id || ""} onChange={(e) => setEditForm({...editForm, default_team_id: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors">
          <option value="">-- No Default Team (Casual) --</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        
        <div className="flex gap-2">
          <input type="text" placeholder="First Name" value={editForm.first_name || ""} onChange={(e) => setEditForm({...editForm, first_name: e.target.value})} className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
          <input type="text" placeholder="Last Name" value={editForm.last_name || ""} onChange={(e) => setEditForm({...editForm, last_name: e.target.value})} className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
        </div>

        <div className="flex gap-2">
          <button onClick={() => setEditForm({...editForm, is_member: !editForm.is_member})} className={`flex-[0.5] text-[10px] font-black uppercase px-2 py-2 rounded-xl transition-colors shadow-sm ${editForm.is_member ? 'bg-emerald-600 text-white' : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'}`}>
            {editForm.is_member ? 'Member' : 'Casual'}
          </button>
          <button onClick={() => setIsEditing(false)} className="flex-1 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-400 rounded-xl text-xs font-black uppercase transition-colors">Cancel</button>
          <button onClick={handleUpdate} disabled={isSaving} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase transition-colors disabled:opacity-50">Save</button>
        </div>
      </div>
    );
  }

  // STANDARD DISPLAY
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex flex-col gap-2 group shadow-sm transition-colors hover:border-zinc-300 dark:hover:border-zinc-700">
      <div className="flex justify-between items-center">
        <div>
          <div className="font-bold text-zinc-900 dark:text-white">
            {player.first_name} {player.last_name} {player.nickname && <span className="text-zinc-500 font-normal italic">"{player.nickname}"</span>}
          </div>
          <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mt-1">
            {teams.find(t => t.id === player.default_team_id)?.name || "Casual"} 
            {player.email && ` • ${player.email}`}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsEditing(true)} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center"><i className="fa-solid fa-pen text-xs"></i></button>
          <button onClick={handleDelete} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-red-500 transition-colors flex items-center justify-center"><i className="fa-solid fa-trash text-xs"></i></button>
        </div>
      </div>
    </div>
  );
}