"use client";

import { useState, useRef, useEffect } from "react";
import { useProfile } from "@/lib/useProfile";
import { useActiveClub } from "@/contexts/ClubContext";

export default function ClubSwitcher() {
  const { profile, roles, loading } = useProfile();
  const { activeClubId, setActiveClubId } = useActiveClub();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown if user clicks outside of it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading || !profile || profile.role === 'super_admin') {
    // Hide for God Mode (they have their own master picker in Setup) or while loading
    return null; 
  }

  // Extract unique clubs from the user's roles ledger
  const uniqueClubs = roles.reduce((acc: any[], role: any) => {
    if (role.clubs && !acc.find(c => c.id === role.clubs.id)) {
      acc.push(role.clubs);
    }
    return acc;
  }, []);

  // If they only belong to one club (or zero), hide the switcher entirely
  if (uniqueClubs.length <= 1) {
    return null;
  }

  const activeClub = uniqueClubs.find(c => c.id === activeClubId) || uniqueClubs[0];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* The trigger button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-4 py-2 rounded-2xl transition-colors w-full sm:w-auto"
      >
        {activeClub?.logo_url ? (
          <img src={activeClub.logo_url} alt="Logo" className="w-8 h-8 rounded-lg object-cover bg-black" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-emerald-500 text-xs font-black">
            {activeClub?.name?.substring(0, 2).toUpperCase() || "??"}
          </div>
        )}
        <div className="text-left flex-1">
          <div className="text-[9px] text-zinc-500 font-black uppercase tracking-widest leading-none mb-0.5">Active Workspace</div>
          <div className="font-black text-white text-sm uppercase tracking-wide leading-none">{activeClub?.name || "Select Club"}</div>
        </div>
        <i className={`fa-solid fa-chevron-down text-zinc-500 text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
      </button>

      {/* The dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full sm:w-64 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-top-2 fade-in">
          <div className="p-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800">Switch Workspace</div>
          <div className="max-h-[300px] overflow-y-auto">
            {uniqueClubs.map(club => (
              <button
                key={club.id}
                onClick={() => {
                  setActiveClubId(club.id);
                  setIsOpen(false);
                }}
                className={`flex items-center gap-3 w-full p-3 text-left transition-colors ${activeClubId === club.id ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'}`}
              >
                {club.logo_url ? (
                  <img src={club.logo_url} alt="Logo" className="w-8 h-8 rounded-lg object-cover bg-black" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500 text-xs font-black">
                    {club.name.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <span className={`font-bold text-sm ${activeClubId === club.id ? 'text-emerald-500' : 'text-white'}`}>
                  {club.name}
                </span>
                {activeClubId === club.id && <i className="fa-solid fa-check ml-auto text-emerald-500 text-xs"></i>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}