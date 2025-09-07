import { useCallback, useEffect, useState } from 'react';
import { BeaconWallet } from '@taquito/beacon-wallet';
import { NetworkType, BeaconEvent } from '@airgap/beacon-sdk';
import { WalletInterface } from '../interfaces';
import { APP_NAME, NETWORK } from '../utils/globals';
import { setWalletProvider } from '../contracts/client';
import { logger } from '../utils/logger';

interface UseBeaconWalletResult {
  wallet: Partial<WalletInterface>;
  isConnected: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const disconnectBeacon = async (wallet: BeaconWallet): Promise<void> => {
  await wallet.client.disconnect();
};

const updateWalletState = (
  beaconWallet: BeaconWallet,
  address: string,
  setWalletState: React.Dispatch<React.SetStateAction<Partial<WalletInterface>>>
) => {
  setWalletProvider(beaconWallet);
  setWalletState({
    wallet: beaconWallet,
    network: NETWORK,
    pkh: address,
  });
};

const clearWalletState = (
  setWalletState: React.Dispatch<React.SetStateAction<Partial<WalletInterface>>>
) => {
  setWalletState(p => ({...p, pkh: undefined}));
};

export const useBeaconWallet = (): UseBeaconWalletResult => {
  const [wallet, setWalletState] = useState<Partial<WalletInterface>>({});
  const [error, setError] = useState<string | null>(null);

  const createBeaconWallet = useCallback(async (): Promise<BeaconWallet> => {
    const networkType: NetworkType = NETWORK as NetworkType;

    return new BeaconWallet({
      name: APP_NAME,
      network: { type: networkType },
    });
  }, []);

  const setupWalletSubscription = useCallback((beaconWallet: BeaconWallet) => {
    beaconWallet.client.subscribeToEvent(BeaconEvent.ACTIVE_ACCOUNT_SET, (account) => {
      if (account) {
        updateWalletState(beaconWallet, account.address, setWalletState);
        setError(null);
      } else {
        clearWalletState(setWalletState);
      }
    });
  }, []);

  const connect = useCallback(async () => {
    setError(null);

    try {
      const activeAccount = await wallet.wallet?.client.getActiveAccount();

      if (activeAccount) {
        updateWalletState(wallet.wallet, activeAccount.address, setWalletState);
      } else {
        await wallet.wallet.client.requestPermissions();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      logger.error('Wallet connection error:', err);
    }
  }, [wallet.wallet]);

  const disconnect = useCallback(async () => {
    try {
      if (wallet.wallet) {
        await disconnectBeacon(wallet.wallet);
      }
      clearWalletState(setWalletState);
      setError(null);
    } catch (err) {
      logger.error('Wallet disconnection error:', err);
    }
  }, [wallet.wallet]);

  useEffect(() => {
    const initializeWallet = async () => {
      try {
        const beaconWallet = await createBeaconWallet();
        setupWalletSubscription(beaconWallet);

        const activeAccount = await beaconWallet.client.getActiveAccount();
        updateWalletState(beaconWallet, activeAccount?.address, setWalletState);
      } catch (err) {
        logger.error('Wallet initialization error:', err);
        clearWalletState(setWalletState);
      }
    };

    initializeWallet();
  }, [createBeaconWallet, setupWalletSubscription, wallet.pkh]);

  return {
    wallet,
    isConnected: !!wallet.pkh,
    error,
    connect,
    disconnect,
  };
};
