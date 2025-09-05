{
  tokens = ( Big_map.literal [("tz1Ke2h7sDdakHJQh8WX4Z372du1KChsksyU" : address), 1n] :
               (address, nat) big_map) ;
  allowances = (Big_map.empty : allowances) ;
  admin = ("ADMIN_ADDRESS" : address) ;
  total_supply = 1n ;
  metadata = ( Big_map.literal [("", (0x697066733a2f2f516d514a4d71657645384a546d3467753852386b31336a6f4a78344677783635475869684e6d7147686a42593751:bytes))] :
               contract_metadata) ;
  token_metadata = ( Big_map.literal [
    (0n, 
      {token_id=0n; token_info=Map.literal [
        ("decimals", (0x36:bytes)) ; 
        ("name", (0x4374657a2043464d4d204c5154:bytes)) ; 
        ("symbol", (0x4c5154:bytes)) ; 
      ]
      })] : token_metadata_storage);
}
