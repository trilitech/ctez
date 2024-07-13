import BigNumber from 'bignumber.js';

export interface AddLiquidityParams {
  owner: string;
  deadline: Date;
  minLqtMinted: number;
  amount: number;
  isCtezSide: boolean;
}

export interface RemoveLiquidityParams {
  to: string;
  deadline: Date;
  lqtBurned: number;
  minSelfReceived : number;
  minProceedsReceived: number;
  minSubsidyReceived: number;
  isCtezSide: boolean;
}

export interface CashToTokenParams {
  to: string;
  minTokensBought: number;
  deadline: Date;
  amount: number;
  // cashSold: number; # For !CASH_IS_TEZ
}

export interface TokenToCashParams {
  to: string;
  tokensSold: number;
  minCashBought: number;
  deadline: Date;
}

export interface TokenToTokenParams {
  outputCfmmContract: string;
  minTokensBought: number;
  to: string;
  tokensSold: number;
  deadline: Date;
}

export interface CfmmStorage {
  tokenPool: BigNumber;
  cashPool: BigNumber;
  pendingPoolUpdates: BigNumber;
  tokenAddress: string;
  lqtAddress: string;
  lastOracleUpdate: Date;
  consumerEntrypoint: string;
  lqtTotal: BigNumber;
}

export interface HalfDexLQTData {
  lqt: number;
  lqtShare: number;
}

export interface UserLQTData {
  ctezDexLqt: number;
  ctezDexLqtShare: number;
  tezDexLqt: number;
  tezDexLqtShare: number;
}
