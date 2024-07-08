poetry run create_oven --ctez-address KT193ERciAqkLJL1QfUnrVDXjMxpJnwqUveX --oven-id 2 --deposit 100
poetry run deposit --ctez-address KT193ERciAqkLJL1QfUnrVDXjMxpJnwqUveX --oven-id 5 --deposit 200
poetry run withdraw --ctez-address KT193ERciAqkLJL1QfUnrVDXjMxpJnwqUveX --oven-id 2 --amount 50
poetry run mint_or_burn --ctez-address KT193ERciAqkLJL1QfUnrVDXjMxpJnwqUveX --oven-id 2 --quantity 10
poetry run liquidate --ctez-address KT193ERciAqkLJL1QfUnrVDXjMxpJnwqUveX --oven-owner-address tz1eM1i2eyZUdouDduqNgs2U853FkE3vQiyn --oven-id 2 --quantity 10

poetry run add_ctez_liquidity --ctez-address KT193ERciAqkLJL1QfUnrVDXjMxpJnwqUveX --amount 10
poetry run add_tez_liquidity --ctez-address KT193ERciAqkLJL1QfUnrVDXjMxpJnwqUveX --amount 10
poetry run collect_from_ctez_liquidity --ctez-address KT193ERciAqkLJL1QfUnrVDXjMxpJnwqUveX
poetry run collect_from_tez_liquidity --ctez-address KT193ERciAqkLJL1QfUnrVDXjMxpJnwqUveX
poetry run remove_ctez_liquidity --ctez-address KT193ERciAqkLJL1QfUnrVDXjMxpJnwqUveX --liquidity_amount 5
poetry run remove_tez_liquidity --ctez-address KT193ERciAqkLJL1QfUnrVDXjMxpJnwqUveX --liquidity_amount 5
poetry run ctez_to_tez --ctez-address KT193ERciAqkLJL1QfUnrVDXjMxpJnwqUveX --ctez_amount 5
poetry run tez_to_ctez --ctez-address KT193ERciAqkLJL1QfUnrVDXjMxpJnwqUveX --tez_amount 5
