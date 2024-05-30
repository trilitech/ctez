from tests.ctez2.base import Ctez2BaseTestCase
from tests.helpers.contracts.ctez2.ctez2 import Ctez2

class Ctez2RemoveCtezLiquidityTestCase(Ctez2BaseTestCase):
    def test_should_fail_if_tez_in_transaction(self) -> None:
        ctez2, _, sender, receiver = self.default_setup()

        with self.raises_michelson_error(Ctez2.Errors.TEZ_IN_TRANSACTION_DISALLOWED):
            ctez2.using(sender).remove_ctez_liquidity(receiver, 0, 0, 0, 0, self.get_future_timestamp()).with_amount(1).send()

    def test_should_fail_if_deadline_has_passed(self) -> None:
        ctez2, _, sender, receiver = self.default_setup()

        with self.raises_michelson_error(Ctez2.Errors.DEADLINE_HAS_PASSED):
            ctez2.using(sender).remove_ctez_liquidity(receiver, 0, 0, 0, 0, self.get_passed_timestamp()).send()

    def test_should_fail_if_insufficient_liquidity(self) -> None:
        deposit_amount = 100
        ctez2, ctez_token, owner, receiver = self.default_setup(
            get_ctez_token_balances = lambda owner, *_: {
                owner : deposit_amount
            }
        )

        with self.raises_michelson_error(Ctez2.Errors.INSUFFICIENT_LIQUIDITY):
            ctez2.using(owner).remove_ctez_liquidity(receiver, 1, 0, 0, 0, self.get_future_timestamp()).send()

        owner.bulk(
            ctez_token.approve(ctez2, deposit_amount),
            ctez2.add_ctez_liquidity(owner, deposit_amount, 0, self.get_future_timestamp())
        ).send()
        self.bake_block()

        with self.raises_michelson_error(Ctez2.Errors.INSUFFICIENT_LIQUIDITY):
            ctez2.using(owner).remove_ctez_liquidity(receiver, deposit_amount + 1, 0, 0, 0, self.get_future_timestamp()).send()

    def test_should_transfer_tokens_correctly(self) -> None:
        deposit_amount = 100
        ctez2, ctez_token, owner, receiver = self.default_setup(
            get_ctez_token_balances = lambda owner, *_: {
                owner : deposit_amount
            }
        )

        owner.bulk(
            ctez_token.approve(ctez2, deposit_amount),
            ctez2.add_ctez_liquidity(owner, deposit_amount, 0, self.get_future_timestamp())
        ).send()
        self.bake_block()

        pre_receiver_ctez_balance = ctez_token.view_balance(receiver)
        pre_ctez2_ctez_balance = ctez_token.view_balance(ctez2)

        ctez2.using(owner).remove_ctez_liquidity(receiver, deposit_amount, 0, 0, 0, self.get_future_timestamp()).send()
        self.bake_block()

        assert ctez_token.view_balance(receiver) == pre_receiver_ctez_balance + deposit_amount
        assert ctez_token.view_balance(ctez2) == pre_ctez2_ctez_balance - deposit_amount

# TODO: add tests for liquidity_shares, proceeds_owed, subsidy_owed
#       when swap and subsidies are implemented
