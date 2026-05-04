// components/Step4_Season.tsx
"use client";

import { useState } from "react";
import { supabase } from '@/lib/supabase';

export default function Step4_Season({ onNext, clubId }: { onNext: () => void, clubId: string }) {
  const [loading, setLoading] = useState(false);
  
  // Conversational State
  const [chatStep, setChatStep] = useState(1);
  const [seasonName, setSeasonName] = useState("");
  const [startMonth, setStartMonth] = useState("");
  const [endMonth, setEndMonth] = useState("");
  
  // Fee State
  const [expenseLabel, setExpenseLabel] = useState("");
  const [umpireFee, setUmpireFee] = useState<number | "">("");
  const [memberFee, setMemberFee] = useState<number | "">("");
  const [casualFee, setCasualFee] = useState<number | "">("");

  const handleNextChat = () => {
    if (chatStep < 5) setChatStep(chatStep + 1);
    else handleSave();
  };

  const handleSameAsMembers = () => {
    setCasualFee(memberFee);
    handleSave(memberFee); // Pass member fee directly so we don't race state
  };

  const handleSave = async (overrideCasualFee?: number | "") => {
    setLoading(true);
    try {
      // Calculate basic dates from months (Default to 1st of start month, last of end month)
      const year = new Date().getFullYear();
      const startDate = startMonth ? new Date(`${startMonth} 1, ${year}`).toISOString().split('T')[0] : null;
      const endDate = endMonth ? new Date(`${endMonth} 28, ${year}`).toISOString().split('T')[0] : null; // Rough end date for syncing
      
      // 1. Save to seasons table
      const { error: seasonError } = await supabase.from('seasons').insert([{
        club_id: clubId,
        name: seasonName || `Season ${year}`,
        start_date: startDate,
        end_date: endDate,
        is_active: true
      }]);

      if (!seasonError) {
        // 2. Sync defaults to clubs table so the Setup UI has them
        const finalCasualFee = overrideCasualFee !== undefined ? overrideCasualFee : casualFee;
        
        await supabase.from('clubs').update({
          season_name: seasonName,
          season_start: startDate,
          season_end: endDate,
          expense_label: expenseLabel || "Umpire Fee",
          default_umpire_fee: umpireFee === "" ? 0 : umpireFee,
          default_member_fee: memberFee === "" ? 0 : memberFee,
          default_casual_fee: finalCasualFee === "" ? (memberFee === "" ? 0 : memberFee) : finalCasualFee
        }).eq('id', clubId);
        
        onNext();
      } else {
        throw seasonError;
      }
    } catch (err) {
      console.error(err);
      onNext(); // Fallback to next step if something fails
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 sm:p-10 items-center justify-center bg-zinc-50">
      <div className="w-full max-w-md bg-white p-8 rounded-3xl border border-zinc-200 shadow-xl space-y-6 relative overflow-hidden min-h-[350px] flex flex-col justify-center">
        
        {/* STEP 1: SEASON NAME */}
        {chatStep === 1 && (
          <div className="animate-in slide-in-from-right fade-in duration-300">
            <h3 className="text-2xl font-black italic tracking-tighter text-zinc-900 mb-2">What is the season we're looking to set up?</h3>
            <p className="text-sm text-zinc-500 mb-6 font-bold">e.g., Fireballs Winter 26, Summer 2027.</p>
            <input 
              type="text" 
              autoFocus
              value={seasonName} 
              onChange={(e) => setSeasonName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && seasonName && handleNextChat()}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-4 font-bold text-lg text-zinc-900 outline-none focus:border-emerald-500"
            />
          </div>
        )}

        {/* STEP 2: DATES */}
        {chatStep === 2 && (
          <div className="animate-in slide-in-from-right fade-in duration-300">
            <h3 className="text-2xl font-black italic tracking-tighter text-zinc-900 mb-6">When does it kick off and wrap up?</h3>
            <div className="flex gap-4 mb-2">
              <div className="flex-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Starts (Month)</label>
                <select value={startMonth} onChange={(e) => setStartMonth(e.target.value)} className="w-full mt-1 bg-zinc-50 border border-zinc-200 rounded-xl p-4 font-bold text-zinc-900 outline-none focus:border-emerald-500">
                  <option value="">Select...</option>
                  {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Ends (Month)</label>
                <select value={endMonth} onChange={(e) => setEndMonth(e.target.value)} className="w-full mt-1 bg-zinc-50 border border-zinc-200 rounded-xl p-4 font-bold text-zinc-900 outline-none focus:border-emerald-500">
                  <option value="">Select...</option>
                  {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: GAME DAY EXPENSES */}
        {chatStep === 3 && (
          <div className="animate-in slide-in-from-right fade-in duration-300">
            <h3 className="text-2xl font-black italic tracking-tighter text-zinc-900 mb-2">Any game day expenses?</h3>
            <p className="text-sm text-zinc-500 mb-6 font-bold">Like umpire fees or court hire.</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">What do you call it?</label>
                <input 
                  type="text" 
                  autoFocus
                  placeholder="e.g., Umpire Fees, Match Fee"
                  value={expenseLabel} 
                  onChange={(e) => setExpenseLabel(e.target.value)}
                  className="w-full mt-1 bg-zinc-50 border border-zinc-200 rounded-xl p-4 font-bold text-zinc-900 outline-none focus:border-emerald-500"
                />
              </div>
              
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">How much per game?</label>
                <div className="relative mt-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-lg">$</span>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    value={umpireFee} 
                    onChange={(e) => setUmpireFee(e.target.value === '' ? '' : Number(e.target.value))}
                    onKeyDown={(e) => e.key === 'Enter' && handleNextChat()}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-8 pr-4 py-4 font-bold text-lg text-zinc-900 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: MEMBER FEES */}
        {chatStep === 4 && (
          <div className="animate-in slide-in-from-right fade-in duration-300">
            <h3 className="text-2xl font-black italic tracking-tighter text-zinc-900 mb-2">What's the standard player fee?</h3>
            <p className="text-sm text-zinc-500 mb-6 font-bold">This is what your regular members pay per game.</p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-lg">$</span>
              <input 
                type="number" 
                autoFocus
                placeholder="10.00"
                value={memberFee} 
                onChange={(e) => setMemberFee(e.target.value === '' ? '' : Number(e.target.value))}
                onKeyDown={(e) => e.key === 'Enter' && handleNextChat()}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-8 pr-4 py-4 font-bold text-lg text-zinc-900 outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        )}

        {/* STEP 5: CASUAL FEES */}
        {chatStep === 5 && (
          <div className="animate-in slide-in-from-right fade-in duration-300">
            <h3 className="text-2xl font-black italic tracking-tighter text-zinc-900 mb-2">What about casual fill-ins?</h3>
            <p className="text-sm text-zinc-500 mb-6 font-bold">Do you charge a different amount for players not on the main roster?</p>
            
            <div className="relative mb-4">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-lg">$</span>
              <input 
                type="number" 
                autoFocus
                placeholder="15.00"
                value={casualFee} 
                onChange={(e) => setCasualFee(e.target.value === '' ? '' : Number(e.target.value))}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-8 pr-4 py-4 font-bold text-lg text-zinc-900 outline-none focus:border-emerald-500"
              />
            </div>

            <button 
              onClick={handleSameAsMembers} 
              className="text-xs font-bold text-emerald-600 hover:text-emerald-500 uppercase tracking-widest transition-colors flex items-center justify-center w-full"
            >
              <i className="fa-solid fa-arrow-turn-down -rotate-90 mr-2"></i> Nah, same as members (${memberFee || 0})
            </button>
          </div>
        )}

        <div className="pt-6 mt-auto flex gap-3">
          {chatStep > 1 && (
            <button onClick={() => setChatStep(chatStep - 1)} disabled={loading} className="py-4 px-6 bg-zinc-100 text-zinc-600 rounded-2xl font-black uppercase tracking-widest hover:bg-zinc-200 transition-all disabled:opacity-50">
              <i className="fa-solid fa-arrow-left"></i>
            </button>
          )}
          <button 
            onClick={handleNextChat}
            disabled={loading || (chatStep === 1 && !seasonName)}
            className="flex-1 py-4 bg-zinc-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            {loading ? "Saving..." : (chatStep === 5 ? "Lock it in" : "Next")}
          </button>
        </div>
      </div>
      
      <div className="flex gap-2 mt-6">
        {[1, 2, 3, 4, 5].map(step => (
          <div key={step} className={`w-2 h-2 rounded-full transition-colors ${chatStep >= step ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
        ))}
      </div>
    </div>
  );
}