from pytezos.client import PyTezosClient
from tests.helpers.contracts.contract import ContractHelper
from tests.helpers.utility import (
    DEFAULT_ADDRESS,
    get_build_dir,
    originate_from_file,
)
from pytezos.operation.group import OperationGroup
from os.path import join


class Fa12(ContractHelper):
    @classmethod
    def originate(self, client: PyTezosClient) -> OperationGroup:
        storage = {
            'tokens': {
                DEFAULT_ADDRESS: 1
            }, 
            'allowances': {}, 
            'admin': DEFAULT_ADDRESS, 
            'total_supply': 1
        }
        
        filename = join(get_build_dir(), 'fa12.tz')

        return originate_from_file(filename, client, storage)
    
    def get_total_supply(self) -> int:
        return self.contract.viewTotalSupply().run_view()
    
