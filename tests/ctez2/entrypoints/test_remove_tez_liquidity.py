from tests.ctez2.base import Ctez2BaseTestCase
from tests.helpers.addressable import get_balance_mutez
from tests.helpers.contracts.ctez2.ctez2 import Ctez2

class Ctez2RemoveTezLiquidityTestCase(Ctez2BaseTestCase):
    def test_should_fail_if_tez_in_transaction(self) -> None:
        ctez2, _, sender, receiver = self.default_setup()

        with self.raises_michelson_error(Ctez2.Errors.TEZ_IN_TRANSACTION_DISALLOWED):
            ctez2.using(sender).remove_tez_liquidity(receiver, 0, 0, 0, 0, self.get_future_timestamp()).with_amount(1).send()

    def test_should_fail_if_deadline_has_passed(self) -> None:
        ctez2, _, sender, receiver = self.default_setup()

        with self.raises_michelson_error(Ctez2.Errors.DEADLINE_HAS_PASSED):
            ctez2.using(sender).remove_tez_liquidity(receiver, 0, 0, 0, 0, self.get_passed_timestamp()).send()

    def test_should_fail_if_insufficient_liquidity(self) -> None:
        deposit_amount = 100
        ctez2, _, owner, receiver = self.default_setup()

        with self.raises_michelson_error(Ctez2.Errors.INSUFFICIENT_LIQUIDITY):
            ctez2.using(owner).remove_tez_liquidity(receiver, 1, 0, 0, 0, self.get_future_timestamp()).send()

        ctez2.using(owner).add_tez_liquidity(owner, 0, self.get_future_timestamp()).with_amount(deposit_amount).send()
        self.bake_block()

        with self.raises_michelson_error(Ctez2.Errors.INSUFFICIENT_LIQUIDITY):
            ctez2.using(owner).remove_tez_liquidity(receiver, deposit_amount + 1, 0, 0, 0, self.get_future_timestamp()).send()

    def test_should_transfer_tokens_correctly(self) -> None:
        deposit_amount = 100
        ctez2, _, owner, receiver = self.default_setup()

        ctez2.using(owner).add_tez_liquidity(owner, 0, self.get_future_timestamp()).with_amount(deposit_amount).send()
        self.bake_block()

        pre_receiver_tez_balance = get_balance_mutez(receiver)
        pre_ctez2_tez_balance = get_balance_mutez(ctez2)

        ctez2.using(owner).remove_tez_liquidity(receiver, deposit_amount, 0, 0, 0, self.get_future_timestamp()).send()
        self.bake_block()

        assert get_balance_mutez(receiver) == pre_receiver_tez_balance + deposit_amount
        assert get_balance_mutez(ctez2) == pre_ctez2_tez_balance - deposit_amount

# TODO: add tests for liquidity_shares, proceeds_owed, subsidy_owed
#       when swap and subsidies are implemented
