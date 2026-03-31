"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

interface ClubContextType {
  activeClubId: string | null;
  setActiveClubId: (id: string | null) => void;
  themeColor: string;
}

const ClubContext = createContext<ClubContextType | undefined>(undefined);

export function ClubProvider({ children }: { children: ReactNode }) {
  const [activeClubId, setActiveClubId] = useState<string | null>(null);
  const [themeColor, setThemeColor] = useState('#10b981'); 

  useEffect(() => {
    // browser-only safe check
    const adminSelectedClub = localStorage.getItem('activeClubId');
    const captainFixedClub = localStorage.getItem('captainClubId');
    const targetClubId = adminSelectedClub || captainFixedClub;

    if (targetClubId) {
      setActiveClubId(targetClubId);
      supabase.from('clubs').select('theme_color').eq('id', targetClubId).single()
        .then(({ data }) => {
          if (data?.theme_color) setThemeColor(data.theme_color);
        });
    }
  }, []);

  return (
    <ClubContext.Provider value={{ activeClubId, setActiveClubId: (id) => { 
      setActiveClubId(id);
      if (id) localStorage.setItem('activeClubId', id);
      else localStorage.removeItem('activeClubId');
    }, themeColor }}>
      {/* CLEAN CSS: ONLY defines the brand classes, does NOT hijack emerald/green */}
      <style dangerouslySetInnerHTML={{__html: `
        :root { --club-theme: ${themeColor}; }
        .text-brand { color: var(--club-theme) !important; }
        .bg-brand { background-color: var(--club-theme) !important; }
        .border-brand { border-color: var(--club-theme) !important; }
      `}} />
      {children}
    </ClubContext.Provider>
  );
}

export function useActiveClub() {
  const context = useContext(ClubContext);
  if (context === undefined) throw new Error('useActiveClub error');
  return context;
}