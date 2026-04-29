"use client";

import { useState, useEffect } from "react";
import { supabase } from '@/lib/supabase';

// Updated interface to hold all the data we need
interface DraftPlayer {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
}

export default function Step3_Squad({ onNext, clubId }: { onNext: () => void, clubId: string }) {
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [players, setPlayers] = useState<DraftPlayer[]>([]);
  const [mode, setMode] = useState<'upload' | 'review' | 'manual'>('upload');
  const [isSaving, setIsSaving] = useState(false);
  const [hasConsent, setHasConsent] = useState(false); // LEGAL CONSENT STATE

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
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMode('review'); 

    try {
      const base64Data = await compressImage(file);
      
      const res = await fetch("/api/extract-roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64Data }),
      });

      const data = await res.json();

      if (data.players && Array.isArray(data.players)) {
        setPlayers(data.players);
      } else if (data.names && Array.isArray(data.names)) {
        const mappedPlayers = data.names.map((fullName: string) => {
          const parts = fullName.trim().split(' ');
          return {
            firstName: parts[0] || "",
            lastName: parts.slice(1).join(' ') || "",
            email: "",
            mobile: ""
          };
        });
        setPlayers(mappedPlayers);
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error("Failed to extract:", error);
      alert("Couldn't parse the image data. Switching to manual entry! Error: " + error.message);
      setMode('manual');
    } finally {
      setLoading(false);
    }
  };

  const addManualPlayer = () => {
    setPlayers([...players, { firstName: "", lastName: "", email: "", mobile: "" }]);
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
          <div className="relative group border-2 border-dashed border-emerald-500 rounded-3xl p-16 text-center hover:bg-emerald-50 transition-colors bg-white shadow-sm cursor-pointer mx-auto w-full max-w-lg">
            <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            <i className="fa-solid fa-camera-retro text-5xl text-emerald-600 mb-4 group-hover:scale-110 transition-transform"></i>
            <h3 className="font-black uppercase tracking-widest text-emerald-800">Tap to Upload Roster Image</h3>
          </div>
          <div className="mt-8 text-center">
             <button onClick={() => { setMode('manual'); addManualPlayer(); }} className="text-xs font-bold text-zinc-400 uppercase tracking-widest hover:text-emerald-600 transition-colors underline">
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

      {(mode === 'review' || mode === 'manual') && !loading && (
        <div className="w-full max-w-2xl mx-auto flex flex-col h-full pb-10 animate-in slide-in-from-bottom-4 fade-in">
          
          {/* THE FIX: Back to Upload Button */}
          <button 
            onClick={() => { setMode('upload'); setPlayers([]); }} 
            className="self-start mb-4 text-xs font-bold text-zinc-400 hover:text-emerald-600 uppercase tracking-widest transition-colors flex items-center"
          >
            <i className="fa-solid fa-arrow-left mr-2"></i> Try Upload Again
          </button>

          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex-1 flex flex-col">
            <div className="bg-zinc-900 px-4 py-3 flex justify-between items-center text-white shrink-0">
              <span className="font-black text-xs uppercase tracking-widest">Squad Roster</span>
              <button onClick={addManualPlayer} className="text-emerald-400 hover:text-emerald-300 text-xs font-bold uppercase"><i className="fa-solid fa-plus mr-1"></i> Add Row</button>
            </div>
            
            <div className="overflow-y-auto p-2 space-y-2 flex-1 max-h-[40vh]">
              {players.map((p, i) => (
                <div key={i} className="flex flex-wrap md:flex-nowrap gap-2 bg-zinc-50 p-2 rounded-xl border border-zinc-200 items-center">
                  <input type="text" placeholder="First Name" value={p.firstName} onChange={(e) => updatePlayer(i, 'firstName', e.target.value)} className="flex-1 min-w-[120px] p-2 text-sm border border-zinc-300 rounded-lg outline-none focus:border-emerald-500" />
                  <input type="text" placeholder="Last Name" value={p.lastName} onChange={(e) => updatePlayer(i, 'lastName', e.target.value)} className="flex-1 min-w-[120px] p-2 text-sm border border-zinc-300 rounded-lg outline-none focus:border-emerald-500" />
                  <input type="email" placeholder="Email" value={p.email} onChange={(e) => updatePlayer(i, 'email', e.target.value)} className="flex-1 min-w-[150px] p-2 text-sm border border-zinc-300 rounded-lg outline-none focus:border-emerald-500" />
                  <input type="tel" placeholder="Mobile" value={p.mobile} onChange={(e) => updatePlayer(i, 'mobile', e.target.value)} className="flex-1 min-w-[120px] p-2 text-sm border border-zinc-300 rounded-lg outline-none focus:border-emerald-500" />
                  <button onClick={() => removePlayer(i)} className="p-2 text-red-400 hover:text-red-600"><i className="fa-solid fa-trash-can"></i></button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 shrink-0 space-y-4">
            <label className="flex items-start gap-3 p-4 border border-emerald-200 bg-emerald-50 rounded-xl cursor-pointer">
              <input type="checkbox" checked={hasConsent} onChange={(e) => setHasConsent(e.target.checked)} className="mt-1 w-5 h-5 accent-emerald-600" />
              <span className="text-xs text-zinc-700 font-bold leading-relaxed">
                I confirm that I am authorised to provide the contact details for these individuals and they (or their guardians) have consented to being contacted regarding team activities and fees.
              </span>
            </label>

            <button 
              onClick={saveRoster}
              disabled={isSaving || !hasConsent}
              className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors shadow-md disabled:opacity-50 active:scale-95"
            >
              {isSaving ? "Saving Profiles..." : "Confirm Squad"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}