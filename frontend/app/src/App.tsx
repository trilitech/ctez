import React, { Suspense } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ChakraProvider } from '@chakra-ui/react';
import { TezosContextProvider } from './tezos';
import { AppRouter } from './router';
import ModalContainer from './components/modals/ModalContainer';
import theme from './theme/theme';
import ErrorBoundary from './components/ErrorBoundary';

const queryClient = new QueryClient();

const App: React.FC = () => {

  return (
    <Suspense fallback="Loading...">
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <TezosContextProvider>
            <ChakraProvider theme={theme}>
              <ErrorBoundary>
                <AppRouter />
                <ModalContainer />
              </ErrorBoundary>
            </ChakraProvider>
          </TezosContextProvider>
        </QueryClientProvider>
      </HelmetProvider>
    </Suspense>
  );
};

export default App;
