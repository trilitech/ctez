import axios, { AxiosResponse } from "axios";
import { useQuery } from "react-query";
import { getAllOvens } from "../contracts/ctez";
import { getOvenSummary } from "../hooks/utilHooks";
import {
  CtezStatsGql, OneLineGraph, OvenDonutGql, OvensSummaryGql, OvenTransactionGql, OvenTransactionDtoGql, OvenTvlGql,
  SwapTransactionsGql, TradeVolumeGql, TvlData, TvlDataALL, AddLiquidityTransactionsGql, AddLiquidityTransactionsDto,
  RemoveLiquidityTransactionsDto, RemoveLiquidityTransactionsGql, CollectFromLiquidityTransactionsDto, CollectFromLiquidityTransactionsGql
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

      const chunks = await getBatchesGql(count, query);
      return chunks.flatMap(response => response.data.data[entity]);
    }
  );
};

export const useCtezGraphCurrentPointGql = () => {
  return useQuery<CtezStatsGql, Error>(
    'ctez_graph_current_point',
    async () => {
      const baseStats = await getBaseStats();
      const currentPoint: CtezStatsGql = {
        id: 'now-now-now',
        timestamp: new Date().toISOString(),
        target_price: Number(baseStats.currentTarget.toFixed(6)),
        annual_drift_percent: Number(baseStats.currentAnnualDrift.toFixed(2)),
        ctez_buy_price: Number(baseStats.currentCtezBuyPrice.toFixed(6)),
        ctez_sell_price: Number(baseStats.currentCtezSellPrice.toFixed(6)),
        current_avg_price: Number(baseStats.currentAvgPrice.toFixed(6))
      };

      return currentPoint;
    },
    { refetchInterval: 30_000 },
  );
};

export const useOvensTvlGraphGql = () => {
  return useQuery<OvenTvlGql[], Error>(
    'ovens_tvl_gql',
    async () => {
      const count = await getCountGql('ca_tvl_history_1d_aggregate');
      const query = `
        query tvl_chart_query($from: timestamptz="2018-07-01",$to: timestamptz="NOW()") {
          tvl_history: ca_tvl_history_1d(where: {bucket_1d: {_gte: $from, _lte: $to}}) {
            timestamp: bucket_1d
            tvl: tvl_usd
          }
       }
      `;
      const chunks = await getBatchesGql(count, query);
      return chunks.flatMap(response => response.data.data.tvl_history);
    }
  );
};

export const getOvensSummaryGql = async () => {
  const entity = 'oven_summary';
  const response = await axios({
    url: GQL_API_URL,
    method: "POST",
    data: {
      query: `
        query {
          ${entity} {
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

  return response.data.data[entity][0];
};

export const useOvensSummaryGql = () => {
  return useQuery<OvensSummaryGql, Error>(
    'ovens_summary_gql',
    getOvensSummaryGql,
    { refetchInterval: 30_000 },
  );
};

export const getTezosPriceGql = async () => {
  const entity = 'quotes'
  const response = await axios({
    url: GQL_API_URL,
    method: "POST",
    data: {
      query: `
        query {
          ${entity} (order_by: {level: desc}, limit: 1) {
            usd
          }
        }
      `
    }
  });

  return response.data.data[entity][0].usd;
};

export const useTezosPriceGql = () => {
  return useQuery<number, Error>(
    'tezos_price_gql',
    getTezosPriceGql,
    { refetchInterval: 30_000 },
  );
};

export const useOvensTvlCurrentPointGql = () => {
  return useQuery<OvenTvlGql, Error>(
    'ovens_tvl_current_point',
    async () => {
      const [summary, price] = await Promise.all([getOvensSummaryGql(), getTezosPriceGql()]);

      const currentPoint: OvenTvlGql = {
        id: 'now-now-now',
        timestamp: new Date().toISOString(),
        tvl: Number((summary.collateral_locked * price).toFixed(2))
      }
      return currentPoint;
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
    { refetchInterval: 60_000 },
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

export const useTradeVolumeGql = (range: '1d' | '30d') => {
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
    }
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

