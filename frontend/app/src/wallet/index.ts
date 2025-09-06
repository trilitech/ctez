import { BeaconWallet } from '@taquito/beacon-wallet';
import { NetworkType } from '@airgap/beacon-sdk';
import { WalletInterface } from '../interfaces/wallet';
import { NETWORK } from '../utils/globals';
import { logger } from '../utils/logger';

export const setConnected = (): void => {
  localStorage.setItem('wallet-connected', 'true');
};

export const isWalletConnected = (): boolean => {
  return localStorage.getItem('wallet-connected') === 'true';
};

export const disconnectBeacon = async (wallet: BeaconWallet): Promise<void> => {
  localStorage.removeItem('wallet-connected');
  await wallet.client.disconnect();
};

export const getBeaconInstance = async (
  name: string,
  connect = false,
  network = NETWORK,
): Promise<WalletInterface | undefined> => {
  try {
    const networkType: NetworkType = network as NetworkType;
    
    const wallet = new BeaconWallet({
      name,
      network: { type: networkType },
    });
    
    const activeAccount = await wallet.client.getActiveAccount();
    if (activeAccount) {
      setConnected();
      return {
        wallet,
        network,
        pkh: activeAccount.address,
      };
    } else {
      if (connect) {
        try {
          await wallet.client.requestPermissions();
          const pkh = await wallet.getPKH();
          setConnected();
          return {
            wallet,
            network,
            pkh,
          };
        } catch (error) {
          console.error("Got request permissions error:", error);
          logger.error(error);
        }
      }
    }
    
    return {
      wallet,
      network,
      pkh: undefined,
    };
  } catch (error) {
    logger.error(error);
  }
};
