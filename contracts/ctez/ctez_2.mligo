#include "../common/stdctez.mligo"
#import "../common/errors.mligo" "Errors"
#import "../oven.mligo" "Oven"
#import "half_dex.mligo" "Half_dex"
#import "context.mligo" "Context"

type add_tez_liquidity = { 
  owner : address;
  min_liquidity : nat;
  deadline : timestamp;
}

type add_ctez_liquidity = { 
  owner : address;
  amount_deposited : nat;
  min_liquidity : nat;
  deadline : timestamp;
}

type tez_to_ctez = {
  [@annot:to]
  to_: address; 
  min_ctez_bought : nat;
  deadline : timestamp
}

type ctez_to_tez = {
  [@annot:to]
  to_: address; 
  ctez_sold : nat;
  min_tez_bought : nat;
  deadline : timestamp
}

type create_oven = {
  id : nat; 
  delegate : key_hash option; 
  depositors : Oven.depositors;
}

type liquidate = { 
  handle : Oven.handle; 
  quantity : nat; 
  [@annot:to]
  to_ : unit contract;
}

type mint_or_burn = { 
  id : nat; 
  quantity : int;
}

type oven = { 
  tez_balance : tez;
  ctez_outstanding : nat;
  address : address;
  fee_index : Float64.t;
}

type withdraw = { 
  id : nat; 
  amount : tez; 
  [@annot:to] 
  to_ : unit contract 
}

type calc_sell_amount = { 
  is_sell_ctez_dex : bool; 
  proceeds_amount : nat;
}

type storage = { 
  ovens : (Oven.handle, oven) big_map;
  last_update : timestamp;
  sell_ctez : Half_dex.t;
  sell_tez  : Half_dex.t;
  context : Context.t;
  metadata : (string, bytes) big_map;
}

type result = storage with_operations

(* Functions *)

let get_oven (handle : Oven.handle) (s : storage) : oven =
  match Big_map.find_opt handle s.ovens with
  | None -> (failwith Errors.oven_not_exists : oven)
  | Some oven -> 
    (* Adjust the amount of outstanding ctez in the oven, record the fee index at that time. *)
    let fee_index = s.sell_ctez.fee_index * s.sell_tez.fee_index in
    let prev_ctez_outstanding = oven.ctez_outstanding in
    let prev_fee_index = oven.fee_index in
    let ctez_outstanding = (prev_ctez_outstanding * fee_index) / prev_fee_index in 
    let fee_index = if prev_ctez_outstanding > 0n 
      then ceil_div (ctez_outstanding * prev_fee_index) prev_ctez_outstanding 
      else fee_index in 
    {oven with fee_index ; ctez_outstanding}

let is_under_collateralized (oven : oven) (target : nat) : bool =
  (15n * oven.tez_balance) < (16n * Float64.mul oven.ctez_outstanding target) * 1mutez

let get_oven_withdraw (oven_address : address) : (tez * (unit contract)) contract =
  match (Tezos.get_entrypoint_opt "%withdraw" oven_address : (tez * (unit contract)) contract option) with
    | None -> (failwith Errors.missing_withdraw_entrypoint : (tez * (unit contract)) contract)
    | Some c -> c

let get_ctez_mint_or_burn (fa12_address : address) : (int * address) contract =
  match (Tezos.get_entrypoint_opt  "%mintOrBurn"  fa12_address : ((int * address) contract) option) with
    | None -> (failwith Errors.missing_mint_or_burn_entrypoint : (int * address) contract)
    | Some c -> c

(* Environments *)

let sell_tez_env : Half_dex.environment = {
  transfer_self = fun (_) (_) (r) (a) -> Context.transfer_xtz r a;
  transfer_proceeds = fun (c) (r) (a) -> Context.transfer_ctez c (Tezos.get_self_address ()) r a;
  get_target_self_reserves = fun (c) -> max (Float64.mul c._Q c.target) 1n;
  div_by_target = fun (c) (amt) -> Float64.mul amt c.target;
  is_sell_ctez_dex = false;
}

let sell_ctez_env : Half_dex.environment = {
  transfer_self = fun (c) (s) (r) (a) -> Context.transfer_ctez c s r a;
  transfer_proceeds = fun (_) (r) (a) -> Context.transfer_xtz r a;
  get_target_self_reserves = fun (c) -> c._Q;
  div_by_target = fun (c) (amt) -> Float64.div amt c.target;
  is_sell_ctez_dex = true;
}

(* housekeeping *)

[@inline]
let drift_adjustment 
    (delta : nat)
    (s : storage) 
    : int = // Float64
  let ctxt = s.context in
  let _Qt = sell_tez_env.get_target_self_reserves ctxt in
  let qc = min s.sell_ctez.self_reserves ctxt._Q in
  let qt = min s.sell_tez.self_reserves _Qt in
  let tqc_m_qt = (Float64.mul qc ctxt.target) - qt in
  65536n * delta * tqc_m_qt * tqc_m_qt * tqc_m_qt / (_Qt * _Qt * _Qt)

let fee_rate (q : nat) (_Q : nat) : Float64.t =
  let max_rate = 5845483520n in 
  if 8n * q < _Q  (* if q < 12.5% of _Q *)
    then max_rate (* ~1% / year *)
  else if 8n * q > 7n * _Q (* if q > 87.5% of _Q*) 
    then 0n (* 0% / year *)
    else abs(max_rate  * (7n * _Q - 8n * q)) / (6n * _Q) (* [0%, ~1%] / year *)

let update_fee_index 
    (delta: nat) 
    (outstanding : nat) 
    (_Q : nat) 
    (dex : Half_dex.t) 
    : Half_dex.t * nat = 
  let rate = fee_rate dex.self_reserves _Q in
  let fee_index = dex.fee_index in 
  (* rate is given as a multiple of 2^(-64), roughly [0%, 1%] / year *)
  let new_fee_index = fee_index + Float64.mul (delta * fee_index) rate in
  (* Compute how many ctez have implicitly been minted since the last update *)
  (* We round this down while we round the ctez owed up. This leads, over time, to slightly overestimating the outstanding ctez, which is conservative. *)
  let minted = outstanding * (new_fee_index - fee_index) / fee_index in
  {dex with fee_index = new_fee_index; subsidy_reserves = clamp_nat (dex.subsidy_reserves + minted) }, clamp_nat (outstanding + minted)

let get_actual_state (s : storage) : int * storage =
  let now = Tezos.get_now () in
  if s.last_update <> now then
    let delta = abs (now - s.last_update) in
    let d_drift = drift_adjustment delta s in
    (* This is not homegeneous, but setting the constant delta is multiplied with
       to 1.0 magically happens to be reasonable. Why?
       Because (2^16 * 24 * 3600 / 2^64) * 365.25*24*3600 ~ 0.97%.
       This means that the annualized drift changes by roughly one percentage point per day at most.
    *)
    let drift = s.context.drift in
    let new_drift = drift + d_drift in

    let target = s.context.target in
    let d_target = Float64.mul ((abs drift) * delta) target in
    (* We assume that `target - d_target < 0` never happens for economic reasons.
       Concretely, even drift were as low as -50% annualized, it would take not
       updating the target for 1.4 years for a negative number to occur *)
    let new_target = if drift < 0 
      then subtract_nat target d_target Errors.incorrect_subtraction 
      else target + d_target in
    (* Compute what the liquidity fee should be, based on the ratio of total outstanding ctez to ctez in dexes *)
    let outstanding = match (Tezos.Next.View.call "viewTotalSupply" () s.context.ctez_fa12_address) with
      | None -> (failwith Errors.missing_total_supply_view : nat)
      | Some n-> n in
    let _Q = max (outstanding / 20n) 1n in
    let s = { s with context = {s.context with _Q = _Q }} in
    let sell_ctez, new_outstanding = update_fee_index delta outstanding (sell_ctez_env.get_target_self_reserves s.context) s.sell_ctez in
    let sell_tez, new_outstanding = update_fee_index delta new_outstanding (sell_tez_env.get_target_self_reserves s.context) s.sell_tez in
    let subsidies_minted = new_outstanding - outstanding in
    let context = { s.context with drift = new_drift ; target = new_target } in
    (subsidies_minted, { s with last_update = now ; sell_ctez = sell_ctez ; sell_tez = sell_tez ; context = context })
  else
    (0, s)

let do_housekeeping (s : storage) : result =
  let subsidies_minted, s = get_actual_state s in
  (* Create the operation to explicitly mint the ctez in the FA12 contract, and credit it to the CFMM *)
  let ctez_mint_or_burn = get_ctez_mint_or_burn s.context.ctez_fa12_address in
  let ops = if subsidies_minted > 0 
    then [Tezos.Next.Operation.transaction (subsidies_minted, Tezos.get_self_address ()) 0mutez ctez_mint_or_burn] 
    else [] in
  (ops, s)

(* Entrypoint Functions *)

[@entry]
let set_ctez_fa12_address 
    (ctez_fa12_address : address) 
    (s : storage) 
    : result =
  let () = assert_no_tez_in_transaction () in
  let () = Assert.Error.assert (s.context.ctez_fa12_address = ("tz1Ke2h7sDdakHJQh8WX4Z372du1KChsksyU" : address)) Errors.ctez_fa12_address_already_set in
  ([], { s with context = { s.context with ctez_fa12_address }})

[@entry]
let create_oven 
    ({ id; delegate; depositors } : create_oven) 
    (s : storage) 
    : result =
  let house_ops, s = do_housekeeping s in
  let handle = { id ; owner = Tezos.get_sender () } in
  let () = Assert.Error.assert (not Big_map.mem handle s.ovens) Errors.oven_already_exists in
  let (origination_op, oven_address) : operation * address =
    Oven.originate_oven delegate (Tezos.get_amount ()) { admin = Tezos.get_self_address () ; handle ; depositors } in
  let oven = {
    tez_balance = (Tezos.get_amount ()); 
    ctez_outstanding = 0n; 
    address = oven_address; 
    fee_index = s.sell_ctez.fee_index * s.sell_tez.fee_index
  } in
  let ovens = Big_map.update handle (Some oven) s.ovens in
  (List.append house_ops [origination_op], { s with ovens })

[@entry]
let withdraw_from_oven
    ({ id; amount; to_ } : withdraw) 
    (s : storage) 
    : result =
  let house_ops, s = do_housekeeping s in
  let () = assert_no_tez_in_transaction () in
  let handle = {id = id ; owner = Tezos.get_sender ()} in
  let oven : oven = get_oven handle s in
  let oven_contract = get_oven_withdraw oven.address in
  (* Check for undercollateralization *)
  let new_balance = match (oven.tez_balance - amount) with
    | None -> (failwith Errors.excessive_tez_withdrawal : tez)
    | Some x -> x in
  let oven = {oven with tez_balance = new_balance} in
  let ovens = Big_map.update handle (Some oven) s.ovens in
  let s = {s with ovens = ovens} in
  let () = Assert.Error.assert (not is_under_collateralized oven s.context.target) Errors.excessive_tez_withdrawal in
  let withdraw_op = Tezos.Next.Operation.transaction (amount, to_) 0mutez oven_contract in
  (List.append house_ops [withdraw_op], s)

[@entry]
let register_oven_deposit 
    ({ handle; amount } : Oven.register_deposit) 
    (s : storage) 
    : result =
  let house_ops, s = do_housekeeping s in
  (* First check that the call is legit *)
  let oven = get_oven handle s in
  let () = Assert.Error.assert (Tezos.get_sender () = oven.address) Errors.only_oven_can_call in
  (* register the increased balance *)
  let oven = {oven with tez_balance = oven.tez_balance + amount} in
  let ovens = Big_map.update handle (Some oven) s.ovens in
  house_ops, { s with ovens = ovens }

(* liquidate the oven by burning "quantity" ctez *)
[@entry]
let liquidate_oven
    ({ handle; quantity; to_ } : liquidate)
    (s : storage) 
    : result  =
  let house_ops, s = do_housekeeping s in
  let () = assert_no_tez_in_transaction () in
  let oven : oven = get_oven handle s in
  let target = s.context.target in
  let () = Assert.Error.assert (is_under_collateralized oven target) Errors.not_undercollateralized in
  let remaining_ctez = match is_nat (oven.ctez_outstanding - quantity) with
    | None -> (failwith Errors.excessive_ctez_burning : nat)
    | Some n -> n  in
  (* get 32/31 of the target price, meaning there is a 1/31 penalty for the oven owner for being liquidated *)
  let extracted_balance = (Float64.mul (32n * quantity) target) * 1mutez / 31n in
  let new_balance = match oven.tez_balance - extracted_balance with
    | None -> (failwith Errors.insufficient_tez_in_oven : tez)
    | Some x -> x in
  let oven = {oven with ctez_outstanding = remaining_ctez ; tez_balance = new_balance} in
  let ovens = Big_map.update handle (Some oven) s.ovens in
  let s = {s with ovens = ovens} in
  let oven_contract = get_oven_withdraw oven.address in
  let op_take_collateral = Tezos.Next.Operation.transaction (extracted_balance, to_) 0mutez oven_contract in
  let ctez_mint_or_burn = get_ctez_mint_or_burn s.context.ctez_fa12_address in
  let op_burn_ctez = Tezos.Next.Operation.transaction (-quantity, Tezos.get_sender ()) 0mutez ctez_mint_or_burn in
  List.append house_ops [op_burn_ctez ; op_take_collateral], s

[@entry]
let mint_or_burn 
    ({id ; quantity } : mint_or_burn)
    (s : storage) 
    : result =
  let house_ops, s = do_housekeeping s in
  let () = assert_no_tez_in_transaction () in
  let handle = { id = id ; owner = Tezos.get_sender () } in
  let oven : oven = get_oven handle s in
  let ctez_outstanding = match is_nat (oven.ctez_outstanding + quantity) with
    | None -> (failwith Errors.excessive_ctez_burning : nat)
    | Some n -> n in
  let oven = {oven with ctez_outstanding = ctez_outstanding} in
  let ovens = Big_map.update handle (Some oven) s.ovens in
  let s = {s with ovens = ovens} in
  let () = Assert.Error.assert (not is_under_collateralized oven s.context.target) Errors.excessive_ctez_minting in
  let ctez_mint_or_burn = get_ctez_mint_or_burn s.context.ctez_fa12_address in
  let mint_or_burn_op = Tezos.Next.Operation.transaction (quantity, Tezos.get_sender ()) 0mutez ctez_mint_or_burn in
  List.append house_ops [mint_or_burn_op], s

(* dex *)

[@entry]
let add_tez_liquidity 
    ({ owner; min_liquidity; deadline } : add_tez_liquidity) 
    (s : storage) 
    : result =
  let house_ops, s = do_housekeeping s in
  let amount_deposited = tez_to_nat (Tezos.get_amount ()) in
  let p : Half_dex.add_liquidity = { owner; amount_deposited; min_liquidity; deadline } in
  let sell_tez = Half_dex.add_liquidity s.sell_tez p in
  house_ops, { s with sell_tez }

[@entry]
let add_ctez_liquidity 
    ({ owner; amount_deposited; min_liquidity; deadline } : add_ctez_liquidity) 
    (s : storage) 
    : result =
  let house_ops, s = do_housekeeping s in
  let () = assert_no_tez_in_transaction () in
  let p : Half_dex.add_liquidity = { owner; amount_deposited; min_liquidity; deadline } in
  let sell_ctez = Half_dex.add_liquidity s.sell_ctez p in
  let transfer_ctez_op = Context.transfer_ctez s.context (Tezos.get_sender ()) (Tezos.get_self_address ()) amount_deposited in
  List.append house_ops [transfer_ctez_op], { s with sell_ctez }

[@entry]
let remove_tez_liquidity 
    (p : Half_dex.remove_liquidity) 
    (s : storage) 
    : result =
  let house_ops, s = do_housekeeping s in
  let () = assert_no_tez_in_transaction () in
  let (ops, sell_tez) = Half_dex.remove_liquidity s.sell_tez s.context sell_tez_env p in
  List.append house_ops ops, { s with sell_tez }

[@entry]
let remove_ctez_liquidity 
    (p : Half_dex.remove_liquidity) 
    (s : storage) 
    : result =
  let house_ops, s = do_housekeeping s in
  let () = assert_no_tez_in_transaction () in
  let (ops, sell_ctez) = Half_dex.remove_liquidity s.sell_ctez s.context sell_ctez_env p in
  List.append house_ops ops, { s with sell_ctez }

[@entry]
let collect_from_tez_liquidity
    (p : Half_dex.collect_proceeds_and_subsidy) 
    (s : storage) 
    : result =
  let house_ops, s = do_housekeeping s in
  let () = assert_no_tez_in_transaction () in
  let (ops, sell_tez) = Half_dex.collect_proceeds_and_subsidy s.sell_tez s.context sell_tez_env p in
  List.append house_ops ops, { s with sell_tez }

[@entry]
let collect_from_ctez_liquidity 
    (p : Half_dex.collect_proceeds_and_subsidy) 
    (s : storage) 
    : result =
  let house_ops, s = do_housekeeping s in
  let () = assert_no_tez_in_transaction () in
  let (ops, sell_ctez) = Half_dex.collect_proceeds_and_subsidy s.sell_ctez s.context sell_ctez_env p in
  List.append house_ops ops, { s with sell_ctez }

[@entry]
let tez_to_ctez
    ({to_; min_ctez_bought; deadline} : tez_to_ctez)
    (s : storage)
    : result =
  let house_ops, s = do_housekeeping s in
  let p : Half_dex.swap = { to_ ; deadline; proceeds_amount = tez_to_nat (Tezos.get_amount ()); min_self = min_ctez_bought } in
  let (ops, sell_ctez) = Half_dex.swap s.sell_ctez s.context sell_ctez_env p in
  List.append house_ops ops, { s with sell_ctez }

[@entry]
let ctez_to_tez
    ({to_; ctez_sold; min_tez_bought; deadline} : ctez_to_tez)
    (s : storage)
    : result =
  let house_ops, s = do_housekeeping s in
  let () = assert_no_tez_in_transaction () in
  let p : Half_dex.swap = { to_ ; deadline; proceeds_amount = ctez_sold; min_self = min_tez_bought } in
  let (ops, sell_tez) = Half_dex.swap s.sell_tez s.context sell_tez_env p in
  let transfer_ctez_op = Context.transfer_ctez s.context (Tezos.get_sender ()) (Tezos.get_self_address ()) ctez_sold in
  let ops = transfer_ctez_op :: ops in 
  List.append house_ops ops, { s with sell_tez }

(* Views *)

let get_half_dex_state (dex: Half_dex.t) = 
  {
    total_liquidity_shares = dex.total_liquidity_shares;
    self_reserves = dex.self_reserves;
    proceeds_debts = dex.proceeds_debts;
    proceeds_reserves = dex.proceeds_reserves;
    subsidy_debts = dex.subsidy_debts;
    subsidy_reserves = dex.subsidy_reserves;
    fee_index = dex.fee_index;
  }

[@view]
let get_current_state () (s : storage) = 
  let _, s = get_actual_state s in
  {
    last_update = s.last_update;
    context = s.context;
    sell_ctez = get_half_dex_state s.sell_ctez;
    sell_tez = get_half_dex_state s.sell_tez;
  }

[@view]
let get_oven_state (handle : Oven.handle) (s : storage) : oven =
  let _, s = get_actual_state s in
  get_oven handle s

[@view]
let calc_sell_amount 
    ({ is_sell_ctez_dex ; proceeds_amount } : calc_sell_amount) 
    (s : storage) 
    : nat =
  let _, s = get_actual_state s in
  let dex, env = if is_sell_ctez_dex 
    then (s.sell_ctez, sell_ctez_env) 
    else (s.sell_tez, sell_tez_env) in
  Half_dex.Curve.swap_amount dex s.context env proceeds_amount
