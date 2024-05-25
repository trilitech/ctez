from tests.ctez2.base import Ctez2BaseTestCase
from tests.helpers.addressable import get_address
from tests.helpers.contracts.ctez2.ctez2 import Ctez2
from tests.helpers.utility import DEFAULT_ADDRESS

class Ctez2AddTezLiquidityTestCase(Ctez2BaseTestCase):
    def test_should_fail_if_deadline_has_passed(self) -> None:
        ctez2, _, sender, owner = self.default_setup()

        deposit_amount = 10
        with self.raises_michelson_error(Ctez2.Errors.DEADLINE_HAS_PASSED):
            ctez2.using(sender).add_tez_liquidity(owner, 10, self.get_passed_timestamp()).with_amount(deposit_amount).send()

    def test_should_fail_if_insufficient_liquidity_created(self) -> None:
        ctez2, _, sender, owner = self.default_setup()

        deposit_amount = 10
        with self.raises_michelson_error(Ctez2.Errors.INSUFFICIENT_LIQUIDITY_CREATED):
            ctez2.using(sender).add_tez_liquidity(owner, 100_000, self.get_future_timestamp()).with_amount(deposit_amount).send()

    def test_receives_self_token_correctly(self) -> None:
        deposit_amount = 123
        ctez2, _, sender, owner = self.default_setup()

        prev_ctez2_balance = ctez2.contract.context.get_balance()

        ctez2.using(sender).add_tez_liquidity(owner, deposit_amount, self.get_future_timestamp()).with_amount(deposit_amount).send()
        self.bake_block()

        assert ctez2.contract.context.get_balance() == prev_ctez2_balance + deposit_amount

# TODO: add tests for liquidity_shares, proceeds_owed, subsidy_owed
#       when swap and subsidies are implemented
