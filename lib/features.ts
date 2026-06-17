export const FEATURES = {
  EMAIL_COMMS: ['plus', 'pro'],
  AI_REPORTER: ['plus', 'pro'],
  SPONSORS: ['plus', 'pro'],
  SEASON_HISTORY: ['plus', 'pro'],
  REPORTS: ['pro'],
};

export type FeatureName = keyof typeof FEATURES;

export function hasFeature(tier: string | undefined | null, feature: FeatureName): boolean {
  // Default to free if tier is undefined/null
  const activeTier = tier ? tier.toLowerCase() : 'free';
  return FEATURES[feature].includes(activeTier);
}
