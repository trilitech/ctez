from tests.ctez2.base import Ctez2BaseTestCase
from tests.helpers.contracts.ctez2.ctez2 import Ctez2
from tests.helpers.utility import get_consumed_mutez

class Ctez2CollectFromTezLiquidityTestCase(Ctez2BaseTestCase):
    def test_should_fail_if_tez_in_transaction(self) -> None:
        ctez2, _, sender, receiver, *_ = self.default_setup()

        with self.raises_michelson_error(Ctez2.Errors.TEZ_IN_TRANSACTION_DISALLOWED):
            ctez2.using(sender).collect_from_tez_liquidity(receiver).with_amount(1).send()
            
    def test_should_collect_from_empty_account_correctly(self) -> None:
        ctez2, ctez_token, receiver, *_ = self.prepare_tez_dex_liquidity()
        empty_account = self.bootstrap_account()

        prev_receiver_ctez_balance = ctez_token.view_balance(receiver)
        prev_receiver_tez_balance = self.get_balance_mutez(receiver)
        prev_tez_dex = ctez2.get_sell_tez_dex()
        ctez2.using(empty_account).collect_from_tez_liquidity(receiver).send()
        self.bake_block()

        current_tez_dex = ctez2.get_sell_tez_dex()
        current_owner_account = ctez2.get_tez_liquidity_owner(empty_account)

        assert ctez_token.view_balance(receiver) == prev_receiver_ctez_balance
        assert self.get_balance_mutez(receiver) == prev_receiver_tez_balance
        assert current_owner_account.liquidity_shares == 0 
        assert current_owner_account.proceeds_owed == 0
        assert current_owner_account.subsidy_owed == 0

        assert current_tez_dex.total_liquidity_shares == prev_tez_dex.total_liquidity_shares
        assert current_tez_dex.self_reserves == prev_tez_dex.self_reserves
        assert current_tez_dex.proceeds_reserves == prev_tez_dex.proceeds_reserves
        assert current_tez_dex.subsidy_reserves == prev_tez_dex.subsidy_reserves


    def test_should_collect_tokens_correctly(self) -> None:
        ctez2, ctez_token, liquidity_owner, *_ = self.prepare_tez_dex_liquidity()
        receiver = self.bootstrap_account()

        prev_receiver_ctez_balance = ctez_token.view_balance(receiver)
        prev_receiver_tez_balance = self.get_balance_mutez(receiver)
        prev_tez_dex = ctez2.get_sell_tez_dex()
        prev_owner_account = ctez2.get_tez_liquidity_owner(liquidity_owner)
        ctez2.using(liquidity_owner).collect_from_tez_liquidity(receiver).send()
        self.bake_block()

        current_tez_dex = ctez2.get_sell_tez_dex()
        current_owner_account = ctez2.get_tez_liquidity_owner(liquidity_owner)

        assert ctez_token.view_balance(receiver) == prev_receiver_ctez_balance + 5248754 + 292
        assert self.get_balance_mutez(receiver) == prev_receiver_tez_balance
        assert current_owner_account.liquidity_shares == prev_owner_account.liquidity_shares 
        assert current_owner_account.proceeds_owed == 5248754
        assert current_owner_account.subsidy_owed == 292

        assert current_tez_dex.total_liquidity_shares == prev_tez_dex.total_liquidity_shares
        assert current_tez_dex.self_reserves == prev_tez_dex.self_reserves
        assert current_tez_dex.proceeds_reserves == prev_tez_dex.proceeds_reserves
        assert current_tez_dex.subsidy_reserves == prev_tez_dex.subsidy_reserves

        # the next collect should not change anything
        prev_receiver_ctez_balance = ctez_token.view_balance(receiver)
        prev_receiver_tez_balance = self.get_balance_mutez(receiver)
        prev_tez_dex = ctez2.get_sell_tez_dex()
        prev_owner_account = ctez2.get_tez_liquidity_owner(liquidity_owner)
        ctez2.using(liquidity_owner).collect_from_tez_liquidity(receiver).send()
        self.bake_block()

        current_tez_dex = ctez2.get_sell_tez_dex()
        current_owner_account = ctez2.get_tez_liquidity_owner(liquidity_owner)

        assert ctez_token.view_balance(receiver) == prev_receiver_ctez_balance
        assert self.get_balance_mutez(receiver) == prev_receiver_tez_balance
        assert current_owner_account.liquidity_shares == prev_owner_account.liquidity_shares 
        assert current_owner_account.proceeds_owed == prev_owner_account.proceeds_owed
        assert current_owner_account.subsidy_owed == prev_owner_account.subsidy_owed

        assert current_tez_dex.total_liquidity_shares == prev_tez_dex.total_liquidity_shares
        assert current_tez_dex.self_reserves == prev_tez_dex.self_reserves
        assert current_tez_dex.proceeds_reserves == prev_tez_dex.proceeds_reserves
        assert current_tez_dex.subsidy_reserves == prev_tez_dex.subsidy_reserves

    def test_collecting_is_the_same_as_remove_and_add(self) -> None:
        ctez2, ctez_token, liquidity_owner, *_ = self.prepare_tez_dex_liquidity()

        prev_receiver_ctez_balance = ctez_token.view_balance(liquidity_owner)
        prev_receiver_tez_balance = self.get_balance_mutez(liquidity_owner)
        prev_tez_dex = ctez2.get_sell_tez_dex()
        prev_owner_account = ctez2.get_tez_liquidity_owner(liquidity_owner)

        deposit_amount = 10_000_000
        opg = liquidity_owner.bulk(
            ctez2.remove_tez_liquidity(liquidity_owner, prev_owner_account.liquidity_shares, 0, 0, 0, self.get_future_timestamp()),
            ctez2.add_tez_liquidity(liquidity_owner, 0, self.get_future_timestamp()).with_amount(deposit_amount)
        ).send()
        self.bake_block()

        current_tez_dex = ctez2.get_sell_tez_dex()
        current_owner_account = ctez2.get_tez_liquidity_owner(liquidity_owner)

        assert ctez_token.view_balance(liquidity_owner) == prev_receiver_ctez_balance + 5248754 + 292
        assert self.get_balance_mutez(liquidity_owner) == prev_receiver_tez_balance - get_consumed_mutez(liquidity_owner, opg)
        assert current_owner_account.liquidity_shares == prev_owner_account.liquidity_shares 
        assert current_owner_account.proceeds_owed == 5248754
        assert current_owner_account.subsidy_owed == 292

        assert current_tez_dex.total_liquidity_shares == prev_tez_dex.total_liquidity_shares
        assert current_tez_dex.self_reserves == prev_tez_dex.self_reserves
        assert current_tez_dex.proceeds_reserves == prev_tez_dex.proceeds_reserves
        assert current_tez_dex.subsidy_reserves == prev_tez_dex.subsidy_reserves
