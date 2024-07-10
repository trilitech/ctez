import {
  OpKind,
  TransactionWalletOperation,
  WalletContract,
  WalletOperation,
  WalletParamsWithKind,
} from '@taquito/taquito';
import BigNumber from 'bignumber.js';
import {
  AddLiquidityParams,
  CashToTokenParams,
  CfmmStorage,
  ErrorType,
  RemoveLiquidityParams,
  TokenToCashParams,
  TokenToTokenParams,
} from '../interfaces';
import { CTEZ_ADDRESS as CFMM_ADDRESS } from '../utils/globals';
import { getTezosInstance } from './client';
import { getCTezFa12Contract, getLQTContract } from './fa12';
import { executeMethod, initContract } from './utils';

let cfmm: WalletContract;

type FA12TokenType = 'ctez' | 'lqt';

export const initCfmm = async (address: string): Promise<void> => {
  cfmm = await initContract(address);
};

export const getCfmmStorage = async (): Promise<CfmmStorage> => {
  const storage = await cfmm.storage<CfmmStorage>();
  return storage;
};

export const getLQTContractStorage = async (): Promise<any> => {
  const lqtContract = await getLQTContract();
  const storage: any = await lqtContract.storage();
  return storage;
};

export const getTokenAllowanceOps = async (
  tokenContract: WalletContract,
  userAddress: string,
  newAllowance: number,
  tokenType: FA12TokenType = 'ctez',
): Promise<WalletParamsWithKind[]> => {
  const batchOps: WalletParamsWithKind[] = [];
  const maxTokensDeposited = tokenType === 'ctez' ? newAllowance * 1e6 : newAllowance;
  const storage: any = await tokenContract.storage();
  const currentAllowance = new BigNumber(
    (await storage.allowances.get({ owner: userAddress, spender: CFMM_ADDRESS })) ?? 0,
  )
    .shiftedBy(-6)
    .toNumber();
  if (currentAllowance < newAllowance) {
    if (currentAllowance > 0) {
      batchOps.push({
        kind: OpKind.TRANSACTION,
        ...tokenContract.methods.approve(CFMM_ADDRESS, 0).toTransferParams(),
      });
    }
    batchOps.push({
      kind: OpKind.TRANSACTION,
      ...tokenContract.methods.approve(CFMM_ADDRESS, maxTokensDeposited).toTransferParams(),
    });
  }
  return batchOps;
};

export const addLiquidity = async (args: AddLiquidityParams): Promise<WalletOperation> => {
  const tezos = getTezosInstance();
  const CTezFa12 = await getCTezFa12Contract();
  const batchOps: WalletParamsWithKind[] = await getTokenAllowanceOps(
    CTezFa12,
    args.owner,
    args.maxTokensDeposited,
  );
  const batch = tezos.wallet.batch([
    ...batchOps,
    {
      kind: OpKind.TRANSACTION,
      ...cfmm.methods
        .addLiquidity(
          args.owner,
          args.minLqtMinted,
          args.maxTokensDeposited * 1e6,
          args.deadline.toISOString(),
        )
        .toTransferParams(),
      amount: args.amount,
    },
    {
      kind: OpKind.TRANSACTION,
      ...CTezFa12.methods.approve(CFMM_ADDRESS, 0).toTransferParams(),
    },
  ]);
  const hash = await batch.send();
  return hash;
};

export const removeLiquidity = async (
  args: RemoveLiquidityParams,
  userAddress: string,
): Promise<WalletOperation> => {
  const tezos = getTezosInstance();
  const LQTFa12 = await getLQTContract();
  const batchOps: WalletParamsWithKind[] = await getTokenAllowanceOps(
    LQTFa12,
    userAddress,
    args.lqtBurned,
    'lqt',
  );
  const batch = tezos.wallet.batch([
    ...batchOps,
    {
      kind: OpKind.TRANSACTION,
      ...cfmm.methods
        .removeLiquidity(
          args.to,
          args.lqtBurned,
          args.minCashWithdrawn * 1e6,
          args.minTokensWithdrawn * 1e6,
          args.deadline.toISOString(),
        )
        .toTransferParams(),
    },
    {
      kind: OpKind.TRANSACTION,
      ...LQTFa12.methods.approve(CFMM_ADDRESS, 0).toTransferParams(),
    },
  ]);
  const hash = await batch.send();
  return hash;
};

export const cashToToken = async (args: CashToTokenParams): Promise<TransactionWalletOperation> => {
  const operation = await executeMethod(
    cfmm,
    'cashToToken',
    [args.to, Math.floor(args.minTokensBought * 1e6), args.deadline.toISOString()],
    undefined,
    args.amount * 1e6,
    true,
  );
  return operation;
};

export const tokenToCash = async (
  args: TokenToCashParams,
  userAddress: string,
): Promise<WalletOperation> => {
  const tezos = getTezosInstance();
  const CTezFa12 = await getCTezFa12Contract();
  const batchOps: WalletParamsWithKind[] = await getTokenAllowanceOps(
    CTezFa12,
    userAddress,
    args.tokensSold,
  );

  const batch = tezos.wallet.batch([
    ...batchOps,
    {
      kind: OpKind.TRANSACTION,
      ...cfmm.methods
        .tokenToCash(
          args.to,
          args.tokensSold * 1e6,
          Math.floor(args.minCashBought * 1e6),
          args.deadline.toISOString(),
        )
        .toTransferParams(),
    },
    {
      kind: OpKind.TRANSACTION,
      ...CTezFa12.methods.approve(CFMM_ADDRESS, 0).toTransferParams(),
    },
  ]);
  const batchOperation = await batch.send();
  return batchOperation;
};

export const tokenToToken = async (
  args: TokenToTokenParams,
): Promise<TransactionWalletOperation> => {
  const operation = await executeMethod(cfmm, 'tokenToToken', [
    args.outputCfmmContract,
    args.minTokensBought * 1e6,
    args.to,
    args.tokensSold * 1e6,
    args.deadline.toISOString(),
  ]);
  return operation;
};
