from tests.ctez2.base import Ctez2BaseTestCase
from tests.helpers.contracts.ctez2.ctez2 import Ctez2
from tests.helpers.utility import find_op_by_hash, get_consumed_mutez
from pytezos.operation.result import OperationResult

class Ctez2AddTezLiquidityTestCase(Ctez2BaseTestCase):
    def test_should_fail_if_deadline_has_passed(self) -> None:
        ctez2, _, sender, owner = self.default_setup()

        deposit_amount = 10
        with self.raises_michelson_error(Ctez2.Errors.DEADLINE_HAS_PASSED):
            ctez2.using(sender).add_tez_liquidity(owner, 10, self.get_passed_timestamp()).with_amount(deposit_amount).send()

    def test_should_fail_if_insufficient_liquidity_created(self) -> None:
        ctez2, _, sender, owner = self.default_setup()

        deposit_amount = 10
        with self.raises_michelson_error(Ctez2.Errors.INSUFFICIENT_LIQUIDITY_CREATED):
            ctez2.using(sender).add_tez_liquidity(owner, 100_000, self.get_future_timestamp()).with_amount(deposit_amount).send()

    def test_transfer_tez_token_correctly(self) -> None:
        deposit_amount = 123
        ctez2, _, sender, owner = self.default_setup()

        prev_sender_balance = self.get_balance_mutez(sender)
        prev_ctez2_balance = self.get_balance_mutez(ctez2)

        opg = ctez2.using(sender).add_tez_liquidity(owner, deposit_amount, self.get_future_timestamp()).with_amount(deposit_amount).send()
        self.bake_block()

        assert self.get_balance_mutez(sender) == prev_sender_balance - deposit_amount - get_consumed_mutez(self.manager, opg)
        assert self.get_balance_mutez(ctez2) == prev_ctez2_balance + deposit_amount

    def test_deposit_token_correctly(self) -> None:
        deposit_amount = 123
        ctez2, _, sender, owner = self.default_setup()

        prev_ctez2_balance = ctez2.contract.context.get_balance()
        prev_sell_ctez_dex = ctez2.get_sell_ctez_dex()
        prev_sell_tez_dex = ctez2.get_sell_tez_dex()

        ctez2.using(sender).add_tez_liquidity(owner, deposit_amount, self.get_future_timestamp()).with_amount(deposit_amount).send()
        self.bake_block()

        current_sell_ctez_dex = ctez2.get_sell_ctez_dex()
        current_sell_tez_dex = ctez2.get_sell_tez_dex()
        assert ctez2.contract.context.get_balance() == prev_ctez2_balance + deposit_amount
        assert current_sell_ctez_dex.self_reserves == prev_sell_ctez_dex.self_reserves 
        assert current_sell_ctez_dex.proceeds_reserves == prev_sell_ctez_dex.proceeds_reserves 
        assert current_sell_tez_dex.self_reserves == prev_sell_tez_dex.self_reserves + deposit_amount 
        assert current_sell_tez_dex.proceeds_reserves == prev_sell_tez_dex.proceeds_reserves 

# TODO: add tests for liquidity_shares, proceeds_owed, subsidy_owed
#       when swap and subsidies are implemented
