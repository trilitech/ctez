from tests.ctez2.base import Ctez2BaseTestCase
from tests.helpers.contracts.ctez2.ctez2 import Ctez2

class Ctez2AddCtezLiquidityTestCase(Ctez2BaseTestCase):
    def test_should_fail_if_tez_in_transaction(self) -> None:
        ctez2, _, sender, owner = self.default_setup()

        deposit_amount = 10
        with self.raises_michelson_error(Ctez2.Errors.TEZ_IN_TRANSACTION_DISALLOWED):
            ctez2.using(sender).add_ctez_liquidity(owner, deposit_amount, 10, 0).with_amount(1).send()

    def test_should_fail_if_deadline_has_passed(self) -> None:
        ctez2, _, sender, owner = self.default_setup()

        deposit_amount = 10
        with self.raises_michelson_error(Ctez2.Errors.DEADLINE_HAS_PASSED):
            ctez2.using(sender).add_ctez_liquidity(owner, deposit_amount, 10, self.get_passed_timestamp()).send()

    def test_should_fail_if_insufficient_liquidity_created(self) -> None:
        ctez2, _, sender, owner = self.default_setup()

        deposit_amount = 10
        with self.raises_michelson_error(Ctez2.Errors.INSUFFICIENT_LIQUIDITY_CREATED):
            ctez2.using(sender).add_ctez_liquidity(owner, deposit_amount, 100_000, self.get_future_timestamp()).send()

    def test_receives_self_token_correctly(self) -> None:
        deposit_amount = 123
        ctez2, ctez_token, sender, owner = self.default_setup(
            get_ctez_token_balances = lambda sender, *_: {
                sender : deposit_amount
            }
        )

        prev_sender_balance = ctez_token.view_balance(sender)
        prev_ctez2_balance = ctez_token.view_balance(ctez2)

        sender.bulk(
            ctez_token.approve(ctez2, deposit_amount),
            ctez2.add_ctez_liquidity(owner, deposit_amount, deposit_amount, self.get_future_timestamp())
        ).send()
        self.bake_block()

        assert ctez_token.view_balance(sender) == prev_sender_balance - deposit_amount
        assert ctez_token.view_balance(ctez2) == prev_ctez2_balance + deposit_amount

# TODO: add tests for liquidity_shares, proceeds_owed, subsidy_owed
#       when swap and subsidies are implemented
