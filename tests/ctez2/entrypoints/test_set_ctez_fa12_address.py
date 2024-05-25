from tests.ctez2.base import Ctez2BaseTestCase
from tests.helpers.addressable import get_address
from tests.helpers.contracts.ctez2.ctez2 import Ctez2
from tests.helpers.utility import DEFAULT_ADDRESS

class Ctez2SetCtezFa12AddressTestCase(Ctez2BaseTestCase):
    def test_should_fail_if_tez_in_transaction(self) -> None:
        ctez2, fa12 = self.default_setup()

        with self.raises_michelson_error(Ctez2.Errors.TEZ_IN_TRANSACTION_DISALLOWED):
            ctez2.set_ctez_fa12_address(fa12).with_amount(1).send()

    def test_should_set_ctez_fa12_address_correctly(self) -> None:
        ctez2, fa12 = self.default_setup()
        assert ctez2.get_ctez_fa12_address() == DEFAULT_ADDRESS

        ctez2.set_ctez_fa12_address(fa12).send()
        self.bake_block()
        assert ctez2.get_ctez_fa12_address() == get_address(fa12)
