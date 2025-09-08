import { useContext } from 'react';
import { BeaconWallet } from '@taquito/beacon-wallet';
import { TezosToolkit } from '@taquito/taquito';
import { TezosWalletContext } from './BeaconWalletProvider';

interface UseTezosWalletResult {
  pkh?: string;
  wallet?: BeaconWallet;
  tezos: TezosToolkit;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const useTezosWallet = (): UseTezosWalletResult => {
  const context = useContext(TezosWalletContext);
  
  if (!context) {
    throw new Error('useTezosWallet must be used within a TezosWalletProvider');
  }

  return {
    pkh: context.pkh,
    wallet: context.wallet,
    tezos: context.tezos,
    connect: context.connect,
    disconnect: context.disconnect,
  };
};
