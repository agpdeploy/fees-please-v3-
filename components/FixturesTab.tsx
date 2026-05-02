"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface FixturesTabProps {
  clubId: string;
  teams: any[];
  fixtures: any[];
  defaultUmpireFee: number | "";
  expenseLabel: string;
  loadClubData: () => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  openSquadModal: (fixture: any) => void;
}

interface DraftFixture {
  match_date: string;
  start_time: string;
  opponent: string;
  location: string;
  notes: string;
}

export default function FixturesTab({ clubId, teams, fixtures, defaultUmpireFee, expenseLabel, loadClubData, showToast, openSquadModal }: FixturesTabProps) {
  const [isBulkMode, setIsBulkMode] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Single Fixture State
  const [fixtureTeamId, setFixtureTeamId] = useState("");
  const [opponent, setOpponent] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [fixtureTime, setFixtureTime] = useState(""); 
  const [fixtureLocation, setFixtureLocation] = useState(""); 
  const [fixtureNotes, setFixtureNotes] = useState(""); 
  const [umpireFee, setUmpireFee] = useState<number | "">(defaultUmpireFee);

  // Bulk / AI State
  const [bulkModeState, setBulkModeState] = useState<'upload' | 'review'>('upload');
  const [isExtracting, setIsExtracting] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [draftFixtures, setDraftFixtures] = useState<DraftFixture[]>([]);

  // AI Retry State
  const [cachedUpload, setCachedUpload] = useState<any>(null);
  const [drawAlias, setDrawAlias] = useState("");
  const [needsAlias, setNeedsAlias] = useState(false);

  useEffect(() => {
    if (teams && teams.length > 0 && !fixtureTeamId) {
      setFixtureTeamId(teams[0].id);
    }
  }, [teams, fixtureTeamId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isExtracting) {
      const messages = ["Reading the draw...", "Finding your team...", "Formatting dates...", "Almost ready..."];
      let i = 0;
      setLoadingText(messages[0]);
      interval = setInterval(() => { i++; if (i < messages.length) setLoadingText(messages[i]); }, 2500); 
    }
    return () => clearInterval(interval);
  }, [isExtracting]);

  async function saveFixture() {
    if (!opponent || !matchDate || !fixtureTeamId) return showToast("Please fill all match fields.", "error");
    setIsSaving(true);
    
    const payload = { 
      team_id: fixtureTeamId, 
      opponent, 
      match_date: matchDate, 
      start_time: fixtureTime, 
      location: fixtureLocation, 
      notes: fixtureNotes, 
      umpire_fee: umpireFee === "" ? 0 : umpireFee 
    };

    const { error } = await supabase.from("fixtures").insert([payload]);
    setIsSaving(false);
    if (error) {
      showToast(error.message, "error");
    } else {
      showToast("Fixture saved!");
      setOpponent(""); setMatchDate(""); setFixtureTime(""); setFixtureLocation(""); setFixtureNotes(""); 
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

  const fileToBase64 = (f: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(f);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const runExtraction = async (payload: any, searchName: string) => {
    setIsExtracting(true);
    setNeedsAlias(false);
    try {
      const res = await fetch("/api/extract-fixtures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, teamName: searchName }),
      });

      const data = await res.json();

      if (data.fixtures && Array.isArray(data.fixtures)) {
        if (data.fixtures.length === 0) {
          setNeedsAlias(true);
        } else {
          setDraftFixtures(data.fixtures);
          setBulkModeState('review');
        }
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error("Extraction error:", error);
      showToast(error.message || "Couldn't parse the draw. Switching to manual.", "error");
      setIsBulkMode(false); 
    } finally {
      setIsExtracting(false);
    }
  };
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!fixtureTeamId) {
      e.target.value = '';
      return showToast("Please select a team from the dropdown first so dAIve knows who to look for.", "error");
    }

    const dangerousExtensions = /\.(exe|bat|cmd|sh|js|ts|html|htm|php|py|vbs|ps1)$/i;
    if (dangerousExtensions.test(file.name)) {
      e.target.value = ''; 
      return showToast(`Security Block: Invalid file type.`, "error");
    }
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      e.target.value = ''; 
      return showToast("Please save your Excel file as a CSV or PDF first.", "error");
    }

    setIsExtracting(true);
    const teamName = teams.find(t => t.id === fixtureTeamId)?.name || "";

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
      
      setCachedUpload(payload);
      await runExtraction(payload, teamName);

    } catch (error: any) {
      console.error("File processing error:", error);
      showToast(error.message || "Couldn't process the file.", "error");
      setIsExtracting(false);
    } finally {
      e.target.value = ''; 
    }
  };

  const updateDraftFixture = (index: number, field: keyof DraftFixture, value: any) => {
    const updated = [...draftFixtures];
    updated[index] = { ...updated[index], [field]: value };
    setDraftFixtures(updated);
  };

  const removeDraftFixture = (index: number) => {
    setDraftFixtures(draftFixtures.filter((_, i) => i !== index));
  };

  async function saveBulkFixtures() {
    const validFixtures = draftFixtures.filter(f => f.opponent.trim() !== "" && f.match_date);
    if (validFixtures.length === 0) return showToast("No valid fixtures to save.", "error");
    
    setIsSaving(true);
    const payload = validFixtures.map(f => ({ 
      ...f, 
      team_id: fixtureTeamId, 
      umpire_fee: defaultUmpireFee || 0 
    }));

    const { error } = await supabase.from("fixtures").insert(payload);
    
    setIsSaving(false);
    if (error) {
      showToast(error.message, "error");
    } else { 
      showToast(`Imported ${validFixtures.length} matches!`); 
      setDraftFixtures([]); 
      setBulkModeState('upload');
      setNeedsAlias(false);
      setCachedUpload(null);
      setDrawAlias("");
      setIsBulkMode(false); 
      loadClubData(); 
    }
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-left-4 fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm relative transition-colors">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[11px] font-black uppercase italic text-emerald-600 dark:text-emerald-500">
            {isBulkMode ? 'Add Matches' : 'Manual Entry'}
          </h2>
        </div>
        
        <select value={fixtureTeamId || ""} onChange={(e) => setFixtureTeamId(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 mb-4 transition-colors font-bold">
          <option value="">-- Select Team to Add Matches --</option>
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
              setDraftFixtures([]);
              setNeedsAlias(false);
              setDrawAlias("");
            }}
            className={`flex-1 py-3 text-[10px] font-black tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${!isBulkMode ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
          >
            <i className="fa-solid fa-keyboard"></i> MANUAL ENTRY
          </button>
        </div>
        
        {!isBulkMode ? (
          <div className="animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-3 mb-4">
              <input type="text" placeholder="Opponent" value={opponent || ""} onChange={(e) => setOpponent(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
              <input type="date" value={matchDate || ""} onChange={(e) => setMatchDate(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 color-scheme-light dark:color-scheme-dark transition-colors" />
              
              <div className="flex gap-2">
                <input type="text" placeholder="Start Time (e.g. 1:00 PM)" value={fixtureTime || ""} onChange={(e) => setFixtureTime(e.target.value)} className="w-1/3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                <div className="flex-1 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">$</span>
                  <input type="number" placeholder={expenseLabel || "Umpire Fee"} value={umpireFee ?? ""} onChange={(e) => setUmpireFee(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl pl-8 pr-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                </div>
              </div>
              <input type="text" placeholder="Location" value={fixtureLocation || ""} onChange={(e) => setFixtureLocation(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
              <input type="text" placeholder="Match Notes" value={fixtureNotes || ""} onChange={(e) => setFixtureNotes(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
            </div>
            <button disabled={isSaving} onClick={saveFixture} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl uppercase tracking-widest text-xs active:scale-95 transition-all shadow-md disabled:opacity-50">
              {isSaving ? "Saving..." : "Save Fixture"}
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
            {bulkModeState === 'upload' && !isExtracting && (
              <>
                {!needsAlias ? (
                  <div className="relative group border-2 border-dashed border-emerald-500 dark:border-emerald-600 rounded-2xl p-10 text-center hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors bg-zinc-50 dark:bg-zinc-800 cursor-pointer w-full">
                    <input type="file" accept="image/*,.csv,.pdf" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className="w-16 h-16 mx-auto bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                      <i className="fa-solid fa-wand-magic-sparkles text-3xl text-emerald-600 dark:text-emerald-500"></i>
                    </div>
                    {/* Removed 'uppercase' class to preserve dAIve casing */}
                    <h3 className="font-black tracking-widest text-sm text-emerald-800 dark:text-emerald-400 mb-1">GIVE IT TO dAIve</h3>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Upload Master Draw (PDF/IMG/CSV)</p>
                  </div>
                ) : (
                  <div className="border border-orange-200 bg-orange-50 dark:bg-orange-900/10 dark:border-orange-900 p-5 rounded-2xl w-full animate-in fade-in">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-orange-200 dark:bg-orange-900/50 flex items-center justify-center text-orange-600 shrink-0">
                        <i className="fa-solid fa-magnifying-glass"></i>
                      </div>
                      <div>
                        <h3 className="font-black uppercase tracking-widest text-sm text-orange-800 dark:text-orange-400">Team Not Found</h3>
                        <p className="text-[10px] font-bold text-orange-600/70 dark:text-orange-500 uppercase tracking-widest">Did they use an abbreviation on the draw?</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <input type="text" placeholder="e.g. Ferny Dist 1" value={drawAlias || ""} onChange={(e) => setDrawAlias(e.target.value)} className="flex-1 bg-white dark:bg-zinc-900 border border-orange-200 dark:border-orange-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-orange-500 transition-colors" />
                      <button onClick={() => runExtraction(cachedUpload, drawAlias)} disabled={!drawAlias} className="px-6 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-black uppercase transition-colors disabled:opacity-50 shadow-md">Try Again</button>
                    </div>
                    <button onClick={() => setNeedsAlias(false)} className="w-full mt-4 text-[10px] font-bold text-orange-600/70 hover:text-orange-800 dark:text-orange-500 dark:hover:text-orange-400 uppercase tracking-widest transition-colors underline">
                      Cancel and upload different file
                    </button>
                  </div>
                )}
              </>
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
                  onClick={() => { setBulkModeState('upload'); setDraftFixtures([]); }} 
                  className="self-start mb-4 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 uppercase tracking-widest transition-colors flex items-center"
                >
                  <i className="fa-solid fa-arrow-left mr-2"></i> Try Upload Again
                </button>

                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col mb-4">
                  <div className="bg-zinc-900 dark:bg-black px-4 py-3 flex justify-between items-center text-white shrink-0">
                    <span className="font-black text-[10px] uppercase tracking-widest">Review Fixtures</span>
                  </div>
                  
                  <div className="overflow-y-auto p-3 space-y-3 max-h-[50vh] bg-zinc-50 dark:bg-zinc-800/50">
                    {draftFixtures.map((f, i) => (
                      <div key={i} className="flex flex-col gap-2 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm relative">
                        <button onClick={() => removeDraftFixture(i)} className="absolute top-2 right-2 text-zinc-400 hover:text-red-500 transition-colors w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"><i className="fa-solid fa-xmark"></i></button>
                        
                        <div className="flex gap-2 pr-6">
                          <input type="text" placeholder="Opponent" value={f.opponent || ""} onChange={(e) => updateDraftFixture(i, 'opponent', e.target.value)} className="flex-1 min-w-0 px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 dark:text-white transition-colors font-bold" />
                          <input type="date" value={f.match_date || ""} onChange={(e) => updateDraftFixture(i, 'match_date', e.target.value)} className="flex-[0.8] min-w-0 px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 dark:text-white transition-colors color-scheme-light dark:color-scheme-dark" />
                        </div>
                        <div className="flex gap-2 pr-6">
                          <input type="text" placeholder="Time" value={f.start_time || ""} onChange={(e) => updateDraftFixture(i, 'start_time', e.target.value)} className="flex-[0.6] min-w-0 px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 dark:text-white transition-colors" />
                          <input type="text" placeholder="Venue/Location" value={f.location || ""} onChange={(e) => updateDraftFixture(i, 'location', e.target.value)} className="flex-1 min-w-0 px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 dark:text-white transition-colors" />
                        </div>
                        <div className="flex gap-2 pr-6">
                          <input type="text" placeholder="Notes (Round, Home/Away)" value={f.notes || ""} onChange={(e) => updateDraftFixture(i, 'notes', e.target.value)} className="w-full min-w-0 px-3 py-2 text-[10px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-500 text-zinc-500 dark:text-zinc-400 transition-colors" />
                        </div>
                      </div>
                    ))}
                    {draftFixtures.length === 0 && <div className="text-center py-6 text-zinc-400 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest">No matches found for this team</div>}
                  </div>
                </div>

                <button 
                  onClick={saveBulkFixtures}
                  disabled={isSaving || draftFixtures.length === 0}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-md disabled:opacity-50 active:scale-95"
                >
                  {isSaving ? "Saving Matches..." : `Import ${draftFixtures.filter(f => f.opponent.trim() !== "").length} Matches`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FIXTURE LIST */}
      <div className="space-y-2">
        {fixtures.map(f => (
          <FixtureRow 
            key={f.id} 
            fixture={f} 
            teams={teams} 
            expenseLabel={expenseLabel}
            loadClubData={loadClubData} 
            showToast={showToast} 
            openSquadModal={openSquadModal}
          />
        ))}
      </div>
    </div>
  );
}

// INLINE EDITING COMPONENT
function FixtureRow({ fixture, teams, expenseLabel, loadClubData, showToast, openSquadModal }: { fixture: any, teams: any[], expenseLabel: string, loadClubData: () => Promise<void>, showToast: (msg: string, type?: 'success'|'error') => void, openSquadModal: (fixture: any) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [editForm, setEditForm] = useState({
    team_id: fixture.team_id,
    opponent: fixture.opponent,
    match_date: fixture.match_date,
    start_time: fixture.start_time || "",
    location: fixture.location || "",
    notes: fixture.notes || "",
    umpire_fee: fixture.umpire_fee !== undefined ? fixture.umpire_fee : ""
  });

  async function handleUpdate() {
    setIsSaving(true);
    const { error } = await supabase.from("fixtures").update(editForm).eq("id", fixture.id);
    setIsSaving(false);
    if (error) showToast(error.message, "error");
    else { showToast("Match updated!"); setIsEditing(false); loadClubData(); }
  }

  async function handleDelete() {
    if (!window.confirm("Are you sure you want to delete this match?")) return;
    const { error } = await supabase.from("fixtures").delete().eq("id", fixture.id);
    if (error) showToast(error.message, "error"); 
    else { showToast("Match deleted."); loadClubData(); }
  }

  if (isEditing) {
    return (
      <div className="bg-white dark:bg-zinc-900 border-2 border-emerald-500 p-4 rounded-xl flex flex-col gap-3 shadow-md transition-colors animate-in fade-in">
        <select value={editForm.team_id || ""} onChange={(e) => setEditForm({...editForm, team_id: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors">
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        
        <div className="flex gap-2">
          <input type="text" placeholder="Opponent" value={editForm.opponent || ""} onChange={(e) => setEditForm({...editForm, opponent: e.target.value})} className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
          <input type="date" value={editForm.match_date || ""} onChange={(e) => setEditForm({...editForm, match_date: e.target.value})} className="flex-[0.8] bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors color-scheme-light dark:color-scheme-dark" />
        </div>

        <div className="flex gap-2">
          <input type="text" placeholder="Time" value={editForm.start_time || ""} onChange={(e) => setEditForm({...editForm, start_time: e.target.value})} className="flex-[0.6] bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
          <input type="text" placeholder="Location" value={editForm.location || ""} onChange={(e) => setEditForm({...editForm, location: e.target.value})} className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
        </div>

        <div className="flex gap-2">
           <input type="text" placeholder="Notes" value={editForm.notes || ""} onChange={(e) => setEditForm({...editForm, notes: e.target.value})} className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
           <div className="flex-[0.6] relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">$</span>
              <input type="number" placeholder={expenseLabel} value={editForm.umpire_fee ?? ""} onChange={(e) => setEditForm({...editForm, umpire_fee: e.target.value === '' ? '' : Number(e.target.value)})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl pl-6 pr-2 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
           </div>
        </div>

        <div className="flex gap-2 mt-1">
          <button onClick={() => setIsEditing(false)} className="flex-1 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-400 rounded-xl text-xs font-black uppercase transition-colors">Cancel</button>
          <button onClick={handleUpdate} disabled={isSaving} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase transition-colors disabled:opacity-50">Save</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex flex-col gap-3 group shadow-sm transition-colors hover:border-zinc-300 dark:hover:border-zinc-700">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mb-1">
            {new Date(fixture.match_date).toLocaleDateString()} {fixture.start_time && `• ${fixture.start_time}`}
          </div>
          <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            {fixture.teams?.name} vs {fixture.opponent}
          </div>
          {fixture.notes && <div className="text-[10px] text-zinc-500 mt-1">{fixture.notes}</div>}
        </div>
        <div className="flex gap-2 shrink-0 ml-2">
          <button onClick={() => setIsEditing(true)} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center"><i className="fa-solid fa-pen text-xs"></i></button>
          <button onClick={handleDelete} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-red-500 transition-colors flex items-center justify-center"><i className="fa-solid fa-trash text-xs"></i></button>
        </div>
      </div>
      <button onClick={() => openSquadModal(fixture)} className="w-full py-2 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 flex items-center justify-center gap-2 transition-colors">
        <i className="fa-solid fa-users"></i> Match Players
      </button>
    </div>
  );
}