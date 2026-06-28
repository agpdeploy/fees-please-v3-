export const FEATURES = {
  EMAIL_COMMS: ['plus', 'pro'],
  AI_REPORTER: ['plus', 'pro'],
  SPONSORS: ['plus', 'pro'],
  SEASON_HISTORY: ['plus', 'pro'],
  REPORTS: ['pro'],
};

export type FeatureName = keyof typeof FEATURES;

export function hasFeature(tierOrClub: string | any | undefined | null, feature: FeatureName): boolean {
  if (!tierOrClub) return FEATURES[feature].includes('free');
  
  let activeTier = 'free';
  
  if (typeof tierOrClub === 'string') {
    activeTier = tierOrClub.toLowerCase();
  } else {
    activeTier = tierOrClub.plan_tier ? tierOrClub.plan_tier.toLowerCase() : 'free';
    
    // Evaluate Trial Status
    if (tierOrClub.trial_ends_at && activeTier === 'free') {
      const trialEnd = new Date(tierOrClub.trial_ends_at);
      if (trialEnd > new Date()) {
        activeTier = 'plus';
      }
    }
  }

  return FEATURES[feature].includes(activeTier);
}
