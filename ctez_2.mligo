#include "oven_types.mligo"
#include "stdctez.mligo"
#import "half_dex.mligo" Half_dex
#import "context.mligo" Context

// TODO: Hook up half dex here

type liquidate = 
  { handle : oven_handle 
  ; quantity : nat 
  ; [@annot:to] to_ : unit contract 
  }

type mint_or_burn = 
  { id : nat 
  ; quantity : int
  }

type oven = 
  { tez_balance : tez 
  ; ctez_outstanding : nat 
  ; address : address 
  ; fee_index : nat
  }

type storage = 
  { ovens : (oven_handle, oven) big_map 
  ; last_update : timestamp 
  ; sell_ctez : Half_dex.t 
  ; sell_tez  : Half_dex.t
  ; context : Context.t
  }

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



