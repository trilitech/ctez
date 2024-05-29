from tests.ctez2.base import Ctez2BaseTestCase
from tests.helpers.contracts.ctez2.ctez2 import Ctez2

class Ctez2CtezToTezTestCase(Ctez2BaseTestCase):
    def test_should_fail_if_tez_in_transaction(self) -> None:
        ctez2, _, sender, receiver = self.default_setup(
            tez_liquidity = 100
        )

        sent_ctez = 10
        with self.raises_michelson_error(Ctez2.Errors.TEZ_IN_TRANSACTION_DISALLOWED):
            ctez2.using(sender).ctez_to_tez(receiver, sent_ctez, 10, 0).with_amount(1).send()

    def test_should_fail_if_deadline_has_passed(self) -> None:
        ctez2, _, sender, receiver = self.default_setup(
            tez_liquidity = 100
        )

        sent_ctez = 10
        with self.raises_michelson_error(Ctez2.Errors.DEADLINE_HAS_PASSED):
            ctez2.using(sender).ctez_to_tez(receiver, sent_ctez, 10, self.get_passed_timestamp()).send()

    def test_should_fail_if_insufficient_tokens_liquidity(self) -> None:
        ctez2, _, sender, receiver = self.default_setup(
            tez_liquidity = 7
        )

        sent_ctez = 10
        with self.raises_michelson_error(Ctez2.Errors.INSUFFICIENT_TOKENS_LIQUIDITY):
            ctez2.using(sender).ctez_to_tez(receiver, sent_ctez, 8, self.get_future_timestamp()).send()

    def test_should_fail_if_insufficient_tokens_bought(self) -> None:
        ctez2, _, sender, receiver = self.default_setup(
            tez_liquidity=100
        )

        sent_ctez = 10
        with self.raises_michelson_error(Ctez2.Errors.INSUFFICIENT_TOKENS_BOUGHT):
            ctez2.using(sender).ctez_to_tez(receiver, sent_ctez, 1_000_000, self.get_future_timestamp()).send()
