'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase'; // Your supabase client

export default function OnboardingFlow({ user, onComplete }: { user: any, onComplete: () => void }) {
  const [step, setStep] = useState(1); // 1: Welcome/Fork, 2: Feature Tour

  const finishOnboarding = async () => {
    // Update Supabase so they don't see this again
    const { error } = await supabase
      .from('profiles')
      .update({ has_onboarded: true })
      .eq('id', user.id);

    if (!error) onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl">
        
        {/* STEP 1: Combined Welcome & Fork */}
        {step === 1 && (
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Fees Please!</h2>
            <p className="text-gray-600 mb-8">Ready to ditch the clipboard? Tell us why you're here today.</p>
            
            <div className="space-y-4">
              <button 
                onClick={() => setStep(2)}
                className="w-full p-4 border-2 border-blue-600 rounded-xl hover:bg-blue-50 transition text-left group"
              >
                <span className="block font-bold text-blue-600">I'm a Coach / Manager</span>
                <span className="text-sm text-gray-500">I want to set up a team and collect fees.</span>
              </button>

              <button 
                onClick={() => setStep(2)} // You could also skip straight to a "Join" screen
                className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-blue-600 transition text-left"
              >
                <span className="block font-bold text-gray-900">I'm a Player / Parent</span>
                <span className="text-sm text-gray-500">I'm here to pay my dues and get playing.</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Feature Tour */}
        {step === 2 && (
          <div className="text-center">
            <div className="mb-6 text-5xl">⚡</div>
            <h2 className="text-2xl font-bold mb-4">How it works</h2>
            <ul className="text-left space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <span className="text-green-500 font-bold">✓</span>
                <p className="text-gray-600">Set fee amounts for the season.</p>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-500 font-bold">✓</span>
                <p className="text-gray-600">Players pay securely via Square.</p>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-500 font-bold">✓</span>
                <p className="text-gray-600">We automate the "polite reminders."</p>
              </li>
            </ul>
            <button 
              onClick={finishOnboarding}
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition"
            >
              Let's Go!
            </button>
          </div>
        )}
      </div>
    </div>
  );
}