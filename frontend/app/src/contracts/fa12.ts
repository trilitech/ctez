import { WalletContract, TezosToolkit } from '@taquito/taquito';
import { CTEZ_FA12_ADDRESS, LQT_FA12_ADDRESS } from '../utils/globals';
import { initContract } from './utils';

let LQTFa12: WalletContract | null = null;
let CTezFa12: WalletContract | null = null;

export const getLQTContract = async (tezos: TezosToolkit, address = LQT_FA12_ADDRESS): Promise<WalletContract> => {
  if (!LQTFa12) {
    LQTFa12 = await initContract(address, tezos);
  }
  return LQTFa12;
};

export const getCTezFa12Contract = async (tezos: TezosToolkit, address = CTEZ_FA12_ADDRESS): Promise<WalletContract> => {
  if (!CTezFa12) {
    CTezFa12 = await initContract(address, tezos);
  }
  return CTezFa12;
};
