import React, { useCallback, useEffect, useState, createContext, ReactNode, useContext } from 'react';
import { useColorMode } from '@chakra-ui/react';
import { BeaconWallet, BeaconEvent } from '@taquito/beacon-wallet';
import { TezosToolkit, MichelCodecPacker, WalletContract } from '@taquito/taquito';
import { APP_NAME, NETWORK, RPC_URL, CTEZ_ADDRESS, CFMM_ADDRESS } from '../utils/globals';
import { initContract } from '../contracts/utils';
import { logger } from '../utils/logger';

export interface TezosContextType {
  pkh?: string;
  wallet?: BeaconWallet | null;
  tezos: TezosToolkit;
  ctezContract: WalletContract | null;
  cfmmContract: WalletContract | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}


export const TezosContext = createContext<TezosContextType | null>(null);

export const TezosContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { colorMode } = useColorMode();
  const [pkh, setPkh] = useState<string | undefined>();
  const [wallet, setWallet] = useState<BeaconWallet | null>(null);
  const [ctezContract, setCtezContract] = useState<WalletContract | null>(null);
  const [cfmmContract, setCfmmContract] = useState<WalletContract | null>(null);
  const [tezos] = useState<TezosToolkit>(() => {
    const toolkit = new TezosToolkit(RPC_URL);
    toolkit.setPackerProvider(new MichelCodecPacker());
    return toolkit;
  });

  const getOrCreateBeaconWallet = useCallback(async () => {
    if (wallet) return wallet;

    const newWallet = new BeaconWallet({
      name: APP_NAME,
      network: { type: NETWORK as any },
    });

    if (colorMode) {
      try {
        await newWallet.client.setColorMode(
          (colorMode === 'dark' ? 'dark' : 'light') as any
        );
      } catch (error) {
        logger.warn('Failed to set Beacon color mode:', error);
      }
    }

    newWallet.client.subscribeToEvent(BeaconEvent.ACTIVE_ACCOUNT_SET, (account) => {
      setPkh(account?.address);
    });

    setWallet(newWallet);
    tezos.setProvider({ wallet: newWallet });
    return newWallet;
  }, [wallet, tezos, colorMode]);

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

        // Initialize contracts - they are guaranteed to exist due to globals.ts checks
        const ctez = await initContract(CTEZ_ADDRESS, tezos);
        const cfmm = await initContract(CFMM_ADDRESS, tezos);
        setCtezContract(ctez);
        setCfmmContract(cfmm);
      } catch (err) {
        logger.error('Wallet initialization error:', err);
        setPkh(undefined);
      }
    };

    initializeWallet();
  }, [getOrCreateBeaconWallet, tezos]);

  useEffect(() => {
    const updateBeaconTheme = async () => {
      if (wallet && colorMode) {
        try {
          await wallet.client.setColorMode(
            (colorMode === 'dark' ? 'dark' : 'light') as any
          );
        } catch (error) {
          logger.warn('Failed to update Beacon color mode:', error);
        }
      }
    };

    updateBeaconTheme();
  }, [colorMode, wallet]);

  const contextValue: TezosContextType = {
    pkh,
    wallet,
    tezos,
    ctezContract,
    cfmmContract,
    connect,
    disconnect,
  };

  return (
    <TezosContext.Provider value={contextValue}>
      {children}
    </TezosContext.Provider>
  );
};

export const useTezosContext = (): TezosContextType => {
  const context = useContext(TezosContext);
  
  if (!context) {
    throw new Error('useTezosContext must be used within a TezosContextProvider');
  }

  return context;
};
