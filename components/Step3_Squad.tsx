"use client";

import { useState, useEffect } from "react";
import { supabase } from '@/lib/supabase';

// Added nickname to the interface
interface DraftPlayer {
  firstName: string;
  lastName: string;
  nickname: string;
  email: string;
  mobile: string;
}

export default function Step3_Squad({ onNext, clubId }: { onNext: () => void, clubId: string }) {
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [players, setPlayers] = useState<DraftPlayer[]>([]);
  // We only need upload and review modes now
  const [mode, setMode] = useState<'upload' | 'review'>('upload');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
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
  }, [loading]);

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

    // --- SECURITY GUARDRAIL ---
    const dangerousExtensions = /\.(exe|bat|cmd|sh|js|ts|html|htm|php|py|vbs|ps1)$/i;
    if (dangerousExtensions.test(file.name)) {
      e.target.value = ''; 
      return alert(`Security Block: .${file.name.split('.').pop()?.toUpperCase()} files are strictly prohibited.`);
    }

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      e.target.value = ''; 
      return alert("Please save your Excel file as a CSV or PDF first.");
    }
    // --------------------------

    setLoading(true);
    setMode('review'); 

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
        setPlayers(data.players.map((p: any) => ({
          firstName: p.firstName || p.first_name || p.name?.split(' ')[0] || "",
          lastName: p.lastName || p.last_name || p.name?.split(' ').slice(1).join(' ') || "",
          nickname: p.nickname || "",
          email: p.email || p.emailAddress || p.email_address || "",
          mobile: p.mobile || p.mobile_number || p.phone || p.phoneNumber || p.phone_number || "",
        })));
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error("Failed to extract:", error);
      alert("Couldn't parse the file data. Switching to manual entry!");
      setMode('review');
      setPlayers([{ firstName: "", lastName: "", nickname: "", email: "", mobile: "" }]);
    } finally {
      setLoading(false);
      e.target.value = ''; // Reset input
    }
  };

  const addManualPlayer = () => {
    setPlayers([...players, { firstName: "", lastName: "", nickname: "", email: "", mobile: "" }]);
  };

  const updatePlayer = (index: number, field: keyof DraftPlayer, value: string) => {
    const updated = [...players];
    updated[index][field] = value;
    setPlayers(updated);
  };

  const removePlayer = (index: number) => {
    setPlayers(players.filter((_, i) => i !== index));
  };

  const saveRoster = async () => {
    const validPlayers = players.filter(p => p.firstName.trim() !== "");
    if (validPlayers.length === 0) {
      onNext();
      return;
    }
    
    setIsSaving(true);
    try {
      const { data: team } = await supabase.from('teams').select('id').eq('club_id', clubId).single();
      const teamId = team ? team.id : null;

      const playersToInsert = validPlayers.map(p => ({
        default_team_id: teamId,
        club_id: clubId,
        first_name: p.firstName,
        last_name: p.lastName,
        nickname: p.nickname || null,
        email: p.email || null,
        mobile_number: p.mobile || null,
        is_member: true
      }));

      const { error } = await supabase.from('players').insert(playersToInsert);
      if (error) throw error;
      onNext(); 
    } catch (err) {
      alert("An unexpected error occurred while saving.");
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-8 bg-zinc-50 overflow-y-auto">
      <div className="text-center mb-8 shrink-0">
        <h2 className="text-3xl font-black tracking-tight text-zinc-900 uppercase italic">Build Your Squad</h2>
        <p className="text-zinc-500 mt-2">Add your players. You can always edit this later.</p>
      </div>

      {mode === 'upload' && !loading && (
        <>
          <div className="relative group border-2 border-dashed border-emerald-500 rounded-3xl p-10 text-center hover:bg-emerald-50 transition-colors bg-white shadow-sm cursor-pointer mx-auto w-full max-w-lg">
            <input type="file" accept="image/*,.csv,.pdf" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            
            {/* dAIve UI */}
            <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-wand-magic-sparkles text-4xl text-emerald-600"></i>
            </div>
            <h3 className="font-black uppercase tracking-widest text-emerald-800 text-lg mb-1">Give it to dAIve</h3>
            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Auto-Extract PDF, CSV, or Image</p>
          </div>
          <div className="mt-8 text-center">
             <button 
                onClick={() => { 
                  setMode('review'); 
                  setPlayers([{ firstName: "", lastName: "", nickname: "", email: "", mobile: "" }]); 
                }} 
                className="text-xs font-bold text-zinc-400 uppercase tracking-widest hover:text-emerald-600 transition-colors underline"
              >
               Skip upload and add manually
             </button>
          </div>
        </>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-500">
          <i className="fa-solid fa-microchip text-5xl text-emerald-500 animate-pulse mb-6"></i>
          <p className="font-black uppercase tracking-widest text-zinc-600 animate-pulse text-sm text-center">{loadingText}</p>
        </div>
      )}

      {mode === 'review' && !loading && (
        <div className="w-full max-w-2xl mx-auto flex flex-col h-full pb-10 animate-in slide-in-from-bottom-4 fade-in">
          
          <button 
            onClick={() => { setMode('upload'); setPlayers([]); }} 
            className="self-start mb-4 text-xs font-bold text-zinc-400 hover:text-emerald-600 uppercase tracking-widest transition-colors flex items-center"
          >
            <i className="fa-solid fa-arrow-left mr-2"></i> Try Upload Again
          </button>

          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex-1 flex flex-col">
            <div className="bg-zinc-900 px-4 py-3 flex justify-between items-center text-white shrink-0">
              <span className="font-black text-xs uppercase tracking-widest">Review Players</span>
              <button onClick={addManualPlayer} className="text-emerald-400 hover:text-emerald-300 text-xs font-bold uppercase tracking-widest"><i className="fa-solid fa-plus mr-1"></i> Row</button>
            </div>
            
            <div className="overflow-y-auto p-3 space-y-3 flex-1 max-h-[45vh] bg-zinc-50">
              {players.map((p, i) => (
                <div key={i} className="flex flex-col gap-2 bg-white p-3 rounded-xl border border-zinc-200 shadow-sm relative">
                  <button onClick={() => removePlayer(i)} className="absolute top-2 right-2 text-zinc-400 hover:text-red-500 transition-colors w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-50"><i className="fa-solid fa-xmark"></i></button>
                  
                  {/* min-w-0 applied to fix overflow, matching PlayersTab styling */}
                  <div className="flex gap-2 pr-6">
                    <input type="text" placeholder="First" value={p.firstName} onChange={(e) => updatePlayer(i, 'firstName', e.target.value)} className="flex-1 min-w-0 px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 transition-colors" />
                    <input type="text" placeholder="Last" value={p.lastName} onChange={(e) => updatePlayer(i, 'lastName', e.target.value)} className="flex-1 min-w-0 px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 transition-colors" />
                    <input type="text" placeholder="Nickname" value={p.nickname} onChange={(e) => updatePlayer(i, 'nickname', e.target.value)} className="flex-1 min-w-0 px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 transition-colors" />
                  </div>
                  <div className="flex gap-2 pr-6">
                    <input type="tel" placeholder="Mobile" value={p.mobile} onChange={(e) => updatePlayer(i, 'mobile', e.target.value)} className="flex-[0.8] min-w-0 px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 transition-colors" />
                    <input type="email" placeholder="Email" value={p.email} onChange={(e) => updatePlayer(i, 'email', e.target.value)} className="flex-1 min-w-0 px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:border-emerald-500 text-zinc-900 transition-colors" />
                  </div>
                </div>
              ))}
              {players.length === 0 && <div className="text-center py-6 text-zinc-400 text-xs font-bold uppercase tracking-widest">No players extracted</div>}
            </div>
          </div>

          <div className="mt-6 shrink-0 space-y-4">
            
            {/* Implied Consent Banner */}
            <div className="flex items-start gap-3 p-3 border border-emerald-200 bg-emerald-50 rounded-xl transition-colors">
              <i className="fa-solid fa-shield-halved text-emerald-600 mt-0.5 shrink-0"></i>
              <p className="text-[11px] text-zinc-700 font-bold leading-relaxed m-0">
                By importing, you confirm you are authorised to provide contact details for these individuals and they consent to being contacted regarding team activities and fees.
              </p>
            </div>

            <button 
              onClick={saveRoster}
              disabled={isSaving || players.length === 0}
              className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors shadow-md disabled:opacity-50 active:scale-95"
            >
              {isSaving ? "Saving Profiles..." : `Import ${players.filter(p => p.firstName.trim() !== "").length} Players`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}