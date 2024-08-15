import axios, { AxiosResponse } from "axios";
import { useQuery } from "react-query";
import { getAllOvens } from "../contracts/ctez";
import { getOvenSummary, useOvenSummary } from "../hooks/utilHooks";
import { 
  AMMTransactionLiquidity, ctezGraphctez, ctezGraphctezDateRange, ctezGraphOvendata, ctezGraphTVL, ctezGraphVolumestat, 
  ctezMainHeader, ctezOven, CtezStatsGql, DepositTransactionTable, driftGraphInterface, driftGraphInterfaceAll, MintBurnData, 
  OneLineGraph, Ovendata, OvenDonutGql, OvensSummaryGql, OvenTransactionGql, OvenTransactionDtoGql, OvenTransactionTable, OvenTvlGql, 
  PiGraphOven, priceSats, SwapTransaction, SwapTransactionsGql, TradeVolumeGql, TvlAMMData, TvlAMMDataAll, TvlData, TvlDataALL, TwoLineGraph, 
  TwoLineGraphWithoutValue, VolumeAMMData, VolumeAMMDataAll, AddLiquidityTransactionsGql, AddLiquidityTransactionsDto, RemoveLiquidityTransactionsDto, RemoveLiquidityTransactionsGql, CollectFromLiquidityTransactionsDto, CollectFromLiquidityTransactionsGql 
} from "../interfaces/analytics";
import { getBaseStats } from "./contracts";

const GQL_API_URL = 'https://ctez-v2-indexer.dipdup.net/v1/graphql';

const getCountGql = async (entity: string, args = ''): Promise<number> => {
  const header = `${entity}${args && `(${args})`}`;
  const query = `
    query {
      ${header} {
        aggregate {
          count
        }
      }
    }
  `;

  const response = await axios({
    url: GQL_API_URL,
    method: "POST",
    data: {
      query
    }
  });

  return response.data.data[entity].aggregate.count as number;
}

const getBatchesGql = async (count: number, queryTemplate: string, limit = 1000): Promise<AxiosResponse<any>[]> => {
  const batchSize = 1000;
  const chunkPromises = Array.from(Array(Math.ceil(count / batchSize)), (_, i) => {
    const chunkQuery = queryTemplate
      .replace('<LIMIT>', batchSize.toString())
      .replace('<OFFSET>', (i * batchSize).toString());

    return axios({
      url: GQL_API_URL,
      method: "POST",
      data: {
        query: chunkQuery
      }
    });
  });

  return Promise.all(chunkPromises);
}

export const useCtezGraphGql = () => {
  return useQuery<CtezStatsGql[], Error>(
    'ctez_graph_gql',
    async () => {
      const entity = 'router_stats';
      const count = await getCountGql(`${entity}_aggregate`);
      const query = `
        query {
          ${entity}(order_by: {timestamp: asc}, offset: <OFFSET>, limit: <LIMIT>) {
            timestamp
            current_avg_price
            target_price
            annual_drift_percent
            ctez_sell_price
            ctez_buy_price
          }
        }
      `;

      const [baseStats, chunks] = await Promise.all([getBaseStats(), getBatchesGql(count, query)]);
      const lastPoint: CtezStatsGql = {
        id: 'now-now-now',
        timestamp: new Date().toISOString(),
        target_price: baseStats.currentTarget,
        annual_drift_percent: baseStats.currentAnnualDrift,
        ctez_buy_price: baseStats.currentCtezBuyPrice,
        ctez_sell_price: baseStats.currentCtezSellPrice,
        current_avg_price: baseStats.currentAvgPrice
      }

      const data = chunks.flatMap(response => response.data.data[entity]);
      data.push(lastPoint);
      return data;
    },
    { refetchInterval: 30_000 },
  );
};

export const useTvlGraphGql = () => {
  return useQuery<OvenTvlGql[], Error>(
    'oven_tvl_gql',
    async () => {
      const [count, allOvens, baseStats] = await Promise.all([getCountGql('ca_tvl_history_1d_aggregate'), getAllOvens(), getBaseStats()]);
      const query = `
        query tvl_chart_query($from: timestamptz="2018-07-01",$to: timestamptz="NOW()") {
          tvl_history: ca_tvl_history_1d(where: {bucket_1d: {_gte: $from, _lte: $to}}) {
            timestamp: bucket_1d
            tvl: tvl_usd
          }
        }
      `;
      const summary = getOvenSummary(allOvens, baseStats);
      const chunks = await getBatchesGql(count, query);
      const data = chunks.flatMap(response => response.data.data.tvl_history);
      // if (summary) {
      //   const lastPoint: OvenTvlGql = {
      //     id: 'now-now-now',
      //     timestamp: new Date().toISOString(),
      //     total_supply: summary?.totalOutstandingCtez
      //   }
      //   data.push(lastPoint);
      // }

      return data;
    },
    { refetchInterval: 30_000 },
  );
};

export const useTopOvensGraphGql = () => {
  return useQuery<OvenDonutGql[], Error>(
    'top_ovens_gql',
    async () => {
      const response = await axios({
        url: GQL_API_URL,
        method: "POST",
        data: {
          query: `
            query {
              oven(order_by: {ctez_outstanding: desc}, limit: 25) {
                ctez_outstanding,
                address
                id: address
              }
              oven_aggregate(order_by: {ctez_outstanding: desc}, offset: 25) {
                aggregate {
                  sum {
                    ctez_outstanding
                  }
                }
              }
            }
          `
        }
      });

      const ovens = response.data.data.oven;
      const othersItem: OvenDonutGql = {
        address: 'Others',
        ctez_outstanding: response.data.data.oven_aggregate.aggregate.sum.ctez_outstanding
      };
      ovens.push(othersItem);
      return ovens;
    },
    { refetchInterval: 30_000 },
  );
};

export const useOvensSummaryGql = () => {
  return useQuery<OvensSummaryGql, Error>(
    'ovens_summary_gql',
    async () => {
      const response = await axios({
        url: GQL_API_URL,
        method: "POST",
        data: {
          query: `
            query {
              oven_summary {
                collateral_locked
                collateral_ratio
                created
                liquidated
                total
                total_debt
              }
            }
          `
        }
      });

      return response.data.data.oven_summary[0];
    },
    { refetchInterval: 30_000 },
  );
};

export const useOvensTransactionsGql = (type: 'deposit' | 'burn' | 'mint' | 'withdraw' | 'liquidate') => {
  return useQuery<OvenTransactionGql[], Error>(
    ['ovens_transactions_deposit_gql', type],
    async () => {
      const entity = 'oven_transaction_history';
      const filter = `where: {transaction_type: {_eq: "${type}"}}`;
      const count = await getCountGql(`${entity}_aggregate`, filter);
      const query = `
        query {
          ${entity}(${filter}, order_by: {router_stats: {timestamp: desc}}, offset: <OFFSET>, limit: <LIMIT>) {
            account
            amount
            id
            transaction_hash
            oven {
              address
            }
            router_stats {
              target_price
              timestamp
            }
          }
        }
      `;

      const chunks = await getBatchesGql(count, query);
      const data = chunks.flatMap(response => response.data.data[entity].map((dto: OvenTransactionDtoGql) => ({
        account: dto.account,
        amount: dto.amount,
        id: dto.id,
        oven_address: dto.oven.address,
        target_price: dto.router_stats.target_price,
        transaction_hash: dto.transaction_hash,
        timestamp: dto.router_stats.timestamp,
      } as OvenTransactionGql)));

      return data;
    },
    { refetchInterval: 30_000 },
  );
};

export const useTradeVolumeGql = (range : '1d' | '30d') => {
  return useQuery<TradeVolumeGql[], Error>(
    ['trade_volume_gql', range],
    async () => {
      const count = await getCountGql(`ca_trade_volume_history_${range}_aggregate`);
      const query = `
        query trade_volume_chart_query($from: timestamptz="2018-07-01",$to: timestamptz="NOW()") {
          trade_volume: ca_trade_volume_history_${range}(where: {bucket_${range}: {_gte: $from, _lte: $to}}) {
            timestamp: bucket_${range}
            volume_usd
          }
        }
      `;
      const chunks = await getBatchesGql(count, query);
      const data = chunks.flatMap(response => response.data.data.trade_volume);

      return data;
    },
    { refetchInterval: 30_000 },
  );
};

export const useSwapTransactionsGql = () => {
  return useQuery<SwapTransactionsGql[], Error>(
    ['swap_transactions_gql'],
    async () => {
      const count = await getCountGql('swap_transaction_history_aggregate');
      const entity = 'swap_transaction_history';
      const query = `
        query {
          ${entity}(order_by: {timestamp: desc}, offset: <OFFSET>, limit: <LIMIT>) {
            id
            account
            amount_ctez
            amount_xtz
            direction
            price
            timestamp
            transaction_hash
          }
        }
      `;
      const chunks = await getBatchesGql(count, query);
      const data = chunks.flatMap(response => response.data.data[entity]);

      return data;
    },
    { refetchInterval: 30_000 },
  );
};

export const useAddLiquidityTransactionsGql = () => {
  return useQuery<AddLiquidityTransactionsGql[], Error>(
    ['add_liquidity_transactions_gql'],
    async () => {
      const entity = 'add_liquidity_transaction_history';
      const count = await getCountGql(`${entity}_aggregate`);
      const query = `
        query {
          ${entity}(order_by: {router_stats: {timestamp: desc}}, offset: <OFFSET>, limit: <LIMIT>) {
            account
            dex
            self_amount
            id
            router_stats {
              timestamp
            }
            transaction_hash
          }
        }
      `;
      const chunks = await getBatchesGql(count, query);
      const data = chunks.flatMap(response => response.data.data[entity].map((dto: AddLiquidityTransactionsDto) => ({
        id: dto.id,
        account: dto.account,
        dex: dto.dex,
        self_amount: dto.self_amount,
        timestamp: dto.router_stats.timestamp,
        transaction_hash: dto.transaction_hash
      } as AddLiquidityTransactionsGql)));

      return data;
    },
    { refetchInterval: 30_000 },
  );
};

export const useRemoveLiquidityTransactionsGql = () => {
  return useQuery<RemoveLiquidityTransactionsGql[], Error>(
    ['remove_liquidity_transactions_gql'],
    async () => {
      const entity = 'remove_liquidity_transaction_history';
      const count = await getCountGql(`${entity}_aggregate`);
      const query = `
        query {
          ${entity}(order_by: {router_stats: {timestamp: desc}}, offset: <OFFSET>, limit: <LIMIT>) {
            dex
            account
            id
            proceeds_redeemed
            self_redeemed
            subsidy_redeemed
            transaction_hash
            router_stats {
              timestamp
            }
          }
        }
      `;
      const chunks = await getBatchesGql(count, query);
      const data = chunks.flatMap(response => response.data.data[entity].map((dto: RemoveLiquidityTransactionsDto) => ({
        id: dto.id,
        account: dto.account,
        dex: dto.dex,
        self_redeemed: dto.self_redeemed,
        proceeds_redeemed: dto.proceeds_redeemed,
        subsidy_redeemed: dto.subsidy_redeemed,
        timestamp: dto.router_stats.timestamp,
        transaction_hash: dto.transaction_hash
      } as RemoveLiquidityTransactionsGql)));

      return data;
    },
    { refetchInterval: 30_000 },
  );
};

export const useCollectFromLiquidityTransactionsGql = () => {
  return useQuery<CollectFromLiquidityTransactionsGql[], Error>(
    ['collect_from_liquidity_transactions_gql'],
    async () => {
      const entity = 'collect_from_liquidity_transaction_history';
      const count = await getCountGql(`${entity}_aggregate`);
      const query = `
        query {
          ${entity}(order_by: {router_stats: {timestamp: desc}}, offset: <OFFSET>, limit: <LIMIT>) {
            dex
            account
            id
            proceeds_withdrawn
            subsidy_withdrawn
            transaction_hash
            router_stats {
              timestamp
            }
          }
        }
      `;
      const chunks = await getBatchesGql(count, query);
      const data = chunks.flatMap(response => response.data.data[entity].map((dto: CollectFromLiquidityTransactionsDto) => ({
        id: dto.id,
        account: dto.account,
        dex: dto.dex,
        proceeds_withdrawn: dto.proceeds_withdrawn,
        subsidy_withdrawn: dto.subsidy_withdrawn,
        timestamp: dto.router_stats.timestamp,
        transaction_hash: dto.transaction_hash
      } as CollectFromLiquidityTransactionsGql)));

      return data;
    },
    { refetchInterval: 30_000 },
  );
};

const analyticsAPI = axios.create({
  baseURL: 'https://analyticsapi.ctez.app'
});
export const usePriceStats = () => {
  return useQuery<{ ctez_priceArr: number[], tez_priceArr: number[], dateArr: number[] }, Error>(
    'price_stats',
    async () => {
      const data = await analyticsAPI.get('/price_stats');
      const priceStatsArr: priceSats[] = data.data;
      const ctez_priceArr: number[] = [];
      const tez_priceArr: number[] = [];
      const dateArr: number[] = [];
      priceStatsArr.forEach((element) => {
        ctez_priceArr.push(element.ctez_price);
        tez_priceArr.push(parseFloat(element.tez_price));
        dateArr.push(new Date(element.timestamp).getDate())
      })
      return { ctez_priceArr, tez_priceArr, dateArr };
    },
    { refetchInterval: 30_000 },
  );
};
export const useDriftGraph = () => {
  return useQuery<OneLineGraph[], Error>(
    'drift_stats',
    async () => {
      const data = await analyticsAPI.get('/main_data/drift');
      const priceStatsArr: driftGraphInterface[] = data.data;
      priceStatsArr.sort((a, b) => new Date(a.epoch_timestamp).getTime() - new Date(b.epoch_timestamp).getTime())
      const data1: OneLineGraph[] = priceStatsArr.map((e) => {
        return <OneLineGraph>{
          value: e.drift,
          time: e.timestamp
        }
      })
      return data1;
    },
    { refetchInterval: 30_000 },
  );
};
export const useDriftGraphAll = () => {
  return useQuery<OneLineGraph[], Error>(
    'drift_stats_all',
    async () => {
      const data = await analyticsAPI.get('/main_data/drift_all');
      const priceStatsArr: driftGraphInterfaceAll[] = data.data;
      priceStatsArr.sort((a, b) => new Date(a.timestamp_from).getTime() - new Date(b.timestamp_from).getTime())
      const data1: OneLineGraph[] = priceStatsArr.map((e) => {
        return <OneLineGraph>{
          value: e.drift,
          time: e.timestamp_from
        }
      })
      return data1;
    },
    { refetchInterval: 30_000 },
  );
};
export const useMainHeader = () => {
  return useQuery<ctezMainHeader, Error>(
    'main_header',
    async () => {
      const data = await analyticsAPI.get('/summary');
      const ctezmainHeader: ctezMainHeader = data.data;
      return ctezmainHeader;
    },
    { refetchInterval: 30_000 },
  );
};
export const useCtezOven = () => {
  return useQuery<ctezOven, Error>(
    'main_ctezOven',
    async () => {
      const data = await analyticsAPI.get('/ovens');
      const ctezoven: ctezOven = data.data;
      return ctezoven;
    },
    { refetchInterval: 30_000 },
  );
};

export const useOvenTransactionTable = () => {
  return useQuery<OvenTransactionTable[], Error>(
    'main_ctez_OvenTransactionTable',
    async () => {
      const data = await analyticsAPI.get('/main_transaction/mint');
      const ovenTransactionTable: OvenTransactionTable[] = data.data;
      return ovenTransactionTable;
    },
    { refetchInterval: 30_000 },
  );
};
export const useMintedTransactionTable = () => {
  return useQuery<MintBurnData[], Error>(
    'main_ctez_MintBurnData',
    async () => {
      const data = await analyticsAPI.get('/main_transaction/burn');
      const mintBurnData: MintBurnData[] = data.data;
      return mintBurnData;
    },
    { refetchInterval: 30_000 },
  );
};
export const useDepositTransactionTable = () => {
  return useQuery<DepositTransactionTable[], Error>(
    'main_ctez_DepositTransactionTable',
    async () => {
      const data = await analyticsAPI.get('/main_transaction/deposit');
      const depositTransactionTable: DepositTransactionTable[] = data.data;
      return depositTransactionTable;
    },
    { refetchInterval: 30_000 },
  );
};
export const useWithdrawTransactionTable = () => {
  return useQuery<DepositTransactionTable[], Error>(
    'main_ctez_withdrawTransactionTable',
    async () => {
      const data = await analyticsAPI.get('/main_transaction/withdraw');
      const withdrawTransactionTable: DepositTransactionTable[] = data.data;
      return withdrawTransactionTable;
    },
    { refetchInterval: 30_000 },
  );
};
export const useSwapTransactionTable = () => {
  return useQuery<SwapTransaction[], Error>(
    'main_ctez_swapTransaction',
    async () => {
      const data = await analyticsAPI.get('/amm_transaction/swap');
      const SwapTransactionTable: SwapTransaction[] = data.data;
      return SwapTransactionTable;
    },
    { refetchInterval: 30_000 },
  );
};
export const useAddLiquidityTransactionTable = () => {
  return useQuery<AMMTransactionLiquidity[], Error>(
    'main_ctez_AddLiquidityTransaction',
    async () => {
      const data = await analyticsAPI.get('/amm_transaction/add_liquidity');
      const SwapTransactionTable: AMMTransactionLiquidity[] = data.data;
      return SwapTransactionTable;
    },
    { refetchInterval: 30_000 },
  );
};
export const useRemoveLiquidityTransactionTable = () => {
  return useQuery<AMMTransactionLiquidity[], Error>(
    'main_ctez_remove_liquidityTransaction',
    async () => {
      const data = await analyticsAPI.get('/amm_transaction/remove_liquidity');
      const SwapTransactionTable: AMMTransactionLiquidity[] = data.data;
      return SwapTransactionTable;
    },
    { refetchInterval: 30_000 },
  );
};

export const useCtezGraphctez1m = () => {
  return useQuery<TwoLineGraph[], Error>(
    'graph_ctez',
    async () => {
      const data = await analyticsAPI.get('/main_data/target');
      const priceStatsArr: ctezGraphctez[] = data.data;
      priceStatsArr.sort((a, b) => a.epoch_timestamp - b.epoch_timestamp)
      const data1: TwoLineGraph[] = priceStatsArr.map((e) => {
        return <TwoLineGraph>{
          data1: e.current_price,
          data2: e.current_target,
          value: e.current_price,
          time: e.epoch_timestamp,
          premium: e.premium,
        }
      })
      return data1;
    },
    { refetchInterval: 30_000 },
  );
};
export const useCtezGraphctezall = () => {
  return useQuery<TwoLineGraph[], Error>(
    'graph_ctez_all',
    async () => {
      const data = await analyticsAPI.get('/main_data/target_all');
      const priceStatsArr: ctezGraphctezDateRange[] = data.data;
      priceStatsArr.sort((a, b) => a.epoch_timestamp_from - b.epoch_timestamp_from);
      const data1: TwoLineGraph[] = priceStatsArr.map((e) => {
        return <TwoLineGraph>{
          data1: e.current_price,
          data2: e.current_target,
          value: e.current_price,
          time: e.epoch_timestamp_from,
          premium: e.premium,
        }
      })
      return data1;
    },
    { refetchInterval: 30_000 },
  );
};
export const useCtezGraphTVL = () => {
  return useQuery<OneLineGraph[], Error>(
    'ctez_graph_TVL',
    async () => {
      const data = await analyticsAPI.get('/tvl');
      const ctezgraphTVL: TvlData[] = data.data;
      ctezgraphTVL.sort((a, b) => a.epochTimestamp - b.epochTimestamp);
      const data1: OneLineGraph[] = ctezgraphTVL.map((e) => {
        return <OneLineGraph>{
          value: e.ovenTvl,
          time: e.epochTimestamp
        }
      })
      return data1;
    },
    { refetchInterval: 30_000 },
  );
};
export const useCtezGraphTVLAll = () => {
  return useQuery<OneLineGraph[], Error>(
    'ctez_graph_TVL_all',
    async () => {
      const data = await analyticsAPI.get('/tvl_all');
      const ctezgraphTVL: TvlDataALL[] = data.data;
      ctezgraphTVL.sort((a, b) => a.epochTimestampFrom - b.epochTimestampFrom);
      const data1: OneLineGraph[] = ctezgraphTVL.map((e) => {
        return <OneLineGraph>{
          value: e.ovenTvl,
          time: e.epochTimestampFrom
        }
      })
      return data1;
    },
    { refetchInterval: 30_000 },
  );
};
export const useCtezGraphAMMTVL = () => {
  return useQuery<OneLineGraph[], Error>(
    'ctez_graph_TVL_on',
    async () => {
      const data = await analyticsAPI.get('/tvl');
      const ctezgraphTVL: TvlData[] = data.data;
      ctezgraphTVL.sort((a, b) => a.epochTimestamp - b.epochTimestamp);
      const data1: OneLineGraph[] = ctezgraphTVL.map((e) => {
        return <OneLineGraph>{
          value: e.ammTvl,
          time: e.epochTimestamp
        }
      })
      return data1;
    },
    { refetchInterval: 30_000 },
  );
};
export const useCtezGraphAMMTVLAll = () => {
  return useQuery<OneLineGraph[], Error>(
    'ctez_graph_TVL_all_on',
    async () => {
      const data = await analyticsAPI.get('/tvl_all');
      const ctezgraphTVL: TvlDataALL[] = data.data;
      ctezgraphTVL.sort((a, b) => a.epochTimestampFrom - b.epochTimestampFrom);
      const data1: OneLineGraph[] = ctezgraphTVL.map((e) => {
        return <OneLineGraph>{
          value: e.ammTvl,
          time: e.epochTimestampFrom
        }
      })
      return data1;
    },
    { refetchInterval: 30_000 },
  );
};

export const useCtezGraphAMMVolume = () => {
  return useQuery<OneLineGraph[], Error>(
    'ctez_graph_AMM_volume',
    async () => {
      const data = await analyticsAPI.get('/volume_stats');
      const ctezgraphTVL: VolumeAMMData[] = data.data;
      const data1: OneLineGraph[] = ctezgraphTVL.reverse().map((e) => {
        return <OneLineGraph>{
          value: e.volume24hours,
          time: e.timestamp
        }
      })
      return data1;
    },
    { refetchInterval: 30_000 },
  );
};
export const useCtezGraphAMMVolumeAll = () => {
  return useQuery<OneLineGraph[], Error>(
    'ctez_graph_AMM_volume_all',
    async () => {
      const data = await analyticsAPI.get('/volume_stats_month');
      const ctezgraphTVL: VolumeAMMDataAll[] = data.data;
      const data1: OneLineGraph[] = ctezgraphTVL.reverse().map((e) => {
        return <OneLineGraph>{
          value: e.volume,
          time: e.timestampFrom
        }
      })
      return data1;
    },
    { refetchInterval: 30_000 },
  );
};

export const useCtezGraphOvendata = () => {
  return useQuery<PiGraphOven[], Error>(
    'ctez_graph_oven_pi',
    async () => {
      const data = await analyticsAPI.get('/ovens_graph');
      const ctezgraphOvendata: Ovendata[] = data.data;
      const data1: PiGraphOven[] = ctezgraphOvendata.map((e, index) => {
        return <PiGraphOven>{
          id: index,
          address: e.oven_address,
          value: parseFloat(e.percentage.toString()),
          time: e.ctez_standing
        }
      });
      return data1;
    },
  );
};
export const useCtezGraphVolumestat = () => {
  return useQuery<{ data1: number[], dateArr: number[] }, Error>(
    'ctez_graph_TVL',
    async () => {
      const data = await analyticsAPI.get('/main_data/drift');
      const ctezgraphVolumestat: ctezGraphVolumestat = data.data;
      const data1: number[] = [];
      const dateArr: number[] = [];
      ctezgraphVolumestat.volumestats.forEach((element) => {
        data1.push(element.volume24hours);
        dateArr.push(new Date(element.timestamp).getDate())
      })
      return { data1, dateArr };
    },
    { refetchInterval: 30_000 },
  );
};
