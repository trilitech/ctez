type contract_metadata = (string, bytes) big_map

type token_metadata =
[@layout:comb]
{
  token_id : nat;
  token_info : (string, bytes) map;
}

type token_metadata_storage = (nat, token_metadata) big_map
