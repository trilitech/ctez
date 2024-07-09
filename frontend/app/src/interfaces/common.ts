export interface ErrorType {
  [key: number]: string;
}

export type AddressTrimSizeType = 'small' | 'medium' | 'large';

export interface BaseStats {
  originalTarget: number;
  ctezDexFeeIndex: string;
  tezDexFeeIndex: string;
  currentTarget: string;
  currentCtezSellPrice: string;
  currentCtezBuyPrice: string;
  currentAvgPrice: string;
  premium: string;
  currentAnnualDrift: string;
  drift: number;
  [key: string]: string | number;
}

export interface UserOvenStats {
  totalOvens: number;
  xtz: number;
  ctez: number;
}
