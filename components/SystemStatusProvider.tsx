"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';

interface SystemStatusContextType {
  isOffline: boolean;
}

const SystemStatusContext = createContext<SystemStatusContextType>({ isOffline: false });

export function SystemStatusProvider({ children }: { children: ReactNode }) {
  const [isOffline, setIsOffline] = useState(false);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    // Store original fetch to intercept calls
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        
        // Supabase returns 503 when the project is paused
        if (!response.ok && response.status === 503) {
          const urlStr = args[0] ? args[0].toString() : '';
          if (urlStr.includes('supabase.co') || urlStr.includes('supabase.in')) {
            setIsOffline(true);
          }
        }
        return response;
      } catch (error: any) {
        // Paused projects often fail DNS resolution completely resulting in Failed to fetch
        const urlStr = args[0] ? args[0].toString() : '';
        if ((urlStr.includes('supabase.co') || urlStr.includes('supabase.in')) && 
            (error.message?.includes('Failed to fetch') || error.name === 'TypeError' || error.message?.includes('NetworkError'))) {
          setIsOffline(true);
        }
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // Polling mechanism to auto-recover when DB wakes up
  useEffect(() => {
    if (!isOffline) return;

    const checkStatus = async () => {
      if (isCheckingRef.current) return;
      isCheckingRef.current = true;
      
      try {
        // Ping the root REST endpoint which is lightweight and requires no specific table permissions
        const res = await window.fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
          method: 'GET',
          headers: { 
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            'Cache-Control': 'no-cache' 
          }
        });
        
        if (res.ok) {
          setIsOffline(false);
        }
      } catch (e) {
        // Still down, do nothing
      } finally {
        isCheckingRef.current = false;
      }
    };

    // Check immediately, then every 10 seconds
    checkStatus();
    const intervalId = setInterval(checkStatus, 10000);

    return () => clearInterval(intervalId);
  }, [isOffline]);

  if (isOffline) {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col items-center justify-center p-6 text-center text-zinc-100">
        <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
          <i className="fa-solid fa-server text-3xl animate-pulse"></i>
        </div>
        <h1 className="text-2xl font-black uppercase tracking-widest mb-3">Waking up the Server</h1>
        <p className="text-zinc-400 max-w-md leading-relaxed mb-8">
          Our database was taking a quick nap and is currently spinning back up. This usually takes about <strong className="text-emerald-400">60 to 90 seconds</strong>.
        </p>
        
        <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-4 py-2 rounded-lg">
          <i className="fa-solid fa-circle-notch fa-spin"></i>
          Waiting for connection...
        </div>
      </div>
    );
  }

  return (
    <SystemStatusContext.Provider value={{ isOffline }}>
      {children}
    </SystemStatusContext.Provider>
  );
}

export const useSystemStatus = () => useContext(SystemStatusContext);
