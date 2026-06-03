/**
 * Calculates the gross amount to charge via Square Online (QR/Web)
 * Fees Please bundled rate varies by club plan:
 * Free Tier: 3.6% + $0.30
 * Plus/Pro/Override Tier: 2.2% + $0.30
 * Formula: Gross = (Net + Fixed) / (1 - Rate)
 */
export const calculateSquareOnlineGross = (netAmount: number, club?: any): number => {
  if (netAmount <= 0) return 0;
  
  // If the club is not passing fees to the payer, the gross amount is just the net amount.
  if (club && club.pass_processing_fees === false) {
    return netAmount;
  }
  
  const isFreeTier = club?.plan_tier === 'free';
  const hasOverride = club?.override_platform_fee === true;
  
  // Base Square wholesale fee is 2.2% + 30c
  let fpRate = 0.022; 
  const fixedFee = 0.30;
  
  if (isFreeTier && !hasOverride) {
    fpRate = 0.036; // Free tier pays 3.6%
  }
  
  const grossAmount = (netAmount + fixedFee) / (1 - fpRate);
  
  return Math.ceil(grossAmount * 100) / 100;
};