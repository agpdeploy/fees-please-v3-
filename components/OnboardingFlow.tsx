// components/OnboardingFlow.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import DaiveOnboardingChat from "./DaiveOnboardingChat"; 
import Step2_Branding from "./Step2_Branding";          
import Step3_Squad from "./Step3_Squad";                
import Step4_Season from "./Step4_Season";              
import Step5_Payment from "./Step5_Payment";

const STEPS = [
  { id: 1, title: "Identity", icon: "fa-robot" },
  { id: 2, title: "Branding", icon: "fa-palette" },
  { id: 3, title: "Squad", icon: "fa-users" },
  { id: 4, title: "Season", icon: "fa-calendar-days" },
  { id: 5, title: "Payments", icon: "fa-money-bill-wave" }
];

export default function OnboardingFlow({ user, onComplete }: { user: any, onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [clubId, setClubId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  
  const { roles, loading } = useProfile(); 

  // PERSISTENCE & RESUME LOGIC (With Self-Healing)
  useEffect(() => {
    if (loading) return; 

    const savedStep = localStorage.getItem('fp_onboarding_step');
    const savedClub = localStorage.getItem('fp_onboarding_club');
    
    // Check if the user actually has access to the club in localStorage
    const hasAccessToSavedClub = roles?.some(r => r.club_id === savedClub);

    // If we have a saved club but no role for it, the state is POISONED. Nuke it.
    if (savedClub && !hasAccessToSavedClub) {
      console.warn("Poisoned state detected. Resetting wizard.");
      localStorage.removeItem('fp_onboarding_step');
      localStorage.removeItem('fp_onboarding_club');
      setCurrentStep(1);
      setShowResumePrompt(false);
    } 
    // OPTION 1: Valid LocalStorage
    else if (savedStep && savedClub && hasAccessToSavedClub) {
      const stepNum = parseInt(savedStep, 10);
      setClubId(savedClub);
      if (stepNum > 1) {
        setShowResumePrompt(true);
      } else {
        setCurrentStep(stepNum);
      }
    } 
    // OPTION 2: Database fallback (Incognito, Device switch, or cleared cache)
    else if (roles && roles.length > 0) {
      const existingClubId = roles[0].club_id;
      if (existingClubId) {
        setClubId(existingClubId);
        localStorage.setItem('fp_onboarding_club', existingClubId);
        localStorage.setItem('fp_onboarding_step', '2'); // Resume at Branding
        setShowResumePrompt(true);
      } else {
        setCurrentStep(1);
      }
    } else {
      setCurrentStep(1);
    }

    setIsLoaded(true);
  }, [roles, loading]);

  const goToStep = (step: number, currentClubId: string | null = clubId) => {
    setCurrentStep(step);
    localStorage.setItem('fp_onboarding_step', step.toString());
    if (currentClubId) {
      setClubId(currentClubId);
      localStorage.setItem('fp_onboarding_club', currentClubId);
    }
  };

  const finishOnboarding = async (): Promise<void> => {
    if (user && clubId) {
      await supabase.from('profiles').update({ 
        has_onboarded: true,           
        onboarding_completed: true,    
        club_id: clubId 
      }).eq('id', user.id);
    }

    localStorage.removeItem('fp_onboarding_step');
    localStorage.removeItem('fp_onboarding_club');
    
    // Smooth transition back to dashboard
    if (onComplete) {
      onComplete();
    }
  };

  if (!isLoaded) return null;

  // THE INTERCEPTOR: The "Would you like to resume?" modal
  if (showResumePrompt) {
    return (
      <div className="fixed inset-0 z-[500] bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl animate-in zoom-in-95 fade-in duration-300">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fa-solid fa-clock-rotate-left text-3xl"></i>
          </div>
          <h2 className="text-2xl font-black italic uppercase text-zinc-900 dark:text-white mb-2 tracking-tighter">Resume Setup?</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-8 text-sm font-bold leading-relaxed">
            Want to pick up where you left off, or skip to the dashboard and finish setup later?
          </p>
          
          <div className="space-y-3">
            <button 
              onClick={() => {
                const step = localStorage.getItem('fp_onboarding_step') || '2';
                setCurrentStep(parseInt(step, 10));
                setShowResumePrompt(false);
              }} 
              className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-emerald-500 transition-colors shadow-md active:scale-95"
            >
              Yes, Resume Setup
            </button>
            <button 
              onClick={finishOnboarding} 
              className="w-full py-4 bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 rounded-xl font-black uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors active:scale-95"
            >
              No, Skip to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[400] bg-zinc-100 dark:bg-zinc-950 sm:p-6 flex items-center justify-center overflow-hidden">
      <div className="flex flex-col h-full sm:h-[700px] w-full max-w-3xl mx-auto font-sans bg-white dark:bg-[#111] shadow-2xl sm:rounded-2xl overflow-hidden border-0 sm:border border-zinc-200 dark:border-zinc-800 relative">
        
        <div className="bg-zinc-900 p-6 shrink-0 relative overflow-hidden">
          <div className="relative z-10 flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter">
                Setup • Step {currentStep}
              </h2>
              <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mt-1">
                {STEPS[currentStep - 1].title}
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              {currentStep > 1 && (
                <button 
                  onClick={finishOnboarding} 
                  className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors underline decoration-zinc-700 underline-offset-4 hidden sm:block"
                >
                  Skip to Dashboard
                </button>
              )}
              <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border border-white/20 text-white shrink-0">
                <i className={`fa-solid ${STEPS[currentStep - 1].icon} text-xl`}></i>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex gap-2">
            {STEPS.map((step) => (
              <div key={step.id} className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ease-out ${currentStep >= step.id ? 'bg-emerald-500' : 'bg-transparent w-0'}`}
                  style={{ width: currentStep >= step.id ? '100%' : '0%' }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-zinc-50 dark:bg-[#1A1A1A] relative flex flex-col">
          {currentStep === 1 && <DaiveOnboardingChat onComplete={(id) => goToStep(2, id)} />}
          {currentStep === 2 && clubId && <Step2_Branding clubId={clubId} onNext={() => goToStep(3)} />}
          {currentStep === 3 && clubId && <Step3_Squad clubId={clubId} onNext={() => goToStep(4)} />}
          {currentStep === 4 && clubId && <Step4_Season clubId={clubId} onNext={() => goToStep(5)} />}
          {currentStep === 5 && clubId && <Step5_Payment clubId={clubId} onNext={finishOnboarding} />}
        </div>
        
        {currentStep > 1 && (
           <div className="sm:hidden p-4 bg-zinc-50 dark:bg-[#1A1A1A] text-center border-t border-zinc-200 dark:border-zinc-800">
             <button onClick={finishOnboarding} className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                Skip to Dashboard
             </button>
           </div>
        )}
      </div>
    </div>
  );
}