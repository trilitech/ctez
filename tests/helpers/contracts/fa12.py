from pytezos.client import PyTezosClient
from pytezos.contract.call import ContractCall
from tests.helpers.addressable import Addressable, get_address
from tests.helpers.contracts.contract import ContractHelper
from tests.helpers.utility import (
    DEFAULT_ADDRESS,
    get_build_dir,
    originate_from_file,
)
from pytezos.operation.group import OperationGroup
from os.path import join


class Fa12(ContractHelper):
    class Errors:
        DONT_SEND_TEZ = 'DontSendTez'
        NOT_ENOUGH_BALANCE = 'NotEnoughBalance'
        NOT_ENOUGH_ALLOWANCE = 'NotEnoughAllowance'
        UNSAFE_ALLOWANCE_CHANGE = 'UnsafeAllowanceChange'
        ONLY_ADMIN = 'OnlyAdmin'
        CANNOT_BURN_MORE_THAN_THE_TARGETS_BALANCE = 'CannotBurnMoreThanTheTargetsBalance'

    @classmethod
    def originate(
        self,
        client: PyTezosClient,
        admin: Addressable,
        balances: dict[Addressable, int],
        allowances: list[tuple[Addressable, Addressable, int]]
    ) -> OperationGroup:
        allowances_value = {}
        for _from, to, amount in allowances:
            key = (get_address(_from), get_address(to))
            allowances_value[key] = amount

        storage = {
            'tokens': {
                get_address(addressable): amount for addressable, amount in balances.items()
            }, 
            'allowances': allowances_value, 
            'admin': get_address(admin), 
            'total_supply': sum(balances.values())
        }
        
        filename = join(get_build_dir(), 'fa12.tz')

        return originate_from_file(filename, client, storage)
    
    def transfer(self, _from : Addressable, to : Addressable, value : int) -> ContractCall:
        return self.contract.transfer({
            'from': get_address(_from),
            'to': get_address(to),
            'value': value,
        })
    
    def approve(self, spender : Addressable, value : int) -> ContractCall:
        return self.contract.approve({
            'spender': get_address(spender),
            'value': value,
        })
    
    def mintOrBurn(self, quantity : int, target : Addressable) -> ContractCall:
        return self.contract.mintOrBurn({
            'quantity': quantity,
            'target': get_address(target),
        })
    
    def view_total_supply(self) -> int:
        return self.contract.viewTotalSupply().run_view()
    
    def get_balance(self, owner: Addressable) -> int:
        address = get_address(owner)
        try:
            balance = self.contract.storage['tokens'][address]()
            assert isinstance(balance, int)
        except Exception as e:
            balance = 0
        return balance
    
    def get_allowance(self, owner: Addressable, spender: Addressable) -> int:
        key = (get_address(owner), get_address(spender))
        try:
            allowance = self.contract.storage['allowances'][key]()
            assert isinstance(allowance, int)
        except Exception as e:
            allowance = 0
        return allowance
