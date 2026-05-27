"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

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

export function SetupLogoCard({ clubId, onDismiss, onSuccess }: { clubId: string, onDismiss: () => void, onSuccess: () => void }) {
  const [isUploading, setIsUploading] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${clubId}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('club-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('club-logos')
        .getPublicUrl(fileName);

      await supabase.from('clubs').update({ logo_url: publicUrl }).eq('id', clubId);
      
      onSuccess();
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm relative animate-in fade-in slide-in-from-top-4 mb-4">
      <button onClick={onDismiss} className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
        <i className="fa-solid fa-xmark"></i>
      </button>
      
      <div className="flex items-center gap-4 mb-4">
        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-500 rounded-xl flex items-center justify-center shrink-0">
          <i className="fa-solid fa-camera"></i>
        </div>
        <div>
          <h3 className="font-black text-sm text-zinc-900 dark:text-white">Add Club Logo</h3>
          <p className="text-xs text-zinc-500">Make it feel like home.</p>
        </div>
      </div>

      <div className="relative group border-2 border-dashed border-emerald-500/50 dark:border-emerald-600/50 rounded-xl p-6 text-center hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors bg-zinc-50 dark:bg-zinc-800 cursor-pointer">
        <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isUploading} />
        <div className="w-12 h-12 mx-auto bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm">
          {isUploading ? <i className="fa-solid fa-circle-notch fa-spin text-xl text-emerald-600 dark:text-emerald-500"></i> : <i className="fa-solid fa-cloud-arrow-up text-xl text-emerald-600 dark:text-emerald-500"></i>}
        </div>
        <h3 className="font-black tracking-widest text-xs text-emerald-800 dark:text-emerald-400 mb-1">{isUploading ? 'Uploading...' : 'Tap to Upload Logo'}</h3>
      </div>
    </div>
  );
}

export function SetupPlayersCard({ teamId, clubId, onDismiss, onSuccess }: { teamId: string, clubId: string, onDismiss: () => void, onSuccess: () => void }) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [draftPlayers, setDraftPlayers] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

      if (res.status === 404) throw new Error("Extraction route missing.");

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
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error("Extraction error:", error);
      alert(error.message || "Couldn't process the file.");
    } finally {
      setIsExtracting(false);
      e.target.value = ''; 
    }
  };

  const saveBulkPlayers = async () => {
    const validPlayers = draftPlayers.filter(p => p.first_name.trim() !== "");
    if (validPlayers.length === 0) return alert("No valid players to save.");
    
    setIsSaving(true);
    const payload = validPlayers.map(p => ({ 
      first_name: p.first_name,
      last_name: p.last_name,
      nickname: p.nickname || null,
      mobile_number: p.mobile_number || null,
      email: p.email || null,
      is_member: p.is_member,
      club_id: clubId,
      default_team_id: teamId, 
    }));

    const { error } = await supabase.from("players").insert(payload);
    setIsSaving(false);
    
    if (error) {
      alert(error.message);
    } else { 
      setDraftPlayers([]); 
      onSuccess();
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm relative animate-in fade-in slide-in-from-top-4 mb-4">
      <button onClick={onDismiss} className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
        <i className="fa-solid fa-xmark"></i>
      </button>
      
      <div className="flex items-center gap-4 mb-4">
        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-500 rounded-xl flex items-center justify-center shrink-0">
          <i className="fa-solid fa-users"></i>
        </div>
        <div>
          <h3 className="font-black text-sm text-zinc-900 dark:text-white">Add Players</h3>
          <p className="text-xs text-zinc-500">Give a roster to dAIve.</p>
        </div>
      </div>

      {draftPlayers.length === 0 ? (
        isExtracting ? (
          <div className="flex flex-col items-center justify-center py-8 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
            <i className="fa-solid fa-microchip text-4xl text-emerald-500 animate-pulse mb-4"></i>
            <p className="font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 animate-pulse text-[10px] text-center">{loadingText}</p>
          </div>
        ) : (
          <div className="relative group border-2 border-dashed border-emerald-500/50 dark:border-emerald-600/50 rounded-xl p-6 text-center hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors bg-zinc-50 dark:bg-zinc-800 cursor-pointer">
            <input type="file" accept="image/*,.csv,.pdf" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            <div className="w-12 h-12 mx-auto bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm">
              <i className="fa-solid fa-wand-magic-sparkles text-xl text-emerald-600 dark:text-emerald-500"></i>
            </div>
            <h3 className="font-black tracking-widest text-xs text-emerald-800 dark:text-emerald-400 mb-1">GIVE IT TO dAIve</h3>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Upload Roster (PDF/IMG/CSV)</p>
          </div>
        )
      ) : (
        <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-zinc-900 dark:bg-black px-4 py-3 flex justify-between items-center text-white rounded-t-xl shrink-0">
            <span className="font-black text-[10px] uppercase tracking-widest">Review Players</span>
            <button onClick={() => setDraftPlayers([])} className="text-[10px] text-emerald-400 hover:text-emerald-300">Start Over</button>
          </div>
          <div className="overflow-y-auto p-2 space-y-2 max-h-[30vh] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-b-xl border-t-0 mt-0">
            {draftPlayers.map((p, i) => (
              <div key={i} className="flex flex-col gap-2 bg-white dark:bg-zinc-900 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <div className="flex gap-2">
                  <input type="text" value={p.first_name} onChange={(e) => { const n=[...draftPlayers]; n[i].first_name=e.target.value; setDraftPlayers(n); }} className="flex-1 min-w-0 px-2 py-1 text-xs bg-zinc-50 dark:bg-zinc-800 rounded border-none outline-none font-bold text-zinc-900 dark:text-white" />
                  <input type="text" value={p.last_name} onChange={(e) => { const n=[...draftPlayers]; n[i].last_name=e.target.value; setDraftPlayers(n); }} className="flex-1 min-w-0 px-2 py-1 text-xs bg-zinc-50 dark:bg-zinc-800 rounded border-none outline-none font-bold text-zinc-900 dark:text-white" />
                </div>
              </div>
            ))}
          </div>
          <button onClick={saveBulkPlayers} disabled={isSaving} className="w-full py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50">
            {isSaving ? "Saving..." : `Import ${draftPlayers.length} Players`}
          </button>
        </div>
      )}
    </div>
  );
}

export function SetupFixturesCard({ teamId, teamName, onDismiss, onSuccess }: { teamId: string, teamName: string, onDismiss: () => void, onSuccess: () => void }) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [draftFixtures, setDraftFixtures] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [needsAlias, setNeedsAlias] = useState(false);
  const [drawAlias, setDrawAlias] = useState("");
  const [cachedUpload, setCachedUpload] = useState<any>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isExtracting) {
      const messages = ["Reading the draw...", "Finding your team...", "Formatting dates..."];
      let i = 0;
      setLoadingText(messages[0]);
      interval = setInterval(() => { i++; if (i < messages.length) setLoadingText(messages[i]); }, 2500); 
    }
    return () => clearInterval(interval);
  }, [isExtracting]);

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
        }
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (error: any) {
      alert(error.message || "Couldn't parse the draw.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let payload: any = {};
    if (file.type.startsWith('image/')) {
      payload.fileBase64 = await compressImage(file);
      payload.mimeType = 'image/jpeg';
    } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      if (file.size > 5 * 1024 * 1024) return alert("PDF must be smaller than 5MB.");
      payload.fileBase64 = await fileToBase64(file);
      payload.mimeType = 'application/pdf';
    } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
      payload.csvText = await file.text();
    } else {
      return alert("Unsupported file format.");
    }
    
    setCachedUpload(payload);
    await runExtraction(payload, teamName);
  };

  const handleRetryWithAlias = async () => {
    if (!drawAlias.trim() || !cachedUpload) return;
    await runExtraction(cachedUpload, drawAlias);
  };

  const saveBulkFixtures = async () => {
    if (draftFixtures.length === 0) return;
    setIsSaving(true);
    const payload = draftFixtures.map(f => ({
      team_id: teamId,
      opponent: f.opponent,
      match_date: f.match_date,
      start_time: f.start_time || null,
      location: f.location || null,
      notes: f.notes || null,
    }));
    const { error } = await supabase.from("fixtures").insert(payload);
    setIsSaving(false);
    if (error) alert(error.message);
    else { setDraftFixtures([]); onSuccess(); }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm relative animate-in fade-in slide-in-from-top-4 mb-4">
      <button onClick={onDismiss} className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
        <i className="fa-solid fa-xmark"></i>
      </button>
      
      <div className="flex items-center gap-4 mb-4">
        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-500 rounded-xl flex items-center justify-center shrink-0">
          <i className="fa-solid fa-calendar-days"></i>
        </div>
        <div>
          <h3 className="font-black text-sm text-zinc-900 dark:text-white">Add Fixtures</h3>
          <p className="text-xs text-zinc-500">Give the draw to dAIve.</p>
        </div>
      </div>

      {needsAlias ? (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 animate-in fade-in zoom-in-95">
          <h4 className="font-bold text-amber-800 dark:text-amber-400 text-xs mb-2">We couldn't find matches for "{teamName}"</h4>
          <p className="text-[10px] text-amber-700 dark:text-amber-500 mb-3">Is your team listed under a different name or division on the draw?</p>
          <input type="text" placeholder="e.g. Division 2, or FP United" value={drawAlias} onChange={(e) => setDrawAlias(e.target.value)} className="w-full bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none mb-3" />
          <button onClick={handleRetryWithAlias} disabled={isExtracting || !drawAlias.trim()} className="w-full bg-amber-600 hover:bg-amber-500 text-white rounded-lg py-2 font-bold text-xs shadow-sm transition-colors disabled:opacity-50">
            {isExtracting ? "Scanning..." : "Retry Scan"}
          </button>
        </div>
      ) : draftFixtures.length === 0 ? (
        isExtracting ? (
          <div className="flex flex-col items-center justify-center py-8 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
            <i className="fa-solid fa-microchip text-4xl text-emerald-500 animate-pulse mb-4"></i>
            <p className="font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 animate-pulse text-[10px] text-center">{loadingText}</p>
          </div>
        ) : (
          <div className="relative group border-2 border-dashed border-emerald-500/50 dark:border-emerald-600/50 rounded-xl p-6 text-center hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors bg-zinc-50 dark:bg-zinc-800 cursor-pointer">
            <input type="file" accept="image/*,.csv,.pdf" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            <div className="w-12 h-12 mx-auto bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm">
              <i className="fa-solid fa-wand-magic-sparkles text-xl text-emerald-600 dark:text-emerald-500"></i>
            </div>
            <h3 className="font-black tracking-widest text-xs text-emerald-800 dark:text-emerald-400 mb-1">GIVE IT TO dAIve</h3>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Upload Draw (PDF/IMG/CSV)</p>
          </div>
        )
      ) : (
        <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-zinc-900 dark:bg-black px-4 py-3 flex justify-between items-center text-white rounded-t-xl shrink-0">
            <span className="font-black text-[10px] uppercase tracking-widest">Review Fixtures</span>
            <button onClick={() => setDraftFixtures([])} className="text-[10px] text-emerald-400 hover:text-emerald-300">Start Over</button>
          </div>
          <div className="overflow-y-auto p-2 space-y-2 max-h-[30vh] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-b-xl border-t-0 mt-0">
            {draftFixtures.map((f, i) => (
              <div key={i} className="flex flex-col gap-2 bg-white dark:bg-zinc-900 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <div className="flex gap-2">
                  <input type="text" value={f.opponent} onChange={(e) => { const n=[...draftFixtures]; n[i].opponent=e.target.value; setDraftFixtures(n); }} className="flex-1 min-w-0 px-2 py-1 text-xs bg-zinc-50 dark:bg-zinc-800 rounded border-none outline-none font-bold text-zinc-900 dark:text-white" />
                  <input type="date" value={f.match_date} onChange={(e) => { const n=[...draftFixtures]; n[i].match_date=e.target.value; setDraftFixtures(n); }} className="w-28 min-w-0 px-2 py-1 text-xs bg-zinc-50 dark:bg-zinc-800 rounded border-none outline-none text-zinc-900 dark:text-white" />
                </div>
              </div>
            ))}
          </div>
          <button onClick={saveBulkFixtures} disabled={isSaving} className="w-full py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50">
            {isSaving ? "Saving..." : `Import ${draftFixtures.length} Matches`}
          </button>
        </div>
      )}
    </div>
  );
}
