from math import ceil
from tests.ctez2.base import Ctez2BaseTestCase
from tests.helpers.contracts.ctez2.ctez2 import Ctez2
from tests.helpers.contracts.fa12.fa12 import Fa12
from pytezos.client import PyTezosClient
from typing import Callable

from tests.helpers.utility import get_consumed_mutez

class Ctez2RemoveCtezLiquidityTestCase(Ctez2BaseTestCase):
    def test_should_fail_if_tez_in_transaction(self) -> None:
        ctez2, _, sender, receiver, *_ = self.default_setup()

        with self.raises_michelson_error(Ctez2.Errors.TEZ_IN_TRANSACTION_DISALLOWED):
            ctez2.using(sender).remove_ctez_liquidity(receiver, 0, 0, 0, 0, self.get_future_timestamp()).with_amount(1).send()

    def test_should_fail_if_deadline_has_passed(self) -> None:
        ctez2, _, sender, receiver, *_ = self.default_setup()

        with self.raises_michelson_error(Ctez2.Errors.DEADLINE_HAS_PASSED):
            ctez2.using(sender).remove_ctez_liquidity(receiver, 0, 0, 0, 0, self.get_passed_timestamp()).send()

    def test_should_fail_if_insufficient_liquidity(self) -> None:
        deposit_amount = 100
        ctez2, ctez_token, owner, receiver, *_ = self.default_setup(
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
        ctez2, ctez_token, owner, receiver, *_ = self.default_setup(
            get_ctez_token_balances = lambda owner, *_: {
                owner : deposit_amount
            }
        )

        owner.bulk(
            ctez_token.approve(ctez2, deposit_amount),
            ctez2.add_ctez_liquidity(owner, deposit_amount, 0, self.get_future_timestamp())
        ).send()
        self.bake_block()

        prev_receiver_ctez_balance = ctez_token.view_balance(receiver)
        prev_ctez2_ctez_balance = ctez_token.view_balance(ctez2)
        prev_ctez2_tez_balance = self.get_balance_mutez(ctez2)

        ctez2.using(owner).remove_ctez_liquidity(receiver, deposit_amount, 0, 0, 0, self.get_future_timestamp()).send()
        self.bake_block()

        assert ctez_token.view_balance(receiver) == prev_receiver_ctez_balance + deposit_amount
        assert ctez_token.view_balance(ctez2) == prev_ctez2_ctez_balance - deposit_amount
        assert self.get_balance_mutez(ctez2) == prev_ctez2_tez_balance

    def test_should_withdraw_from_ctez_dex_at_the_beginning(self) -> None:
        ctez_liquidity = 10_000_000
        ctez2, ctez_token, receiver, _, depositor_0 = self.default_setup(
            ctez_liquidity = ctez_liquidity,
            ctez_total_supply = ctez_liquidity * 10_000,
            bootstrap_all_tez_balances = True
        )

        deposit_amount = ctez_liquidity - 1 # 1 is reserved for null address

        prev_sell_ctez_dex = ctez2.get_sell_ctez_dex()
        prev_depositor_0_account = ctez2.get_ctez_liquidity_owner(depositor_0)

        assert prev_sell_ctez_dex.total_liquidity_shares == ctez_liquidity
        assert prev_sell_ctez_dex.self_reserves == ctez_liquidity
        assert prev_sell_ctez_dex.proceeds_reserves == 0
        assert prev_sell_ctez_dex.subsidy_reserves == 0

        assert prev_depositor_0_account.liquidity_shares == 9_999_999
        assert prev_depositor_0_account.proceeds_owed == 0
        assert prev_depositor_0_account.subsidy_owed == 0

        prev_total_supply = ctez_token.view_total_supply()
        prev_receiver_ctez_balance = ctez_token.view_balance(receiver)
        ctez2.using(depositor_0).remove_ctez_liquidity(receiver, prev_depositor_0_account.liquidity_shares, 0, 0, 0, self.get_future_timestamp()).send()
        self.bake_block()

        current_sell_ctez_dex = ctez2.get_sell_ctez_dex()
        current_depositor_0_account = ctez2.get_ctez_liquidity_owner(depositor_0)

        assert current_sell_ctez_dex.total_liquidity_shares == prev_sell_ctez_dex.total_liquidity_shares - prev_depositor_0_account.liquidity_shares
        assert current_sell_ctez_dex.self_reserves == prev_sell_ctez_dex.self_reserves - deposit_amount
        assert current_sell_ctez_dex.proceeds_reserves == 0
        assert current_sell_ctez_dex.subsidy_reserves == 0

        assert current_depositor_0_account.liquidity_shares == 0
        assert current_depositor_0_account.proceeds_owed == 0
        assert current_depositor_0_account.subsidy_owed == 0

        ctez_dex_subsidies = ctez_token.view_total_supply() - prev_total_supply - ctez2.get_sell_tez_dex().subsidy_reserves
        assert ctez_token.view_balance(receiver) == prev_receiver_ctez_balance + deposit_amount + ctez_dex_subsidies
        
    def prepare_liquidity_owners(self) -> tuple[Ctez2, Fa12, PyTezosClient, PyTezosClient, PyTezosClient]:
        deposit_amount_1 = 10_000_000
        deposit_amount_2 = 10_000_000
        swap_amount = 5_000_000
        ctez_liquidity = 10_000_000 + swap_amount + 1 # 1 is initial liquidity + 10_000_000 is depositor_0 deposit + 5_000_000 to convert into proceeds

        ctez2, ctez_token, depositor_1, depositor_2, depositor_0 = self.default_setup(
            ctez_total_supply = ctez_liquidity * 10_000,
            ctez_liquidity = ctez_liquidity,
            tez_liquidity = ctez_liquidity * 10_000, # to avoid collecting subsidies in sell_tez dex
            get_ctez_token_balances = lambda depositor_1, depositor_2: {
                depositor_1: deposit_amount_1,
                depositor_2: deposit_amount_2
            },
            bootstrap_all_tez_balances = True
        )

        ctez2.using(depositor_0).tez_to_ctez(depositor_0, 5_000_000, self.get_future_timestamp()).with_amount(5_248_754).send()
        self.bake_block()

        for (depositor, deposit_amount) in ((depositor_1, deposit_amount_1), (depositor_2, deposit_amount_2)):
            depositor.bulk(
                ctez_token.approve(ctez2, deposit_amount),
                ctez2.add_ctez_liquidity(depositor, deposit_amount, 0, self.get_future_timestamp())
            ).send()
            self.bake_blocks(5) # to collect more subsidies between deposits

        ctez2.using(depositor_0).mint_or_burn(0, -ctez_token.view_balance(depositor_0)).send() # to stop collecting subsidies (all total_supply in dex)
        self.bake_block()

        depositors = (depositor_0, depositor_1, depositor_2)
        depositor_accounts = list(map(ctez2.get_ctez_liquidity_owner, depositors))
        assert depositor_accounts[0] == Ctez2.LiquidityOwner(liquidity_shares=15000000, proceeds_owed=0,       subsidy_owed=0)
        assert depositor_accounts[1] == Ctez2.LiquidityOwner(liquidity_shares=15000000, proceeds_owed=2624377, subsidy_owed=71)
        assert depositor_accounts[2] == Ctez2.LiquidityOwner(liquidity_shares=15000000, proceeds_owed=1749585, subsidy_owed=127)

        dex = ctez2.get_sell_ctez_dex()
        assert dex.total_liquidity_shares == 45000001
        assert dex.self_reserves == 30000001
        assert dex.proceeds_reserves == 5248754 == (self.get_balance_mutez(ctez2) - ctez2.get_sell_tez_dex().self_reserves)
        assert dex.subsidy_reserves == 616

        return ctez2, ctez_token, depositor_0, depositor_1, depositor_2

    def run_test_should_withdraw_correctly_for_several_depositors(
            self, 
            order_depositors : Callable[[tuple[PyTezosClient, PyTezosClient, PyTezosClient]], tuple[PyTezosClient, PyTezosClient, PyTezosClient]]
        ) -> None:
        ctez2, ctez_token, depositor_0, depositor_1, depositor_2 = self.prepare_liquidity_owners()

        depositors = order_depositors(depositor_0, depositor_1, depositor_2)
        depositor_accounts = list(map(ctez2.get_ctez_liquidity_owner, depositors))
        prev_depositor_tez_balances = list(map(self.get_balance_mutez, depositors))
        prev_depositor_ctez_balances = list(map(ctez_token.view_balance, depositors))

        dep_ops = list(map(
            lambda t: ctez2.using(t[1]).remove_ctez_liquidity(t[1], depositor_accounts[t[0]].liquidity_shares, 0, 0, 0, self.get_future_timestamp()).send(), 
            enumerate(depositors)
        ))
        self.bake_block()

        depositor_balances_diffs = list(map(lambda t: {
            'ctez_diff': ctez_token.view_balance(t[1]) - prev_depositor_ctez_balances[t[0]],
            'tez_diff': self.get_balance_mutez(t[1]) - prev_depositor_tez_balances[t[0]] + get_consumed_mutez(self.manager, dep_ops[t[0]]),
        }, enumerate(depositors)))
        depositor_accounts = list(map(ctez2.get_ctez_liquidity_owner, depositors))

        print('depositor_balances_diffs', depositor_balances_diffs, sep="\n")
        print('depositor_accounts', depositor_accounts)

        print('dex', ctez2.get_sell_ctez_dex())
        print('dex tez balance', self.get_balance_mutez(ctez2) - ctez2.get_sell_tez_dex().self_reserves)

        assert False

    # def test_should_withdraw_correctly_for_depositors_0_1_2(self) -> None:
    #     self.run_test_should_withdraw_correctly_for_several_depositors(
    #         lambda d0, d1, d2: (d0, d1, d2)
    #     )

    def test_should_withdraw_correctly_for_depositors_2_1_0(self) -> None:
        self.run_test_should_withdraw_correctly_for_several_depositors(
            lambda d0, d1, d2: (d2, d1, d0)
        )

# todo: test for the case when not all liquidity shares are provided to remove_liquidity  
# todo: test for the case when all self tokens are redeemed (at lease 1 should be left in the dex) 
