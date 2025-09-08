import React, { useCallback, useEffect, useState, createContext, ReactNode } from 'react';
import { BeaconWallet } from '@taquito/beacon-wallet';
import { TezosToolkit, MichelCodecPacker } from '@taquito/taquito';
import { BeaconEvent } from '@airgap/beacon-sdk';
import { APP_NAME, NETWORK, RPC_URL, CTEZ_ADDRESS, CFMM_ADDRESS } from '../utils/globals';
import { initCTez } from '../contracts/ctez';
import { initCfmm } from '../contracts/cfmm';
import { logger } from '../utils/logger';

interface TezosWalletContextType {
  wallet: BeaconWallet | null;
  tezos: TezosToolkit;
  pkh?: string;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const TezosWalletContext = createContext<TezosWalletContextType | null>(null);

export const TezosWalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [pkh, setPkh] = useState<string | undefined>();
  const [wallet, setWallet] = useState<BeaconWallet | null>(null);
  const [tezos] = useState<TezosToolkit>(() => {
    const toolkit = new TezosToolkit(RPC_URL);
    toolkit.setPackerProvider(new MichelCodecPacker());
    return toolkit;
  });

  const getOrCreateBeaconWallet = useCallback(async () => {
    if (wallet) return wallet;

    const newWallet = new BeaconWallet({
      name: APP_NAME,
      network: { type: NETWORK },
    });

    newWallet.client.subscribeToEvent(BeaconEvent.ACTIVE_ACCOUNT_SET, (account) => {
      setPkh(account?.address);
    });

    setWallet(newWallet);
    tezos.setProvider({ wallet: newWallet });
    return newWallet;
  }, [wallet, tezos]);

  const connect = useCallback(async () => {
    try {
      const walletInstance = await getOrCreateBeaconWallet();
      const activeAccount = await walletInstance.client.getActiveAccount();

      if (!activeAccount) {
        await walletInstance.client.requestPermissions();
      }
    } catch (err) {
      logger.error('Wallet connection error:', err);
    }
  }, [getOrCreateBeaconWallet]);

  const disconnect = useCallback(async () => {
    try {
      if (wallet) {
        await wallet.client.disconnect();
      }
    } catch (err) {
      logger.error('Wallet disconnection error:', err);
    }
  }, [wallet]);

  useEffect(() => {
    const initializeWallet = async () => {
      try {
        const walletInstance = await getOrCreateBeaconWallet();
        const activeAccount = await walletInstance.client.getActiveAccount();

        if (activeAccount) {
          setPkh(activeAccount.address);
        }

        // Initialize contracts
        if (CTEZ_ADDRESS) await initCTez(CTEZ_ADDRESS, tezos);
        if (CFMM_ADDRESS) await initCfmm(CFMM_ADDRESS, tezos);
      } catch (err) {
        logger.error('Wallet initialization error:', err);
        setPkh(undefined);
      }
    };

    initializeWallet();
  }, [getOrCreateBeaconWallet, tezos]);

  const contextValue: TezosWalletContextType = {
    wallet,
    tezos,
    pkh,
    connect,
    disconnect,
  };

  return (
    <TezosWalletContext.Provider value={contextValue}>
      {children}
    </TezosWalletContext.Provider>
  );
};
