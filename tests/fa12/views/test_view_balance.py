from tests.fa12.base import Fa12BaseTestCase
from tests.helpers.utility import DEFAULT_ADDRESS, TEST_ADDRESSES_SET

class Fa12ViewBalanceTestCase(Fa12BaseTestCase):
    def test_view_balance(self) -> None:
        _, _, fa12 = self.default_setup(
            get_balances = lambda *_: {
                TEST_ADDRESSES_SET[0]: 100,
                TEST_ADDRESSES_SET[1]: 222,
            }
        )
        assert fa12.view_balance(TEST_ADDRESSES_SET[0]) == 100
        assert fa12.view_balance(TEST_ADDRESSES_SET[1]) == 222
        assert fa12.view_balance(TEST_ADDRESSES_SET[2]) == 0
