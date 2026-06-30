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
  clubSettings?: any;
  planTier?: string;
  editMode?: 'club' | 'team';
  onSaveClubSettings?: (settings: any) => void;
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
  clubSettings,
  planTier,
  editMode = 'team',
  onSaveClubSettings
}: TeamListGraphicBuilderProps) {
  const [mounted, setMounted] = useState(false);
  
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const defaults = clubSettings?.graphic_defaults || {};
  const [primaryColor, setPrimaryColor] = useState(defaults.primaryColor || team?.theme_colors?.[0] || '#3FB116');
  const [secondaryColor, setSecondaryColor] = useState(defaults.secondaryColor || team?.theme_colors?.[1] || '#306F06');
  const [headerBgColor, setHeaderBgColor] = useState(defaults.headerBgColor || "#ffffff");
  const [teamNamesFont, setTeamNamesFont] = useState(defaults.teamNamesFont || "Inter");
  const [teamNamesColor, setTeamNamesColor] = useState(defaults.teamNamesColor || "#363636");
  const [playerNamesFont, setPlayerNamesFont] = useState(defaults.playerNamesFont || "Inter");
  const [playerNamesColor, setPlayerNamesColor] = useState(defaults.playerNamesColor || "#ffffff");
  const [matchDetailsColor, setMatchDetailsColor] = useState(defaults.matchDetailsColor || "#1C1C1C");
  const [matchNotesColor, setMatchNotesColor] = useState(defaults.matchNotesColor || "#696969");
  const [sponsorScale, setSponsorScale] = useState<number>(defaults.sponsorScale || team?.settings?.sponsorScale || 100);
  const [sponsorStyles, setSponsorStyles] = useState<Record<string, { scale: number, x: number, y: number }>>(defaults.sponsorStyles || team?.settings?.sponsorStyles || {});
  const [sponsorOrder, setSponsorOrder] = useState<string[]>(defaults.sponsorOrder || team?.settings?.sponsorOrder || []);

  const [nameFormat, setNameFormat] = useState<'full' | 'first_initial' | 'nickname'>('first_initial');
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
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
  const [letterSpacing, setLetterSpacing] = useState<number>(0);
  const [matchNotesOverride, setMatchNotesOverride] = useState<string>('');
  const [matchNotesBg, setMatchNotesBg] = useState<string>('transparent');
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

    if (team?.settings) {
      if (team.settings.letter_spacing !== undefined) setLetterSpacing(team.settings.letter_spacing);
      if (team.settings.name_format) setNameFormat(team.settings.name_format);
      if (typeof team.settings.show_numbers === 'boolean') setShowNumbers(team.settings.show_numbers);
      if (team.settings.name_size) setNameSize(team.settings.name_size);
      if (team.settings.orientation) setOrientation(team.settings.orientation);
      if (team.settings.hero_width_percent !== undefined) setHeroWidthPercent(team.settings.hero_width_percent);
      if (team.settings.image_fit) setImageFit(team.settings.image_fit);
      if (team.settings.image_zoom !== undefined) setImageZoom(team.settings.image_zoom);
      if (team.settings.image_x !== undefined) setImageX(team.settings.image_x);
      if (team.settings.image_y !== undefined) setImageY(team.settings.image_y);
      if (team.settings.image_rotation !== undefined) setImageRotation(team.settings.image_rotation);
    }

    if (fixture?.lists?.squadIds) {
      setOrderedPlayers([...fixture.lists.squadIds]);
    }

    const loadSponsorsAndClub = async () => {
      if (editMode === 'club' && clubId) {
        // Since club sponsors are synced across all team_sponsors, we just get them for the first team in the club
        const { data: teamData } = await supabase.from('teams').select('id').eq('club_id', clubId).limit(1).single();
        if (teamData?.id) {
          const { data } = await supabase.from('team_sponsors').select('*').eq('team_id', teamData.id).eq('is_active', true);
          if (data) setSponsors(data.map(s => ({ logo: s.logo_url, index: s.id })));
        }
      } else {
        const { data } = await supabase.from('team_sponsors').select('*').eq('team_id', team?.id).eq('is_active', true);
        if (data) {
          setSponsors(data.map(s => ({ logo: s.logo_url, index: s.id })));
        }
      }

      if (!team?.logo_url && clubId) {
        const { data: clubData } = await supabase.from('clubs').select('logo_url').eq('id', clubId).single();
        if (clubData?.logo_url) {
          setClubLogo(clubData.logo_url);
        }
      }
    };
    loadSponsorsAndClub();

  }, [isOpen, team, fixture, clubId]);

  // Load from LocalStorage
  useEffect(() => {
    if (!isOpen || !mounted) return;
    const savedAdvanced = localStorage.getItem(`graphic_builder_advanced_${team?.id}`);
    if (savedAdvanced) {
      try {
        const adv = JSON.parse(savedAdvanced);
        if (adv.nameFormat) setNameFormat(adv.nameFormat);
        if (adv.showNumbers !== undefined) setShowNumbers(adv.showNumbers);
        if (adv.nameSize) setNameSize(adv.nameSize);
        if (adv.orientation) setOrientation(adv.orientation);
        if (adv.letterSpacing !== undefined) setLetterSpacing(adv.letterSpacing);
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
        if (fix.matchNotesOverride !== undefined) setMatchNotesOverride(fix.matchNotesOverride);
        if (fix.matchNotesBg) setMatchNotesBg(fix.matchNotesBg);
      } catch (e) {}
    }
  }, [isOpen, mounted, team?.id, fixture?.id]);

  // Save to LocalStorage on change
  useEffect(() => {
    if (!isOpen || !mounted) return;
    localStorage.setItem(`graphic_builder_advanced_${team?.id}`, JSON.stringify({
      nameFormat, showNumbers, nameSize, orientation, letterSpacing
    }));
  }, [isOpen, mounted, team?.id, nameFormat, showNumbers, nameSize, orientation, letterSpacing]);

  useEffect(() => {
    if (!isOpen || !mounted) return;
    try {
      localStorage.setItem(`graphic_builder_fixture_${fixture?.id}`, JSON.stringify({
        orderedPlayers, heroWidthPercent, imageFit, imageZoom, imageX, imageY, imageRotation, customPhoto, imageCaption, matchNotesOverride, matchNotesBg
      }));
    } catch (e) {
      console.warn("Could not save fixture state. Image might be too large for localStorage.");
    }
  }, [isOpen, mounted, fixture?.id, orderedPlayers, heroWidthPercent, imageFit, imageZoom, imageX, imageY, imageRotation, customPhoto, imageCaption]);

  // Resize Observer for perfect scaling
  useEffect(() => {
    if (!containerRef.current || !isOpen) return;
    const canvasWidth = orientation === 'portrait' ? 1080 : 1200;
    const canvasHeight = orientation === 'portrait' ? 1350 : 630;
    
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

  const saveSettings = async () => {
    if (editMode === 'club') {
      if (!clubId) return;
      const newDefaults = {
        primaryColor, secondaryColor, headerBgColor, teamNamesFont, teamNamesColor,
        playerNamesFont, playerNamesColor, matchDetailsColor, matchNotesColor, sponsorScale, sponsorStyles, sponsorOrder
      };
      const updatedSettings = { ...(clubSettings || {}), graphic_defaults: newDefaults };
      await supabase.from('clubs').update({ settings: updatedSettings }).eq('id', clubId);
      if (onSaveClubSettings) onSaveClubSettings(updatedSettings);
      alert('Global Branding Defaults Saved!');
      return;
    }

    if (!team?.id) return;
    const newSettings = { 
      ...(team.settings || {}), 
      letter_spacing: letterSpacing,
      name_format: nameFormat,
      show_numbers: showNumbers,
      name_size: nameSize,
      orientation: orientation,
      hero_width_percent: heroWidthPercent,
      image_fit: imageFit,
      image_zoom: imageZoom,
      image_x: imageX,
      image_y: imageY,
      image_rotation: imageRotation,
      sponsorScale,
      sponsorStyles,
      sponsorOrder
    };
    await supabase.from('teams').update({ 
      settings: newSettings
    }).eq('id', team.id);
    alert('Layout Configuration Saved!');
  };

  const downloadImage = async () => {
    if (!captureRef.current) return;
    setIsGenerating(true);
    
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

      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      link.click();
      
    } catch (err) {
      console.error("Failed to download image", err);
      alert("Failed to download image. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const shareImage = async () => {
    if (!captureRef.current) return;
    setIsGenerating(true);
    
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

      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const file = new File([blob], fileName, { type: 'image/png' });
          await navigator.share({
            title: `Team List vs ${fixture?.opponent || 'Opponent'}`,
            files: [file]
          });
        } catch (err: any) {
          if (err.name !== 'AbortError') console.error(err);
        }
      }
    } catch (err) {
      console.error("Failed to share image", err);
      alert("Failed to share image. Please try again.");
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

  const validSponsors = sponsors.filter(s => s.logo && s.logo.trim() !== '');
  const orderedSponsors = [...validSponsors].sort((a, b) => {
    const indexA = sponsorOrder.indexOf(a.index);
    const indexB = sponsorOrder.indexOf(b.index);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
  const hasSponsors = orderedSponsors.length > 0;

  const handleMoveSponsor = (sponsorId: string, direction: number) => {
    const currentOrder = sponsorOrder.length === validSponsors.length ? sponsorOrder : validSponsors.map(s => s.index);
    const currentIndex = currentOrder.indexOf(sponsorId);
    if (currentIndex === -1) return;
    const newIndex = currentIndex + direction;
    if (newIndex < 0 || newIndex >= currentOrder.length) return;
    const newOrder = [...currentOrder];
    [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];
    setSponsorOrder(newOrder);
  };
  const matchDateStr = fixture?.match_date ? new Date(fixture.match_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  const canvasWidth = orientation === 'portrait' ? 1080 : 1200;
  const canvasHeight = orientation === 'portrait' ? 1350 : 630;

  const modalContent = (
    <div className="fixed inset-0 z-[100000] flex flex-col bg-black/95 backdrop-blur-md">
      
      <link href={`https://fonts.googleapis.com/css2?family=${teamNamesFont.replace(/\s+/g, '+')}:wght@400;700;900&display=swap`} rel="stylesheet" crossOrigin="anonymous" />
      {playerNamesFont !== teamNamesFont && <link href={`https://fonts.googleapis.com/css2?family=${playerNamesFont.replace(/\s+/g, '+')}:wght@400;700;900&display=swap`} rel="stylesheet" crossOrigin="anonymous" />}

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
             style={{ backgroundColor: primaryColor }}
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
                       minWidth: imageFit === 'cover' ? '100%' : '0',
                       minHeight: imageFit === 'cover' ? '100%' : '0',
                       maxWidth: imageFit === 'contain' ? '100%' : 'none',
                       maxHeight: imageFit === 'contain' ? '100%' : 'none',
                     }}
                   />
                     {imageCaption && (
                       <div 
                         className="absolute right-8 left-8 z-30 flex flex-col items-end text-right" 
                         style={{ bottom: hasSponsors ? (orientation === 'portrait' ? '320px' : '140px') : (orientation === 'portrait' ? '140px' : '80px') }}
                       >
                         <span 
                           className={`bg-black/50 text-white rounded-3xl font-black tracking-wide leading-[1.7] box-decoration-clone ${orientation === 'portrait' ? 'px-8 py-4 text-4xl' : 'px-4 py-2 text-xl'}`}
                           style={{ fontFamily: `'${teamNamesFont}', sans-serif`, WebkitBoxDecorationBreak: 'clone' }}
                         >
                           {imageCaption}
                         </span>
                       </div>
                     )}
                 </div>
               ) : (
                 <div className="w-full h-full border-l-[8px] border-white/20 flex flex-col items-center justify-center p-8 text-center text-white/30 backdrop-blur-sm" style={{ backgroundColor: primaryColor }}>
                   <i className={`fa-solid fa-image ${orientation === 'portrait' ? 'text-8xl mb-6' : 'text-5xl mb-4'}`}></i>
                   <p className={`${orientation === 'portrait' ? 'text-3xl' : 'text-xl'} font-black uppercase tracking-widest`} style={{ fontFamily: `'${teamNamesFont}', sans-serif` }}>No Hero<br/>Image Uploaded</p>
                 </div>
               )}
             </div>

             {/* Content Layer */}
             <div className={`relative z-20 flex-1 flex flex-col ${orientation === 'portrait' ? 'px-12 pt-12' : 'px-8 pt-4'}`}>
               
               {/* Header - App-Style Versus Layout */}
               <div 
                 className={`flex flex-col rounded-3xl relative z-30 ${orientation === 'portrait' ? 'mb-8 p-6' : 'mb-3 p-4'}`} 
                 style={{ 
                   backgroundColor: headerBgColor, 
                   border: '1px solid rgba(255,255,255,0.2)',
                   width: orientation === 'landscape' ? `${100 - heroWidthPercent}%` : 'auto'
                 }}
               >
                 <div className={`flex items-center justify-between gap-8 ${orientation === 'portrait' ? 'mb-6' : 'mb-2'}`}>
                   
                   {/* Home Team */}
                   <div className={`flex flex-col items-center flex-1 ${orientation === 'portrait' ? 'gap-4' : 'gap-1'}`}>
                      <div className={`bg-black/30 rounded-full flex items-center justify-center overflow-hidden shrink-0 shadow-2xl ${orientation === 'portrait' ? 'w-32 h-32' : 'w-14 h-14'}`}>
                        {(team?.logo_url || clubLogo) ? <img src={team?.logo_url || clubLogo!} className="w-full h-full object-cover" /> : <span className={`${orientation === 'portrait' ? 'text-6xl' : 'text-2xl'} font-black text-white/40 tracking-tighter`} style={{ fontFamily: `'${teamNamesFont}', sans-serif` }}>{getInitials(team?.name)}</span>}
                      </div>
                      <h1 className={`${orientation === 'portrait' ? 'text-4xl' : 'text-sm'} text-center font-black uppercase leading-tight tracking-tight`} style={{ letterSpacing: `${letterSpacing}px`, fontFamily: `'${teamNamesFont}', sans-serif`, color: teamNamesColor }}>
                        {team?.name}
                      </h1>
                    </div>

                    {/* VS */}
                    <div className="shrink-0 flex flex-col items-center">
                      <span className={`font-black italic tracking-widest ${orientation === 'portrait' ? 'text-6xl mb-2' : 'text-2xl mb-0'}`} style={{ color: matchNotesColor, letterSpacing: `${letterSpacing}px`, fontFamily: `'${teamNamesFont}', sans-serif` }}>VS</span>
                    </div>

                    {/* Away Team */}
                    <div className={`flex flex-col items-center flex-1 ${orientation === 'portrait' ? 'gap-4' : 'gap-1'}`}>
                      <div className={`bg-black/30 rounded-full flex items-center justify-center overflow-hidden shrink-0 shadow-2xl ${orientation === 'portrait' ? 'w-32 h-32' : 'w-14 h-14'}`}>
                        {fixture?.opponent_logo_url ? <img src={fixture?.opponent_logo_url} className="w-full h-full object-cover" /> : <span className={`${orientation === 'portrait' ? 'text-6xl' : 'text-2xl'} font-black text-white/40 tracking-tighter`} style={{ fontFamily: `'${teamNamesFont}', sans-serif` }}>{getInitials(fixture?.opponent)}</span>}
                      </div>
                      <h1 className={`${orientation === 'portrait' ? 'text-4xl' : 'text-sm'} text-center font-black uppercase leading-tight tracking-tight`} style={{ letterSpacing: `${letterSpacing}px`, fontFamily: `'${teamNamesFont}', sans-serif`, color: teamNamesColor }}>
                        {fixture?.opponent || 'TBA'}
                      </h1>
                   </div>

                 </div>

                 {/* Match Details */}
                 <div className={`flex flex-col items-center text-center ${orientation === 'portrait' ? 'gap-3 mt-4' : 'gap-0 mt-1'}`} style={{ fontFamily: `'${teamNamesFont}', sans-serif` }}>
                   <div className={`${orientation === 'portrait' ? 'text-4xl' : 'text-sm'} font-black uppercase tracking-widest`} style={{ letterSpacing: `${letterSpacing}px`, color: matchDetailsColor }}>
                     {matchDateStr} @ {fixture?.start_time || 'TBA'}
                   </div>
                   <div className={`${orientation === 'portrait' ? 'text-3xl' : 'text-xs'} font-bold uppercase tracking-widest`} style={{ color: matchNotesColor, letterSpacing: `${letterSpacing}px` }}>
                     <i className="fa-solid fa-location-dot mr-2"></i> {fixture?.location || 'Venue TBA'}
                   </div>
                   {(matchNotesOverride || fixture?.notes) && (
                     <div className={`font-medium max-w-2xl italic ${orientation === 'portrait' ? 'text-3xl mt-4 px-6 py-2 rounded-full' : 'text-xs mt-1 px-3 py-1 rounded-full'}`} style={{ backgroundColor: matchNotesBg, color: matchNotesColor, letterSpacing: `${letterSpacing}px` }}>
                       "{matchNotesOverride || fixture?.notes}"
                     </div>
                   )}
                 </div>
               </div>

               {/* Players List */}
               <div className={`z-20 relative pr-4 ${orientation === 'portrait' ? 'flex flex-col gap-4 mt-4' : 'columns-2 gap-x-8 mt-2'}`} style={{ width: `${100 - heroWidthPercent}%` }}>
                 {orderedPlayers.map((pid: string, idx: number) => (
                   <div key={pid} className={`font-black uppercase tracking-tight flex items-start gap-3 md:gap-6 break-inside-avoid ${orientation === 'portrait' ? '' : 'mb-1.5'}`} style={{ fontSize: `${orientation === 'portrait' ? nameSize : Math.max(nameSize * 0.45, 12)}px`, letterSpacing: `${letterSpacing}px`, textShadow: '2px 2px 8px rgba(0,0,0,0.6)', fontFamily: `'${playerNamesFont}', sans-serif`, color: playerNamesColor }}>
                     {showNumbers && <span className="opacity-50 w-[2.5ch] text-right mt-[0.1em] shrink-0 inline-block">{idx + 1}.</span>}
                     <span className="leading-none break-words pt-[0.1em]">{formatPlayerName(pid)}</span>
                   </div>
                 ))}
               </div>

             </div>

             {/* Footer - Sponsors */}
             <div 
                className="absolute bottom-0 left-0 right-0 bg-white z-40 flex items-center justify-center shadow-[0_-20px_50px_rgba(0,0,0,0.3)] clip-footer" 
                style={{ 
                  height: hasSponsors ? (orientation === 'portrait' ? '180px' : '100px') : (orientation === 'portrait' ? '80px' : '40px'),
                  clipPath: orientation === 'portrait' ? 'polygon(0 15%, 100% 0, 100% 100%, 0% 100%)' : 'polygon(0 30%, 100% 0, 100% 100%, 0% 100%)' 
                }}
              >
                {hasSponsors && (
                 <div className={`absolute inset-0 flex items-center justify-center gap-8 md:gap-16 px-16 pb-2 ${orientation === 'portrait' ? 'pt-8' : 'pt-4'}`}>
                   {orderedSponsors.map(s => {
                     const style = sponsorStyles[s.index] || { scale: 100, x: 0, y: 0 };
                     return (
                       <img 
                         key={s.index} 
                         src={s.logo} 
                         className="object-contain" 
                         style={{ 
                           maxHeight: `${(orientation === 'portrait' ? 96 : 48) * (sponsorScale / 100)}px`,
                           transform: `translate(${style.x || 0}px, ${style.y || 0}px) scale(${(style.scale || 100) / 100})`
                         }} 
                       />
                     );
                   })}
                 </div>
               )}
               
               {/* Watermark */}
               <div className={`absolute right-10 z-50 text-zinc-400 tracking-widest bg-white/90 px-3 py-1 rounded backdrop-blur-md shadow-sm ${orientation === 'portrait' ? 'bottom-6 text-xl' : 'bottom-2 text-[10px]'}`} style={{ fontFamily: "'Inter', sans-serif" }}>
                 Generated by <span className="font-black italic">FEES PLEASE</span>
               </div>
             </div>
             
             {planTier === 'free' && (
               <div className="absolute inset-0 z-[100] pointer-events-none flex items-center justify-center overflow-hidden">
                 <div className="w-[150%] py-12 bg-black/50 backdrop-blur-md -rotate-[35deg] flex items-center justify-center shadow-[0_0_50px_rgba(0,0,0,0.5)] border-y border-white/20">
                   <span className="text-white font-black uppercase tracking-[0.5em] text-6xl drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] opacity-90 whitespace-nowrap">PREVIEW ONLY</span>
                 </div>
               </div>
             )}

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
                        <input type="range" min="0.1" max="3" step="0.1" value={imageZoom} onChange={e => setImageZoom(parseFloat(e.target.value))} className="w-full accent-emerald-500" />
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

            {/* Lineup Reorder - hidden in club edit mode */}
            {editMode !== 'club' && (
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
                          <select 
                            value={idx + 1}
                            onChange={(e) => {
                              const newIdx = parseInt(e.target.value) - 1;
                              const newOrdered = [...orderedPlayers];
                              const [moved] = newOrdered.splice(idx, 1);
                              newOrdered.splice(newIdx, 0, moved);
                              setOrderedPlayers(newOrdered);
                            }}
                            className="bg-zinc-800 text-white text-xs font-bold rounded px-2 py-1 border border-zinc-700 outline-none cursor-pointer"
                          >
                            {orderedPlayers.map((_, i) => (
                              <option key={i} value={i + 1}>{i + 1}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Fixture Overrides (Per-Game) - hidden in club edit mode */}
            {editMode !== 'club' && (
              <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/30">
                <div className="p-4 flex flex-col gap-4">
                  <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-500"><i className="fa-solid fa-gamepad"></i> Fixture Overrides</span>
                  
                  <div>
                    <label className="text-[9px] font-bold text-zinc-600 uppercase mb-1 block">Match Notes Override</label>
                    <input type="text" value={matchNotesOverride} onChange={e => setMatchNotesOverride(e.target.value)} placeholder={fixture?.notes || 'No default notes'} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-bold text-zinc-100 outline-none focus:border-emerald-500 transition-colors" />
                  </div>
                  
                  <div>
                    <label className="text-[9px] font-bold text-zinc-600 uppercase mb-1 block">Notes Background Color</label>
                    <div className="flex gap-2">
                      <input type="color" value={matchNotesBg === 'transparent' ? '#000000' : matchNotesBg} onChange={e => setMatchNotesBg(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0 p-0 shrink-0 bg-transparent" />
                      <button 
                        onClick={() => setMatchNotesBg(matchNotesBg === 'transparent' ? 'rgba(0,0,0,0.5)' : 'transparent')}
                        className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-[10px] font-black uppercase transition-colors"
                      >
                        {matchNotesBg === 'transparent' ? 'Add Background' : 'Remove Background'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Layout Configuration Accordion */}
            <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/30">
              <button 
                onClick={() => setAdvancedSettingsExpanded(!advancedSettingsExpanded)}
                className="w-full p-4 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                <span className="flex items-center gap-2"><i className="fa-solid fa-sliders"></i> {editMode === 'club' ? 'Global Branding Defaults' : 'Layout Configuration'}</span>
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

                  {/* Edit Mode: Club - Colors and Fonts */}
                  {editMode === 'club' && (
                    <>
                      <div className="space-y-3 pt-4 border-t border-zinc-800">
                         <h3 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Theme Colors</h3>
                         <div className="flex flex-col gap-3">
                           <div>
                             <label className="text-[9px] font-bold text-zinc-600 uppercase mb-1 block">Primary</label>
                             <div className="flex gap-2">
                               <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0 p-0 shrink-0 bg-transparent" />
                               <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono uppercase text-zinc-100 outline-none focus:border-emerald-500 transition-colors" />
                             </div>
                           </div>
                           <div>
                             <label className="text-[9px] font-bold text-zinc-600 uppercase mb-1 block">Secondary</label>
                             <div className="flex gap-2">
                               <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0 p-0 shrink-0 bg-transparent" />
                               <input type="text" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono uppercase text-zinc-100 outline-none focus:border-emerald-500 transition-colors" />
                             </div>
                           </div>
                         </div>
                      </div>

                      <div className="space-y-3 pt-4 border-t border-zinc-800">
                         <h3 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Header & Match Details</h3>
                         <div>
                           <label className="text-[9px] font-bold text-zinc-600 uppercase mb-1 block">Header Background Override (Optional)</label>
                           <div className="flex gap-2">
                             <input type="color" value={headerBgColor || primaryColor} onChange={e => setHeaderBgColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0 p-0 shrink-0 bg-transparent" />
                             <button onClick={() => setHeaderBgColor("")} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-[10px] font-black uppercase transition-colors">Reset Default</button>
                           </div>
                         </div>
                         <div className="grid grid-cols-2 gap-3">
                           <div>
                             <label className="text-[9px] font-bold text-zinc-600 uppercase mb-1 block">Team Names Font</label>
                             <input type="text" list="google-fonts-list" value={teamNamesFont} onChange={e => setTeamNamesFont(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs font-bold outline-none text-zinc-100" />
                           </div>
                           <div>
                             <label className="text-[9px] font-bold text-zinc-600 uppercase mb-1 block">Team Text Color</label>
                             <div className="flex gap-2">
                               <input type="color" value={teamNamesColor} onChange={e => setTeamNamesColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 p-0 shrink-0 bg-transparent" />
                               <input type="text" value={teamNamesColor} onChange={e => setTeamNamesColor(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 text-[10px] font-mono uppercase text-zinc-100 outline-none focus:border-emerald-500" />
                             </div>
                           </div>
                         </div>
                         <div className="grid grid-cols-2 gap-3">
                           <div>
                             <label className="text-[9px] font-bold text-zinc-600 uppercase mb-1 block">Date & Location</label>
                             <div className="flex gap-2">
                               <input type="color" value={matchDetailsColor} onChange={e => setMatchDetailsColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 p-0 shrink-0 bg-transparent" />
                               <input type="text" value={matchDetailsColor} onChange={e => setMatchDetailsColor(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 text-[10px] font-mono uppercase text-zinc-100 outline-none focus:border-emerald-500" />
                             </div>
                           </div>
                           <div>
                             <label className="text-[9px] font-bold text-zinc-600 uppercase mb-1 block">VS & Notes Color</label>
                             <div className="flex gap-2">
                               <input type="color" value={matchNotesColor || secondaryColor} onChange={e => setMatchNotesColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 p-0 shrink-0 bg-transparent" />
                               <input type="text" value={matchNotesColor || secondaryColor} onChange={e => setMatchNotesColor(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 text-[10px] font-mono uppercase text-zinc-100 outline-none focus:border-emerald-500" />
                             </div>
                           </div>
                         </div>
                      </div>

                      <div className="space-y-3 pt-4 border-t border-zinc-800">
                         <h3 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Player List Fonts</h3>
                         <div className="grid grid-cols-2 gap-3">
                           <div>
                             <label className="text-[9px] font-bold text-zinc-600 uppercase mb-1 block">Player Font</label>
                             <input type="text" list="google-fonts-list" value={playerNamesFont} onChange={e => setPlayerNamesFont(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs font-bold outline-none text-zinc-100" />
                           </div>
                           <div>
                             <label className="text-[9px] font-bold text-zinc-600 uppercase mb-1 block">Player Text Color</label>
                             <div className="flex gap-2">
                               <input type="color" value={playerNamesColor} onChange={e => setPlayerNamesColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 p-0 shrink-0 bg-transparent" />
                               <input type="text" value={playerNamesColor} onChange={e => setPlayerNamesColor(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 text-[10px] font-mono uppercase text-zinc-100 outline-none focus:border-emerald-500" />
                             </div>
                           </div>
                         </div>
                      </div>

                      <datalist id="google-fonts-list">
                         {COMMON_GOOGLE_FONTS.map(font => (
                           <option key={font} value={font} />
                         ))}
                      </datalist>

                      <div className="space-y-3 pt-4 border-t border-zinc-800">
                         <h3 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Sponsor Logos</h3>
                         <div>
                           <label className="text-[9px] font-bold text-zinc-600 uppercase mb-2 flex justify-between">
                             <span>Global Logo Scale</span>
                             <span>{sponsorScale}%</span>
                           </label>
                           <input type="range" min="30" max="150" value={sponsorScale} onChange={e => setSponsorScale(parseInt(e.target.value))} className="w-full accent-emerald-500" />
                         </div>

                         {orderedSponsors.length > 0 && (
                           <div className="mt-4 space-y-4 border-t border-zinc-800/50 pt-4">
                             <label className="text-[9px] font-bold text-zinc-600 uppercase mb-2 block">Individual Adjustments</label>
                             {orderedSponsors.map(s => {
                               const style = sponsorStyles[s.index] || { scale: 100, x: 0, y: 0 };
                               return (
                                 <div key={s.index} className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800/80">
                                   <div className="flex items-center gap-3 mb-3">
                                     <div className="flex flex-col gap-1 mr-1">
                                       <button onClick={() => handleMoveSponsor(s.index, -1)} disabled={orderedSponsors.indexOf(s) === 0} className="w-5 h-5 rounded bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center disabled:opacity-30">
                                         <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
                                       </button>
                                       <button onClick={() => handleMoveSponsor(s.index, 1)} disabled={orderedSponsors.indexOf(s) === orderedSponsors.length - 1} className="w-5 h-5 rounded bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center disabled:opacity-30">
                                         <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                                       </button>
                                     </div>
                                     <div className="w-8 h-8 rounded bg-white flex items-center justify-center p-1 overflow-hidden shrink-0">
                                       <img src={s.logo} className="max-w-full max-h-full object-contain" />
                                     </div>
                                     <span className="text-[10px] font-bold text-zinc-300 truncate flex-1">Sponsor {orderedSponsors.indexOf(s) + 1}</span>
                                     <button onClick={() => setSponsorStyles(prev => ({ ...prev, [s.index]: { scale: 100, x: 0, y: 0 } }))} className="text-[9px] text-zinc-500 hover:text-white uppercase tracking-wider bg-zinc-900 px-2 py-1 rounded">Reset</button>
                                   </div>
                                   <div className="space-y-3">
                                     <div>
                                       <div className="flex justify-between text-[8px] font-bold text-zinc-500 uppercase mb-1">
                                         <span>Scale</span><span>{style.scale || 100}%</span>
                                       </div>
                                       <input type="range" min="50" max="250" value={style.scale || 100} onChange={e => setSponsorStyles(prev => ({ ...prev, [s.index]: { ...style, scale: parseInt(e.target.value) } }))} className="w-full accent-emerald-500" />
                                     </div>
                                     <div className="grid grid-cols-2 gap-3">
                                       <div>
                                         <div className="flex justify-between text-[8px] font-bold text-zinc-500 uppercase mb-1">
                                           <span>X Offset</span><span>{style.x || 0}px</span>
                                         </div>
                                         <input type="range" min="-100" max="100" value={style.x || 0} onChange={e => setSponsorStyles(prev => ({ ...prev, [s.index]: { ...style, x: parseInt(e.target.value) } }))} className="w-full accent-emerald-500" />
                                       </div>
                                       <div>
                                         <div className="flex justify-between text-[8px] font-bold text-zinc-500 uppercase mb-1">
                                           <span>Y Offset</span><span>{style.y || 0}px</span>
                                         </div>
                                         <input type="range" min="-100" max="100" value={style.y || 0} onChange={e => setSponsorStyles(prev => ({ ...prev, [s.index]: { ...style, y: parseInt(e.target.value) } }))} className="w-full accent-emerald-500" />
                                       </div>
                                     </div>
                                   </div>
                                 </div>
                               );
                             })}
                           </div>
                         )}
                      </div>
                    </>
                  )}

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
                     
                     <div>
                       <label className="text-[9px] font-bold text-zinc-600 uppercase mb-2 flex justify-between">
                         <span>Letter Spacing</span>
                         <span>{letterSpacing}px</span>
                       </label>
                       <input type="range" min="-5" max="30" step="0.5" value={letterSpacing} onChange={e => setLetterSpacing(parseFloat(e.target.value))} className="w-full accent-emerald-500" />
                     </div>
                  </div>



                  {/* Save Settings */}
                  <div className="pt-4 border-t border-zinc-800 mt-6">
                    <button 
                      onClick={saveSettings}
                      className="w-full py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold uppercase tracking-widest text-[10px] transition-colors flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-floppy-disk"></i> Save Configuration
                    </button>
                    <p className="text-[8px] text-zinc-500 text-center mt-2">Saves layout and styles for future use</p>
                  </div>
                </div>
              )}
            </div>
            
          </div>

          {/* Generate Button Footer */}
          <div className="p-4 border-t border-zinc-800 bg-[#111]">
            {editMode === 'club' ? (
               <button 
                 onClick={onClose}
                 className="w-full py-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-black/20 flex items-center justify-center gap-2 transition-transform active:scale-95"
               >
                 Close Editor
               </button>
            ) : planTier === 'free' ? (
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('navigate-setup', { detail: 'billing' }))}
                className="w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs text-amber-900 bg-amber-400 hover:bg-amber-300 shadow-md shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-wand-magic-sparkles"></i> Upgrade to Generate
              </button>
            ) : (
              <div className="flex gap-3">
                <button 
                  onClick={downloadImage}
                  disabled={isGenerating}
                  className="flex-1 py-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-black/20 flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
                >
                  {isGenerating ? <><i className="fa-solid fa-spinner fa-spin"></i></> : <><i className="fa-solid fa-download"></i> Download</>}
                </button>
                {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                  <button 
                    onClick={shareImage}
                    disabled={isGenerating}
                    className="flex-[2] py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
                  >
                    {isGenerating ? <><i className="fa-solid fa-spinner fa-spin"></i> Generating...</> : <><i className="fa-solid fa-share-nodes"></i> Share Image</>}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}
