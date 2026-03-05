import {
  ContractAbstraction,
  TransactionWalletOperation,
  Wallet,
  WalletContract,
  TezosToolkit,
} from '@taquito/taquito';

export const executeMethod = async (
  contract: WalletContract,
  methodName: string,
  args: unknown[] = [['Unit']],
  confirmation = 0,
  amount = 0,
  mutez = false,
): Promise<TransactionWalletOperation> => {
  const param = args.length === 1
    ? args[0]
    : args.reduce<Record<number, unknown>>((acc, val, idx) => {
        acc[idx] = val;
        return acc;
      }, {});
  const op = await (contract as any).methodsObject[methodName](param).send({
    amount: amount > 0 ? amount : undefined,
    mutez,
  });

  confirmation && (await op.confirmation(confirmation));

  return op;
};

export const initContract = async (
  address: string,
  tezos: TezosToolkit,
): Promise<ContractAbstraction<Wallet>> => {
  if (!address) {
    throw new Error('contract address not set');
  }
  const contract = await tezos.wallet.at(address);
  return contract;
};
