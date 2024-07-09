import axios from 'axios';
import BigNumber from 'bignumber.js';
import { sub, format, differenceInDays } from 'date-fns';
import { getCfmmStorage, getLQTContractStorage } from '../contracts/cfmm';
import { getCtezStorage } from '../contracts/ctez';
import { BaseStats, CTezStorage, CTezTzktStorage, HalfDex, OvenBalance, UserLQTData } from '../interfaces';
import { CONTRACT_DEPLOYMENT_DATE, RPC_URL } from '../utils/globals';
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

const getMarginalPrice = (q: number, Q: number, target: number): number => {
  const u = Math.min(q / Q, 1);
  return target * (21 - 3 * u + 3 * u ** 2 - u ** 3) / 20;
}

const getCurrentPrice = (storage: CTezStorage, target: number): number => {
  const ctez_marginal_price = getMarginalPrice(
    storage.sell_ctez.proceeds_reserves.toNumber(),
    /* eslint-disable */
    storage.context._Q.toNumber(),
    target
  );
  const tez_marginal_price = getMarginalPrice(
    storage.sell_tez.proceeds_reserves.toNumber(),
    storage.context._Q.toNumber() * target, 
    1 / target
  )
  return (ctez_marginal_price + tez_marginal_price) / 2;
}

export const getBaseStats = async (_userAddress?: string): Promise<BaseStats> => {
  const storage = await getCtezStorage();
  const target = storage.context.target.toNumber() / 2 ** 64;
  const ctezSellPrice = getMarginalPrice(
    storage.sell_ctez.proceeds_reserves.toNumber(),
    /* eslint-disable */
    storage.context._Q.toNumber(),
    target
  );

  const ctezBuyPrice = 1 / getMarginalPrice(
    storage.sell_tez.proceeds_reserves.toNumber(),
    storage.context._Q.toNumber() * target, 
    1 / target
  )

  const currentAvgPrice = (ctezSellPrice + ctezBuyPrice) / 2
  const premium = currentAvgPrice === target ? 0 : currentAvgPrice / target - 1.0;
  const drift = storage.context.drift.toNumber() / 2 ** 64;
  const currentAnnualDrift = (1.0 + drift) ** (365.25 * 24 * 3600) - 1.0;

  return {
    originalTarget: storage.context.target.toNumber(),
    currentTarget: target.toFixed(6),
    currentCtezSellPrice: ctezSellPrice.toFixed(6),
    currentCtezBuyPrice: ctezBuyPrice.toFixed(6),
    currentAvgPrice: currentAvgPrice.toFixed(6),
    premium: (premium * 100).toFixed(2),
    currentAnnualDrift: (currentAnnualDrift * 100).toFixed(2),
    drift,
  };
};

export const getUserTezCtezData = async (userAddress: string): Promise<OvenBalance> => {
  const userOvenData = await getUserOvensAPI(userAddress);
  try {
    return userOvenData.reduce(
      (acc, cur) => ({
        tezInOvens: acc.tezInOvens + Number(cur.value.tez_balance) / 1e6,
        ctezOutstanding: acc.tezInOvens + Number(cur.value.ctez_outstanding) / 1e6,
      }),
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
  const cfmmStorage = await getCfmmStorage();
  const lqtTokenStorage = await getLQTContractStorage();
  const userLqtBalance: BigNumber =
    (await lqtTokenStorage.tokens.get(userAddress)) ?? new BigNumber(0);
  return {
    lqt: userLqtBalance.toNumber(),
    lqtShare: Number(
      ((userLqtBalance.toNumber() / cfmmStorage.lqtTotal.toNumber()) * 100).toFixed(6),
    ),
  };
};

export const isMonthFromLiquidation = (
  outstandingCtez: number,
  target: number,
  tezBalance: number,
  currentDrift: number,
  noTargetScale?: boolean,
): boolean => {
  const scaledTarget = noTargetScale ? target : target / 2 ** 48;

  return (
    outstandingCtez *
    scaledTarget *
    (1 + currentDrift / 2 ** 48) ** ((365.25 * 24 * 3600) / 12) *
    (16 / 15) >
    tezBalance
  );
};
