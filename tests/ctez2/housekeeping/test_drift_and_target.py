from math import floor
from tests.ctez2.base import Ctez2BaseTestCase
from parameterized import parameterized
from tests.ctez2.test_cases import drift_and_target

class Ctez2DriftAndTargetTestCase(Ctez2BaseTestCase):
    @parameterized.expand(drift_and_target)
    def test_should_update_drift_and_target_correctly(
        self, 
        _name, 
        ctez_liquidity: int,
        target_ctez_liquidity: int,
        tez_liquidity: int, 
        target_ctez_price: float,
        delta: int,
        expected_drift_change: int,
    ) -> None:
        ctez2, ctez_token, sender, _, *_ = self.default_setup(
            target_ctez_price = target_ctez_price,
            ctez_liquidity = ctez_liquidity,
            ctez_total_supply = target_ctez_liquidity * 20, # because Q is 5% of total supply
            tez_liquidity = tez_liquidity,
            bootstrap_all_tez_balances = True
        )

        context = ctez2.contract.storage()['context']
        assert context['drift'] == 0
        assert context['target'] == floor(target_ctez_price * 2**48)

        # do something to inject housekeeping (update Q)
        ctez2.using(sender).collect_from_ctez_liquidity(sender).send()
        self.bake_block()

        context = ctez2.contract.storage()['context']
        prev_drift = context['drift']

        self.bake_blocks(delta - 1) # 1 block is 1 second
        ctez2.using(sender).collect_from_ctez_liquidity(sender).send()
        self.bake_block()

        context = ctez2.contract.storage()['context']
        prev_target = context['target']

        new_drift = context['drift']
        d_drift = new_drift - prev_drift
        assert d_drift == expected_drift_change

        delta = 2
        self.bake_block(delta - 1) # to make new delta is 2
        ctez2.using(sender).collect_from_ctez_liquidity(sender).send() # force housekeeping again to apply new drift to target
        self.bake_block()

        context = ctez2.contract.storage()['context']
        d_target = context['target'] - prev_target
        assert d_target == (prev_target * abs(new_drift) * delta // 2**48) * (-1 if new_drift < 0 else 1) # to check that drift applied correctly
