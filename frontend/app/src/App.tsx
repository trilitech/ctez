import React, { Suspense, useEffect, useState } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ChakraProvider } from '@chakra-ui/react';
import { WalletProvider } from './wallet/walletContext';
import { WalletInterface } from './interfaces';
import { setWalletProvider } from './contracts/client';
import { APP_NAME, NETWORK, CTEZ_ADDRESS } from './utils/globals';
import { getBeaconInstance, isWalletConnected } from './wallet';
import { AppRouter } from './router';
import { initCTez } from './contracts/ctez';
import { logger } from './utils/logger';
import { initializeRpcUrl } from './utils/rpcManager';
import ModalContainer from './components/modals/ModalContainer';
import theme from './theme/theme';
import ErrorBoundary from './components/ErrorBoundary';
import { initCfmm } from './v1/contracts/cfmm';
import { CFMM_ADDRESS } from './v1/utils/globals';
import { AppReloadProvider } from './components/AppReloadProvider';

const queryClient = new QueryClient();

const App: React.FC = () => {
  const [wallet, setWallet] = useState<Partial<WalletInterface>>({});
  const checkWalletConnection = async () => {
    const prevUsedWallet = isWalletConnected();
    if (prevUsedWallet) {
      const walletData = await getBeaconInstance(APP_NAME, true, NETWORK);
      walletData?.wallet && setWalletProvider(walletData.wallet);
      walletData && setWallet(walletData);
      return walletData; 
    }
    return null;
  };

  useEffect(() => {
    const setup = async () => {
      try {
        const walletData = await checkWalletConnection();
        const walletAddress = walletData?.pkh || wallet.pkh;
        const nodeUrl = initializeRpcUrl(walletAddress);
        
        if (nodeUrl && (nodeUrl.startsWith('http://') || nodeUrl.startsWith('https://'))) {
          
          if (CTEZ_ADDRESS) {
            await initCTez(CTEZ_ADDRESS);
          }
          
          if (CFMM_ADDRESS) {
            await initCfmm(CFMM_ADDRESS);
          }
        } else {
          logger.warn('Invalid RPC URL, skipping contract initialization:', nodeUrl);
        }
      } catch (error: any) {
        logger.error('Failed to initialize contracts:', error);
      }
    };
    
    setup();
  }, [wallet.pkh]);

  return (
    <Suspense fallback="Loading...">
      <AppReloadProvider>
        <HelmetProvider>
          <QueryClientProvider client={queryClient}>
            <WalletProvider value={{ wallet, setWallet }}>
              <ChakraProvider theme={theme}>
                <ErrorBoundary>
                  <AppRouter />
                  <ModalContainer />
                </ErrorBoundary>
              </ChakraProvider>
            </WalletProvider>
          </QueryClientProvider>
        </HelmetProvider>
      </AppReloadProvider>
    </Suspense>
  );
};

export default App;
