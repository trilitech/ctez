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
  TezToCtezParams,
  CfmmStorage,
  ErrorType,
  RemoveLiquidityParams,
  ctezToTezParams,
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
  const currentAllowance = new BigNumber(
    (await tokenContract.contractViews.viewAllowance({ owner: userAddress, spender: CFMM_ADDRESS }).executeView({viewCaller: tokenContract.address})) ?? 0,
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

export const addCtezLiquidity = async (args: AddLiquidityParams): Promise<WalletOperation> => {
  const tezos = getTezosInstance();
  const CTezFa12 = await getCTezFa12Contract();
  const batchOps: WalletParamsWithKind[] = await getTokenAllowanceOps(
    CTezFa12,
    args.owner,
    args.amount,
  );
  const batch = tezos.wallet.batch([
    ...batchOps,
    {
      kind: OpKind.TRANSACTION,
      ...cfmm.methods
        .add_ctez_liquidity(
          args.owner,
          args.amount * 1e6,
          args.minLqtMinted,
          args.deadline.toISOString(),
        )
        .toTransferParams(),
      amount: 0,
    },
    {
      kind: OpKind.TRANSACTION,
      ...CTezFa12.methods.approve(CFMM_ADDRESS, 0).toTransferParams(),
    },
  ]);
  const hash = await batch.send();
  return hash;
};

export const addTezLiquidity = async (args: AddLiquidityParams): Promise<WalletOperation> => {
  const hash = await cfmm.methods.add_tez_liquidity(
    args.owner,
    args.minLqtMinted,
    args.deadline.toISOString(),
  ).send({amount: args.amount})
  return hash;
};

export const addLiquidity = async (args: AddLiquidityParams): Promise<WalletOperation> => {
  return args.isCtezSide ? addCtezLiquidity(args) : addTezLiquidity(args);
};

export const removeLiquidity = async (
  args: RemoveLiquidityParams,
  userAddress: string,
): Promise<WalletOperation> => {
  const tezos = getTezosInstance();

  const hash = await cfmm.methods[args.isCtezSide ? 'remove_ctez_liquidity' : 'remove_tez_liquidity'](
    args.to,
    args.lqtBurned,
    args.minSelfReceived * 1e6,
    args.minProceedsReceived * 1e6,
    args.minSubsidyReceived * 1e6,
    args.deadline.toISOString(),
  ).send();
  return hash;
};

export const tezToCtez = async (args: TezToCtezParams): Promise<TransactionWalletOperation> => {
  const operation = await executeMethod(
    cfmm,
    'tez_to_ctez',
    [args.to, Math.floor(args.minCtezBought * 1e6), args.deadline.toISOString()],
    undefined,
    args.tezSold * 1e6,
    true,
  );
  return operation;
};

export const ctezToTez = async (
  args: ctezToTezParams,
  userAddress: string,
): Promise<WalletOperation> => {
  const tezos = getTezosInstance();
  const CTezFa12 = await getCTezFa12Contract();
  const batchOps: WalletParamsWithKind[] = await getTokenAllowanceOps(
    CTezFa12,
    userAddress,
    args.ctezSold,
  );

  const batch = tezos.wallet.batch([
    ...batchOps,
    {
      kind: OpKind.TRANSACTION,
      ...cfmm.methods
        .ctez_to_tez(
          args.to,
          args.ctezSold * 1e6,
          Math.floor(args.minTezBought * 1e6),
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
