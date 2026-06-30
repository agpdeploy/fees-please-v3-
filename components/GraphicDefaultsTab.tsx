"use client";

import React, { useState } from "react";
import TeamListGraphicBuilder from "./TeamListGraphicBuilder";

interface GraphicDefaultsTabProps {
  clubId: string;
  clubRecord: any;
  setClubRecord: (record: any) => void;
}

export default function GraphicDefaultsTab({ clubId, clubRecord, setClubRecord }: GraphicDefaultsTabProps) {
  const [isOpen, setIsOpen] = useState(false);

  // create a dummy team and fixture for the preview
  const dummyTeam = {
    id: 'dummy',
    name: clubRecord?.name || 'Your Team',
    theme_colors: [
      clubRecord?.settings?.graphic_defaults?.primaryColor || '#3FB116', 
      clubRecord?.settings?.graphic_defaults?.secondaryColor || '#306F06'
    ],
    settings: {}, 
    logo_url: clubRecord?.logo_url
  };

  const dummyFixture = {
    id: 'dummy',
    opponent: 'Opponent Team',
    match_date: new Date().toISOString(),
    start_time: '14:00',
    location: 'Home Stadium',
    notes: 'Match Notes Here',
    lists: { squadIds: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'] }
  };
  
  const dummyPlayers = Array.from({length: 11}, (_, i) => ({ 
    id: `${i+1}`, 
    first_name: `Player`, 
    last_name: `${i+1}`,
    nickname: `Nickname ${i+1}`
  }));

  const handleSaveClubSettings = (newSettings: any) => {
    setClubRecord({ ...clubRecord, settings: newSettings });
  };

  const hasPlusFeatures = clubRecord?.plan_tier === 'pro' || clubRecord?.plan_tier === 'plus' || (clubRecord?.trial_ends_at && new Date(clubRecord.trial_ends_at) > new Date() && clubRecord?.plan_tier === 'free');
  const currentPlanTier = hasPlusFeatures ? 'plus' : 'free';

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      <div className="flex items-center gap-4 mb-2">
        <div>
          <h2 className="text-xl font-black uppercase italic tracking-tighter text-zinc-900 dark:text-white">
            Branding
          </h2>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
            Set Global branding elements for your account here.
          </p>
        </div>
      </div>

      <div className="bg-emerald-500 rounded-3xl p-6 shadow-lg shadow-emerald-500/20 relative overflow-hidden text-white flex flex-col items-center text-center">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl -ml-24 -mb-24"></div>
        
        <div className="relative z-10 w-full max-w-lg mx-auto py-4 flex flex-col items-center">
           <i className="fa-solid fa-paintbrush text-4xl mb-4 text-emerald-100"></i>
           <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-2">
             Team List Generator
           </h2>
           <p className="text-emerald-50 mb-8 text-xs leading-relaxed max-w-sm">
             Launch the builder to visually configure your account's default team list styles and fonts. These will apply across all team list generated images.
           </p>
           
           <button 
             onClick={() => setIsOpen(true)} 
             className="px-8 py-3 bg-white text-emerald-600 hover:bg-emerald-50 transition-colors rounded-xl font-black uppercase tracking-widest shadow-xl shadow-black/10 active:scale-95 flex items-center gap-2"
           >
             <i className="fa-solid fa-wand-magic-sparkles"></i> Open Branding Editor
           </button>
        </div>
      </div>

       {isOpen && (
         <TeamListGraphicBuilder
           isOpen={isOpen}
           onClose={() => setIsOpen(false)}
           editMode="club"
           clubId={clubId}
           clubSettings={clubRecord?.settings}
           team={dummyTeam}
           fixture={dummyFixture}
           clubPlayers={dummyPlayers}
           planTier={currentPlanTier} 
           onSaveClubSettings={handleSaveClubSettings}
         />
       )}
    </div>
  )
}
