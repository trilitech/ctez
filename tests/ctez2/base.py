from math import ceil
from typing import Callable, Optional
from tests.base import BaseTestCase
from tests.helpers.addressable import Addressable, get_address
from tests.helpers.contracts.ctez2.ctez2 import Ctez2
from tests.helpers.contracts.fa12.fa12 import Fa12
from pytezos.client import PyTezosClient

from tests.helpers.utility import NULL_ADDRESS

class Ctez2BaseTestCase(BaseTestCase):
    def default_setup(
        self,
        tez_liquidity: int = 1,
        ctez_liquidity: int = 1,
        get_ctez_token_balances: Optional[Callable[[PyTezosClient, PyTezosClient], dict[Addressable, int]]] = None,
        ctez_total_supply: Optional[int] = None,
        target_ctez_price: float = 1.0,
        bootstrap_all_tez_balances = False # reloads none and transfer all bakers balances to bootstrapped accounts
    ) -> tuple[Ctez2, Fa12, PyTezosClient, PyTezosClient, PyTezosClient]:
        if bootstrap_all_tez_balances:
            self.tearDownClass()
            self.setUpClass()
        initial_tez_balance = None if bootstrap_all_tez_balances else 100_000_000
        account1 = self.bootstrap_account(initial_tez_balance)
        account2 = self.bootstrap_account(initial_tez_balance)
        donor = self.bootstrap_account(initial_tez_balance)
        ctez2 = self.deploy_ctez2(target_ctez_price=target_ctez_price)

        default_balances = {
            # because half dexes initially have liquidity equals 1
            get_address(ctez2): 1,
            # we need to set the minimum supply (20) of ctez token 
            # to allow _Q always be greater than 0 (since _Q is 5% of total supply)
            NULL_ADDRESS: 19
        }
        ctez_token = self.deploy_fa12(ctez2, default_balances)
        ctez2.set_ctez_fa12_address(ctez_token).send()
        self.bake_block()

        # because we have initial liquidities in half dexes
        ctez_liquidity = max(ctez_liquidity - 1, 0)
        tez_liquidity = max(tez_liquidity - 1, 0)

        balances = get_ctez_token_balances(account1, account2) if get_ctez_token_balances is not None else {}
        rest_supply = ctez_total_supply - 20 if ctez_total_supply is not None else sum(balances.values()) + ctez_liquidity
        tez_deposit = ceil(rest_supply * target_ctez_price * 16/15) # ctez_outstanding = tez*target_price*16/16 not to get under_collateralized

        donor.bulk(
            ctez2.create_oven(0, None, None).with_amount(tez_deposit),
            ctez2.mint_or_burn(0, rest_supply),
            *(
                ctez_token.approve(ctez2, ctez_liquidity),
                ctez2.add_ctez_liquidity(donor, ctez_liquidity, 0, self.get_future_timestamp()),
            ) if ctez_liquidity > 0 else (),
            *(
                ctez2.add_tez_liquidity(donor, 0, self.get_future_timestamp()).with_amount(tez_liquidity),
            ) if tez_liquidity > 0 else (),
        ).send()
        self.bake_block()

        if len(balances):
            donor.bulk(
                *[ctez_token.transfer(donor, receiver, amount) for receiver, amount in balances.items()]
            ).send()
            self.bake_block()

        return ctez2, ctez_token, account1, account2, donor
