from tests.ctez2.base import Ctez2BaseTestCase
from tests.helpers.contracts.ctez2.ctez2 import Ctez2

class Ctez2CollectFromCtezLiquidityTestCase(Ctez2BaseTestCase):
    def test_should_fail_if_tez_in_transaction(self) -> None:
        ctez2, _, sender, receiver = self.default_setup()

        with self.raises_michelson_error(Ctez2.Errors.TEZ_IN_TRANSACTION_DISALLOWED):
            ctez2.using(sender).collect_from_ctez_liquidity(receiver).with_amount(1).send()

    def test_should_transfer_tokens_correctly(self) -> None:
        deposit_amount = 100
        ctez2, ctez_token, owner, receiver = self.default_setup(
            get_ctez_token_balances = lambda owner, *_: {
                owner : deposit_amount
            }
        )

        ctez2.using(owner).collect_from_ctez_liquidity(receiver).send()
        self.bake_block()

        owner.bulk(
            ctez_token.approve(ctez2, deposit_amount),
            ctez2.add_ctez_liquidity(owner, deposit_amount, 0, self.get_future_timestamp())
        ).send()
        self.bake_block()

        ctez2.using(owner).collect_from_ctez_liquidity(receiver).send()
        self.bake_block()

# TODO: add tests for liquidity_shares, proceeds_owed, subsidy_owed
#       when swap and subsidies are implemented
