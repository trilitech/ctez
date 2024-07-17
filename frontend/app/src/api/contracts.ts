import axios from 'axios';
import BigNumber from 'bignumber.js';
import { sub, format, differenceInDays } from 'date-fns';
import { getCfmmStorage, getLQTContractStorage } from '../contracts/cfmm';
import { getActualCtezStorage, getCtezStorage, getUserHalfDexLqtBalance } from '../contracts/ctez';
import { BaseStats, CTezStorage, CTezTzktStorage, HalfDex, OvenBalance, UserLQTData } from '../interfaces';
import { CONTRACT_DEPLOYMENT_DATE, RPC_URL } from '../utils/globals';
import { getOvenCtezOutstanding } from '../utils/ovenUtils';
import { getCTezTzktStorage, getLastBlockOfTheDay, getUserOvensAPI } from './tzkt';

export const getPrevCTezStorage = async (
  days = 7,
  userAddress?: string,
): Promise<CTezTzktStorage> => {
  const prevDate = format(sub(new Date(), { days }), 'yyyy-MM-dd');

  const lastBlock = await getLastBlockOfTheDay(prevDate, userAddress);
  const storage = await getCTezTzktStorage(lastBlock.level, userAddress);
  return storage;
};
export const getCurrentBlock = async () => {
  const response = await axios.get(`${RPC_URL}/chains/main/blocks/head`);

  return response.data.header.level;
};
export const getTimeStampOfBlock = async (block: number) => {
  const response = await axios.get(`https://api.tzkt.io/v1/blocks/${block}`);

  return response.data.timestamp;
};

const getMarginalPrice = (liquidity: number, targetLiquidity: number, targetPrice: number): number => {
  const u = Math.min(liquidity / targetLiquidity, 1);
  return targetPrice * (21 - 3 * u + 3 * u ** 2 - u ** 3) / 20;
}

export const getBaseStats = async (_userAddress?: string): Promise<BaseStats> => {
  const storage = await getActualCtezStorage();
  const target = storage.context.target.toNumber() / 2 ** 64;
  const sellCtezDex = storage.sell_ctez;
  const sellTezDex = storage.sell_tez;

  const ctezSellPrice = getMarginalPrice(
    sellCtezDex.self_reserves.toNumber(),
    /* eslint-disable */
    storage.context._Q.toNumber(),
    target
  );
  const tezBuyPrice = 1 / ctezSellPrice;

  const tezSellPrice = getMarginalPrice(
    sellTezDex.self_reserves.toNumber(),
    storage.context._Q.toNumber() * target,
    1 / target
  )
  const ctezBuyPrice = 1 / tezSellPrice;

  const currentAvgPrice = (ctezSellPrice + ctezBuyPrice) / 2
  const premium = currentAvgPrice === target ? 0 : currentAvgPrice / target - 1.0;
  const drift = storage.context.drift.toNumber() / 2 ** 64;
  const currentAnnualDrift = (1.0 + drift) ** (365.25 * 24 * 3600) - 1.0;

  return {
    originalTarget: storage.context.target.toNumber(),
    currentTarget: target,
    currentCtezSellPrice: ctezSellPrice,
    currentTezSellPrice: tezSellPrice,
    currentCtezBuyPrice: ctezBuyPrice,
    currentTezBuyPrice: tezBuyPrice,
    currentAvgPrice: currentAvgPrice,
    premium: (premium * 100),
    currentAnnualDrift: (currentAnnualDrift * 100),
    drift,
    ctezDexFeeIndex: sellCtezDex.fee_index.toNumber(),
    tezDexFeeIndex: sellTezDex.fee_index.toNumber(),
    ctezDexSelfTokens: sellCtezDex.self_reserves.toNumber() / 1e6,
    ctezDexProceeds: (sellCtezDex.proceeds_reserves.toNumber() - sellCtezDex.proceeds_debts.toNumber()) / 1e6,
    ctezDexSubsidy: (sellCtezDex.subsidy_reserves.toNumber() - sellCtezDex.subsidy_debts.toNumber()) / 1e6,
    tezDexSelfTokens: sellTezDex.self_reserves.toNumber() / 1e6,
    tezDexProceeds: (sellTezDex.proceeds_reserves.toNumber() - sellTezDex.proceeds_debts.toNumber()) / 1e6,
    tezDexSubsidy: (sellTezDex.subsidy_reserves.toNumber() - sellTezDex.subsidy_debts.toNumber()) / 1e6,
  };
};

export const getUserTezCtezData = async (userAddress: string): Promise<OvenBalance> => {
  const data = await getBaseStats();
  const userOvenData = await getUserOvensAPI(userAddress);

  try {
    return userOvenData.reduce(
      (acc, cur) => {
        const ctezOutstanding = getOvenCtezOutstanding(
          cur.value.ctez_outstanding,
          cur.value.fee_index,
          data.ctezDexFeeIndex,
          data.tezDexFeeIndex
        )
        return {
          tezInOvens: acc.tezInOvens + Number(cur.value.tez_balance) / 1e6,
          ctezOutstanding: acc.ctezOutstanding + ctezOutstanding / 1e6,
        }
      },
      {
        tezInOvens: 0,
        ctezOutstanding: 0,
      },
    );
  } catch (error: any) {
    return {
      tezInOvens: 0,
      ctezOutstanding: 0,
    };
  }
};

export const getUserLQTData = async (userAddress: string): Promise<UserLQTData> => {
  const ctezLqtBalances = await getUserHalfDexLqtBalance(userAddress, true);
  const tezLqtBalances = await getUserHalfDexLqtBalance(userAddress, false);
  return {
    ctezDexLqt: ctezLqtBalances.lqt,
    ctezDexLqtShare: ctezLqtBalances.lqtShare,
    tezDexLqt: tezLqtBalances.lqt,
    tezDexLqtShare: tezLqtBalances.lqtShare,
  };
};

export const isMonthFromLiquidation = (
  outstandingCtez: number,
  target: number,
  tezBalance: number,
  currentDrift: number,
  noTargetScale?: boolean,
): boolean => {
  const scaledTarget = noTargetScale ? target : target / 2 ** 64;

  return (
    outstandingCtez *
    scaledTarget *
    (1 + currentDrift / 2 ** 64) ** ((365.25 * 24 * 3600) / 12) *
    (16 / 15) >
    tezBalance
  );
};
