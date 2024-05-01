(*
 Order of deployment
 1. Deploy the oven management contract (this contract)
 2. Deploy the fa12 address for the ctez contract, setting the oven management address as admin
 3. Deploy the CFMM, hard coding the oven management contract address as consumer
 4. Deploy the FA12 for the LQT specifying the CFMM as admin
 5. Manually set the LQT FA12 address in the CFMM
 6. Manually set the ctez fa12 address and the cfmm address in the oven management contract
*)

#include "oven_types.mligo"




(* End of oven types *)


type liquidate = [@layout:comb] { handle : oven_handle ; quantity : nat ; [@annot:to] to_ : unit contract }
type mint_or_burn = [@layout:comb] {id : nat ; quantity : int}

type parameter =
  | Create of create
  | Withdraw of withdraw
  | Liquidate of liquidate
  | Register_oven_deposit of register_oven_deposit
  | Mint_or_burn of mint_or_burn
  | Cfmm_info of (nat * nat) * nat
  | Set_addresses of set_addresses
  | Get_target of nat contract

type oven = {tez_balance : tez ; ctez_outstanding : nat ; address : address ; fee_index : nat}


type liquidity_owner = 
{
    lpt : nat ; (* LP token amount *)
    owed : nat ; (* amount of the proceeds token owed to the contract *)
    subsidy_owed : nat ; (* amount of ctez subsidy owed to the contract *)
}

type half_dex = 
{
    liquidity_owners : (address, liquidity_owner) big_map ; (* map of liquidity owners *)
    total_lpt : nat  ; (* total amount of liquidity tokens *)
    total_liquidity : nat ; (* total amount of liquidity *)
    total_proceeds : nat ; (* total amount accumulated from proceeds *)
    total_subsidy : nat ; (* total amount accumulated from subsidy *)
    fee_index : nat ;
}

type storage = {
  ovens : (oven_handle, oven) big_map ;
  target : nat ;
  drift : int ;
  last_update : timestamp ;
  ctez_fa12_address : address ; (* address of the fa12 contract managing the ctez token *)
  sell_ctez : half_dex ;
  sell_tez  : half_dex ;
  _Q : nat ; (* Q is the desired quantity of ctez in the ctez half dex,
      floor(Q * target) is the desired quantity of tez in the tez half dex *)
}

type result = (operation list) * storage

(* Errors *)

[@inline] let error_OVEN_ALREADY_EXISTS = 0n
[@inline] let error_INVALID_CALLER_FOR_OVEN_OWNER = 1n
[@inline] let error_CTEZ_FA12_ADDRESS_ALREADY_SET = 2n
[@inline] let error_CFMM_ADDRESS_ALREADY_SET = 3n
[@inline] let error_OVEN_DOESNT_EXIST= 4n
[@inline] let error_OVEN_MISSING_WITHDRAW_ENTRYPOINT = 5n
[@inline] let error_OVEN_MISSING_DEPOSIT_ENTRYPOINT = 6n
[@inline] let error_OVEN_MISSING_DELEGATE_ENTRYPOINT = 7n
[@inline] let error_EXCESSIVE_TEZ_WITHDRAWAL = 8n
[@inline] let error_CTEZ_FA12_CONTRACT_MISSING_MINT_OR_BURN_ENTRYPOINT = 9n
[@inline] let error_CANNOT_BURN_MORE_THAN_OUTSTANDING_AMOUNT_OF_CTEZ = 10n
[@inline] let error_OVEN_NOT_UNDERCOLLATERALIZED = 11n
[@inline] let error_EXCESSIVE_CTEZ_MINTING = 12n
[@inline] let error_CALLER_MUST_BE_CFMM = 13n
[@inline] let error_INVALID_CTEZ_TARGET_ENTRYPOINT = 14n
[@inline] let error_IMPOSSIBLE = 999n (* an error that should never happen *)


#include "oven.mligo"

(* Functions *)

let get_oven (handle : oven_handle) (s : storage) : oven =
  match Big_map.find_opt handle s.ovens with
  | None -> (failwith error_OVEN_DOESNT_EXIST : oven)
  | Some oven -> 
    (* Adjust the amount of outstanding ctez in the oven, record the fee index at that time. *)
    let new_fee_index = s.sell_ctez.fee_index * s.sell_tez.fee_index in
    let ctez_outstanding = abs((- oven.ctez_outstanding * new_fee_index) / oven.fee_index) in
    {oven with fee_index = new_fee_index ; ctez_outstanding = ctez_outstanding}

let is_under_collateralized (oven : oven) (target : nat) : bool =
  (15n * oven.tez_balance) < (Bitwise.shift_right (oven.ctez_outstanding * target) 44n) * 1mutez

let get_oven_withdraw (oven_address : address) : (tez * (unit contract)) contract =
  match (Tezos.get_entrypoint_opt "%oven_withdraw" oven_address : (tez * (unit contract)) contract option) with
  | None -> (failwith error_OVEN_MISSING_WITHDRAW_ENTRYPOINT : (tez * (unit contract)) contract)
  | Some c -> c

let get_oven_delegate (oven_address : address) : (key_hash option) contract =
  match (Tezos.get_entrypoint_opt "%oven_delegate" oven_address : (key_hash option) contract option) with
  | None -> (failwith error_OVEN_MISSING_DELEGATE_ENTRYPOINT : (key_hash option) contract)
  | Some c -> c

let get_ctez_mint_or_burn (fa12_address : address) : (int * address) contract =
  match (Tezos.get_entrypoint_opt  "%mintOrBurn"  fa12_address : ((int * address) contract) option) with
  | None -> (failwith error_CTEZ_FA12_CONTRACT_MISSING_MINT_OR_BURN_ENTRYPOINT : (int * address) contract)
  | Some c -> c


(* Views *)
[@view] let view_target ((), s : unit * storage) : nat = s.target

type create_oven = {id : nat ; delegate : key_hash option ; depositors : depositors }

(* Entrypoint Functions *)
[@entry]
let create_oven ({ id; delegate; depositors }: create_oven) (s : storage) : result =
  let handle = { id ; owner = Tezos.get_sender () } in
  if Big_map.mem handle s.ovens then
    (failwith error_OVEN_ALREADY_EXISTS : result)
  else
    let (origination_op, oven_address) : operation * address =
    originate_oven delegate (Tezos.get_amount ()) { admin = Tezos.get_self_address () ; handle = handle ; depositors = depositors } in
    let oven = {tez_balance = (Tezos.get_amount ()) ; ctez_outstanding = 0n ; address = oven_address ; fee_index = s.sell_ctez.fee_index * s.sell_tez.fee_index}  in
    let ovens = Big_map.update handle (Some oven) s.ovens in
    ([origination_op], {s with ovens = ovens})

// called on initialization to set the ctez_fa12_address
[@entry]
let set_ctez_fa12_address (ctez_fa12_address : address) (s : storage)  : result =
  if s.ctez_fa12_address <> ("tz1Ke2h7sDdakHJQh8WX4Z372du1KChsksyU" : address) then
    (failwith error_CTEZ_FA12_ADDRESS_ALREADY_SET : result)
  else
    (([] : operation list), {s with ctez_fa12_address = ctez_fa12_address})

type withdraw = { id : nat ; amount : tez ;  [@annot:to] to_ : unit contract }

[@entry]
let withdraw_from_oven (p : withdraw) (s : storage)  : result =
  let handle = {id = p.id ; owner = Tezos.get_sender ()} in
  let oven : oven = get_oven handle s in
  let oven_contract = get_oven_withdraw oven.address in

  (* Check for undercollateralization *)
  let new_balance = match (oven.tez_balance - p.amount) with
  | None -> (failwith error_EXCESSIVE_TEZ_WITHDRAWAL : tez)
  | Some x -> x in
  let oven = {oven with tez_balance = new_balance} in
  let ovens = Big_map.update handle (Some oven) s.ovens in
  let s = {s with ovens = ovens} in
  if is_under_collateralized oven s.target then
    (failwith error_EXCESSIVE_TEZ_WITHDRAWAL : result)
  else
    ([Tezos.transaction (p.amount, p.to_) 0mutez oven_contract], s)


[@entry]
let register_oven_deposit (p : register_oven_deposit) (s : storage) : result =
    (* First check that the call is legit *)
    let oven = get_oven p.handle s in
    if oven.address <> Tezos.get_sender () then
      (failwith error_INVALID_CALLER_FOR_OVEN_OWNER : result)
    else
      (* register the increased balance *)
      let oven = {oven with tez_balance = oven.tez_balance + p.amount} in
      let ovens = Big_map.update p.handle (Some oven) s.ovens in
      (([] : operation list), {s with ovens = ovens})

(* liquidate the oven by burning "quantity" ctez *)
[@entry]
let liquidate_oven (p : liquidate)  (s: storage)  : result  =
  let oven : oven = get_oven p.handle s in
  if is_under_collateralized oven s.target then
    let remaining_ctez = match is_nat (oven.ctez_outstanding - p.quantity) with
      | None -> (failwith error_CANNOT_BURN_MORE_THAN_OUTSTANDING_AMOUNT_OF_CTEZ : nat)
      | Some n -> n  in
    (* get 32/31 of the target price, meaning there is a 1/31 penalty for the oven owner for being liquidated *)
    let extracted_balance = (Bitwise.shift_right (p.quantity * s.target) 43n) * 1mutez / 31n in (* 43 is 48 - log2(32) *)
    let new_balance = match oven.tez_balance - extracted_balance with
    | None -> (failwith error_IMPOSSIBLE : tez)
    | Some x -> x in
    let oven = {oven with ctez_outstanding = remaining_ctez ; tez_balance = new_balance} in
    let ovens = Big_map.update p.handle (Some oven) s.ovens in
    let s = {s with ovens = ovens} in
    let oven_contract = get_oven_withdraw oven.address in
    let op_take_collateral = Tezos.transaction (extracted_balance, p.to_) 0mutez oven_contract in
    let ctez_mint_or_burn = get_ctez_mint_or_burn s.ctez_fa12_address in
    let op_burn_ctez = Tezos.transaction (-p.quantity, Tezos.get_sender ()) 0mutez ctez_mint_or_burn in
    ([op_burn_ctez ; op_take_collateral], s)
  else
    (failwith error_OVEN_NOT_UNDERCOLLATERALIZED : result)

[@entry]
let mint_or_burn (p : mint_or_burn)  (s : storage) : result =
  let handle = { id = p.id ; owner = Tezos.get_sender () } in
  let oven : oven = get_oven handle s in
  let ctez_outstanding = match is_nat (oven.ctez_outstanding + p.quantity) with
    | None -> (failwith error_CANNOT_BURN_MORE_THAN_OUTSTANDING_AMOUNT_OF_CTEZ : nat)
    | Some n -> n in
  let oven = {oven with ctez_outstanding = ctez_outstanding} in
  let ovens = Big_map.update handle (Some oven) s.ovens in
  let s = {s with ovens = ovens} in
  if is_under_collateralized oven s.target then
    (failwith  error_EXCESSIVE_CTEZ_MINTING : result)
    (* mint or burn quantity in the fa1.2 of ctez *)
  else
    let ctez_mint_or_burn = get_ctez_mint_or_burn s.ctez_fa12_address in
    ([Tezos.transaction (p.quantity, Tezos.get_sender ()) 0mutez ctez_mint_or_burn], s)

[@view]
let get_target () (storage : storage) : nat = storage.target

[@view]
let get_drift () (storage : storage) : int = storage.drift

let min (a : nat) b = if a < b then a else b

[@inline]
let drift_adjustment (storage : storage) : int =
  let target = storage.target in 
  let qc = min storage.sell_ctez.total_liquidity storage._Q in
  let qt = min storage.sell_tez.total_liquidity (storage._Q * target) in
  let tqc_m_qt = target * qc - qt in
  let tQ = target * storage._Q in
  tqc_m_qt * tqc_m_qt * tqc_m_qt / (tQ * tQ * tQ)


let fee_rate (_Q : nat) (q : nat) : nat = 
  if 16n * q < _Q then 65536n else if 16n * q > 15n * _Q then 0n else
  abs (15 - 14 * q / _Q) * 65536n / 14n


let clamp_nat (x : int) : nat = 
    match is_nat x with
    | None -> 0n
    | Some x -> x

let update_fee_index (ctez_fa12_address: address) (delta: nat) (outstanding : nat) (_Q : nat) (dex : half_dex) : half_dex * nat * operation = 
  let rate = fee_rate _Q dex.total_liquidity in
  (* rate is given as a multiple of 2^(-48)... note that 2^(-32) Np / s ~ 0.73 cNp / year, so roughly a max of 0.73% / year *)
  let new_fee_index = dex.fee_index + Bitwise.shift_right (delta * dex.fee_index * rate) 48n in
  (* Compute how many ctez have implicitly been minted since the last update *)
  (* We round this down while we round the ctez owed up. This leads, over time, to slightly overestimating the outstanding ctez, which is conservative. *)
  let minted = outstanding * (new_fee_index - dex.fee_index) / dex.fee_index in

  (* Create the operation to explicitly mint the ctez in the FA12 contract, and credit it to the CFMM *)
  let ctez_mint_or_burn = get_ctez_mint_or_burn ctez_fa12_address in
  let op_mint_ctez = Tezos.transaction (minted, Tezos.get_self_address ()) 0mutez ctez_mint_or_burn in

  {dex with fee_index = new_fee_index; total_subsidy = clamp_nat (dex.total_subsidy + minted) }, clamp_nat (outstanding + minted), op_mint_ctez


let housekeeping () (storage : storage) : result =
  let curr_timestamp = Tezos.get_now () in
  if storage.last_update <> curr_timestamp then
    let d_drift = drift_adjustment storage in
    (* This is not homegeneous, but setting the constant delta is multiplied with
       to 1.0 magically happens to be reasonable. Why?
       Because (24 * 3600 / 2^48) * 365.25*24*3600 ~ 0.97%.
       This means that the annualized drift changes by roughly one percentage point per day at most.
    *)
    let new_drift = storage.drift + d_drift in

    let delta = abs (curr_timestamp - storage.last_update) in
    let target = storage.target in
    let d_target = Bitwise.shift_right (target * (abs storage.drift) * delta) 48n in
    (* We assume that `target - d_target < 0` never happens for economic reasons.
       Concretely, even drift were as low as -50% annualized, it would take not
       updating the target for 1.4 years for a negative number to occur *)
    let new_target  = if storage.drift < 0  then abs (target - d_target) else target + d_target in
    (* Compute what the liquidity fee shoud be, based on the ratio of total outstanding ctez to ctez in dexes *)
    let outstanding = (
      match (Tezos.call_view "viewTotalSupply" () storage.ctez_fa12_address) with
      | None -> (failwith unit : nat)
      | Some n-> n
    ) in
    let storage = { storage with _Q = outstanding / 20n } in
    let sell_ctez, outstanding, op_mint_ctez1 = update_fee_index storage.ctez_fa12_address delta outstanding storage._Q storage.sell_ctez in
    let sell_tez,  _outstanding, op_mint_ctez2 = update_fee_index storage.ctez_fa12_address delta outstanding (storage._Q * storage.target) storage.sell_tez in
    let storage = { storage with sell_ctez = sell_ctez ; sell_tez = sell_tez } in

    ([op_mint_ctez1 ; op_mint_ctez2], {storage with drift = new_drift ; last_update = curr_timestamp ; target = new_target })
  else
    ([], storage)



type add_tez_liquidity = 
[@layout:comb]
{
    owner : address ; (* address that will own the liqudity *)
    minLiquidity : nat ; (* minimum amount of liquidity to add *)
    deadline : timestamp ; (* deadline for the transaction *)
}

type add_ctez_liquidity = 
[@layout:comb]
{
    owner : address ; (* address that will own the liqudity *)
    minLiquidity : nat ; (* minimum amount of liquidity to add *)
    deadline : timestamp ; (* deadline for the transaction *)
    ctezDeposited : nat ; (* amount of ctez to deposit *)
}

type remove_tez_liquidity = 
[@layout:comb]
{
    [@annot:to] to_: address ; (* address to receive to *)
    lpt : nat ; (* amount of liquidity to remove *)
    minTezReceived : nat ; (* minimum amount of tez to receive *)
    minCtezReceived : nat ; (* minimum amount of ctez to receive *)
    minSubsidyReceived : nat ; (* minimum amount of ctez subsidy to receive *)
    deadline : timestamp ; (* deadline for the transaction *)
}

type remove_ctez_liquidity = 
[@layout:comb]
{
    [@annot:to] to_: address ; (* address to receive to *)
    lpt : nat ; (* amount of liquidity to remove *)
    minTezReceived : nat ; (* minimum amount of tez to receive *)
    minCtezReceived : nat ; (* minimum amount of ctez to receive *)
    minSubsidyReceived : nat ; (* minimum amount of ctez subsidy to receive *)
    deadline : timestamp ; (* deadline for the transaction *)
}

type tez_to_ctez = 
[@layout:comb]
{
    [@annot:to] to_: address ; (* address that will own the ctez *)
    deadline : timestamp ; (* deadline for the transaction *)
    minCtezBought : nat ; (* minimum amount of ctez to buy *)
}

type ctez_to_tez = 
[@layout:comb]
{
    [@annot:to] to_: address ; (* address that will own the tez *)
    deadline : timestamp ; (* deadline for the transaction *)
    minTezBought : nat ; (* minimum amount of tez to buy *)    
    ctezSold : nat ; (* amount of ctez to sell *)
}

type withdraw_for_tez_liquidity = 
[@layout:comb]
{
    [@annot:to] to_: address ; (* address to withdraw to *)
}

type withdraw_for_ctez_half_dex = 
[@layout:comb]
{
    [@annot:to] to_: address ; (* address to withdraw to, note that here you receive both ctez and tez 
    because ctez is received as part of the subsidy *)
}


type fa12_transfer =
  [@layout:comb]
  { [@annot:from] address_from : address;
    [@annot:to] address_to : address;
    value : nat }


// retrieve _Q and target



let update_ctez_contract_if_needed (s : storage) : operation list * storage = 
  let curr_level = Tezos.get_level () in
  if s.last_update <> curr_level then
    let ctez_contract = (Tezos.get_entrypoint "%dex_update" s.ctez_contract : (nat * nat) contract) in
    let operation = Tezos.transaction (s.sell_ctez.total_liquidity, s.sell_tez.total_liquidity) 0mutez ctez_contract in
    let target , _Q = Option.value_with_error "dex_info entrypoint must exist" (Tezos.call_view "%dex_info" () s.ctez_contract) in
    ([operation], {s with last_update = curr_level; target = target; _Q = _Q})
  else
    ([], s)


[@inline]
let ceildiv (numerator : nat) (denominator : nat) : nat = abs ((- numerator) / (int denominator))


[@inline]
let redeem_amount (x : nat) (reserve : nat) (total : nat) : nat = 
  // The redeem rate is defined as 
  //  RX_i(t_0, t_1) := r_i / total(t_0, t_1)
  // The redeem amount is defined as
  //    v = x / RX_i(t_0, t_1) = (x * total(t_0, t_1)) / reserve
  (x * total) / reserve


[@entry]
let add_ctez_liquidity (param : add_ctez_liquidity) (s : storage) : storage * operation list =
  let d_lpt = redeem_amount param.ctezDeposited s.sell_ctez.total_liquidity s.sell_ctez.total_lpt in
  let () = assert_with_error (d_lpt >= param.minLiquidity) "transaction would create insufficient liquidity" in 
  let () = assert_with_error (Tezos.get_now () <= param.deadline) "deadline has passed" in
  // lpt is going to be lpt + d_lpt
  // ctez is going to be ctez + d_ctez
  // if the owner already has liquidity, we need to update the owed amount
  // otherwise we need to create a new liquidity owner
  let liquidity_owner = 
    Option.value 
      { lpt = 0n ; owed = 0n ; subsidy_owed = 0n} 
      (Big_map.find_opt param.owner s.sell_ctez.liquidity_owners) 
  in
  let d_tez = ceildiv (s.sell_ctez.total_proceeds * d_lpt) s.sell_ctez.total_lpt in    
  let d_subsidy_owed = ceildiv (s.sell_ctez.total_subsidy * d_lpt) s.sell_ctez.total_lpt in
  // Update liquidity owner
  let liquidity_owner = { liquidity_owner with
      lpt  = liquidity_owner.lpt + d_lpt ;
      owed = liquidity_owner.owed + d_tez ;
      subsidy_owed = liquidity_owner.subsidy_owed + d_subsidy_owed } in
  let liquidity_owners = Big_map.update param.owner (Some liquidity_owner) s.sell_ctez.liquidity_owners in

  let sell_ctez = {s.sell_ctez with
      liquidity_owners = liquidity_owners ;
      total_lpt = s.sell_ctez.total_lpt + d_lpt ;
      total_liquidity = s.sell_ctez.total_liquidity + param.ctezDeposited ;
      } in

  let receive_ctez = Tezos.transaction (param.owner, (s.liquidity_dex_address, param.ctezDeposited)) 0mutez s.ctez_token_contract in
  ({s with sell_ctez = half_dex}, [receive_ctez])
    
[@entry]
let remove_ctez_liquidity (param : remove_ctez_liquidity) (s : storage) : storage * operation list = 
  let () = assert_with_error (Tezos.get_now () <= param.deadline) "deadline has passed" in
  let ctez_removed = (param.lpt * s.sell_ctez.total_liquidity) / s.sell_ctez.total_lpt in
  let tez_removed = (param.lpt * s.sell_ctez.total_proceeds) / s.sell_ctez.total_lpt in
  let subsidy_removed = (param.lpt * s.sell_ctez.total_subsidy) / s.sell_ctez.total_lpt in
  let owner = Tezos.get_sender () in
  let liquidity_owner = Option.unopt_with_error (Big_map.find_opt owner s.sell_ctez.liquidity_owners) "no liquidity owner" in
  let () = assert_with_error (liquidity_owner.lpt >= param.lpt) "insufficient liquidity" in
  let () = assert_with_error (ctez_removed >= param.minCtezReceived) "insufficient ctez would be received" in

  (* compute the amount of tez to receive after netting the owed amount *)
  let tez_to_receive = tez_removed - liquidity_owner.owed in
  let () = assert_with_error (tez_to_receive >= int param.minTezReceived) "insufficient tez would be received" in
  let (owed, tez_to_receive) =
      if tez_to_receive < 0 then                    
          (abs (liquidity_owner.owed - tez_removed), 0n)
      else
          (0n, abs tez_to_receive)
  in
  (* computed the amount of subsidy to recieve after netting the owed subsidy amount *)


  let subsidy_to_receive = subsidy_removed - liquidity_owner.subsidy_owed in
  let () = assert_with_error (subsidy_to_receive >= int param.minSubsidyReceived) "insufficient subsidy would be received" in
  let (subsidy_owed, subsidy_to_receive) =
      if subsidy_to_receive < 0 then
          (abs (liquidity_owner.subsidy_owed - subsidy_removed), 0n)
      else
          (0n, abs subsidy_to_receive)
  in

  let liquidity_ower = { liquidity_owner with
                        lpt = abs (liquidity_owner.lpt - param.lpt) ;
                        owed = owed ;
                        subsidy_owed = subsidy_owed } in
  let liquidity_owners = Big_map.update owner (Some liquidity_owner) s.sell_ctez.liquidity_owners in

  let sell_ctez = {s.sell_ctez with
      liquidity_owners = liquidity_owners ;
      total_lpt = abs (s.sell_ctez.total_lpt - param.lpt) ;
      total_liquidity = abs (s.sell_ctez.total_liquidity - ctez_removed) ;
      total_proceeds = abs (s.sell_ctez.total_proceeds - tez_removed) ;
      total_subsidy = abs (s.sell_ctez.total_subsidy - subsidy_removed) ;
  } in
  let receive_ctez = Tezos.transaction (param.to_, (s.ctez_token_contract, ctez_removed)) 0mutez s.liquidity_dex_address in
  let receive_subsidy = Tezos.transaction (param.to_, (s.ctez_token_contract, subsidy_to_receive)) 0mutez s.liquidity_dex_address in
  let receive_tez = Tezos.transaction () (tez_to_receive * 1mutez) param.to_ in
  ({s with sell_ctez = sell_ctez}, [receive_ctez; receive_subsidy; receive_tez])


let min (x : nat) (y : nat) : nat = if x < y then x else y

let clamp_nat (x : int) : nat = 
    match is_nat x with
    | None -> 0n
    | Some x -> x

let newton_step (q : nat) (t : nat) (_Q : nat) (dq : nat): int =
 (*
    (3 dq⁴ + 6 dq² (q - Q)² + 8 dq³ (-q + Q) + 80 Q³ t) / (4 ((dq - q)³ + 3 (dq - q)² Q + 3 (dq - q) Q² + 21 Q³))
    todo, check that implementation below is correct
    TODO: optimize the computation of [q - _Q] and other constants 
          (A dq^2 +B)/(C + dq(D+dq(4dq-E)))
 *)    
    // ensures that dq < q
    let dq = min dq q in
    // assert q < _Q (due to clamp at [invert])
    let q_m_Q = q - _Q in

    let dq_m_q = dq - q in
    let dq_m_q_sq = dq_m_q * dq_m_q in
    let dq_m_q_cu = dq_m_q_sq * dq_m_q in
    let _Q_sq = _Q * _Q in
    let _Q_cu = _Q_sq * _Q in
      
    let num = 3 * dq * dq * dq * dq + 6 * dq * dq * q_m_Q * q_m_Q + 8 * dq * dq * dq * (-q_m_Q) + 80 * _Q_cu * t in
    let denom = 4 * (dq_m_q_cu + 3 * dq_m_q_sq * _Q + 3 * dq_m_q * _Q_sq + 21 * _Q_cu) in
      
    num / denom

let invert (q : nat) (t : nat) (_Q : nat) : nat =
    (* q is the current amount,
       t is the amount you want to trade
       _Q is the target amount 
     *)
    (* note that the price is generally very nearly linear, after all the worth marginal price is 1.05, so Newton
       converges stupidly fast *)
    let q = min q _Q in
    let dq = clamp_nat (newton_step q t _Q t) in 
    let dq = clamp_nat (newton_step q t _Q dq) in
    let dq = clamp_nat (newton_step q t _Q dq) in
    let result = dq - dq / 1_000_000_000 - 1 in
    match is_nat result with
    | None -> failwith "trade size too small"
    | Some x -> x


let append t1 t2 = List.fold_right (fun (x, tl) -> x :: tl) t1 t2

[@entry]
let tez_to_ctez (param : tez_to_ctez) (s : storage) : operation list * storage = 
  let update_ops, s = update_ctez_contract_if_needed s in

  let () = assert_with_error (Tezos.get_now () <= param.deadline) "deadline has passed" in
 (* The amount of tez that will be bought is calculated by integrating a polynomial which is a function of the fraction u purchased over q
  * the polynomial, representing the marginal price is given as (21 - 3 * u + 3 u^2 - u^3) / 20 
  * again, u is the quantity of ctez purchased over q which represents this characteristic quantity of ctez in the ctez half dex.&&
  * the integral of this polynomial between u = 0 and u = x / q (where x will be ctez_to_sell) is is given as
  *  (21 * u - 3 * u^2 / 2 + u^3 - u^4 / 4) / 20
  * or (cts(cts(cts^2-3q^2)+42  q^3))/(40q^4) *) 
//   let cts = ctez_to_sell in let q = s.q in
//   let q2 = q * q in 
//   let d_tez = (cts * (cts * (cts * cts - 3 * q2) + 42 * q * q2)) / (40 * q2 * q2) in    
   
    let t = Bitwise.shift_left (Tezos.get_amount () / 1mutez) 48n / s.target in 
    let ctez_to_sell = invert s.sell_ctez.total_liquidity t s._Q  in
    let () = assert_with_error (ctez_to_sell >= param.minCtezBought) "insufficient ctez would be bought" in
    let () = assert_with_error (ctez_to_sell <= s.sell_ctez.total_liquidity) "insufficient ctez in the dex" in
    // Update dex
    let half_dex = s.sell_ctez in
    let half_dex: half_dex = { half_dex with total_liquidity = clamp_nat (half_dex.total_liquidity - ctez_to_sell); total_proceeds = half_dex.total_proceeds + (Tezos.get_amount () / 1mutez) } in
    // Transfer ctez to the buyer
    let fa_contract = (Tezos.get_entrypoint "%transfer" s.ctez_token_contract : fa12_transfer contract) in
    let receive_ctez = Tezos.transaction { address_from = s.liquidity_dex_address; address_to = param.to_; value = ctez_to_sell } 0mutez fa_contract in
    // Deal with subsidy later
    (append update_ops [receive_ctez], {s with sell_ctez = half_dex})


let implicit_transfer (to_ : address) (amt : tez) : operation = 
    let contract = (Tezos.get_entrypoint "%default" to_ : unit contract) in
    Tezos.transaction () amt contract

let ctez_transfer (s : storage) (to_ : address) (value: nat) : operation = 
    let fa_contract = (Tezos.get_entrypoint "%transfer" s.ctez_token_contract : fa12_transfer contract) in
    let receive_ctez = Tezos.transaction { address_from = s.liquidity_dex_address; address_to = to_; value } 0mutez fa_contract in
    receive_ctez


[@entry]
let withdraw_for_ctez_half_dex (param : withdraw_for_ctez_half_dex) (s: storage) : operation list * storage = 
    // withdraw: you can withdraw x so long as x + owed < lpt * total_proceeds / total_lpt, after which owed := owed + x 
    //  So, my thoughts on withdrawing:
    // you can withdraw x, so long as x + owe < lpt * total_proceeds / total_lpt
    // owe := owe + x
    // 2:57 PM
    // owe never decreases, it's basically a tally of everything you've ever withdrawn
    // 2:57 PM
    // so when you add liquidity, it's like you added all those proceeds, and then withdrew lpt * total_proceeds / total_lpt
    // 
    // TL;DR: proceeds = tez + total owed; proceeds doesn't increase
    
    let owner = Tezos.get_sender () in
    let half_dex = s.sell_ctez in
    let liquidity_owner = Option.value_with_error  "no liquidity owner" (Big_map.find_opt owner half_dex.liquidity_owners) in
    let share_of_proceeds = liquidity_owner.lpt * half_dex.total_proceeds / half_dex.total_lpt in
    // proceeds in tez
    let amount_proceeds_withdrawn = clamp_nat (share_of_proceeds - liquidity_owner.owed) in
    let share_of_subsidy = liquidity_owner.lpt * half_dex.total_subsidy / half_dex.total_lpt in
    // subsidy in ctez
    let amount_subsidy_withdrawn = clamp_nat (share_of_subsidy - liquidity_owner.subsidy_owed) in
    // liquidity owner owes the full share of proceeds
    let liquidity_owner = { liquidity_owner with owed = share_of_proceeds; subsidy_owed = share_of_subsidy } in
    // update half dex
    let half_dex = { half_dex with liquidity_owners = Big_map.update owner (Some liquidity_owner) half_dex.liquidity_owners } in
    // do transfers
    let receive_proceeds = implicit_transfer param.to_ (amount_proceeds_withdrawn * 1mutez) in
    let receive_subsidy = ctez_transfer s param.to_ amount_subsidy_withdrawn in
    ([receive_proceeds; receive_subsidy], {s with sell_ctez = half_dex})




let main (p, s : parameter * storage) : result =
  match p with
  | Withdraw w -> (withdraw s w : result)
  | Register_oven_deposit r -> (register_oven_deposit s r : result)
  | Create d -> (create s d : result)
  | Liquidate l -> (liquidate s l : result)
  | Mint_or_burn xs -> (mint_or_burn s xs : result)
  | Cfmm_info ((x,y),z) -> (cfmm_info s x y z : result)
  | Set_addresses xs -> (set_addresses s xs : result)
  | Get_target t -> (get_target s t : result)


