from pytezos.client import PyTezosClient
from pytezos.contract.call import ContractCall
from tests.helpers.addressable import Addressable, get_address
from tests.helpers.contracts.contract import ContractHelper
from tests.helpers.utility import (
    NULL_ADDRESS,
    get_build_dir,
    originate_from_file,
)
from pytezos.operation.group import OperationGroup
from os.path import join
from math import floor
from typing import NamedTuple

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
        proceeds_reserves: int
        subsidy_reserves: int
        fee_index: int

    @classmethod
    def originate(
        self,
        client: PyTezosClient,
        target_ctez_price = 1.0
    ) -> OperationGroup:
        # we need to set initial liquidity as 1 which will never be withdrawn 
        half_dex_storage = {
            'liquidity_owners' : {
                NULL_ADDRESS: {
                    'liquidity_shares': 1,
                    'proceeds_owed': 0,
                    'subsidy_owed': 0
                }
            },
            'total_liquidity_shares' : 1,
            'self_reserves' : 1,
            'proceeds_reserves' : 0,
            'subsidy_reserves' : 0,
            'fee_index' : 2**48,
        }

        storage = {
            'ovens': {},
            'last_update': 0,
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

        return originate_from_file(filename, client, storage, balance=1)

    def set_ctez_fa12_address(self, address : Addressable) -> ContractCall:
        return self.contract.set_ctez_fa12_address(get_address(address))

    def get_ctez_fa12_address(self) -> str:
        return self.contract.storage()['context']['ctez_fa12_address']
    
    def get_sell_ctez_dex(self) -> HalfDex:
        return Ctez2.HalfDex(**self.contract.storage()['sell_ctez']) 
    
    def get_sell_tez_dex(self) -> HalfDex:
        return Ctez2.HalfDex(**self.contract.storage()['sell_tez']) 

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
