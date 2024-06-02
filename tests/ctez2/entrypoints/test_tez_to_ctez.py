from tests.ctez2.base import Ctez2BaseTestCase
from tests.helpers.addressable import get_balance_mutez
from tests.helpers.contracts.ctez2.ctez2 import Ctez2
from parameterized import parameterized

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

    def test_should_not_allow_to_remove_all_liquidity(self) -> None:
        all_liquidity = 8
        ctez2, _, sender, receiver = self.default_setup(
            ctez_liquidity = all_liquidity
        )

        sent_tez = 10
        with self.raises_michelson_error(Ctez2.Errors.INSUFFICIENT_TOKENS_LIQUIDITY):
            ctez2.using(sender).tez_to_ctez(receiver, all_liquidity, self.get_future_timestamp()).with_amount(sent_tez).send()

    @parameterized.expand([
        #                                           q,            Q,           x,        y
        #                                        liquidity    target_liq   send_amt  receive_amt
        ('liquidity_is_total_supply_ie_max',    200_000_000,  10_000_000, 1_000_000, 999_986), # price ~ 1.0000 , because we still have enough liquidity after swap
        ('liquidity_from_120_to_110_percent',    12_000_000,  10_000_000, 1_000_000, 999_986), # price ~ 1.0000 , ...
        ('liquidity_from_110_to_100_percent',    11_000_000,  10_000_000, 1_000_000, 999_986), # price ~ 1.0000 , ...
        ('liquidity_from_100_to_90_percent',     10_000_000,  10_000_000, 1_000_000, 999_986), # price ~ 1.0000 , because we not far from target liquidity after swap
        ('liquidity_from_90_to_80_percent',       9_000_000,  10_000_000, 1_000_000, 999_811), # price ~ 1.0002 , the price should then increase up to 1.05 as we get farther from the target liquidity.
        ('liquidity_from_80_to_70_percent',       8_000_000,  10_000_000, 1_000_000, 999_187), # price ~ 1.0008 ...
        ('liquidity_from_70_to_60_percent',       7_000_000,  10_000_000, 1_000_000, 997_818), # price ~ 1.0022 ...
        ('liquidity_from_60_to_50_percent',       6_000_000,  10_000_000, 1_000_000, 995_415), # price ~ 1.0046 ...
        ('liquidity_from_50_to_40_percent',       5_000_000,  10_000_000, 1_000_000, 991_700), # price ~ 1.0084 ...
        ('liquidity_from_40_to_30_percent',       4_000_000,  10_000_000, 1_000_000, 986_418), # price ~ 1.0138 ...
        ('liquidity_from_30_to_20_percent',       3_000_000,  10_000_000, 1_000_000, 979_338), # price ~ 1.0211 ...
        ('liquidity_from_20_to_10_percent',       2_000_000,  10_000_000, 1_000_000, 970_264), # price ~ 1.0306 ...
        ('liquidity_from_10_to_0_percent',        1_000_000,  10_000_000, 1_000_000, 959_046), # price ~ 1.0427 ...
        ('liquidity_from_5_to_0_percent',         1_000_000,  20_000_000, 1_000_000, 955_826), # price ~ 1.0462 ...
        ('liquidity_from_1_to_0_percent',         1_000_000, 100_000_000, 1_000_000, 953_087), # price ~ 1.0492 ...
        ('liquidity_very_close_to_0_percent',     1_000_000,     10**100, 1_000_000, 952_379), # price ~ 1.0500

        ('liquidity_from_max_to_min',            200_000_000, 200_000_000, 202_500_001, 199_999_999), # price ~ 1.0125
    ])
    def test_should_transfer_tokens_correctly(self, _, ctez_liquidity, target_liquidity, sent_tez, ctez_bought) -> None:
        total_supply = target_liquidity * 20 # target_liquidity is 5% of total supply
        ctez2, ctez_token, sender, receiver = self.default_setup(
            ctez_liquidity = ctez_liquidity,
            get_ctez_token_balances = lambda sender, *_: {
                sender : total_supply - ctez_liquidity
            }
        )

        prev_receiver_ctez_balance = ctez_token.view_balance(receiver)
        prev_ctez2_tez_balance = get_balance_mutez(ctez2)

        assert ctez2.contract.storage()['context']['_Q'] == target_liquidity

        ctez2.using(sender).tez_to_ctez(receiver, ctez_bought, self.get_future_timestamp()).with_amount(sent_tez).send()
        self.bake_block()

        assert ctez_token.view_balance(receiver) == prev_receiver_ctez_balance + ctez_bought
        assert get_balance_mutez(ctez2) == prev_ctez2_tez_balance + sent_tez

# TODO: add swap tests for different target prices
