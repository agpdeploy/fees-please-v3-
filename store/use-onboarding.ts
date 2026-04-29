// store/use-onboarding.ts
import { create } from 'zustand';

export type OnboardingStep = 'ROUTING' | 'BRANDING' | 'ROSTER' | 'FIRST_GAME' | 'PAYMENT' | 'COMPLETE';

interface OnboardingState {
  step: OnboardingStep;
  orgId: string | null;
  teamId: string | null;
  useCase: string | null;
  
  // Actions
  setStep: (step: OnboardingStep) => void;
  setEntities: (orgId: string, teamId: string, useCase: string) => void;
  nextStep: () => void;
  reset: () => void;
}

export const useOnboarding = create<OnboardingState>((set, get) => ({
  step: 'ROUTING',
  orgId: null,
  teamId: null,
  useCase: null,

  setStep: (step) => set({ step }),
  
  setEntities: (orgId, teamId, useCase) => set({ orgId, teamId, useCase }),

  nextStep: () => {
    const steps: OnboardingStep[] = ['ROUTING', 'BRANDING', 'ROSTER', 'FIRST_GAME', 'PAYMENT', 'COMPLETE'];
    const currentIdx = steps.indexOf(get().step);
    if (currentIdx < steps.length - 1) {
      set({ step: steps[currentIdx + 1] });
    }
  },

  reset: () => set({ step: 'ROUTING', orgId: null, teamId: null, useCase: null }),
}));