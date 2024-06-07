from tests.ctez2.base import Ctez2BaseTestCase
from tests.helpers.contracts.ctez2.ctez2 import Ctez2
from parameterized import parameterized
from tests.ctez2.test_cases import swap_tez_to_ctez_cases
from tests.helpers.utility import NULL_ADDRESS

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

    @parameterized.expand(range(0, 2))
    def test_should_fail_if_sell_token_amount_too_small(self, amount) -> None:
        ctez2, _, sender, receiver = self.default_setup(
            ctez_liquidity = 100_000_000_000
        )

        with self.raises_michelson_error(Ctez2.Errors.SMALL_SELL_AMOUNT):
            ctez2.using(sender).tez_to_ctez(receiver, 0, self.get_future_timestamp()).with_amount(amount).send()

    def test_should_fail_if_all_liquidity_removed(self) -> None:
        all_liquidity = 8
        ctez2, _, sender, receiver = self.default_setup(
            ctez_liquidity = all_liquidity
        )

        sent_tez = 10
        with self.raises_michelson_error(Ctez2.Errors.INSUFFICIENT_TOKENS_LIQUIDITY):
            ctez2.using(sender).tez_to_ctez(receiver, all_liquidity, self.get_future_timestamp()).with_amount(sent_tez).send()

    @parameterized.expand(swap_tez_to_ctez_cases)
    def test_should_swap_tez_to_ctez_tokens_correctly(self, _, ctez_liquidity, target_liquidity, sent_tez, ctez_bought, target_price) -> None:
        total_supply = target_liquidity * 20 # ctez_target_liquidity(Q) is 5% of total supply
        ctez2, ctez_token, sender, receiver = self.default_setup(
            ctez_liquidity = ctez_liquidity,
            target_ctez_price = target_price,
            get_ctez_token_balances = lambda *_: {
                NULL_ADDRESS : total_supply - ctez_liquidity
            }
        )

        prev_receiver_ctez_balance = ctez_token.view_balance(receiver)
        prev_ctez2_tez_balance = self.get_balance_mutez(ctez2)
        prev_sell_ctez_dex = ctez2.get_sell_ctez_dex()
        prev_sell_tez_dex = ctez2.get_sell_tez_dex()


        ctez2.using(sender).tez_to_ctez(receiver, ctez_bought, self.get_future_timestamp()).with_amount(sent_tez).send()
        self.bake_block()

        Q_ctez = ctez2.contract.storage()['context']['_Q']
        error_rate = 1.000001 # because of subsidies
        assert target_liquidity / error_rate <= Q_ctez <= target_liquidity * error_rate

        assert ctez_token.view_balance(receiver) == prev_receiver_ctez_balance + ctez_bought
        assert self.get_balance_mutez(ctez2) == prev_ctez2_tez_balance + sent_tez
        
        current_sell_tez_dex = ctez2.get_sell_tez_dex()
        current_sell_ctez_dex = ctez2.get_sell_ctez_dex()
        assert current_sell_tez_dex.self_reserves == prev_sell_tez_dex.self_reserves
        assert current_sell_tez_dex.proceeds_reserves == prev_sell_tez_dex.proceeds_reserves
        assert current_sell_ctez_dex.self_reserves == prev_sell_ctez_dex.self_reserves - ctez_bought
        assert current_sell_ctez_dex.proceeds_reserves == prev_sell_ctez_dex.proceeds_reserves + sent_tez
