"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface AiReporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  fixture: any;
  squad: any[];
  themeColor: string;
  teamName: string;
  reportsGenerated: number;       // <-- Make sure this is here!
  onReportIncrement: () => void;  // <-- Make sure this is here!
}

export default function AiReporterModal({ isOpen, onClose, fixture, squad, themeColor, teamName }: AiReporterModalProps) {
  const [mounted, setMounted] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [character, setCharacter] = useState("OUTBACK_EXPERT");
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");

  useEffect(() => {
    setMounted(true); 
  }, []);

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
      } else if (character === 'SUBURBAN_MUM') {
        messages = [
          "Pouring a generous glass of Cardonnay...", 
          "Saying 'Look at moy' to the umpire...", 
          "Adjusting her statement earrings...", 
          "Admiring her new activewear...",
          "Gossiping with the scorers..."
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
      }, 2500); 
    }
    
    return () => clearInterval(interval);
  }, [loading, character]);

  if (!isOpen || !mounted) return null;

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
    // Convert Markdown bold (**) to WhatsApp bold (*)
    const shareText = report.replace(/\*\*/g, '*');

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Match Report',
          text: shareText,
        });
      } catch (err) {
        console.log("Share failed", err);
      }
    } else {
      navigator.clipboard.writeText(shareText);
      alert("Report copied to clipboard!");
    }
  };

  const formatReportText = (text: string) => {
    return text.split('\n').map((line, index) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <span key={index} className="block mb-2">
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

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 transition-all">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center shrink-0 bg-white dark:bg-zinc-900">
          <div>
            <h2 className="text-xl font-black italic uppercase tracking-tighter" style={{ color: themeColor }}>Match Reporter</h2>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Powered by Gemini</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors w-8 h-8 flex items-center justify-center rounded-full bg-zinc-50 dark:bg-zinc-800">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Character Selection */}
          {!loading && !report && (
            <div className="flex gap-2">
              {[
                { id: 'OUTBACK_EXPERT', label: 'Rusty' },
                { id: 'CLUB_VETERAN', label: 'Gaz' },
                { id: 'SUBURBAN_MUM', label: 'Shazza' }
              ].map((char) => (
                <button 
                  key={char.id}
                  onClick={() => setCharacter(char.id)}
                  className={`flex-1 py-3 px-1 rounded-2xl text-[9px] font-black uppercase tracking-widest border transition-all ${character === char.id ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white shadow-md' : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
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
              <div className={`border-2 border-dashed rounded-3xl p-10 text-center transition-colors ${image ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 group-hover:border-zinc-400 dark:group-hover:border-zinc-500'}`}>
                <i className={`fa-solid ${image ? 'fa-file-image text-emerald-600 dark:text-emerald-500' : 'fa-camera text-zinc-400 dark:text-zinc-500'} text-3xl mb-3 transition-colors`}></i>
                <p className={`text-xs font-bold uppercase tracking-widest ${image ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-500'}`}>
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
            <div className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-5 rounded-2xl animate-in fade-in slide-in-from-bottom-4 shadow-inner">
              <div className="text-sm font-medium leading-relaxed text-zinc-800 dark:text-zinc-300">
                {formatReportText(report)}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
          {!report && !loading ? (
            <button 
              onClick={handleGenerate}
              disabled={!image}
              className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm text-white shadow-md active:scale-95 transition-all disabled:opacity-50"
              style={{ backgroundColor: themeColor }}
            >
              Generate Report
            </button>
          ) : !loading ? (
            <div className="flex gap-3 animate-in fade-in">
              <button onClick={() => setReport("")} className="flex-1 py-4 rounded-2xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors font-black uppercase tracking-widest text-[10px] text-zinc-600 dark:text-zinc-400 shadow-sm">Retry</button>
              <button onClick={handleShare} className="flex-[2] py-4 rounded-2xl text-white font-black uppercase tracking-widest text-sm shadow-md transition-transform active:scale-95" style={{ backgroundColor: themeColor }}>
                <i className="fa-solid fa-share-nodes mr-2"></i> Share Report
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  // --- TELEPORT THE MODAL TO THE BODY ---
  return createPortal(modalContent, document.body);
}