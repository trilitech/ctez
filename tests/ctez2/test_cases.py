swap_tez_to_ctez_cases = [
    #                                        q_ctez,        Q_ctez,       x_tez,       y_ctez        t (tez / ctez)
    #                                       liquidity     target_liq     sent_amt   received_amt     target_price
    # price range test
    ('liquidity_is_total_supply_ie_max',    200_000_000,  10_000_000,   1_000_000,     999_986,       1.0), # price ~ 1.0000 , because dex still have enough liquidity after swap
    ('liquidity_from_120_to_110_percent',    12_000_000,  10_000_000,   1_000_000,     999_986,       1.0), # price ~ 1.0000 ...
    ('liquidity_from_110_to_100_percent',    11_000_000,  10_000_000,   1_000_000,     999_986,       1.0), # price ~ 1.0000 ...
    ('liquidity_from_100_to_90_percent',     10_000_000,  10_000_000,   1_000_000,     999_986,       1.0), # price ~ 1.0000 , because dex liquidity is not far from target liquidity after swap
    ('liquidity_from_90_to_80_percent',       9_000_000,  10_000_000,   1_000_000,     999_811,       1.0), # price ~ 1.0002 , the price should then increase up to 1.05 as we get farther from the target liquidity.
    ('liquidity_from_80_to_70_percent',       8_000_000,  10_000_000,   1_000_000,     999_187,       1.0), # price ~ 1.0008 ...
    ('liquidity_from_70_to_60_percent',       7_000_000,  10_000_000,   1_000_000,     997_818,       1.0), # price ~ 1.0022 ...
    ('liquidity_from_60_to_50_percent',       6_000_000,  10_000_000,   1_000_000,     995_415,       1.0), # price ~ 1.0046 ...
    ('liquidity_from_50_to_40_percent',       5_000_000,  10_000_000,   1_000_000,     991_700,       1.0), # price ~ 1.0084 ...
    ('liquidity_from_40_to_30_percent',       4_000_000,  10_000_000,   1_000_000,     986_418,       1.0), # price ~ 1.0138 ...
    ('liquidity_from_30_to_20_percent',       3_000_000,  10_000_000,   1_000_000,     979_338,       1.0), # price ~ 1.0211 ...
    ('liquidity_from_20_to_10_percent',       2_000_000,  10_000_000,   1_000_000,     970_264,       1.0), # price ~ 1.0306 ...
    ('liquidity_from_10_to_0_percent',        1_000_000,  10_000_000,   1_000_000,     959_046,       1.0), # price ~ 1.0427 ...
    ('liquidity_from_5_to_0_percent',         1_000_000,  20_000_000,   1_000_000,     955_826,       1.0), # price ~ 1.0462 ...
    ('liquidity_from_1_to_0_percent',         1_000_000, 100_000_000,   1_000_000,     953_087,       1.0), # price ~ 1.0492 ...
    ('liquidity_very_close_to_0_percent',     1_000_000,      10**11,   1_000_000,     952_380,       1.0), # price ~ 1.0500

    ('liquidity_from_max_to_min',           200_000_000, 200_000_000, 202_500_001, 199_999_999,       1.0), # price ~ 1.0125

    # different target_price tests
    ('target_is_1_0',                         5_000_000,  10_000_000,   1_000_000,     991_700,       1.0), # price ~ 1.0084 ...
    ('target_is_1_5',                         5_000_000,  10_000_000,   1_000_000,     661_634,       1.5), # price ~ 1.5114 ...
    ('target_is_2_0',                         5_000_000,  10_000_000,   1_000_000,     496_403,       2.0), # price ~ 2.0145 ...

    # edge cases        
    ('small_x_amount',                        5_000_000,  10_000_000,           3,           1,       1.0),
    ('small_x_amount_and_liquidity',                  2,  10_000_000,           3,           1,       1.0),
    ('small_x_amount_and_liquidity_and_Q',            2,           1,           3,           1,       1.0),
]


swap_ctez_to_tez_cases = [
    #                                         q_tez,         Q_tez,       x_ctez,       y_tez        t (tez / ctez)
    #                                       liquidity     target_liq     sent_amt   received_amt     target_price
    # price range test
    ('liquidity_is_total_supply_ie_max',    200_000_000,  10_000_000,   1_000_000,     999_986,       1.0), # price ~ 1.0000 , because dex still have enough liquidity after swap
    ('liquidity_from_120_to_110_percent',    12_000_000,  10_000_000,   1_000_000,     999_986,       1.0), # price ~ 1.0000 ...
    ('liquidity_from_110_to_100_percent',    11_000_000,  10_000_000,   1_000_000,     999_986,       1.0), # price ~ 1.0000 ...
    ('liquidity_from_100_to_90_percent',     10_000_000,  10_000_000,   1_000_000,     999_986,       1.0), # price ~ 1.0000 , because dex liquidity is not far from target liquidity after swap
    ('liquidity_from_90_to_80_percent',       9_000_000,  10_000_000,   1_000_000,     999_811,       1.0), # price ~ 1.0002 , the price should then increase up to 1.05 as we get farther from the target liquidity.
    ('liquidity_from_80_to_70_percent',       8_000_000,  10_000_000,   1_000_000,     999_187,       1.0), # price ~ 1.0008 ...
    ('liquidity_from_70_to_60_percent',       7_000_000,  10_000_000,   1_000_000,     997_818,       1.0), # price ~ 1.0022 ...
    ('liquidity_from_60_to_50_percent',       6_000_000,  10_000_000,   1_000_000,     995_415,       1.0), # price ~ 1.0046 ...
    ('liquidity_from_50_to_40_percent',       5_000_000,  10_000_000,   1_000_000,     991_700,       1.0), # price ~ 1.0084 ...
    ('liquidity_from_40_to_30_percent',       4_000_000,  10_000_000,   1_000_000,     986_418,       1.0), # price ~ 1.0138 ...
    ('liquidity_from_30_to_20_percent',       3_000_000,  10_000_000,   1_000_000,     979_338,       1.0), # price ~ 1.0211 ...
    ('liquidity_from_20_to_10_percent',       2_000_000,  10_000_000,   1_000_000,     970_264,       1.0), # price ~ 1.0306 ...
    ('liquidity_from_10_to_0_percent',        1_000_000,  10_000_000,   1_000_000,     959_046,       1.0), # price ~ 1.0427 ...
    ('liquidity_from_5_to_0_percent',         1_000_000,  20_000_000,   1_000_000,     955_826,       1.0), # price ~ 1.0462 ...
    ('liquidity_from_1_to_0_percent',         1_000_000, 100_000_000,   1_000_000,     953_087,       1.0), # price ~ 1.0492 ...
    ('liquidity_very_close_to_0_percent',     1_000_000,      10**11,   1_000_000,     952_380,       1.0), # price ~ 1.0500

    ('liquidity_from_max_to_min',           200_000_000, 200_000_000, 202_500_001, 199_999_999,       1.0), # price ~ 1.0125

    # different target_price tests
    ('target_is_1_0',                         5_000_000,  10_000_000,   1_000_000,     991_700,       1.0), # price ~ 1.0084 ...
    ('target_is_1_5',                         5_000_000,  10_000_000,   1_000_000,   1_485_693,       1.5), # price ~ 1.4981 ...
    ('target_is_2_0',                         5_000_000,  10_000_000,   1_000_000,   1_978_171,       2.0), # price ~ 1.9782 ...

    # edge cases        
    ('small_x_amount',                        5_000_000,  10_000_000,           3,           1,       1.0),
    ('small_x_amount_and_liquidity',                  2,  10_000_000,           3,           1,       1.0),
    ('small_x_amount_and_liquidity_and_Q',            2,           2,           3,           1,       1.0),
]

ctez_dex_subsidies = [
    #                                 q,                      Q,                 t,               s_rate
    #                           ctez_liquidity,     target_ctez_liquidity,  target_price,   expected_subsidies_per_sec
    # interest range tests
    ('liquidity_is_110%',       110_000_000_000,        100_000_000_000,        1.0,          0),     # interest_rate = 0% / year, because dex has enough liquidity
    ('liquidity_is_100%',       100_000_000_000,        100_000_000_000,        1.0,          0),     # interest_rate = 0% / year, ...
    ('liquidity_is_95%',         95_000_000_000,        100_000_000_000,        1.0,          0),     # interest_rate = 0% / year, 
    ('liquidity_gt_93.75%',      93_750_000_001,        100_000_000_000,        1.0,          0),     # interest_rate = 0% / year
    
    ('liquidity_is_93.75%',      93_750_000_000,        100_000_000_000,        1.0,          66.0),  # interest_rate = 0.1041% / year
    ('liquidity_is_90',          90_000_000_000,        100_000_000_000,        1.0,          99.0),  # interest_rate = 0.1562% / year
    ('liquidity_is_50',          50_000_000_000,        100_000_000_000,        1.0,          266.0), # interest_rate = 0.4197% / year
    ('liquidity_is_10%',         10_000_000_000,        100_000_000_000,        1.0,          465.0), # interest_rate = 0.7337% / year

    ('liquidity_lt_10%',          9_999_999_999,        100_000_000_000,        1.0,          465.0), # interest_rate = 0.7337% / year, starting from this, fixed rate is applied
    ('liquidity_is_5%',           5_000_000_000,        100_000_000_000,        1.0,          465.0), # interest_rate = 0.7337% / year
    ('liquidity_is_1%',           1_000_000_000,        100_000_000_000,        1.0,          465.0), # interest_rate = 0.7337% / year
    ('liquidity_almost_0%',                   1,        100_000_000_000,        1.0,          465.0), # interest_rate = 0.7337% / year

    # different target_price tests
    ('target_is_1_0',            50_000_000_000,        100_000_000_000,        1.0,          266.0), # rate does not depend on target price in sell ctez dex
    ('target_is_1_2',            50_000_000_000,        100_000_000_000,        1.2,          266.0), # 
    ('target_is_1_5',            50_000_000_000,        100_000_000_000,        1.5,          266.0), # 
]

tez_dex_subsidies = [
    #                                 q,                      Q,                 t,               s_rate
    #                            tez_liquidity,     target_tez_liquidity,  target_price,   expected_subsidies_per_sec
    # interest range tests
    ('liquidity_is_110%',       110_000_000_000,        100_000_000_000,        1.0,          0),     # interest_rate = 0% / year, because dex has enough liquidity
    ('liquidity_is_100%',       100_000_000_000,        100_000_000_000,        1.0,          0),     # interest_rate = 0% / year, ...
    ('liquidity_is_95%',         95_000_000_000,        100_000_000_000,        1.0,          0),     # interest_rate = 0% / year, 
    ('liquidity_gt_93.75%',      93_750_000_001,        100_000_000_000,        1.0,          0),     # interest_rate = 0% / year
    
    ('liquidity_is_93.75%',      93_750_000_000,        100_000_000_000,        1.0,          66.0),  # interest_rate = 0.1041% / year
    ('liquidity_is_90',          90_000_000_000,        100_000_000_000,        1.0,          99.0),  # interest_rate = 0.1562% / year
    ('liquidity_is_50',          50_000_000_000,        100_000_000_000,        1.0,          266.0), # interest_rate = 0.4197% / year
    ('liquidity_is_10%',         10_000_000_000,        100_000_000_000,        1.0,          465.0), # interest_rate = 0.7337% / year

    ('liquidity_lt_10%',          9_999_999_999,        100_000_000_000,        1.0,          465.0), # interest_rate = 0.7337% / year, starting from this, fixed rate is applied
    ('liquidity_is_5%',           5_000_000_000,        100_000_000_000,        1.0,          465.0), # interest_rate = 0.7337% / year
    ('liquidity_is_1%',           1_000_000_000,        100_000_000_000,        1.0,          465.0), # interest_rate = 0.7337% / year
    ('liquidity_almost_0%',                   1,        100_000_000_000,        1.0,          465.0), # interest_rate = 0.7337% / year

    # different target_price tests
    ('target_is_1_0',            50_000_000_000,        100_000_000_000,        1.0,          266.0), # rate depends on target price in sell tez dex
    ('target_is_1_2',            50_000_000_000,        100_000_000_000,        1.2,          221.0), # the more price, the less total_supply (with the same Q_tez),
    ('target_is_1_5',            50_000_000_000,        100_000_000_000,        1.5,          177.0), # the less subsidies we get
]
