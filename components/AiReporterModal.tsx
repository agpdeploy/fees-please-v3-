"use client";

import { useState } from "react";

interface AiReporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  fixture: any;
  squad: any[];
  themeColor: string;
}

export default function AiReporterModal({ isOpen, onClose, fixture, squad, themeColor }: AiReporterModalProps) {
  const [image, setImage] = useState<File | null>(null);
  const [character, setCharacter] = useState("BURGUNDY");
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // --- COMPRESSION HELPER ---
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          // Shrink to 800px - plenty for AI to read, but tiny file size
          const MAX_WIDTH = 800; 
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          }
          
          // Lower quality to 0.6 (60%) - this drastically reduces MBs
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleGenerate = async () => {
    if (!image) return alert("Please upload a scorebook photo first!");
    
    setLoading(true);
    setReport("");

    try {
      // 1. Convert Image to Base64 USING THE COMPRESSION HELPER
      const base64Data = await compressImage(image);

      // 2. Prepare the context from your existing Gameday state
      const context = {
        competition: fixture?.notes || "Regular Season Match",
        teamName: "Our Team", // You can pull this from activeClub context later
        opponent: fixture?.opponent || "TBA",
        roster: squad.map(p => p.nickname || p.first_name).join(", ")
      };

      // 3. Call the API we made
      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64Data, character, context }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Server responded with an error");
      }

      if (data.report) {
        setReport(data.report);
      } else {
        throw new Error("No report returned");
      }
    } catch (err: any) {
      console.error(err);
      setReport(`Great Odin's Raven! The news wire is down. Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Match Report',
          text: report,
        });
      } catch (err) {
        console.log("Share failed", err);
      }
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(report);
      alert("Report copied to clipboard!");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[300] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#111] w-full max-w-md rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black italic uppercase tracking-tighter" style={{ color: themeColor }}>Match Reporter</h2>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Powered by Gemini Flash</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"><i className="fa-solid fa-xmark text-xl"></i></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Character Selection */}
          <div className="flex gap-2">
            {['BURGUNDY', 'DREBIN'].map((char) => (
              <button 
                key={char}
                onClick={() => setCharacter(char)}
                className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${character === char ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800'}`}
              >
                {char === 'BURGUNDY' ? 'Ron Burgundy' : 'Frank Drebin'}
              </button>
            ))}
          </div>

          {/* File Upload */}
          {!report && (
            <div className="relative group">
              <input 
                type="file" 
                accept="image/*" 
                onChange={(e) => setImage(e.target.files?.[0] || null)} 
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
              />
              <div className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center group-hover:border-zinc-400 dark:group-hover:border-zinc-600 transition-colors">
                <i className={`fa-solid ${image ? 'fa-file-image text-emerald-500' : 'fa-camera text-zinc-400'} text-3xl mb-3`}></i>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                  {image ? image.name : 'Upload Scorebook'}
                </p>
              </div>
            </div>
          )}

          {/* Generated Report Output */}
          {report && (
            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-5 rounded-3xl animate-in fade-in slide-in-from-bottom-4">
              <p className="text-sm font-medium leading-relaxed italic text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
                "{report}"
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-zinc-50 dark:bg-[#151515] border-t border-zinc-100 dark:border-zinc-800">
          {!report ? (
            <button 
              onClick={handleGenerate}
              disabled={loading || !image}
              className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm text-white shadow-lg active:scale-95 transition-all disabled:opacity-50"
              style={{ backgroundColor: themeColor }}
            >
              {loading ? <i className="fa-solid fa-circle-notch animate-spin"></i> : 'Generate Report'}
            </button>
          ) : (
            <div className="flex gap-3">
              <button onClick={() => setReport("")} className="flex-1 py-4 rounded-2xl bg-zinc-200 dark:bg-zinc-800 font-black uppercase tracking-widest text-[10px] text-zinc-600 dark:text-zinc-400">Retry</button>
              <button onClick={handleShare} className="flex-[2] py-4 rounded-2xl text-white font-black uppercase tracking-widest text-sm shadow-lg" style={{ backgroundColor: themeColor }}>
                <i className="fa-solid fa-share-nodes mr-2"></i> Share Report
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}