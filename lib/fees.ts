export function calculateSquareGross(netAmount: number) {
  // 1.9% Square + 1% Platform = 2.9%
  const gross = netAmount / 0.971; 
  return Number(gross.toFixed(2)); 
}

export function calculatePlatformFee(grossAmount: number) {
  return Number((grossAmount * 0.01).toFixed(2));
}