"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { toPng } from 'html-to-image';

interface TeamListGraphicBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  fixture: any;
  team: any;
  clubPlayers: any[];
  clubId: string;
  planTier?: string;
}

const COMMON_GOOGLE_FONTS = [
  "Inter", "Roboto", "Montserrat", "Oswald", "Bebas Neue", "Anton", "Outfit",
  "Open Sans", "Lato", "Poppins", "Raleway", "Ubuntu", "Playfair Display",
  "Rubik", "Work Sans", "Merriweather", "Noto Sans", "PT Sans", "Mukta",
  "Teko", "Fjalla One", "Josefin Sans", "Barlow", "Titillium Web", "Varela Round"
];

export default function TeamListGraphicBuilder({
  isOpen,
  onClose,
  fixture,
  team,
  clubPlayers,
  clubId,
  planTier
}: TeamListGraphicBuilderProps) {
  const [mounted, setMounted] = useState(false);
  
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#10b981'); // default emerald
  const [secondaryColor, setSecondaryColor] = useState('#f59e0b'); // default amber
  const [nameFormat, setNameFormat] = useState<'full' | 'first_initial' | 'nickname'>('first_initial');
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
  const [selectedFont, setSelectedFont] = useState("Inter");
  const [orderedPlayers, setOrderedPlayers] = useState<string[]>([]);
  
  // Accordion States
  const [heroImageExpanded, setHeroImageExpanded] = useState(true);
  const [lineupOrderExpanded, setLineupOrderExpanded] = useState(false);
  const [advancedSettingsExpanded, setAdvancedSettingsExpanded] = useState(false);
  
  // Custom Photo State
  const [imageFit, setImageFit] = useState<'cover' | 'contain'>('cover');
  const [imageZoom, setImageZoom] = useState<number>(1);
  const [imageX, setImageX] = useState<number>(50);
  const [imageY, setImageY] = useState<number>(50);
  const [imageRotation, setImageRotation] = useState<number>(0);
  const [imageCaption, setImageCaption] = useState<string>('');
  
  // Canvas Layout State
  const [heroWidthPercent, setHeroWidthPercent] = useState<number>(45);
  const [showNumbers, setShowNumbers] = useState<boolean>(false);
  const [nameSize, setNameSize] = useState<number>(48);
  const [isExpanded, setIsExpanded] = useState<boolean>(false); // Full screen preview toggle
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  const containerRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.35);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [clubLogo, setClubLogo] = useState<string | null>(null);

  // Load saved colors and sponsors
  useEffect(() => {
    if (!isOpen) return;

    if (team?.theme_colors && team.theme_colors.length >= 2) {
      setPrimaryColor(team.theme_colors[0]);
      setSecondaryColor(team.theme_colors[1]);
    }

    if (team?.settings?.graphic_font) {
      setSelectedFont(team.settings.graphic_font);
    }

    if (fixture?.lists?.squadIds) {
      setOrderedPlayers([...fixture.lists.squadIds]);
    }

    const loadSponsors = async () => {
      const { data } = await supabase.from('public_team_profiles').select('sponsor_1_logo, sponsor_2_logo, sponsor_3_logo').eq('team_id', team?.id).single();
      if (data) {
        const loadedSponsors = [
          { logo: data.sponsor_1_logo, index: 1 },
          { logo: data.sponsor_2_logo, index: 2 },
          { logo: data.sponsor_3_logo, index: 3 }
        ].filter(s => s.logo);
        setSponsors(loadedSponsors);
      }

      if (!team?.logo_url && clubId) {
        const { data: clubData } = await supabase.from('clubs').select('logo_url').eq('id', clubId).single();
        if (clubData?.logo_url) {
          setClubLogo(clubData.logo_url);
        }
      }
    };
    loadSponsors();
  }, [isOpen, team, fixture, clubId]);

  // Load from LocalStorage
  useEffect(() => {
    if (!isOpen || !mounted) return;
    const savedAdvanced = localStorage.getItem(`graphic_builder_advanced_${team?.id}`);
    if (savedAdvanced) {
      try {
        const adv = JSON.parse(savedAdvanced);
        if (adv.primaryColor) setPrimaryColor(adv.primaryColor);
        if (adv.secondaryColor) setSecondaryColor(adv.secondaryColor);
        if (adv.selectedFont) setSelectedFont(adv.selectedFont);
        if (adv.nameFormat) setNameFormat(adv.nameFormat);
        if (typeof adv.showNumbers === 'boolean') setShowNumbers(adv.showNumbers);
        if (adv.nameSize) setNameSize(adv.nameSize);
        if (adv.orientation) setOrientation(adv.orientation);
      } catch (e) {}
    }
    const savedFixture = localStorage.getItem(`graphic_builder_fixture_${fixture?.id}`);
    if (savedFixture) {
      try {
        const fix = JSON.parse(savedFixture);
        if (fix.orderedPlayers && fix.orderedPlayers.length > 0) setOrderedPlayers(fix.orderedPlayers);
        if (fix.heroWidthPercent) setHeroWidthPercent(fix.heroWidthPercent);
        if (fix.imageFit) setImageFit(fix.imageFit);
        if (fix.imageZoom) setImageZoom(fix.imageZoom);
        if (fix.imageX) setImageX(fix.imageX);
        if (fix.imageY) setImageY(fix.imageY);
        if (fix.imageRotation) setImageRotation(fix.imageRotation);
        if (fix.customPhoto) setCustomPhoto(fix.customPhoto);
        if (fix.imageCaption) setImageCaption(fix.imageCaption);
      } catch (e) {}
    }
  }, [isOpen, mounted, team?.id, fixture?.id]);

  // Save to LocalStorage on change
  useEffect(() => {
    if (!isOpen || !mounted) return;
    localStorage.setItem(`graphic_builder_advanced_${team?.id}`, JSON.stringify({
      primaryColor, secondaryColor, selectedFont, nameFormat, showNumbers, nameSize, orientation
    }));
  }, [isOpen, mounted, team?.id, primaryColor, secondaryColor, selectedFont, nameFormat, showNumbers, nameSize, orientation]);

  useEffect(() => {
    if (!isOpen || !mounted) return;
    try {
      localStorage.setItem(`graphic_builder_fixture_${fixture?.id}`, JSON.stringify({
        orderedPlayers, heroWidthPercent, imageFit, imageZoom, imageX, imageY, imageRotation, customPhoto, imageCaption
      }));
    } catch (e) {
      console.warn("Could not save fixture state. Image might be too large for localStorage.");
    }
  }, [isOpen, mounted, fixture?.id, orderedPlayers, heroWidthPercent, imageFit, imageZoom, imageX, imageY, imageRotation, customPhoto, imageCaption]);

  // Resize Observer for perfect scaling
  useEffect(() => {
    if (!containerRef.current || !isOpen) return;
    const canvasWidth = orientation === 'portrait' ? 1080 : 1200;
    const canvasHeight = orientation === 'portrait' ? 1920 : 630;
    
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        const availableWidth = width - 32;
        const availableHeight = height - 32;
        const scaleW = availableWidth / canvasWidth;
        const scaleH = availableHeight / canvasHeight;
        setScale(Math.min(scaleW, scaleH));
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isOpen, isExpanded, orientation]);

  const saveSettings = async (primary: string, secondary: string, fontName: string) => {
    if (!team?.id) return;
    await supabase.from('teams').update({ 
      theme_colors: [primary, secondary],
      settings: { ...(team.settings || {}), graphic_font: fontName }
    }).eq('id', team.id);
  };

  const handleGenerate = async () => {
    if (!captureRef.current) return;
    setIsGenerating(true);
    
    saveSettings(primaryColor, secondaryColor, selectedFont);

    try {
      const dataUrl = await toPng(captureRef.current, {
        quality: 1.0,
        pixelRatio: 1, // Forces 1x resolution to prevent massive files on retina screens
        cacheBust: true,
        skipFonts: false
      });
      
      const d = new Date(fixture?.match_date || Date.now());
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateString = `${yyyy}${mm}${dd}`;
      const sanitizedTeamName = (team?.name || 'Team').replace(/[^a-zA-Z0-9]/g, '');
      const fileName = `TeamList-${sanitizedTeamName}-${dateString}.png`;

      if (navigator.share) {
        try {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const file = new File([blob], fileName, { type: 'image/png' });
          await navigator.share({
            title: `Team List vs ${fixture.opponent}`,
            files: [file]
          });
          setIsGenerating(false);
          return;
        } catch (err: any) {
          if (err.name !== 'AbortError') console.error(err);
        }
      }

      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      link.click();
      
    } catch (err) {
      console.error("Failed to generate image", err);
      alert("Failed to generate image. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const formatPlayerName = (pid: string) => {
    const p = clubPlayers.find(cp => cp.id === pid);
    if (!p) return 'Unknown Player';
    if (nameFormat === 'nickname' && p.nickname) return p.nickname;
    if (nameFormat === 'first_initial') return `${p.first_name} ${p.last_name?.charAt(0) || ''}.`;
    return `${p.first_name} ${p.last_name}`;
  };

  const movePlayer = (index: number, direction: 'up' | 'down') => {
    const newOrdered = [...orderedPlayers];
    if (direction === 'up' && index > 0) {
      [newOrdered[index - 1], newOrdered[index]] = [newOrdered[index], newOrdered[index - 1]];
    } else if (direction === 'down' && index < newOrdered.length - 1) {
      [newOrdered[index + 1], newOrdered[index]] = [newOrdered[index], newOrdered[index + 1]];
    }
    setOrderedPlayers(newOrdered);
  };

  const getInitials = (name?: string) => {
    if (!name) return '??';
    const words = name.split(' ').filter(w => w.length > 0);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return '??';
  };

  if (!isOpen || !mounted) return null;

  const hasSponsors = sponsors.length > 0;
  const matchDateStr = fixture?.match_date ? new Date(fixture.match_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const fontFamilyString = `'${selectedFont}', sans-serif`;

  const canvasWidth = orientation === 'portrait' ? 1080 : 1200;
  const canvasHeight = orientation === 'portrait' ? 1920 : 630;

  const modalContent = (
    <div className="fixed inset-0 z-[100000] flex flex-col bg-black/95 backdrop-blur-md">
      
      <link href={`https://fonts.googleapis.com/css2?family=${selectedFont.replace(/\s+/g, '+')}:wght@400;700;900&display=swap`} rel="stylesheet" crossOrigin="anonymous" />

      {/* Header Bar */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-end bg-black shrink-0 z-10">
        <div className="flex items-center gap-3">
          {planTier !== 'free' && (
            <button onClick={() => setIsExpanded(!isExpanded)} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${isExpanded ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
              {isExpanded ? <><i className="fa-solid fa-compress mr-2"></i> Show Controls</> : <><i className="fa-solid fa-expand mr-2"></i> Full Screen Preview</>}
            </button>
          )}
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>
      </div>

      {/* Preview Area (Always on top and centered) */}
      <div ref={containerRef} className="flex-1 overflow-hidden flex flex-col items-center justify-center p-4 relative bg-[#0a0a0a]">
        
        {/* Canvas scaled down visually via ResizeObserver */}
        <div 
          className="shadow-2xl overflow-hidden relative origin-center shrink-0" 
          style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px`, transform: `scale(${scale})` }}
        >
           <div 
             ref={captureRef}
             className="w-full h-full absolute inset-0 bg-white flex flex-col relative"
             style={{ backgroundColor: primaryColor, fontFamily: fontFamilyString }}
           >
             {/* Background layers */}
             <div className="absolute inset-0 z-0 overflow-hidden">
               <div className="absolute -top-[10%] -left-[30%] w-[160%] h-[160%] rotate-[-15deg] bg-white/10" style={{ backgroundColor: secondaryColor }}></div>
             </div>

             {/* Right half image fill */}
             <div className="absolute right-0 top-0 bottom-0 z-10" style={{ width: `${heroWidthPercent}%` }}>
               {customPhoto ? (
                 <div className="w-full h-full overflow-hidden shadow-[-10px_0_40px_rgba(0,0,0,0.3)] bg-black/10 relative" style={{ backgroundColor: primaryColor }}>
                   <img 
                     src={customPhoto} 
                     alt="Hero Photo" 
                     style={{
                       position: 'absolute',
                       left: `${imageX}%`,
                       top: `${imageY}%`,
                       transform: `translate(-50%, -50%) scale(${imageZoom}) rotate(${imageRotation}deg)`,
                       width: imageFit === 'cover' ? '100%' : 'auto',
                       height: imageFit === 'cover' ? '100%' : 'auto',
                       minWidth: imageFit === 'contain' ? '100%' : 'auto',
                       minHeight: imageFit === 'contain' ? '100%' : 'auto',
                       objectFit: imageFit
                     }}
                   />
                     {imageCaption && (
                       <div 
                         className="absolute right-8 left-8 z-30 flex flex-col items-end text-right" 
                         style={{ bottom: hasSponsors ? (orientation === 'portrait' ? '320px' : '140px') : (orientation === 'portrait' ? '140px' : '80px') }}
                       >
                         <span 
                           className={`bg-black/50 text-white rounded-3xl font-black tracking-wide leading-[1.7] box-decoration-clone ${orientation === 'portrait' ? 'px-8 py-4 text-4xl' : 'px-4 py-2 text-xl'}`}
                           style={{ fontFamily: "'Inter', sans-serif", WebkitBoxDecorationBreak: 'clone' }}
                         >
                           {imageCaption}
                         </span>
                       </div>
                     )}
                 </div>
               ) : (
                 <div className="w-full h-full border-l-[8px] border-white/20 flex flex-col items-center justify-center p-8 text-center text-white/30 backdrop-blur-sm" style={{ backgroundColor: primaryColor }}>
                   <i className={`fa-solid fa-image ${orientation === 'portrait' ? 'text-8xl mb-6' : 'text-5xl mb-4'}`}></i>
                   <p className={`${orientation === 'portrait' ? 'text-3xl' : 'text-xl'} font-black uppercase tracking-widest`}>No Hero<br/>Image Uploaded</p>
                 </div>
               )}
             </div>

             {/* Content Layer */}
             <div className={`relative z-20 flex-1 flex flex-col ${orientation === 'portrait' ? 'px-12 pt-24' : 'px-8 pt-4'}`}>
               
               {/* Header - App-Style Versus Layout */}
               <div 
                 className={`flex flex-col rounded-3xl relative z-30 ${orientation === 'portrait' ? 'mb-16 p-10' : 'mb-3 p-4'}`} 
                 style={{ 
                   backgroundColor: primaryColor, 
                   border: '1px solid rgba(255,255,255,0.2)',
                   width: orientation === 'landscape' ? `${100 - heroWidthPercent}%` : 'auto'
                 }}
               >
                 <div className={`flex items-center justify-between gap-8 ${orientation === 'portrait' ? 'mb-8' : 'mb-2'}`}>
                   
                   {/* Home Team */}
                   <div className={`flex flex-col items-center flex-1 ${orientation === 'portrait' ? 'gap-4' : 'gap-1'}`}>
                     <div className={`bg-black/30 rounded-full flex items-center justify-center overflow-hidden shrink-0 shadow-2xl ${orientation === 'portrait' ? 'w-40 h-40' : 'w-14 h-14'}`}>
                       {(team?.logo_url || clubLogo) ? <img src={team?.logo_url || clubLogo!} className="w-full h-full object-cover" /> : <span className={`${orientation === 'portrait' ? 'text-7xl' : 'text-2xl'} font-black text-white/40 tracking-tighter`}>{getInitials(team?.name)}</span>}
                     </div>
                     <h1 className={`${orientation === 'portrait' ? 'text-4xl' : 'text-sm'} text-center font-black uppercase leading-tight tracking-tight text-white`}>
                       {team?.name}
                     </h1>
                   </div>

                   {/* VS */}
                   <div className="shrink-0 flex flex-col items-center">
                     <span className={`font-black italic tracking-widest ${orientation === 'portrait' ? 'text-6xl mb-2' : 'text-2xl mb-0'}`} style={{ color: secondaryColor }}>VS</span>
                   </div>

                   {/* Away Team */}
                   <div className={`flex flex-col items-center flex-1 ${orientation === 'portrait' ? 'gap-4' : 'gap-1'}`}>
                     <div className={`bg-black/30 rounded-full flex items-center justify-center overflow-hidden shrink-0 shadow-2xl ${orientation === 'portrait' ? 'w-40 h-40' : 'w-14 h-14'}`}>
                       {fixture?.opponent_logo_url ? <img src={fixture?.opponent_logo_url} className="w-full h-full object-cover" /> : <span className={`${orientation === 'portrait' ? 'text-7xl' : 'text-2xl'} font-black text-white/40 tracking-tighter`}>{getInitials(fixture?.opponent)}</span>}
                     </div>
                     <h1 className={`${orientation === 'portrait' ? 'text-4xl' : 'text-sm'} text-center font-black uppercase leading-tight tracking-tight text-white`}>
                       {fixture?.opponent || 'TBA'}
                     </h1>
                   </div>

                 </div>

                 {/* Match Details */}
                 <div className={`flex flex-col items-center text-center ${orientation === 'portrait' ? 'gap-3 mt-4' : 'gap-0 mt-1'}`}>
                   <div className={`${orientation === 'portrait' ? 'text-4xl' : 'text-sm'} font-black uppercase tracking-widest text-white/90`}>
                     {matchDateStr} @ {fixture?.start_time || 'TBA'}
                   </div>
                   <div className={`${orientation === 'portrait' ? 'text-3xl' : 'text-xs'} font-bold uppercase tracking-widest`} style={{ color: secondaryColor }}>
                     <i className="fa-solid fa-location-dot mr-2"></i> {fixture?.location || 'Venue TBA'}
                   </div>
                   {fixture?.notes && (
                     <div className={`font-medium text-white/80 max-w-2xl italic ${orientation === 'portrait' ? 'text-3xl mt-4' : 'text-xs mt-1'}`}>
                       "{fixture.notes}"
                     </div>
                   )}
                 </div>
               </div>

               {/* Players List */}
               <div className={`text-white z-20 relative pr-4 ${orientation === 'portrait' ? 'flex flex-col gap-5 mt-8' : 'grid grid-cols-2 gap-x-6 gap-y-1 mt-2'}`} style={{ width: `${100 - heroWidthPercent}%` }}>
                 {orderedPlayers.map((pid: string, idx: number) => (
                   <div key={pid} className="font-black uppercase tracking-tight flex items-start gap-3 md:gap-6" style={{ fontSize: `${orientation === 'portrait' ? nameSize : Math.max(nameSize * 0.45, 12)}px`, textShadow: '2px 2px 8px rgba(0,0,0,0.6)' }}>
                     {showNumbers && <span className="opacity-50 min-w-[2.5ch] mt-[0.1em] shrink-0">{idx + 1}.</span>}
                     <span className="leading-none break-words pt-[0.1em]">{formatPlayerName(pid)}</span>
                   </div>
                 ))}
               </div>

             </div>

             {/* Footer - Sponsors */}
             <div 
                className="absolute bottom-0 left-0 right-0 bg-white z-40 flex items-center justify-center shadow-[0_-20px_50px_rgba(0,0,0,0.3)] clip-footer" 
                style={{ 
                  height: hasSponsors ? (orientation === 'portrait' ? '280px' : '100px') : (orientation === 'portrait' ? '100px' : '40px'),
                  clipPath: orientation === 'portrait' ? 'polygon(0 15%, 100% 0, 100% 100%, 0% 100%)' : 'polygon(0 30%, 100% 0, 100% 100%, 0% 100%)' 
                }}
              >
               {hasSponsors && (
                 <div className={`absolute inset-0 flex items-center justify-center gap-8 md:gap-16 px-16 pb-2 ${orientation === 'portrait' ? 'pt-8' : 'pt-4'}`}>
                   {sponsors.map(s => (
                     <img key={s.index} src={s.logo} className={`object-contain ${orientation === 'portrait' ? 'max-h-32' : 'max-h-12'}`} />
                   ))}
                 </div>
               )}
               
               {/* Watermark */}
               <div className={`absolute right-10 z-50 text-zinc-400 tracking-widest bg-white/90 px-3 py-1 rounded backdrop-blur-md shadow-sm ${orientation === 'portrait' ? 'bottom-6 text-xl' : 'bottom-2 text-[10px]'}`} style={{ fontFamily: "'Inter', sans-serif" }}>
                 Generated by <span className="font-black italic">FEES PLEASE</span>
               </div>
             </div>
             
           </div>
        </div>
      </div>

      {/* Bottom Sheet Controls (Hidden when Expanded) */}
      {!isExpanded && (
        <div className="w-full bg-[#111] border-t border-zinc-800 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] shrink-0 z-20 flex flex-col max-h-[60vh] md:max-h-[50vh]">
          <div className="overflow-y-auto p-5 space-y-6 flex-1">
            
            {/* Team List Hero Image */}
            <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/30">
              <button 
                onClick={() => setHeroImageExpanded(!heroImageExpanded)}
                className="w-full p-4 flex items-center justify-between text-[10px] font-black text-emerald-500 uppercase tracking-widest hover:bg-zinc-900 transition-colors"
              >
                <span className="flex items-center gap-2"><i className="fa-solid fa-image"></i> Team List Hero Image</span>
                <i className={`fa-solid fa-chevron-down transition-transform ${heroImageExpanded ? 'rotate-180' : ''}`}></i>
              </button>
              
              {heroImageExpanded && (
                <div className="p-4 border-t border-zinc-800 space-y-4 bg-zinc-900/10">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Upload or Replace</span>
                    {customPhoto && (
                      <button onClick={() => setCustomPhoto(null)} className="text-[9px] text-red-500 hover:underline">Remove Photo</button>
                    )}
                  </div>
                  
                  {!customPhoto ? (
                    <div className="relative group rounded-xl border-2 border-dashed border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 transition-colors p-4 text-center cursor-pointer">
                      <input type="file" accept="image/*" onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const img = new Image();
                            img.onload = () => {
                              const canvas = document.createElement('canvas');
                              const MAX_WIDTH = 1080;
                              const MAX_HEIGHT = 1920;
                              let width = img.width;
                              let height = img.height;
                              
                              if (width > height && width > MAX_WIDTH) {
                                height *= MAX_WIDTH / width;
                                width = MAX_WIDTH;
                              } else if (height > MAX_HEIGHT) {
                                width *= MAX_HEIGHT / height;
                                height = MAX_HEIGHT;
                              }
                              
                              canvas.width = width;
                              canvas.height = height;
                              const ctx = canvas.getContext('2d');
                              ctx?.drawImage(img, 0, 0, width, height);
                              setCustomPhoto(canvas.toDataURL('image/jpeg', 0.8));
                            };
                            img.src = event.target?.result as string;
                          };
                          reader.readAsDataURL(file);
                        }
                      }} className="absolute inset-0 opacity-0 cursor-pointer" />
                      <div className="text-[10px] font-black uppercase text-zinc-400"><i className="fa-solid fa-upload mb-2 text-xl block"></i> Browse Image</div>
                    </div>
                  ) : (
                    <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-4 space-y-5">
                      
                      {/* Image Layout Width */}
                      <div>
                        <label className="text-[9px] font-bold text-zinc-500 uppercase mb-2 flex justify-between">
                          <span>Hero Width</span>
                          <span>{heroWidthPercent}%</span>
                        </label>
                        <input type="range" min="30" max="70" value={heroWidthPercent} onChange={e => setHeroWidthPercent(parseInt(e.target.value))} className="w-full accent-emerald-500" />
                        <p className="text-[8px] text-zinc-600 mt-1">Slide to adjust how much space the image takes compared to the names.</p>
                      </div>

                      <hr className="border-zinc-800" />

                      {/* Fill / Fit */}
                      <div className="flex bg-black rounded-lg overflow-hidden border border-zinc-800">
                        <button 
                          onClick={() => setImageFit('cover')}
                          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${imageFit === 'cover' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          Cover (Fill)
                        </button>
                        <button 
                          onClick={() => setImageFit('contain')}
                          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${imageFit === 'contain' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          Contain (Fit)
                        </button>
                      </div>
                      
                      {/* Zoom */}
                      <div>
                        <label className="text-[9px] font-bold text-zinc-500 uppercase mb-2 flex justify-between">
                          <span>Zoom Scale</span>
                          <span>{imageZoom.toFixed(1)}x</span>
                        </label>
                        <input type="range" min="0.5" max="3" step="0.1" value={imageZoom} onChange={e => setImageZoom(parseFloat(e.target.value))} className="w-full accent-emerald-500" />
                      </div>
                      
                      {/* Position */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] font-bold text-zinc-500 uppercase mb-2 flex justify-between">
                            <span>X Position</span>
                            <span>{imageX}%</span>
                          </label>
                          <input type="range" min="0" max="100" value={imageX} onChange={e => setImageX(parseInt(e.target.value))} className="w-full accent-emerald-500" />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-zinc-500 uppercase mb-2 flex justify-between">
                            <span>Y Position</span>
                            <span>{imageY}%</span>
                          </label>
                          <input type="range" min="0" max="100" value={imageY} onChange={e => setImageY(parseInt(e.target.value))} className="w-full accent-emerald-500" />
                        </div>
                      </div>

                      {/* Rotation */}
                      <div>
                          <label className="text-xs font-black uppercase text-zinc-400 mb-2 flex justify-between">
                            <span>Image Rotation</span>
                            <span className="text-emerald-500">{imageRotation}°</span>
                          </label>
                          <input type="range" min="-180" max="180" value={imageRotation} onChange={(e) => setImageRotation(Number(e.target.value))} className="w-full accent-emerald-500" />
                        </div>

                        <div>
                      <label className="text-xs font-black uppercase text-zinc-400 mb-2 block">Photo Caption</label>
                      <input 
                        type="text" 
                        value={imageCaption}
                        onChange={(e) => setImageCaption(e.target.value)}
                        placeholder="e.g. Photo by @FeesPlease"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Lineup Reorder */}
            <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/30">
              <button 
                onClick={() => setLineupOrderExpanded(!lineupOrderExpanded)}
                className="w-full p-4 flex items-center justify-between text-[10px] font-black text-emerald-500 uppercase tracking-widest hover:bg-zinc-900 transition-colors"
              >
                <span className="flex items-center gap-2"><i className="fa-solid fa-list-ol"></i> Lineup Order</span>
                <i className={`fa-solid fa-chevron-down transition-transform ${lineupOrderExpanded ? 'rotate-180' : ''}`}></i>
              </button>
              
              {lineupOrderExpanded && (
                <div className="p-4 border-t border-zinc-800 space-y-1 bg-zinc-900/10">
                  {orderedPlayers.map((pid, idx) => (
                    <div key={pid} className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-800/50">
                      <div className="text-xs font-bold text-zinc-300 flex items-center gap-3 truncate">
                        <span className="text-zinc-500 font-black w-4">{idx + 1}.</span>
                        <span className="truncate">{formatPlayerName(pid)}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button 
                          onClick={() => movePlayer(idx, 'up')} 
                          disabled={idx === 0}
                          className="w-7 h-7 rounded bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 flex items-center justify-center transition-colors"
                        >
                          <i className="fa-solid fa-arrow-up"></i>
                        </button>
                        <button 
                          onClick={() => movePlayer(idx, 'down')} 
                          disabled={idx === orderedPlayers.length - 1}
                          className="w-7 h-7 rounded bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 flex items-center justify-center transition-colors"
                        >
                          <i className="fa-solid fa-arrow-down"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Advanced Settings Accordion */}
            <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/30">
              <button 
                onClick={() => setAdvancedSettingsExpanded(!advancedSettingsExpanded)}
                className="w-full p-4 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                <span className="flex items-center gap-2"><i className="fa-solid fa-sliders"></i> Advanced Settings</span>
                <i className={`fa-solid fa-chevron-down transition-transform ${advancedSettingsExpanded ? 'rotate-180' : ''}`}></i>
              </button>
              
              {advancedSettingsExpanded && (
                <div className="p-4 border-t border-zinc-800 space-y-6 bg-zinc-900/10">
                  {/* Orientation */}
                  <div className="space-y-3">
                     <h3 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Canvas Layout</h3>
                     <div className="flex bg-black rounded-lg overflow-hidden border border-zinc-800">
                        <button 
                          onClick={() => setOrientation('portrait')}
                          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${orientation === 'portrait' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          <i className="fa-solid fa-mobile-screen mr-2"></i> Portrait
                        </button>
                        <button 
                          onClick={() => setOrientation('landscape')}
                          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${orientation === 'landscape' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          <i className="fa-solid fa-display mr-2"></i> Landscape
                        </button>
                      </div>
                  </div>

                  {/* Colors */}
                  <div className="space-y-3">
                     <h3 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Theme Colors</h3>
                     <div className="grid grid-cols-2 gap-3">
                       <div>
                         <label className="text-[9px] font-bold text-zinc-600 uppercase mb-1 block">Primary</label>
                         <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-full h-8 rounded cursor-pointer border-0 p-0" />
                       </div>
                       <div>
                         <label className="text-[9px] font-bold text-zinc-600 uppercase mb-1 block">Secondary</label>
                         <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="w-full h-8 rounded cursor-pointer border-0 p-0" />
                       </div>
                     </div>
                  </div>

                  {/* Font Selection */}
                  <div className="space-y-3">
                     <h3 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Typography Search</h3>
                     <div className="relative">
                       <input 
                         type="text"
                         list="google-fonts-list"
                         value={selectedFont} 
                         onChange={e => setSelectedFont(e.target.value)}
                         placeholder="Type a Google Font..."
                         className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs font-bold outline-none text-zinc-100"
                       />
                       <datalist id="google-fonts-list">
                         {COMMON_GOOGLE_FONTS.map(font => (
                           <option key={font} value={font} />
                         ))}
                       </datalist>
                     </div>
                  </div>

                  {/* Player Names Configuration */}
                  <div className="space-y-4">
                     <h3 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Lineup Display</h3>
                     
                     <div>
                       <label className="text-[9px] font-bold text-zinc-600 uppercase mb-2 block">Name Format</label>
                       <select value={nameFormat} onChange={e => setNameFormat(e.target.value as any)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs font-bold outline-none text-zinc-100">
                         <option value="first_initial">First Name + Initial (John S.)</option>
                         <option value="full">Full Name (John Smith)</option>
                         <option value="nickname">Nickname (Jono)</option>
                       </select>
                     </div>

                     <div>
                       <label className="text-[9px] font-bold text-zinc-600 uppercase mb-2 flex justify-between">
                         <span>Text Size</span>
                         <span>{nameSize}px</span>
                       </label>
                       <input type="range" min="24" max="72" value={nameSize} onChange={e => setNameSize(parseInt(e.target.value))} className="w-full accent-emerald-500" />
                     </div>

                     <div className="flex items-center gap-3">
                       <input type="checkbox" id="showNumbers" checked={showNumbers} onChange={e => setShowNumbers(e.target.checked)} className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 accent-emerald-500" />
                       <label htmlFor="showNumbers" className="text-xs font-bold text-zinc-300">Show List Numbers</label>
                     </div>
                  </div>
                </div>
              )}
            </div>
            
          </div>

          {/* Generate Button Footer */}
          <div className="p-4 border-t border-zinc-800 bg-[#111]">
            {planTier === 'free' ? (
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('navigate-setup', { detail: 'billing' }))}
                className="w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs text-amber-900 bg-amber-400 hover:bg-amber-300 shadow-md shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-wand-magic-sparkles"></i> Upgrade to Generate
              </button>
            ) : (
              <button 
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
              >
                {isGenerating ? <><i className="fa-solid fa-spinner fa-spin"></i> Generating...</> : <><i className="fa-solid fa-share-nodes"></i> Share / Download</>}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}
