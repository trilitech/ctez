from tests.fa12.base import Fa12BaseTestCase
from tests.helpers.contracts.fa12 import Fa12

class Fa12ApproveTestCase(Fa12BaseTestCase):
    def test_should_fail_if_tez_in_transaction(self) -> None:
        owner, spender, fa12 = self.default_setup()

        with self.raisesMichelsonError(Fa12.Errors.DONT_SEND_TEZ):
            fa12.using(owner).approve(spender, 10).with_amount(1).send()

    def test_should_fail_if_unsafe_allowance_change(self) -> None:
        owner, spender, fa12 = self.default_setup()
        
        fa12.using(owner).approve(spender, 20).send()
        self.bake_block()

        with self.raisesMichelsonError(Fa12.Errors.UNSAFE_ALLOWANCE_CHANGE):
            fa12.using(owner).approve(spender, 10).send()

    def test_should_update_allowance_correctly(self) -> None:
        owner, spender, fa12 = self.default_setup()
        
        fa12.using(owner).approve(spender, 20).send()
        self.bake_block()
        assert fa12.get_allowance(owner, spender) == 20

        fa12.using(owner).approve(spender, 0).send()
        self.bake_block()
        assert fa12.get_allowance(owner, spender) == 0

        fa12.using(owner).approve(spender, 100).send()
        self.bake_block()
        assert fa12.get_allowance(owner, spender) == 100
