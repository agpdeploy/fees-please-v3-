"use client";

import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true); // Default to true to prevent flash
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
    
    // 1. Check if they are already using the installed app
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(checkStandalone);

    if (checkStandalone) return;

    // 2. iOS Detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    // If iOS, just show the prompt after a few seconds
    if (isIOSDevice) {
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // 3. Android Detection (Intersects the native install prompt)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault(); // Stop Chrome from showing the ugly default banner
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[150] animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-zinc-900 border border-zinc-700 shadow-2xl rounded-2xl p-4 flex items-center gap-4">
        
        <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center shrink-0">
          <i className="fa-solid fa-download text-lg"></i>
        </div>
        
        <div className="flex-1">
          <h3 className="text-white text-sm font-black uppercase tracking-wide">Install App</h3>
          {isIOS ? (
            <p className="text-zinc-400 text-[10px] uppercase font-bold tracking-widest mt-0.5">
              Tap <i className="fa-solid fa-arrow-up-from-bracket mx-1"></i> then "Add to Home Screen"
            </p>
          ) : (
            <p className="text-zinc-400 text-[10px] uppercase font-bold tracking-widest mt-0.5">
              Install Fees Please to your device
            </p>
          )}
        </div>

        {!isIOS && (
          <button 
            onClick={handleInstallClick}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
          >
            Install
          </button>
        )}

        <button onClick={handleDismiss} className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors shrink-0">
          <i className="fa-solid fa-xmark"></i>
        </button>

      </div>
      
      {/* iOS Arrow indicator pointing down to the safari menu bar */}
      {isIOS && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-zinc-900 border-b border-r border-zinc-700 rotate-45"></div>
      )}
    </div>
  );
}