import { AxiosError } from 'axios';
import { useQueries, useQuery } from 'react-query';
import { UseQueryResult } from 'react-query/types/react/types';
import { getCfmmStorage } from '../contracts/cfmm';
import {
  getAllOvens,
  getExternalOvenData,
  getOven,
  getOvenDelegate,
  getOvens,
  getOvenStorage,
  getUserOvens,
} from '../contracts/ctez';
import {
  AllOvenDatum,
  Baker,
  BaseStats,
  CfmmStorage,
  Oven,
  OvenStorage,
  UserBalance,
  UserLQTData,
} from '../interfaces';
import { getBaseStats, getUserLQTData } from './contracts';
import { getDelegates } from './tzkt';
import { getUserBalance } from './user';
import { useTezosContext } from '../tezos';

type TUseQueryReturn<T> = UseQueryResult<T | undefined, AxiosError>;

export const useDelegates = (userAddress?: string) => {
  return useQuery<Baker[], AxiosError, Baker[]>(['delegates'], () => {
    return getDelegates(userAddress);
  });
};

export const useCtezBaseStats = (userAddress?: string) => {
  const { ctezContract, cfmmContract } = useTezosContext();
  
  return useQuery<BaseStats, AxiosError, BaseStats>(
    ['baseStats'],
    async () => {
      if (!ctezContract || !cfmmContract) {
        throw new Error('Contracts not initialized');
      }
      return getBaseStats(ctezContract, cfmmContract, userAddress);
    },
    {
      refetchInterval: 30_000,
      staleTime: 3_000,
      enabled: !!(ctezContract && cfmmContract),
    },
  );
};

export const useUserBalance = (userAddress?: string) => {
  const { tezos } = useTezosContext();
  
  return useQuery<UserBalance | undefined, AxiosError, UserBalance | undefined>(
    [`user-balance-${userAddress}`],
    () => {
      if (userAddress) {
        return getUserBalance(tezos, userAddress);
      }
    },
    {
      refetchInterval: 30_000,
      staleTime: 3_000,
    },
  );
};
export const useCfmmStorage = () => {
  const { cfmmContract } = useTezosContext();
  
  return useQuery<CfmmStorage, AxiosError, CfmmStorage>(
    ['cfmmStorage'],
    async () => {
      if (!cfmmContract) {
        throw new Error('CFMM contract not initialized');
      }
      return getCfmmStorage(cfmmContract);
    },
    {
      refetchInterval: 30000,
      staleTime: 3000,
      enabled: !!cfmmContract,
    },
  );
};

export const useOvenData = (userAddress?: string, externalOvens: string[] = []) => {
  const { tezos, ctezContract } = useTezosContext();
  
  return useQuery<Oven[], AxiosError, Oven[]>(
    ['ovenData', userAddress, externalOvens.join()],
    async () => {
      if (userAddress && ctezContract) {
        const userOvens = await getOvens(ctezContract, userAddress, tezos);
        const ovens: Oven[] = [];
        if (userOvens && userOvens.length > 0) {
          ovens.push(...userOvens);
        }
        const currentOvens = userOvens?.map((o) => o.address) ?? [];
        const filteredOvens = externalOvens.filter((o) => !currentOvens.includes(o));
        const externals = await getExternalOvenData(ctezContract, filteredOvens, userAddress, tezos);
        if (externals && externals.length > 0) {
          ovens.push(...externals);
        }
        const result =
          typeof ovens !== 'undefined'
            ? ovens.filter((data: Oven) => {
                return data && data.baker !== null;
              })
            : [];
        return result;
      }
      return [];
    },
    {
      refetchInterval: 30_000,
      staleTime: 3_000,
      enabled: !!(userAddress && ctezContract),
    },
  );
};

export const useAllOvenData = () => {
  return useQuery<AllOvenDatum[] | undefined, AxiosError, AllOvenDatum[] | undefined>(
    ['allOvenData'],
    () => {
      return getAllOvens();
    },
  );
};

export const useUserOvenData = (
  userAddress: string | undefined,
): TUseQueryReturn<AllOvenDatum[]> => {
  return useQuery<AllOvenDatum[] | undefined, AxiosError, AllOvenDatum[] | undefined>(
    ['allOvenData', userAddress],
    () => {
      if (userAddress) {
        return getUserOvens(userAddress);
      }

      // ? Return empty array if userAddress is empty
      return new Promise<AllOvenDatum[]>(() => []);
    },
  );
};

export const useOvenDataByAddresses = (ovenAddresses: string[]) => {
  return useQueries(
    ovenAddresses.map((address) => ({
      queryKey: ['ovenData', address],
      queryFn: () => {
        return getOven(address);
      },
    })),
  );
};

export const useOvenStorage = (ovenAddress?: string) => {
  const { tezos } = useTezosContext();
  
  return useQuery<OvenStorage | undefined, AxiosError, OvenStorage | undefined>(
    ['ovenStorage', ovenAddress],
    async () => {
      if (ovenAddress) {
        return getOvenStorage(ovenAddress, tezos);
      }
    },
  );
};

export const useOvenDelegate = (ovenAddress?: string) => {
  const { tezos } = useTezosContext();
  
  return useQuery<string | null | undefined, AxiosError, string | null | undefined>(
    ['ovenDelegate', ovenAddress],
    async () => {
      if (ovenAddress) {
        return getOvenDelegate(ovenAddress, tezos);
      }
    },
  );
};

export const useUserLqtData = (userAddress?: string) => {
  const { tezos, cfmmContract } = useTezosContext();
  
  return useQuery<UserLQTData | undefined, AxiosError, UserLQTData | undefined>(
    ['userLqtData', userAddress],
    async () => {
      if (userAddress && cfmmContract) {
        return getUserLQTData(cfmmContract, userAddress, tezos);
      }
    },
    {
      refetchInterval: 30000,
      staleTime: 3000,
      enabled: !!(userAddress && cfmmContract),
    },
  );
};
