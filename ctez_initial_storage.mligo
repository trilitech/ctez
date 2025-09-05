{
	ovens = (Big_map.empty : (oven_handle, oven) big_map)  ;
	target = Bitwise.shift_left 1n 48n ; drift = 0 ;
	last_drift_update = ("DEPLOYMENT_DATET00:00:00Z" : timestamp) ;
	ctez_fa12_address = ("tz1Ke2h7sDdakHJQh8WX4Z372du1KChsksyU" : address) ;
	cfmm_address = ("tz1Ke2h7sDdakHJQh8WX4Z372du1KChsksyU" : address) ;
	metadata = ( Big_map.literal [("", (0x697066733a2f2f516d5470597658384a54767376654b356639653257796b414251425342524d554369684a723459444e4b68343659:bytes))] :
               contract_metadata) ;
}
