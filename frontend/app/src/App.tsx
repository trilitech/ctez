import React, { Suspense, useEffect, useState } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ChakraProvider } from '@chakra-ui/react';
import { WalletProvider } from './wallet/walletContext';
import { WalletInterface } from './interfaces';
import { initTezos } from './contracts/client';
import { RPC_URL, RPC_PORT, CTEZ_ADDRESS, CFMM_ADDRESS } from './utils/globals';
import { AppRouter } from './router';
import { initCTez } from './contracts/ctez';
import { initCfmm } from './contracts/cfmm';
import { logger } from './utils/logger';
import ModalContainer from './components/modals/ModalContainer';
import theme from './theme/theme';
import ErrorBoundary from './components/ErrorBoundary';

const queryClient = new QueryClient();

const App: React.FC = () => {
  const [wallet, setWallet] = useState<Partial<WalletInterface>>({});

  useEffect(() => {
    const setup = async () => {
      try {
        initTezos(RPC_URL, RPC_PORT);
        CTEZ_ADDRESS && (await initCTez(CTEZ_ADDRESS));
        CFMM_ADDRESS && (await initCfmm(CFMM_ADDRESS));
      } catch (error) {
        logger.error(error);
      }
    };
    setup();
  }, []);

  return (
    <Suspense fallback="Loading...">
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
    </Suspense>
  );
};

export default App;
