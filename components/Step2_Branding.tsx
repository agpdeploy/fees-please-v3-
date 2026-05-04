// components/Step2_Branding.tsx
"use client";

import { useState } from "react";
import { supabase } from '@/lib/supabase';

export default function Step2_Branding({ onNext, clubId }: { onNext: () => void, clubId: string }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Using your exact compression logic from Setup.tsx
  const cropAndCompressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const size = Math.min(img.width, img.height);
          canvas.width = 300; canvas.height = 300;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject("Canvas error");
          const startX = (img.width - size) / 2; const startY = (img.height - size) / 2;
          ctx.drawImage(img, startX, startY, size, size, 0, 0, 300, 300);
          canvas.toBlob((blob) => {
            if (!blob) return reject("Blob error");
            resolve(new File([blob], "logo.webp", { type: "image/webp" }));
          }, "image/webp", 0.8);
        };
      };
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clubId) return;

    setIsUploading(true);
    setError(null);

    try {
      const processedFile = await cropAndCompressImage(file);
      const fileName = `${clubId}-${Math.random()}.webp`;

      // Upload to Storage (Just like Setup.tsx)
      const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, processedFile);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
      
      // Set the URL in state (Just like Setup.tsx)
      setLogoUrl(data.publicUrl);
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const saveAndContinue = async () => {
    if (!logoUrl) return onNext(); // Skip if no logo

    setIsSaving(true);
    try {
      // IMPORTANT: Updating the CLUBS table, just like Setup.tsx
      const { error: dbError } = await supabase
        .from("clubs")
        .update({ logo_url: logoUrl })
        .eq("id", clubId);

      if (dbError) throw dbError;
      onNext();
    } catch (err: any) {
      setError("Database save failed: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-8 items-center justify-center text-center space-y-8 bg-zinc-50">
      <div>
        <h2 className="text-3xl font-black tracking-tight text-zinc-900 uppercase italic">Make it Official</h2>
        <p className="text-zinc-500 mt-2">Upload your club logo.</p>
      </div>

      {error && <div className="text-red-500 text-xs font-bold bg-red-50 p-2 rounded border border-red-200">{error}</div>}

      <div className="relative group">
        <div className={`w-48 h-48 rounded-full border-4 flex items-center justify-center overflow-hidden bg-white shadow-xl transition-all ${logoUrl ? 'border-emerald-500' : 'border-dashed border-zinc-300 group-hover:border-emerald-400'}`}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <i className={`fa-solid fa-camera-retro text-5xl text-zinc-300 ${isUploading ? 'animate-spin' : ''}`}></i>
          )}
        </div>
        <input type="file" accept="image/*" onChange={handleUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
      </div>

      <div className="w-full max-w-xs pt-4">
        <button 
          onClick={saveAndContinue}
          disabled={isUploading || isSaving}
          className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-emerald-700 shadow-md active:scale-95 transition-all disabled:opacity-50"
        >
          {isSaving ? "Saving..." : (logoUrl ? "Save & Continue" : "Skip for now")}
        </button>
      </div>
    </div>
  );
}