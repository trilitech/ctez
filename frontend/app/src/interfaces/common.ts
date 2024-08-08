export interface ErrorType {
  [key: number]: string;
}

export type AddressTrimSizeType = 'small' | 'medium' | 'large';

export interface BaseStats {
  originalTarget: number;
  ctezDexFeeIndex: number;
  tezDexFeeIndex: number;
  currentTarget: number;
  currentCtezSellPrice: number;
  currentTezSellPrice: number;
  currentCtezBuyPrice: number;
  currentTezBuyPrice: number;
  currentAvgPrice: number;
  premium: number;
  currentAnnualDrift: number;
  drift: number;
  ctezDexSelfTokens: number;
  ctezDexProceeds: number;
  ctezDexSubsidy: number;
  ctezDexFeeRate: number;
  tezDexSelfTokens: number;
  tezDexProceeds: number;
  tezDexSubsidy: number;
  tezDexFeeRate: number;
}

export interface UserOvenStats {
  totalOvens: number;
  xtz: number;
  ctez: number;
}
