import { TezosToolkit } from '@taquito/taquito';
import { getCTezFa12Contract } from '../contracts/fa12';
import { UserBalance } from '../interfaces';
import { getUserTezCtezData } from './contracts';
import BigNumber from 'bignumber.js';

const getXtzBalance = async (tezos: TezosToolkit, userAddress: string) => {
  try {
    const xtz = ((await tezos.tz.getBalance(userAddress)) ?? new BigNumber(0)).shiftedBy(-6).toNumber() ?? 0;
    return xtz;
  } catch (error) {
    return 0;
  }
};

const getCtezBalance = async (userAddress: string, tezos: TezosToolkit) => {
  try {
    const ctezFa12 = await getCTezFa12Contract(tezos);
    const ctezFa12Storage: any = await ctezFa12.storage();
    const ctez =
      ((await ctezFa12Storage.tokens.get(userAddress)) ?? new BigNumber(0)).shiftedBy(-6).toNumber() ?? 0;
    return ctez;
  } catch (error) {
    return 0;
  }
};

export const getUserBalance = async (tezos: TezosToolkit, userAddress: string): Promise<UserBalance> => {
  try {
    const ctez = await getCtezBalance(userAddress, tezos);
    const xtz = await getXtzBalance(tezos, userAddress);
    const { tezInOvens, ctezOutstanding } = await getUserTezCtezData(userAddress);
    return {
      xtz,
      ctez,
      tezInOvens,
      ctezOutstanding,
    };
  } catch (error) {
    return {
      xtz: 0,
      ctez: 0,
      tezInOvens: 0,
      ctezOutstanding: 0,
    };
  }
};
