from tests.ctez2.base import Ctez2BaseTestCase
from tests.helpers.contracts.ctez2.ctez2 import Ctez2

class Ctez2TezToCtezTestCase(Ctez2BaseTestCase):
    def test_should_fail_if_deadline_has_passed(self) -> None:
        ctez2, _, sender, receiver = self.default_setup()

        sent_tez = 10
        with self.raises_michelson_error(Ctez2.Errors.DEADLINE_HAS_PASSED):
            ctez2.using(sender).tez_to_ctez(receiver, 10, self.get_passed_timestamp()).with_amount(sent_tez).send()

    def test_should_fail_if_insufficient_tokens_liquidity(self) -> None:
        ctez2, _, sender, receiver = self.default_setup(
            ctez_liquidity = 7
        )

        sent_tez = 10
        with self.raises_michelson_error(Ctez2.Errors.INSUFFICIENT_TOKENS_LIQUIDITY):
            ctez2.using(sender).tez_to_ctez(receiver, 8, self.get_future_timestamp()).with_amount(sent_tez).send()

    def test_should_fail_if_insufficient_tokens_bought(self) -> None:
        ctez2, _, sender, receiver = self.default_setup(
            ctez_liquidity = 100
        )

        sent_tez = 10
        with self.raises_michelson_error(Ctez2.Errors.INSUFFICIENT_TOKENS_BOUGHT):
            ctez2.using(sender).tez_to_ctez(receiver, 1_000_000, self.get_future_timestamp()).with_amount(sent_tez).send()

    def test_should_transfer_tokens_correctly(self) -> None:
        ctez2, ctez_token, sender, receiver = self.default_setup(
            ctez_liquidity = 1_000_000_000_000
        )

        prev_receiver_ctez_balance = ctez_token.view_balance(receiver)
        prev_ctez2_tez_balance = ctez2.contract.context.get_balance()

        sent_tez = 10_000_000
        ctez_bought = 9999998
        ctez2.using(sender).tez_to_ctez(receiver, ctez_bought, self.get_future_timestamp()).with_amount(sent_tez).send()
        self.bake_block()

        assert ctez_token.view_balance(receiver) == prev_receiver_ctez_balance + ctez_bought
        assert ctez2.contract.context.get_balance() == prev_ctez2_tez_balance + sent_tez
