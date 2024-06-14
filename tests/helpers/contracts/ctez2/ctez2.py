from pytezos.client import PyTezosClient
from pytezos.contract.call import ContractCall
from tests.helpers.addressable import Addressable, get_address
from tests.helpers.contracts.contract import ContractHelper
from tests.helpers.contracts.oven.oven import Oven
from tests.helpers.utility import (
    NULL_ADDRESS,
    get_build_dir,
    originate_from_file,
)
from pytezos.operation.group import OperationGroup
from os.path import join
from math import floor
from typing import NamedTuple, Optional

class Ctez2(ContractHelper):
    class Errors:
        TEZ_IN_TRANSACTION_DISALLOWED = 'TEZ_IN_TRANSACTION_DISALLOWED'
        DEADLINE_HAS_PASSED = 'DEADLINE_HAS_PASSED'
        INSUFFICIENT_LIQUIDITY_CREATED = 'INSUFFICIENT_LIQUIDITY_CREATED'
        CTEZ_FA12_ADDRESS_ALREADY_SET = 'CTEZ_FA12_ADDRESS_ALREADY_SET'
        INSUFFICIENT_TOKENS_BOUGHT = 'INSUFFICIENT_TOKENS_BOUGHT'
        INSUFFICIENT_TOKENS_LIQUIDITY = 'INSUFFICIENT_TOKENS_LIQUIDITY'
        INSUFFICIENT_LIQUIDITY = 'INSUFFICIENT_LIQUIDITY'
        INSUFFICIENT_SELF_RECEIVED = 'INSUFFICIENT_SELF_RECEIVED'
        INSUFFICIENT_PROCEEDS_RECEIVED = 'INSUFFICIENT_PROCEEDS_RECEIVED'
        INSUFFICIENT_SUBSIDY_RECEIVED = 'INSUFFICIENT_SUBSIDY_RECEIVED'
        SMALL_SELL_AMOUNT = 'SMALL_SELL_AMOUNT'

    class HalfDex(NamedTuple):
        liquidity_owners: int
        total_liquidity_shares: int
        self_reserves: int
        proceeds_debts: int
        proceeds_reserves: int
        subsidy_debts: int
        subsidy_reserves: int
        fee_index: int

    class LiquidityOwner(NamedTuple):
        liquidity_shares: int
        proceeds_owed: int
        subsidy_owed: int

    @classmethod
    def originate(
        self,
        client: PyTezosClient,
        last_update: int,
        target_ctez_price = 1.0
    ) -> OperationGroup:
        half_dex_storage = {
            'liquidity_owners': {},
            'total_liquidity_shares': 0,
            'self_reserves': 0,
            'proceeds_debts': 0,
            'proceeds_reserves': 0,
            'subsidy_debts': 0,
            'subsidy_reserves': 0,
            'fee_index' : 2**48,
        }

        storage = {
            'ovens': {},
            'last_update': last_update,
            'sell_tez' : half_dex_storage,
            'sell_ctez' : half_dex_storage,
            'context': {
                'target': floor(target_ctez_price * 2**48), 
                'drift' : 0, 
                '_Q' : 1,
                'ctez_fa12_address' : NULL_ADDRESS,
            }
        }
        
        filename = join(get_build_dir(), 'ctez_2.tz')

        return originate_from_file(filename, client, storage)

    def set_ctez_fa12_address(self, address : Addressable) -> ContractCall:
        return self.contract.set_ctez_fa12_address(get_address(address))

    def get_ctez_fa12_address(self) -> str:
        return self.contract.storage()['context']['ctez_fa12_address']
    
    def get_sell_ctez_dex(self) -> HalfDex:
        return Ctez2.HalfDex(**self.contract.storage()['sell_ctez']) 
    
    def get_sell_tez_dex(self) -> HalfDex:
        return Ctez2.HalfDex(**self.contract.storage()['sell_tez']) 
    
    def get_ctez_liquidity_owner(self, owner: Addressable) -> LiquidityOwner:
        owner_address = get_address(owner)
        return Ctez2.LiquidityOwner(**self.contract.storage['sell_ctez']['liquidity_owners'][owner_address]())
    
    def get_tez_liquidity_owner(self, owner: Addressable) -> LiquidityOwner:
        owner_address = get_address(owner)
        return Ctez2.LiquidityOwner(**self.contract.storage['sell_tez']['liquidity_owners'][owner_address]())
    
    def get_oven_contract(self, client: PyTezosClient, owner: Addressable, oven_id: int) -> Oven:
        oven_record = self.contract.storage['ovens'][(oven_id, get_address(owner))]()
        print(oven_record)
        return Oven.from_address(client, oven_record['address'])

    def create_oven(self, id: int, delegate: Optional[Addressable], depositors: Optional[list]) -> ContractCall:
        return self.contract.create_oven({ 
            'id': id,
            'delegate': get_address(delegate) if delegate is not None else None, 
            'depositors': {'any': None} if depositors is None else {'whitelist': depositors}
        })
    
    def mint_or_burn(self, id: int, quantity: int) -> ContractCall:
        return self.contract.mint_or_burn({
            'id': id,
            'quantity': quantity
        })

    def add_ctez_liquidity(self, owner : Addressable, amount_deposited : int, min_liquidity : int, deadline : int ) -> ContractCall:
        return self.contract.add_ctez_liquidity({ 
            'owner': get_address(owner),
            'amount_deposited': amount_deposited, 
            'min_liquidity': min_liquidity, 
            'deadline': deadline 
        })

    def add_tez_liquidity(self, owner : Addressable, min_liquidity : int, deadline : int ) -> ContractCall:
        return self.contract.add_tez_liquidity({ 
            'owner': get_address(owner),
            'min_liquidity': min_liquidity, 
            'deadline': deadline 
        })

    def remove_ctez_liquidity(
            self, 
            to : Addressable, 
            liquidity_redeemed : int, 
            min_self_received : int, 
            min_proceeds_received : int, 
            min_subsidy_received : int, 
            deadline : int 
            ) -> ContractCall:
        return self.contract.remove_ctez_liquidity({ 
            'to_': get_address(to),
            'liquidity_redeemed': liquidity_redeemed, 
            'min_self_received': min_self_received, 
            'min_proceeds_received': min_proceeds_received, 
            'min_subsidy_received': min_subsidy_received, 
            'deadline': deadline 
        })

    def remove_tez_liquidity(
            self, 
            to : Addressable, 
            liquidity_redeemed : int, 
            min_self_received : int, 
            min_proceeds_received : int, 
            min_subsidy_received : int, 
            deadline : int 
            ) -> ContractCall:
        return self.contract.remove_tez_liquidity({ 
            'to_': get_address(to),
            'liquidity_redeemed': liquidity_redeemed, 
            'min_self_received': min_self_received, 
            'min_proceeds_received': min_proceeds_received, 
            'min_subsidy_received': min_subsidy_received, 
            'deadline': deadline 
        })

    def collect_from_tez_liquidity(self, to : Addressable) -> ContractCall:
        return self.contract.collect_from_tez_liquidity(get_address(to))

    def collect_from_ctez_liquidity(self, to : Addressable) -> ContractCall:
        return self.contract.collect_from_ctez_liquidity(get_address(to))

    def tez_to_ctez(self, to : Addressable, min_ctez_bought : int, deadline : int ) -> ContractCall:
        return self.contract.tez_to_ctez({ 
            'to_': get_address(to),
            'min_ctez_bought': min_ctez_bought, 
            'deadline': deadline 
        })

    def ctez_to_tez(self, to : Addressable, ctez_sold : int, min_tez_bought : int, deadline : int ) -> ContractCall:
        return self.contract.ctez_to_tez({ 
            'to_': get_address(to),
            'ctez_sold': ctez_sold,
            'min_tez_bought': min_tez_bought, 
            'deadline': deadline 
        })
