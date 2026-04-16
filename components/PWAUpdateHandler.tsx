"use client";

import { useEffect, useState } from "react";

export default function PWAUpdateHandler() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only run in the browser and if service workers are supported
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      (window as any).serwist !== undefined // Bypass TS strictness
    ) {
      const sw = (window as any).serwist; // Bypass TS strictness

      // Listen for the "waiting" service worker (the new version)
      sw.addEventListener("installed", (event: any) => {
        if (event.isUpdate) {
          setShow(true);
        }
      });
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[999] animate-in slide-in-from-bottom-10">
      <div className="bg-zinc-900 dark:bg-white text-white dark:text-black p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 border border-emerald-500/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center animate-pulse">
            <i className="fa-solid fa-cloud-arrow-down text-xs"></i>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest">Update Available</p>
            <p className="text-[10px] font-bold opacity-70">Tap to refresh for the latest features.</p>
          </div>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-colors"
        >
          Update
        </button>
      </div>
    </div>
  );
}