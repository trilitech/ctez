from math import ceil
from tests.ctez2.base import Ctez2BaseTestCase, BalanceDiffs
from tests.helpers.contracts.ctez2.ctez2 import Ctez2
from tests.helpers.contracts.fa12.fa12 import Fa12
from pytezos.client import PyTezosClient
from typing import Callable
from parameterized import parameterized
from tests.helpers.utility import get_consumed_mutez, print_dict

class Ctez2RemoveCtezLiquidityTestCase(Ctez2BaseTestCase):
    def test_should_fail_if_tez_in_transaction(self) -> None:
        ctez2, _, sender, receiver, *_ = self.default_setup()

        with self.raises_michelson_error(Ctez2.Errors.TEZ_IN_TRANSACTION_DISALLOWED):
            ctez2.using(sender).remove_ctez_liquidity(receiver, 0, 0, 0, 0, self.get_future_timestamp()).with_amount(1).send()

    def test_should_fail_if_deadline_has_passed(self) -> None:
        ctez2, _, sender, receiver, *_ = self.default_setup()

        with self.raises_michelson_error(Ctez2.Errors.DEADLINE_HAS_PASSED):
            ctez2.using(sender).remove_ctez_liquidity(receiver, 0, 0, 0, 0, self.get_passed_timestamp()).send()

    def test_should_fail_if_insufficient_liquidity_in_account(self) -> None:
        deposit_amount = 100
        ctez2, _, not_owner, receiver, owner = self.default_setup(
            ctez_liquidity = deposit_amount
        )

        with self.raises_michelson_error(Ctez2.Errors.INSUFFICIENT_LIQUIDITY):
            ctez2.using(not_owner).remove_ctez_liquidity(receiver, 1, 0, 0, 0, self.get_future_timestamp()).send()

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
        deposit_amount = ctez_liquidity = 10_000_000
        ctez2, ctez_token, receiver, _, depositor_0 = self.default_setup(
            ctez_liquidity = ctez_liquidity,
            ctez_total_supply = ctez_liquidity * 10_000,
            bootstrap_all_tez_balances = True
        )

        prev_sell_ctez_dex = ctez2.get_sell_ctez_dex()
        prev_depositor_0_account = ctez2.get_ctez_liquidity_owner(depositor_0)

        assert prev_sell_ctez_dex.total_liquidity_shares == ctez_liquidity
        assert prev_sell_ctez_dex.self_reserves == ctez_liquidity
        assert prev_sell_ctez_dex.proceeds_reserves == 0
        assert prev_sell_ctez_dex.subsidy_reserves == 0

        assert prev_depositor_0_account.liquidity_shares == 10_000_000
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
        ctez_liquidity = 10_000_000 + swap_amount # 10_000_000 is depositor_0 deposit + 5_000_000 to convert into proceeds

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

        ctez2.using(depositor_0).mint_or_burn(0, -ctez_token.view_balance(depositor_0)).send() # to stop collecting subsidies (all total_supply is in dex)
        self.bake_block()

        depositors = (depositor_0, depositor_1, depositor_2)
        depositor_accounts = list(map(ctez2.get_ctez_liquidity_owner, depositors))
        assert depositor_accounts[0] == Ctez2.LiquidityOwner(liquidity_shares=15000000, proceeds_owed=0,       subsidy_owed=0)
        assert depositor_accounts[1] == Ctez2.LiquidityOwner(liquidity_shares=15000000, proceeds_owed=5248754, subsidy_owed=142)
        assert depositor_accounts[2] == Ctez2.LiquidityOwner(liquidity_shares=15000000, proceeds_owed=5248754, subsidy_owed=261)

        dex = ctez2.get_sell_ctez_dex()
        assert dex.total_liquidity_shares == 45000000
        assert dex.self_reserves == 30000000
        assert dex.proceeds_reserves == 15746262 
        assert dex.proceeds_reserves - sum(a.proceeds_owed for a in depositor_accounts) == (self.get_balance_mutez(ctez2) - ctez2.get_sell_tez_dex().self_reserves)
        assert dex.subsidy_reserves == 1019

        print('initial dex state:', dex)
        print('depositor_0:', depositor_accounts[0])
        print('depositor_1:', depositor_accounts[1])
        print('depositor_2:', depositor_accounts[2])

        return ctez2, ctez_token, depositor_0, depositor_1, depositor_2

    @parameterized.expand([
        (lambda d0, d1, d2: (d0, d1, d2)),
        (lambda d0, d1, d2: (d0, d2, d1)),
        (lambda d0, d1, d2: (d1, d0, d2)),
        (lambda d0, d1, d2: (d1, d2, d0)),
        (lambda d0, d1, d2: (d2, d0, d1)),
        (lambda d0, d1, d2: (d2, d1, d0)),
    ])
    def test_should_withdraw_correctly_for_several_depositors_regardless_of_order(
            self, 
            order_depositors : Callable[[tuple[PyTezosClient, PyTezosClient, PyTezosClient]], tuple[PyTezosClient, PyTezosClient, PyTezosClient]]
        ) -> None:
        ctez2, ctez_token, depositor_0, depositor_1, depositor_2 = self.prepare_liquidity_owners()

        depositors = (depositor_0, depositor_1, depositor_2)
        depositor_names = dict((t[1], f'depositor_{t[0]}') for t in enumerate(depositors))
        depositor_accounts = dict((depositor_names[d], ctez2.get_ctez_liquidity_owner(d)) for d in depositors)
        prev_depositor_tez_balances = dict((depositor_names[d], self.get_balance_mutez(d)) for d in depositors)
        prev_depositor_ctez_balances = dict((depositor_names[d], ctez_token.view_balance(d)) for d in depositors)
        prev_sell_tez_dex = ctez2.get_sell_tez_dex()
        prev_ctez_dex_ctez_balance = ctez_token.view_balance(ctez2) - prev_sell_tez_dex.proceeds_reserves - prev_sell_tez_dex.subsidy_reserves

        print('Start withdrawing...')

        dep_ops = {}
        for d in order_depositors(*depositors):
            d_name = depositor_names[d]
            print(f'{d_name} withdraws')
            opg = ctez2.using(d).remove_ctez_liquidity(d, depositor_accounts[d_name].liquidity_shares, 0, 0, 0, self.get_future_timestamp()).send()
            self.bake_block()
            dep_ops[d_name] = opg

        depositor_balances_diffs = dict(
            (
                depositor_names[d], 
                BalanceDiffs(
                    ctez_diff = ctez_token.view_balance(d) - prev_depositor_ctez_balances[depositor_names[d]],
                    tez_diff = self.get_balance_mutez(d) - prev_depositor_tez_balances[depositor_names[d]] + get_consumed_mutez(self.manager, dep_ops[depositor_names[d]])
                )
            ) 
            for d in depositors
        )
        depositor_accounts = dict((depositor_names[d], ctez2.get_ctez_liquidity_owner(d)) for d in depositors)

        sell_tez_dex = ctez2.get_sell_tez_dex()
        sell_ctez_dex = ctez2.get_sell_ctez_dex()
        ctez_dex_ctez_balance = ctez_token.view_balance(ctez2) - sell_tez_dex.proceeds_reserves - sell_tez_dex.subsidy_reserves
        ctez_dex_tez_balance = self.get_balance_mutez(ctez2) - sell_tez_dex.self_reserves

        print_dict('depositor_balances_diffs:', depositor_balances_diffs)
        print_dict('depositor_accounts_after_withdrawals:', depositor_accounts)
        print('current dex state:', sell_ctez_dex)
        print('ctez dex ctez balance:', ctez_dex_ctez_balance)
        print('ctez dex tez balance:', ctez_dex_tez_balance)
        
        assert sell_ctez_dex.total_liquidity_shares == 0
        assert sell_ctez_dex.subsidy_reserves == 0
        assert sell_ctez_dex.proceeds_reserves == 0
        assert sell_ctez_dex.subsidy_reserves == 0
        assert ctez_dex_ctez_balance == 0
        assert ctez_dex_tez_balance == 0

        # depositors 1 and 2 provided liquidity after proceeds were accumulated, thats why they do not have any of proceeds
        assert depositor_balances_diffs[depositor_names[depositor_0]].ctez_diff in (10000339, 10000340) # because of rounding
        assert depositor_balances_diffs[depositor_names[depositor_0]].tez_diff == 5248754
        assert depositor_balances_diffs[depositor_names[depositor_1]].ctez_diff in (10000197, 10000198) # because of rounding
        assert depositor_balances_diffs[depositor_names[depositor_1]].tez_diff == 0
        assert depositor_balances_diffs[depositor_names[depositor_2]].ctez_diff in (10000078, 10000079) # because of rounding
        assert depositor_balances_diffs[depositor_names[depositor_2]].tez_diff == 0

        assert all(a.liquidity_shares == 0 and a.proceeds_owed == 0 and a.subsidy_owed == 0 for a in depositor_accounts.values())
        assert sum(d.ctez_diff for d in depositor_balances_diffs.values()) == prev_ctez_dex_ctez_balance 

# todo: test for the case when not all liquidity shares are provided to remove_liquidity  
