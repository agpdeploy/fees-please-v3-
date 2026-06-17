/**
 * Calculates the gross amount to charge via Square Online (QR/Web)
 * Fees Please bundled rate varies by club plan:
 * Free Tier: 2.2% + $0.30 (Square wholesale) + 2.5% platform clip = 4.7% + $0.30
 * Plus Tier: 2.2% + $0.30 (Square wholesale) + $0.30 platform clip = 2.2% + $0.60
 * Pro Tier: 2.2% + $0.30 (Square wholesale) + $0.15 platform clip = 2.2% + $0.45
 * Override: 2.2% + $0.30 (Square wholesale only)
 * Formula: Gross = (Net + Fixed) / (1 - Rate)
 */
export const calculateSquareOnlineGross = (netAmount: number, club?: any): number => {
  if (netAmount <= 0) return 0;
  
  const planTier = club?.plan_tier || 'free';
  const hasOverride = club?.override_platform_fee === true;
  
  let fpRate = 0.022; 
  let fixedFee = 0.30;
  
  if (hasOverride) {
    // Square wholesale only: 2.2% + 30c
    fpRate = 0.022;
    fixedFee = 0.30;
  } else if (planTier === 'free') {
    // 2.2% + 30c (Square) + 2.5% platform clip = 4.7% + 30c
    fpRate = 0.022 + 0.025;
    fixedFee = 0.30;
  } else if (planTier === 'plus') {
    // 2.2% + 30c (Square) + 30c platform clip = 2.2% + 60c
    fpRate = 0.022;
    fixedFee = 0.30 + 0.30;
  } else if (planTier === 'pro') {
    // 2.2% + 30c (Square) + 15c platform clip = 2.2% + 45c
    fpRate = 0.022;
    fixedFee = 0.30 + 0.15;
  }
  
  const grossAmount = (netAmount + fixedFee) / (1 - fpRate);
  
  return Math.ceil(grossAmount * 100) / 100;
};