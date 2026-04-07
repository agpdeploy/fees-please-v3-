"use client";

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed', platform: string }>;
  prompt(): Promise<void>;
}

export default function InstallPrompt() {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // 0. ALWAYS Register Service Worker first (Required for PWA)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }

    // 1. DESKTOP CHECK: If it's a mouse-user (fine pointer), don't auto-show
    const isMobile = window.matchMedia('(pointer: coarse)').matches;
    if (!isMobile) return;

    // 2. RECENT DISMISSAL CHECK
    const lastDismissed = localStorage.getItem('pwa_prompt_dismissed_at');
    if (lastDismissed) {
      const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - parseInt(lastDismissed) < sevenDaysInMs) return;
    }

    // 3. Standalone Check
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(checkStandalone);
    if (checkStandalone) return;

    // 4. iOS Logic
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);
    if (isIOSDevice) {
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // 5. Android/Chrome Logic
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault(); 
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // CUSTOM EVENT: Listen for a manual trigger from your menu
    const handleManualTrigger = () => setShowPrompt(true);
    window.addEventListener('triggerPWAInstall', handleManualTrigger);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('triggerPWAInstall', handleManualTrigger);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setShowPrompt(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa_prompt_dismissed_at', Date.now().toString());
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[150] animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-zinc-900 border border-zinc-700 shadow-2xl rounded-2xl p-4 flex items-center gap-4">
        <div className="w-10 h-10 shrink-0">
          <img src="/icon-192.png" alt="Icon" className="w-full h-full rounded-xl" />
        </div>
        <div className="flex-1">
          <h3 className="text-white text-sm font-black uppercase">Install Fees Please</h3>
          <p className="text-zinc-400 text-[10px] uppercase font-bold mt-0.5">
            {isIOS ? 'Tap Share > Add to Home Screen' : 'Add to your device for easy access'}
          </p>
        </div>
        {!isIOS && (
          <button onClick={handleInstallClick} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase">
            Install
          </button>
        )}
        <button onClick={handleDismiss} className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center">
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
      {isIOS && <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-zinc-900 border-b border-r border-zinc-700 rotate-45"></div>}
    </div>
  );
}