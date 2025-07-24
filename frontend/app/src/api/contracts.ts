import axios from 'axios';
import BigNumber from 'bignumber.js';
import { sub, format } from 'date-fns';
import { getActualCtezStorage, getUserHalfDexLqtBalance } from '../contracts/ctez';
import { getCtezFa12TotalSupply } from '../contracts/fa12';
import { BaseStats, CTezStorage, CTezTzktStorage, OvenBalance, UserLQTData } from '../interfaces';
import { CTEZ_CONTRACT_BIGMAP, RPC_URL } from '../utils/globals';
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

const getMarginalPrice = (liquidity: number, targetLiquidity: number, targetPrice: number): number => {
  const u = Math.min(liquidity / targetLiquidity, 1);
  return targetPrice * (21 - 3 * u + 3 * u ** 2 - u ** 3) / 20;
}

const getAnnualFeeRate = (liquidity: number, targetLiquidity: number): number => {
  const max_rate = 5845483520;
  const rate = (8 * liquidity < targetLiquidity)
    ? max_rate
    : (8 * liquidity > 7 * targetLiquidity)
      ? 0
      : Math.floor(Math.abs(max_rate * (7 * targetLiquidity - 8 * liquidity)) / (6 * targetLiquidity));

  return rate * 60 * 60 * 24 * 365.25 / 2 ** 64;
}

const getAnnualLiquidityIncentives = (ctezTotalSupply: BigNumber, dexAnnualFeeRate: number, dexSelfReservesInCtez: BigNumber): number => {
  const earnedSubsidyInCtezPerYear = ctezTotalSupply.multipliedBy(dexAnnualFeeRate);
  return earnedSubsidyInCtezPerYear.dividedBy(BigNumber.max(dexSelfReservesInCtez, 1)).toNumber();
}

export const getBaseStats = async (): Promise<BaseStats> => {
  const [storage, ctezTotalSupply] = await Promise.all([getActualCtezStorage(), getCtezFa12TotalSupply()]);
  const target = storage.context.target.toNumber() / 2 ** 64;
  const sellCtezDex = storage.sell_ctez;
  const sellTezDex = storage.sell_tez;

  /* eslint-disable */
  const ctezDexTargetLiquidity = storage.context._Q.toNumber();
  const tezDexTargetLiquidity = storage.context._Q.multipliedBy(target).toNumber();

  const ctezSellPrice = getMarginalPrice(
    sellCtezDex.self_reserves.toNumber(),
    ctezDexTargetLiquidity,
    target
  );
  const tezBuyPrice = 1 / ctezSellPrice;

  const tezSellPrice = getMarginalPrice(
    sellTezDex.self_reserves.toNumber(),
    tezDexTargetLiquidity,
    1 / target
  )
  const ctezBuyPrice = 1 / tezSellPrice;

  const currentAvgPrice = (ctezSellPrice + ctezBuyPrice) / 2
  const premium = currentAvgPrice === target ? 0 : currentAvgPrice / target - 1.0;
  const drift = storage.context.drift.toNumber() / 2 ** 64;
  const currentAnnualDrift = (1.0 + drift) ** (365.25 * 24 * 3600) - 1.0;

  const ctezDexFeeRate = getAnnualFeeRate(sellCtezDex.self_reserves.toNumber(), storage.context._Q.toNumber());
  const tezDexFeeRate = getAnnualFeeRate(sellTezDex.self_reserves.toNumber(), storage.context._Q.multipliedBy(target).toNumber());
  const ctezLiquidityIncentives = getAnnualLiquidityIncentives(ctezTotalSupply, ctezDexFeeRate, sellCtezDex.self_reserves);
  const tezLiquidityIncentives = getAnnualLiquidityIncentives(ctezTotalSupply, tezDexFeeRate, sellTezDex.self_reserves.dividedBy(target));

  return {
    originalTarget: storage.context.target.toNumber(),
    currentTarget: target,
    currentCtezSellPrice: ctezSellPrice,
    currentTezSellPrice: tezSellPrice,
    currentCtezBuyPrice: ctezBuyPrice,
    currentTezBuyPrice: tezBuyPrice,
    currentAvgPrice: currentAvgPrice,
    premium: premium * 100,
    currentAnnualDrift: currentAnnualDrift * 100,
    drift,
    ctezTotalSupply: ctezTotalSupply.dividedBy(1e6).toNumber(),
    ctezDexFeeIndex: sellCtezDex.fee_index,
    tezDexFeeIndex: sellTezDex.fee_index,
    ctezDexSelfTokens: sellCtezDex.self_reserves.toNumber() / 1e6,
    ctezDexTargetLiquidity: ctezDexTargetLiquidity / 1e6,
    ctezDexProceeds: sellCtezDex.proceeds_reserves.minus(sellCtezDex.proceeds_debts).toNumber() / 1e6,
    ctezDexSubsidy: sellCtezDex.subsidy_reserves.minus(sellCtezDex.subsidy_debts).toNumber() / 1e6,
    ctezDexAnnualFeeRate: ctezDexFeeRate * 100,
    ctezLiquidityIncentives: ctezLiquidityIncentives * 100,
    tezDexSelfTokens: sellTezDex.self_reserves.toNumber() / 1e6,
    tezDexTargetLiquidity: tezDexTargetLiquidity / 1e6,
    tezDexProceeds: sellTezDex.proceeds_reserves.minus(sellTezDex.proceeds_debts).toNumber() / 1e6,
    tezDexSubsidy: sellTezDex.subsidy_reserves.minus(sellTezDex.subsidy_debts).toNumber() / 1e6,
    tezDexAnnualFeeRate: tezDexFeeRate * 100,
    tezLiquidityIncentives: tezLiquidityIncentives * 100
  };
};

export const getUserTezCtezData = async (userAddress: string): Promise<OvenBalance> => {
  const data = await getBaseStats();
  const userOvenData = await getUserOvensAPI(userAddress, CTEZ_CONTRACT_BIGMAP);

  try {
    return userOvenData.reduce(
      (acc, cur) => {
        const ctezOutstanding = getOvenCtezOutstandingAndFeeIndex(
          new BigNumber(cur.value.ctez_outstanding),
          new BigNumber(cur.value.fee_index),
          data.ctezDexFeeIndex,
          data.tezDexFeeIndex
        ).ctezOutstanding
        return {
          tezInOvens: acc.tezInOvens + Number(cur.value.tez_balance) / 1e6,
          ctezOutstanding: acc.ctezOutstanding + ctezOutstanding.dividedBy(1e6).toNumber(),
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
  ovenFeeIndex: BigNumber,
  storage: CTezStorage,
): boolean => {
  const secondsInMonth = (365.25 * 24 * 3600) / 12;
  const secondsInMonthBig = new BigNumber(secondsInMonth);
  const sellCtezDexFeeIndex = getUpdatedDexFeeIndex(
    secondsInMonthBig,
    storage.context._Q,
    storage.sell_ctez.fee_index,
    storage.sell_ctez.self_reserves,
  );
  const sellTezDexFeeIndex = getUpdatedDexFeeIndex(
    secondsInMonthBig,
    BigNumber.max(storage.context._Q.multipliedBy(storage.context.target).dividedBy(2 ** 64), 1),
    storage.sell_tez.fee_index,
    storage.sell_tez.self_reserves,
  );

  const updatedOutstandingCtez = getOvenCtezOutstandingAndFeeIndex(
    new BigNumber(outstandingCtez).multipliedBy(1e6),
    ovenFeeIndex,
    sellCtezDexFeeIndex,
    sellTezDexFeeIndex
  ).ctezOutstanding.dividedBy(1e6);

  // const requiredTezBalanceInMonthOld =
  //   updatedOutstandingCtez.toNumber() *
  //   target *
  //   (1 + currentDrift / 2 ** 64) ** secondsInMonth *
  //   (16 / 15);

  const requiredTezBalanceInMonth = updatedOutstandingCtez
      .multipliedBy(target)
      .multipliedBy(
        new BigNumber(1)
          .plus(new BigNumber(currentDrift).dividedBy(new BigNumber(2).pow(64)))
          .pow(secondsInMonth)
      ).multipliedBy(16).dividedBy(15);

  // console.log('');
  // console.log('requiredTezBalanceInMonthOld', requiredTezBalanceInMonthOld);
  // console.log('requiredTezBalanceInMonthNew', requiredTezBalanceInMonth.toString());
  // console.log('currentTezBalance...........', tezBalance);

  return requiredTezBalanceInMonth.isGreaterThan(tezBalance);
};
