from typing import Callable, Optional
from tests.base import BaseTestCase
from tests.helpers.addressable import Addressable, get_address
from tests.helpers.contracts.ctez2.ctez2 import Ctez2
from tests.helpers.contracts.fa12.fa12 import Fa12
from pytezos.client import PyTezosClient

from tests.helpers.utility import DEFAULT_ADDRESS

class Ctez2BaseTestCase(BaseTestCase):
    def default_setup(
        self,
        tez_liquidity = 0,
        ctez_liquidity = 0,
        get_ctez_token_balances: Optional[Callable[[PyTezosClient, PyTezosClient], dict[Addressable, int]]] = None,
    ) -> tuple[Ctez2, Fa12]:
        account1 = self.bootstrap_account()
        account2 = self.bootstrap_account()
        donor = self.bootstrap_account()
        balances = get_ctez_token_balances(account1, account2) if get_ctez_token_balances is not None else {}
        balances[DEFAULT_ADDRESS] = 1
        balances[donor] = ctez_liquidity
    
        ctez2 = self.deploy_ctez2()
        fa12 = self.deploy_fa12(ctez2, balances)
        ctez2.set_ctez_fa12_address(fa12).send()
        self.bake_block()

        donor.bulk(
            fa12.approve(ctez2, ctez_liquidity),
            ctez2.add_ctez_liquidity(donor, ctez_liquidity, 0, self.get_future_timestamp()),
            ctez2.add_tez_liquidity(donor, 0, self.get_future_timestamp()).with_amount(tez_liquidity),
        ).send()
        self.bake_block()
        
        return ctez2, fa12, account1, account2
