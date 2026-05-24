"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface SetupChecklistProps {
  activeClubId: string;
  clubInfo: any;
  teamFees: any;
  teamsCount: number;
  teams: any[];
  onDismiss: () => void;
}

export default function SetupChecklist({ activeClubId, clubInfo, teamFees, teamsCount, teams, onDismiss }: SetupChecklistProps) {
  const [hasPlayers, setHasPlayers] = useState(false);
  const [hasFixtures, setHasFixtures] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  // Logo state
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Player state
  const [playerMode, setPlayerMode] = useState<'daive'|'manual'>('daive');
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nickname, setNickname] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [isMember, setIsMember] = useState(true);
  const [isSavingPlayer, setIsSavingPlayer] = useState(false);
  const [draftPlayers, setDraftPlayers] = useState<any[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);

  // Fixture state
  const [opponent, setOpponent] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [location, setLocation] = useState("");
  const [isSavingFixture, setIsSavingFixture] = useState(false);

  // Financials state
  const [memberFee, setMemberFee] = useState(teamFees?.member || 10);
  const [casualFee, setCasualFee] = useState(teamFees?.casual || 25);
  const [payIdType, setPayIdType] = useState<'mobile'|'email'|'bank_account'>(clubInfo?.pay_id_type || 'mobile');
  const [payId, setPayId] = useState(clubInfo?.pay_id_value || "");
  const [expenseLabel, setExpenseLabel] = useState(clubInfo?.expense_label || "");
  const [isSquareEnabled, setIsSquareEnabled] = useState(clubInfo?.is_square_enabled || false);
  const [isSavingFinancials, setIsSavingFinancials] = useState(false);

  const teamId = teams && teams.length > 0 ? teams[0].id : null;

  useEffect(() => {
    async function checkStatus() {
      if (!activeClubId) return;
      const { count: playerCount } = await supabase.from('players').select('*', { count: 'exact', head: true }).eq('club_id', activeClubId);
      const { count: fixtureCount } = await supabase.from('fixtures').select('*', { count: 'exact', head: true }).eq('club_id', activeClubId);
      
      setHasPlayers((playerCount || 0) > 0);
      setHasFixtures((fixtureCount || 0) > 0);
      setLoading(false);
    }
    checkStatus();
  }, [activeClubId]);

  const hasLogo = !!clubInfo.logo;
  const hasTeams = teamsCount > 0;
  const hasFinancials = !!clubInfo.pay_id_value || !!clubInfo.is_square_enabled;

  const steps = [
    {
      id: 'teams',
      title: 'Add a team',
      completed: hasTeams,
    },
    {
      id: 'logo',
      title: 'Add a club logo',
      completed: hasLogo,
    },
    {
      id: 'players',
      title: 'Add players to your squad',
      completed: hasPlayers,
    },
    {
      id: 'fixtures',
      title: 'Add your season fixtures',
      completed: hasFixtures,
    },
    {
      id: 'financials',
      title: 'Set payment details',
      completed: hasFinancials,
    }
  ];

  const allCompleted = steps.every(s => s.completed);

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
            resolve(new File([blob], "image.webp", { type: "image/webp" }));
          }, "image/webp", 0.8);
        };
        img.onerror = () => reject("Image format invalid");
      };
      reader.onerror = () => reject("File read error");
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    try {
      const processedFile = await cropAndCompressImage(file);
      const fileName = `${activeClubId}-logo-${Math.random()}.webp`;
      const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, processedFile);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
      await supabase.from('clubs').update({ logo: data.publicUrl }).eq('id', activeClubId);
      // Mutate local object so it instantly checks off
      clubInfo.logo = data.publicUrl;
      setExpandedStep('players');
    } catch (err) {
      console.error(err);
      alert("Error uploading logo");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSavePlayerManual = async () => {
    if (!firstName || !teamId) return;
    setIsSavingPlayer(true);
    const { error } = await supabase.from('players').insert([{
      club_id: activeClubId,
      default_team_id: teamId,
      first_name: firstName,
      last_name: lastName,
      nickname: nickname || null,
      mobile_number: mobileNumber || null,
      email: emailAddress || null,
      is_member: isMember
    }]);
    setIsSavingPlayer(false);
    if (!error) {
      setHasPlayers(true);
      setExpandedStep('fixtures');
    } else {
      alert("Error saving player: " + error.message);
    }
  };

  const fileToBase64 = (f: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(f);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleDaiveUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !teamId) return;

    setIsExtracting(true);
    try {
      let payload: any = {};
      if (file.type.startsWith('image/')) {
        payload.fileBase64 = await fileToBase64(file);
        payload.mimeType = 'image/jpeg';
      } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        payload.csvText = await file.text();
      } else {
        throw new Error("Unsupported file format for inline dAIve. Try CSV or Image.");
      }
      
      const res = await fetch("/api/extract-roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.players && Array.isArray(data.players)) {
        setDraftPlayers(data.players);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to parse roster via dAIve.");
    } finally {
      setIsExtracting(false);
      e.target.value = '';
    }
  };

  const saveBulkPlayers = async () => {
    if (draftPlayers.length === 0 || !teamId) return;
    setIsSavingPlayer(true);
    const payload = draftPlayers.map(p => ({ 
      first_name: p.firstName || p.first_name,
      last_name: p.lastName || p.last_name || "",
      is_member: true,
      club_id: activeClubId,
      default_team_id: teamId, 
    }));
    const { error } = await supabase.from("players").insert(payload);
    setIsSavingPlayer(false);
    if (!error) {
      setHasPlayers(true);
      setExpandedStep('fixtures');
      setDraftPlayers([]);
    } else {
      alert("Error saving players");
    }
  };

  const handleSaveFixture = async () => {
    if (!opponent || !matchDate || !teamId) return;
    setIsSavingFixture(true);
    const { error } = await supabase.from('fixtures').insert([{
      club_id: activeClubId,
      team_id: teamId,
      opponent,
      match_date: matchDate,
      start_time: startTime,
      location: location,
      status: 'scheduled'
    }]);
    setIsSavingFixture(false);
    if (!error) {
      setHasFixtures(true);
      setExpandedStep('financials');
    } else {
      alert("Error saving fixture: " + error.message);
    }
  };

  const handleSaveFinancials = async () => {
    if (!teamId) return;
    setIsSavingFinancials(true);
    await supabase.from('teams').update({ 
      member_fee: memberFee, 
      casual_fee: casualFee 
    }).eq('id', teamId);
    
    await supabase.from('clubs').update({ 
      pay_id_type: payIdType,
      pay_id_value: payId || null,
      expense_label: expenseLabel || null,
      is_square_enabled: isSquareEnabled
    }).eq('id', activeClubId);
    
    // Mutate local object so it checks off
    clubInfo.pay_id_value = payId || null;
    clubInfo.is_square_enabled = isSquareEnabled;
    setIsSavingFinancials(false);
    setExpandedStep(null);
  };

  if (loading) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-900/50 p-6 rounded-2xl shadow-sm mb-6 animate-in slide-in-from-top-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
      
      <div className="flex justify-between items-start mb-5">
        <div>
          <h3 className="font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 text-sm mb-1">Let's Get Started</h3>
          <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Complete these steps to set up your club.</p>
        </div>
        <button 
          onClick={onDismiss}
          className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        >
          Dismiss
        </button>
      </div>

      {/* Video Placeholder */}
      <div className="mb-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex flex-col items-center justify-center py-10 px-4 text-zinc-400 dark:text-zinc-500 transition-colors shadow-inner">
        <i className="fa-brands fa-youtube text-4xl mb-2 opacity-50"></i>
        <span className="text-xs font-black uppercase tracking-widest opacity-80">Welcome Video Coming Soon</span>
      </div>

      <div className="space-y-3">
        {steps.map(step => (
          <div key={step.id} className={`flex flex-col p-3.5 rounded-xl border transition-colors ${step.completed ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${step.completed ? 'bg-emerald-500 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400'}`}>
                  {step.completed ? <i className="fa-solid fa-check text-[10px]"></i> : <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500"></span>}
                </div>
                <span className={`text-xs font-bold ${step.completed ? 'line-through text-emerald-700/60 dark:text-emerald-500/60' : 'text-zinc-900 dark:text-white'}`}>
                  {step.title}
                </span>
              </div>
              {!step.completed && (
                <button 
                  onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                  className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 bg-emerald-100/50 dark:bg-emerald-500/10 hover:bg-emerald-200/50 dark:hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
                >
                  {expandedStep === step.id ? "Close" : "Expand"}
                  <i className={`fa-solid fa-chevron-${expandedStep === step.id ? 'up' : 'down'}`}></i>
                </button>
              )}
            </div>

            {/* Inline expansion area */}
            {expandedStep === step.id && !step.completed && (
              <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700 animate-in slide-in-from-top-2">
                
                {/* Logo Upload Inline */}
                {step.id === 'logo' && (
                  <div className="relative group border-2 border-dashed border-emerald-500/50 dark:border-emerald-600/50 rounded-xl p-6 text-center hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors bg-white dark:bg-zinc-800 cursor-pointer">
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className="w-12 h-12 mx-auto bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm">
                      {isUploadingLogo ? <i className="fa-solid fa-circle-notch fa-spin text-xl text-emerald-600 dark:text-emerald-500"></i> : <i className="fa-solid fa-cloud-arrow-up text-xl text-emerald-600 dark:text-emerald-500"></i>}
                    </div>
                    <h3 className="font-black tracking-widest text-xs text-emerald-800 dark:text-emerald-400 mb-1">{isUploadingLogo ? 'Uploading...' : 'Tap to Upload Logo'}</h3>
                  </div>
                )}

                {/* Players Inline */}
                {step.id === 'players' && (
                  <div>
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-1 mb-4 transition-colors">
                      <button onClick={() => setPlayerMode('daive')} className={`flex-1 py-2 text-[9px] font-black tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${playerMode === 'daive' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}>
                        <i className="fa-solid fa-wand-magic-sparkles"></i> dAIve
                      </button>
                      <button onClick={() => setPlayerMode('manual')} className={`flex-1 py-2 text-[9px] font-black tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${playerMode === 'manual' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}>
                        <i className="fa-solid fa-keyboard"></i> MANUAL
                      </button>
                    </div>

                    {playerMode === 'daive' ? (
                      draftPlayers.length === 0 ? (
                        <div className="relative text-center p-6 border-2 border-dashed border-emerald-500/50 rounded-xl bg-white dark:bg-zinc-800 cursor-pointer hover:bg-emerald-50/50 transition-colors">
                          <input type="file" accept="image/*,.csv" onChange={handleDaiveUpload} disabled={isExtracting} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                          {isExtracting ? (
                             <i className="fa-solid fa-circle-notch fa-spin text-2xl text-emerald-500 mb-2"></i>
                          ) : (
                             <i className="fa-solid fa-wand-magic-sparkles text-2xl text-emerald-500 mb-2"></i>
                          )}
                          <p className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">
                            {isExtracting ? 'dAIve is extracting...' : 'Upload Image or CSV'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-center">
                            <h4 className="text-xs font-black text-emerald-700 dark:text-emerald-500 uppercase tracking-widest mb-1">Found {draftPlayers.length} Players</h4>
                          </div>
                          <button onClick={saveBulkPlayers} disabled={isSavingPlayer} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-lg uppercase tracking-widest text-[10px] active:scale-95 transition-all shadow-sm disabled:opacity-50">
                            {isSavingPlayer ? 'Saving...' : 'Import to Squad'}
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <input type="text" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                          <input type="text" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                        </div>
                        <div className="flex gap-2">
                          <input type="text" placeholder="Nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                          <input type="tel" placeholder="Mobile Number" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                        </div>
                        <input type="email" placeholder="Email Address" value={emailAddress} onChange={(e) => setEmailAddress(e.target.value)} className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                        
                        <div className="flex items-center justify-between border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 bg-zinc-50 dark:bg-zinc-800 transition-colors">
                           <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">Status</span>
                           <button 
                             onClick={() => setIsMember(!isMember)}
                             className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors shadow-sm ${isMember ? 'bg-emerald-600 text-white' : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'}`}
                           >
                             {isMember ? 'MEMBER' : 'CASUAL'}
                           </button>
                        </div>

                        <button disabled={isSavingPlayer || !firstName} onClick={handleSavePlayerManual} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-lg uppercase tracking-widest text-[10px] active:scale-95 transition-all shadow-sm disabled:opacity-50">
                          {isSavingPlayer ? 'Saving...' : 'Add Player'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Fixtures Inline */}
                {step.id === 'fixtures' && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Add your first match</p>
                    <input type="text" placeholder="Opponent Name" value={opponent} onChange={(e) => setOpponent(e.target.value)} className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                    <div className="flex gap-2">
                      <input type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} className="flex-[0.8] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 color-scheme-light dark:color-scheme-dark transition-colors" />
                      <input type="text" placeholder="Time (e.g. 1:00 PM)" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="flex-[0.6] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                    </div>
                    <input type="text" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                    
                    <button disabled={isSavingFixture || !opponent || !matchDate} onClick={handleSaveFixture} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-lg uppercase tracking-widest text-[10px] active:scale-95 transition-all shadow-sm disabled:opacity-50">
                      {isSavingFixture ? 'Saving...' : 'Save Fixture'}
                    </button>
                  </div>
                )}

                {/* Financials Inline */}
                {step.id === 'financials' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800 p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 transition-colors">
                      <span className="text-[10px] font-black text-zinc-900 dark:text-zinc-300 uppercase tracking-widest">Enable Square</span>
                      <button onClick={() => setIsSquareEnabled(!isSquareEnabled)} className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors shadow-sm ${isSquareEnabled ? 'bg-emerald-600 text-white' : 'bg-zinc-300 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-300'}`}>{isSquareEnabled ? 'Active' : 'Disabled'}</button>
                    </div>

                    <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors space-y-3">
                      <h4 className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-2">Manual Payment Fallback</h4>
                      
                      <div className="flex gap-2">
                        <div className="w-1/3">
                          <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Type</label>
                          <select 
                            value={payIdType || ""} 
                            onChange={(e) => setPayIdType(e.target.value as any)} 
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
                          >
                            <option value="mobile">PayID (Mobile)</option>
                            <option value="email">PayID (Email)</option>
                            <option value="bank_account">Bank Account</option>
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="text-[9px] text-zinc-500 uppercase font-black ml-1 block mb-1">Details</label>
                          <input 
                            type="text" 
                            value={payId || ""} 
                            onChange={(e) => setPayId(e.target.value)} 
                            placeholder={payIdType === 'mobile' ? 'e.g. 0400 000 000' : payIdType === 'email' ? 'e.g. admin@club.com' : 'e.g. BSB: 123-456 ACC: 12345678'}
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" 
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors space-y-3">
                      <h4 className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-2">Defaults & Labels</h4>
                      
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Member Fee ($)</label>
                          <input type="number" value={memberFee} onChange={(e) => setMemberFee(Number(e.target.value))} className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                        </div>
                        <div className="flex-1">
                          <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Casual Fee ($)</label>
                          <input type="number" value={casualFee} onChange={(e) => setCasualFee(Number(e.target.value))} className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Global Expense Label</label>
                        <input type="text" placeholder="e.g. Umpire Fee, Court Hire" value={expenseLabel} onChange={(e) => setExpenseLabel(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                      </div>
                    </div>
                    
                    <button disabled={isSavingFinancials} onClick={handleSaveFinancials} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-lg uppercase tracking-widest text-[10px] active:scale-95 transition-all shadow-sm disabled:opacity-50 mt-2">
                      {isSavingFinancials ? 'Saving...' : 'Save Financials'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {allCompleted && (
        <button 
          onClick={onDismiss}
          className="w-full mt-5 bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white font-black uppercase tracking-widest text-xs py-3.5 rounded-xl transition-all shadow-md active:scale-95"
        >
          Complete Setup
        </button>
      )}
    </div>
  );
}
