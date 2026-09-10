/**
 * Calculates the fee deductions for a given charge amount.
 * The player is charged exactly the `chargeAmount` (no surcharge).
 * Square deducts 2.2% of the chargeAmount.
 * Fees Please deducts a platform clip based on the club's plan.
 */
export const calculateFeeDeductions = (chargeAmount: number, club?: any) => {
  if (chargeAmount <= 0) return { squareFee: 0, platformFee: 0, netToClub: 0 };
  
  const planTier = club?.plan_tier || 'free';
  const hasOverride = club?.override_platform_fee === true;
  
  // Square online rate is 2.2%
  const squareFee = Math.round((chargeAmount * 0.022) * 100) / 100;
  
  let platformFee = 0;
  
  if (hasOverride) {
    platformFee = 0;
  } else if (planTier === 'free') {
    // Free Tier: 2.8% platform clip
    platformFee = Math.round((chargeAmount * 0.028) * 100) / 100;
  } else if (planTier === 'plus' || planTier === 'pro') {
    // Paid Tiers: 0% platform clip
    platformFee = 0;
  }
  
  const netToClub = Math.round((chargeAmount - squareFee - platformFee) * 100) / 100;
  
  return {
    squareFee,
    platformFee,
    netToClub
  };
};