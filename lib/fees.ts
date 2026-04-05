/**
 * Calculates the gross amount to charge via Square to ensure
 * the club receives the exact netAmount after Square's 1.6% card fee.
 * * Formula: Gross = Net / (1 - 0.016)
 */
export const calculateSquareGross = (netAmount: number): number => {
  if (netAmount <= 0) return 0;
  
  // Square Australia POS standard flat tap rate is 1.6%
  const squareRate = 0.016; 
  
  // Calculate the gross amount needed
  const grossAmount = netAmount / (1 - squareRate);
  
  // Round up to the nearest cent to guarantee no shortfall for the club
  return Math.ceil(grossAmount * 100) / 100;
};