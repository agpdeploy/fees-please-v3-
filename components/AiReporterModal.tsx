"use client";

import { useState, useEffect } from "react";

interface AiReporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  fixture: any;
  squad: any[];
  themeColor: string;
  teamName: string; // Accepts the dynamic team name from Gameday.tsx
}

export default function AiReporterModal({ isOpen, onClose, fixture, squad, themeColor, teamName }: AiReporterModalProps) {
  const [image, setImage] = useState<File | null>(null);
  const [character, setCharacter] = useState("OUTBACK_EXPERT"); // Default to Rusty
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");

  // --- DYNAMIC LOADING MESSAGES ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      let messages: string[] = [];
      
      if (character === 'OUTBACK_EXPERT') {
        messages = [
          "Looking for the snake bite kit...", 
          "Checking the radiator levels...", 
          "Wrestling a rogue bin chicken...", 
          "Sparking up the camp oven...",
          "Decoding the scorebook..."
        ];
      } else if (character === 'CLUB_VETERAN') {
        messages = [
          "Stretching the hammies...", 
          "Complaining about the umpire...", 
          "Checking the price of a meat pie...", 
          "Reminiscing about the 1998 Grand Final...",
          "Squinting at the run rate..."
        ];
      } else if (character === 'THE_ENFORCER') {
        messages = [
          "Counting the gold coins...", 
          "Checking the Square reader...", 
          "Yelling at the stragglers...", 
          "Slicing the half-time oranges...",
          "Tallying up the wickets..."
        ];
      }
      
      let i = 0;
      setLoadingText(messages[0]);
      
      interval = setInterval(() => {
        i++;
        if (i < messages.length) {
          setLoadingText(messages[i]);
        } else {
          setLoadingText("Still analyzing... the handwriting is terrible...");
        }
      }, 2500); // Change text every 2.5 seconds
    }
    
    return () => clearInterval(interval);
  }, [loading, character]);

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
      const base64Data = await compressImage(image);

      const context = {
        competition: fixture?.notes || "Indoor Cricket Season",
        teamName: teamName, 
        opponent: fixture?.opponent || "The Opposition",
        roster: squad.length > 0 
          ? squad.map(p => p.nickname || p.first_name).join(", ") 
          : "Names currently being finalized in the Fees Please app."
      };

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
      setReport(`Blimey! The news wire is down. Error: ${err.message}`);
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
      navigator.clipboard.writeText(report);
      alert("Report copied to clipboard!");
    }
  };

  // --- MARKDOWN FORMATTER ---
  // Converts "**Text**" into bold HTML tags safely for React
  const formatReportText = (text: string) => {
    return text.split('\n').map((line, index) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <span key={index} className="block mb-3">
          {parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={i} className="font-black text-zinc-900 dark:text-white">{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
        </span>
      );
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[300] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#111] w-full max-w-md rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header - shrink-0 keeps it attached to the top */}
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-black italic uppercase tracking-tighter" style={{ color: themeColor }}>Match Reporter</h2>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Powered by Gemini Flash</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"><i className="fa-solid fa-xmark text-xl"></i></button>
        </div>

        {/* Scrollable Body - flex-1 prevents pushing the footer off screen! */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Character Selection */}
          {!loading && !report && (
            <div className="flex gap-2">
              {[
                { id: 'OUTBACK_EXPERT', label: 'Rusty (Outback)' },
                { id: 'CLUB_VETERAN', label: 'Gaz (Veteran)' },
                { id: 'THE_ENFORCER', label: 'Shazza (Treasurer)' }
              ].map((char) => (
                <button 
                  key={char.id}
                  onClick={() => setCharacter(char.id)}
                  className={`flex-1 py-3 px-1 rounded-2xl text-[9px] font-black uppercase tracking-widest border transition-all ${character === char.id ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white' : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800'}`}
                >
                  {char.label}
                </button>
              ))}
            </div>
          )}

          {/* File Upload */}
          {!loading && !report && (
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

          {/* Loading State Output */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-10 space-y-6 animate-in fade-in duration-500">
              <i className="fa-solid fa-microphone-lines text-4xl animate-pulse" style={{ color: themeColor }}></i>
              <p className="text-xs font-black uppercase tracking-widest text-zinc-500 text-center px-4 animate-pulse">
                {loadingText}
              </p>
            </div>
          )}

          {/* Generated Report Output */}
          {report && !loading && (
            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-5 rounded-3xl animate-in fade-in slide-in-from-bottom-4">
              <div className="text-sm font-medium leading-relaxed italic text-zinc-800 dark:text-zinc-200">
                {formatReportText(report)}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions - shrink-0 keeps it locked to the bottom */}
        <div className="p-6 bg-zinc-50 dark:bg-[#151515] border-t border-zinc-100 dark:border-zinc-800 shrink-0">
          {!report && !loading ? (
            <button 
              onClick={handleGenerate}
              disabled={!image}
              className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm text-white shadow-lg active:scale-95 transition-all disabled:opacity-50"
              style={{ backgroundColor: themeColor }}
            >
              Generate Report
            </button>
          ) : !loading ? (
            <div className="flex gap-3 animate-in fade-in">
              <button onClick={() => setReport("")} className="flex-1 py-4 rounded-2xl bg-zinc-200 dark:bg-zinc-800 font-black uppercase tracking-widest text-[10px] text-zinc-600 dark:text-zinc-400">Retry</button>
              <button onClick={handleShare} className="flex-[2] py-4 rounded-2xl text-white font-black uppercase tracking-widest text-sm shadow-lg" style={{ backgroundColor: themeColor }}>
                <i className="fa-solid fa-share-nodes mr-2"></i> Share Report
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}