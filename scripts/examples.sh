poetry run create_oven --ctez-address KT1G86xQatxgToF32MLt2VcUvbYiMKqaT3ch --oven-id 2 --deposit 100 --delegate tz1RuHDSj9P7mNNhfKxsyLGRDahTX5QD1DdP
poetry run deposit --ctez-address KT1G86xQatxgToF32MLt2VcUvbYiMKqaT3ch --oven-id 5 --deposit 200
poetry run withdraw --ctez-address KT1G86xQatxgToF32MLt2VcUvbYiMKqaT3ch --oven-id 2 --amount 50
poetry run mint_or_burn --ctez-address KT1G86xQatxgToF32MLt2VcUvbYiMKqaT3ch --oven-id 2 --quantity 10
poetry run liquidate --ctez-address KT1G86xQatxgToF32MLt2VcUvbYiMKqaT3ch --oven-owner-address tz1eM1i2eyZUdouDduqNgs2U853FkE3vQiyn --oven-id 2 --quantity 10

poetry run add_ctez_liquidity --ctez-address KT1G86xQatxgToF32MLt2VcUvbYiMKqaT3ch --amount 10
poetry run add_tez_liquidity --ctez-address KT1G86xQatxgToF32MLt2VcUvbYiMKqaT3ch --amount 10
poetry run collect_from_ctez_liquidity --ctez-address KT1G86xQatxgToF32MLt2VcUvbYiMKqaT3ch
poetry run collect_from_tez_liquidity --ctez-address KT1G86xQatxgToF32MLt2VcUvbYiMKqaT3ch
poetry run remove_ctez_liquidity --ctez-address KT1G86xQatxgToF32MLt2VcUvbYiMKqaT3ch --liquidity_amount 5
poetry run remove_tez_liquidity --ctez-address KT1G86xQatxgToF32MLt2VcUvbYiMKqaT3ch --liquidity_amount 5
poetry run ctez_to_tez --ctez-address KT1G86xQatxgToF32MLt2VcUvbYiMKqaT3ch --ctez_amount 5
poetry run tez_to_ctez --ctez-address KT1G86xQatxgToF32MLt2VcUvbYiMKqaT3ch --tez_amount 5
