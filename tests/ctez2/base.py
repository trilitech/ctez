from typing import Callable, Optional
from tests.base import BaseTestCase
from tests.helpers.addressable import Addressable
from tests.helpers.contracts.ctez2.ctez2 import Ctez2
from tests.helpers.contracts.fa12.fa12 import Fa12
from pytezos.client import PyTezosClient

from tests.helpers.utility import DEFAULT_ADDRESS

class Ctez2BaseTestCase(BaseTestCase):
    def default_setup(
        self,
    ) -> tuple[Ctez2, Fa12]:
        ctez2 = self.deploy_ctez2()
        balances = {
            DEFAULT_ADDRESS : 1
        }
        fa12 = self.deploy_fa12(ctez2, balances)
        
        return ctez2, fa12
