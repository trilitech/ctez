from tests.ctez2.base import Ctez2BaseTestCase
from tests.helpers.contracts.ctez2.ctez2 import Ctez2
from parameterized import parameterized
from test_cases import swap_ctez_to_tez_cases
from tests.helpers.utility import NULL_ADDRESS, TEST_ADDRESSES_SET
from math import floor, ceil

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

    def test_should_not_allow_to_remove_all_liquidity(self) -> None:
        all_liquidity = 8
        ctez2, _, sender, receiver = self.default_setup(
            tez_liquidity = all_liquidity
        )

        sent_tez = 10
        with self.raises_michelson_error(Ctez2.Errors.INSUFFICIENT_TOKENS_LIQUIDITY):
            ctez2.using(sender).ctez_to_tez(receiver, sent_tez, all_liquidity, self.get_future_timestamp()).send()

    @parameterized.expand(swap_ctez_to_tez_cases)
    def test_should_swap_ctez_to_tez_tokens_correctly(self, _, tez_liquidity, target_liquidity, sent_ctez, tez_bought, target_price) -> None:
        total_supply = ceil(target_liquidity * 20 / target_price) # target_liquidity is 5% of total supply
        ctez2, ctez_token, sender, _ = self.default_setup(
            get_ctez_token_balances = lambda sender, *_: {
                sender: sent_ctez,
                NULL_ADDRESS: total_supply - sent_ctez
            },
            tez_liquidity = tez_liquidity,
            target_ctez_price = target_price
        )
        receiver = TEST_ADDRESSES_SET[0]

        prev_receiver_tez_balance = self.get_balance_mutez(receiver)
        prev_ctez2_ctez_balance = ctez_token.view_balance(ctez2)
        prev_sender_ctez_balance = ctez_token.view_balance(sender)


        print('tez_liquidity', tez_liquidity)
        print('tez_bought', tez_bought)
        print('target_price', target_price)
        print('target_liquidity', target_liquidity)
        print('total_supply', total_supply)
        print('sent_ctez', sent_ctez)
        print('ctez_supply', ctez_token.view_total_supply())
        print('_Q', ctez2.contract.storage()['context']['_Q'])
        print('storage', ctez2.contract.storage())

        Q_ctez = ctez2.contract.storage()['context']['_Q']
        Q_tez = floor(Q_ctez * target_price)
        print("Q_ctez", Q_ctez)
        print("Q_tez", Q_tez)
        #assert Q_tez == target_liquidity TODO: assert with error rate

        sender.bulk(
            ctez_token.approve(ctez2, sent_ctez),
            ctez2.ctez_to_tez(receiver, sent_ctez, tez_bought, self.get_future_timestamp())
        ).send()
        self.bake_block()

        assert self.get_balance_mutez(receiver) == prev_receiver_tez_balance + tez_bought
        assert ctez_token.view_balance(sender) == prev_sender_ctez_balance - sent_ctez
        assert ctez_token.view_balance(ctez2) >= prev_ctez2_ctez_balance + sent_ctez # + subsidies
        #TODO: check proceeds amount
