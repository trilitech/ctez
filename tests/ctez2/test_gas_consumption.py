from tests.ctez2.base import Ctez2BaseTestCase
from tests.helpers.addressable import get_address
from tests.helpers.operation_result_recorder import OperationResultRecorder
from tests.helpers.utility import TEST_ADDRESSES_SET, get_tests_dir
from os.path import join
from parameterized import parameterized

class Ctez2GasConsumptionTestCase(Ctez2BaseTestCase):
    recorder = OperationResultRecorder()

    @classmethod
    def tearDownClass(self) -> None:
        self.recorder.write_to_file(join(get_tests_dir(), 'ctez2', 'gas_consumption.json'))
        super().tearDownClass()

    @parameterized.expand([('with_subsidies', True), ('without_subsidies', False)])
    def test_add_ctez_liquidity_gas(self, name: str, with_subsidies: bool) -> None:
        deposit_amount = 1_000_000
        initial_ctez_total_supply = 100_000_000
        ctez2, ctez_token, sender, owner, *_ = self.default_setup(
            ctez_liquidity= 1_000_000 if with_subsidies else 5_000_000,
            tez_liquidity = 1_000_000 if with_subsidies else 5_000_000,
            ctez_total_supply = initial_ctez_total_supply,
            get_ctez_token_balances = lambda sender, *_: {
                sender: deposit_amount
            },
        )

        ctez_token.using(sender).approve(ctez2, deposit_amount).send()
        self.bake_blocks(100)
        opg = ctez2.using(sender).add_ctez_liquidity(owner, deposit_amount, 0, self.get_future_timestamp()).send()
        self.bake_block()

        self.recorder.add_element(self.manager, f'add_ctez_liquidity_{name}', opg)

        ctez_total_supply = ctez_token.view_total_supply()
        assert (with_subsidies and ctez_total_supply > initial_ctez_total_supply) or (not with_subsidies and ctez_total_supply == initial_ctez_total_supply)

    @parameterized.expand([('with_subsidies', True), ('without_subsidies', False)])
    def test_add_tez_liquidity_gas(self, name: str, with_subsidies: bool) -> None:
        deposit_amount = 1_000_000
        initial_ctez_total_supply = 100_000_000
        ctez2, ctez_token, sender, owner, *_ = self.default_setup(
            ctez_liquidity= 1_000_000 if with_subsidies else 5_000_000,
            tez_liquidity = 1_000_000 if with_subsidies else 5_000_000,
            ctez_total_supply = initial_ctez_total_supply,
            get_ctez_token_balances = lambda sender, *_: {
                sender: deposit_amount
            },
        )

        self.bake_blocks(100)
        opg = ctez2.using(sender).add_tez_liquidity(owner, 0, self.get_future_timestamp()).with_amount(deposit_amount).send()
        self.bake_block()

        self.recorder.add_element(self.manager, f'add_tez_liquidity_{name}', opg)

        ctez_total_supply = ctez_token.view_total_supply()
        assert (with_subsidies and ctez_total_supply > initial_ctez_total_supply) or (not with_subsidies and ctez_total_supply == initial_ctez_total_supply)

    def test_collect_from_ctez_liquidity_gas(self) -> None:
        ctez2, ctez_token, liquidity_owner, *_ = self.prepare_ctez_dex_liquidity()
        receiver = self.bootstrap_account()

        prev_receiver_ctez_balance = ctez_token.view_balance(receiver)
        prev_receiver_tez_balance = self.get_balance_mutez(receiver)
        opg = ctez2.using(liquidity_owner).collect_from_ctez_liquidity(receiver).send()
        self.bake_block()

        self.recorder.add_element(self.manager, 'collect_from_ctez_liquidity', opg)

        assert ctez_token.view_balance(receiver) == prev_receiver_ctez_balance + 340
        assert self.get_balance_mutez(receiver) == prev_receiver_tez_balance + 5248754

    def test_collect_from_tez_liquidity_gas(self) -> None:
        ctez2, ctez_token, liquidity_owner, *_ = self.prepare_tez_dex_liquidity()
        receiver = self.bootstrap_account()

        prev_receiver_ctez_balance = ctez_token.view_balance(receiver)
        prev_receiver_tez_balance = self.get_balance_mutez(receiver)
        opg = ctez2.using(liquidity_owner).collect_from_tez_liquidity(receiver).send()
        self.bake_block()

        self.recorder.add_element(self.manager, 'collect_from_tez_liquidity', opg)

        assert ctez_token.view_balance(receiver) == prev_receiver_ctez_balance + 5248754 + 292
        assert self.get_balance_mutez(receiver) == prev_receiver_tez_balance

    def test_create_oven_gas(self) -> None:
        ctez2, _, owner, *_ = self.default_setup()
        initial_balance = 100_000_000
        delegate = get_address(self.bootstrap_baker())
        depositors = [TEST_ADDRESSES_SET[0], TEST_ADDRESSES_SET[1]]

        oven_id = 2
        opg = ctez2.using(owner).create_oven(oven_id, delegate, depositors).with_amount(initial_balance).send()
        self.bake_block()

        self.recorder.add_element(self.manager, 'create_oven', opg)

        ctez_dex = ctez2.get_sell_ctez_dex()
        tez_dex = ctez2.get_sell_tez_dex()
        oven_info = ctez2.get_oven(owner, oven_id)
        assert oven_info.tez_balance == initial_balance 
        assert oven_info.ctez_outstanding == 0 
        assert oven_info.fee_index == ctez_dex.fee_index * tez_dex.fee_index

        oven = ctez2.get_oven_contract(owner, owner, oven_id)
        assert self.get_balance_mutez(oven) == initial_balance
        assert self.get_contract_delegate(oven) == delegate
        assert oven.get_admin() == get_address(ctez2)
        assert oven.get_depositors() == True if depositors == None else depositors
