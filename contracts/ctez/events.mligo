type remove_liquidity = { 
  self_redeemed: nat;
  proceeds_redeemed: nat;
  subsidy_redeemed: nat;
  is_sell_ctez_dex: bool;
}

type collect_from_liquidity = { 
  proceeds_redeemed: nat;
  subsidy_redeemed: nat;
  is_sell_ctez_dex: bool;
}
