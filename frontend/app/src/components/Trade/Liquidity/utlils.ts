export const calcRedeemedAmount = (liquidityRedeemed: number, reserves: number, totalLiquidityShares: number, debt: number): number => {
    const denominator = Math.max(totalLiquidityShares, 1);
    const redeemedAmount = Math.floor(liquidityRedeemed * reserves / denominator);
    return Math.max(redeemedAmount - debt, 0);
}
