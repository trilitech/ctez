import axios from 'axios';
import { sub, format } from 'date-fns';
import { getActualCtezStorage, getUserHalfDexLqtBalance } from '../contracts/ctez';
import { BaseStats, CTezStorage, CTezTzktStorage, OvenBalance, UserLQTData } from '../interfaces';
import { RPC_URL } from '../utils/globals';
import { getOvenCtezOutstandingAndFeeIndex, getUpdatedDexFeeIndex } from '../utils/ovenUtils';
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

const getFeeRate = (liquidity: number, targetLiquidity: number): number => {
  const max_rate = 5845483520;
  const rate = (8 * liquidity < targetLiquidity)
    ? max_rate
    : (8 * liquidity > 7 * targetLiquidity)
      ? 0
      : Math.floor(Math.abs(max_rate * (7 * targetLiquidity - 8 * liquidity)) / (6 * targetLiquidity));

  return rate * 60 * 60 * 24 * 365.25 * 100 / 2 ** 64;
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

  const ctezDexFeeRate = getFeeRate(sellCtezDex.self_reserves.toNumber(), storage.context._Q.toNumber())
  const tezDexFeeRate = getFeeRate(sellTezDex.self_reserves.toNumber(), storage.context._Q.toNumber() * target)

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
    ctezDexFeeRate,
    tezDexSelfTokens: sellTezDex.self_reserves.toNumber() / 1e6,
    tezDexProceeds: (sellTezDex.proceeds_reserves.toNumber() - sellTezDex.proceeds_debts.toNumber()) / 1e6,
    tezDexSubsidy: (sellTezDex.subsidy_reserves.toNumber() - sellTezDex.subsidy_debts.toNumber()) / 1e6,
    tezDexFeeRate
  };
};

export const getUserTezCtezData = async (userAddress: string): Promise<OvenBalance> => {
  const data = await getBaseStats();
  const userOvenData = await getUserOvensAPI(userAddress);

  try {
    return userOvenData.reduce(
      (acc, cur) => {
        const ctezOutstanding = getOvenCtezOutstandingAndFeeIndex(
          cur.value.ctez_outstanding,
          cur.value.fee_index,
          data.ctezDexFeeIndex,
          data.tezDexFeeIndex
        ).ctezOutstanding
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
  ovenFeeIndex: number,
  storage: CTezStorage,
): boolean => {
  const secondsInMonth = (365.25 * 24 * 3600) / 12;
  const sellCtezDexFeeIndex = getUpdatedDexFeeIndex(
    secondsInMonth,
    storage.context._Q.toNumber(),
    storage.sell_ctez.fee_index.toNumber(),
    storage.sell_ctez.self_reserves.toNumber(),
  );
  const sellTezDexFeeIndex = getUpdatedDexFeeIndex(
    secondsInMonth,
    Math.max(storage.context._Q.multipliedBy(storage.context.target).dividedBy(2 ** 64).toNumber(), 1),
    storage.sell_tez.fee_index.toNumber(),
    storage.sell_tez.self_reserves.toNumber(),
  );

  const updatedOutstandingCtez = getOvenCtezOutstandingAndFeeIndex(outstandingCtez * 1e6, ovenFeeIndex, sellCtezDexFeeIndex, sellTezDexFeeIndex).ctezOutstanding / 1e6;

  // const futureFees = updatedOutstandingCtez - outstandingCtez;
  // console.log('outstandingCtez', outstandingCtez);
  // console.log('updatedOutstandingCtez', updatedOutstandingCtez);
  // console.log('futureFees', futureFees.toFixed(6), ' at ', new Date(Date.now() + secondsInMonth*1000).toLocaleString());

  return (
    updatedOutstandingCtez *
    target *
    (1 + currentDrift / 2 ** 64) ** secondsInMonth *
    (16 / 15) >
    tezBalance
  );
};
