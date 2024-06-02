#include "stdctez.mligo"
#import "context.mligo" "Context"
#import "errors.mligo" "Errors"

(** A half dex is defined by:
      - An ordered liquidity share [(tau_0, tau_1)]
      - A reserve of the 'self' token [r0 : tau_0]
      - A reserve of the 'proceeds' token [r1 : tau_1]
      - A subsidy owed by ovens to the dex (in ctez) [s : CTEZ]
      - A fee index [f : nat]
    Each account may own some shares in the dex. 

    The dex is parameterised by a capability context for:
      - transferring the self token
      - transferring the proceeds token
      - computing the target quantity of the 'self' token in the half dex
*)

type environment = 
  { transfer_self : Context.t -> address -> address -> nat -> operation
  ; transfer_proceeds : Context.t -> address -> nat -> operation
  ; target_self_reserves : Context.t -> nat
  }

module Curve = struct
  (** The marginal price [dp/du] is the derivative of the price function [p(u)] with respect to the 
      characteristic quantity [u = min(q/Q, 1)] where [q] is the current amount of the dex's 'self'
      token and [Q] is the target amount.

      The marginal price function is given as [dp/du(u) = target * (21 - 3 * u + 3 * u^2 - u^3) / 20]. 
      Meaning the price of dex's 'self' token in 'proceed' token units is given by
      {v
        p(u_0 -> u_1) = ∫_{u_0}^{u_1} dp/du(u) du 
                      = [target * (21 * u - 3 * u^2 / 2 + u^3 - u^4 / 4) / 20]_{u_1}^{u_0}
      v}
      for [u_1 < u_0]

      For a swap we need to determine [y] for a given [x] such that [p(q/q -> (q - y) / Q) = x] where
      [x] is the amount of 'proceed' token units to be traded for [y] 'self' token units.

      Solving the above equation for [y] gives irrational solutions. We instead use Newton's method to
      find an approximate solution. The Newton step is given as
      {v
        y_{i + 1} = y_i - p(q/Q, (q - y_i)/Q) / p'(q/Q, (q - y_i)/Q)
                  = FullySimplify[%]
                  = 3 y_i⁴ + 6 y_i² (q - Q)² + 8 y_i³ (-q + Q) + 80 Q³ x 
                    -----------------------------------------------------------
                    4 ((y_i - q)³ + 3 (y_i - q)² Q + 3 (y_i - q) Q² + 21 Q³)
      v}

      Note that since marginal price function is generally very nearly linear in the region [0, 1], 
      so Newton converges stupidly fast.
  *)

  let newton_step (x : nat) (y : nat) (q : nat) (_Q : nat) : int =
      (* Computes
          3 y⁴ + 6 y² (q - Q)² + 8 y³ (-q + Q) + 80 Q³ x 
          ---------------------------------------------------
          4 ((y - q)³ + 3 (y - q)² Q + 3 (y - q) Q² + 21 Q³)
      *)
      let dq = min y q in
      let q_m_Q = q - _Q in
      let dq_m_q = dq - q in
      let dq_m_q_sq = dq_m_q * dq_m_q in
      let dq_m_q_cu = dq_m_q_sq * dq_m_q in
      let _Q_sq = _Q * _Q in
      let _Q_cu = _Q_sq * _Q in
      let num = 3 * dq * dq * dq * dq + 6 * dq * dq * q_m_Q * q_m_Q + 8 * dq * dq * dq * (-q_m_Q) + 80 * _Q_cu * x in
      let denom = 4 * (dq_m_q_cu + 3 * dq_m_q_sq * _Q + 3 * dq_m_q * _Q_sq + 21 * _Q_cu) in
      num / denom

  (** [swap_amount x q _Q] returns the swap amount for trading [x] units of the proceeds token 
      for a half dex with total quantity [q] and target quantity [_Q]. 
  *)
  let swap_amount (x : nat) (q : nat) (_Q : nat) : nat = 
    let q = min q _Q in
    (* Initial guess for [y] is [x] *)
    let y = x in
    let y = clamp_nat (newton_step x y q _Q) in 
    let y = clamp_nat (newton_step x y q _Q) in
    let y = clamp_nat (newton_step x y q _Q) in
    let result = y - y / 1_000_000_000 - 1 in
    match is_nat result with
    | None -> failwith "trade size too small"
    | Some x -> x
end

type liquidity_owner = { 
  liquidity_shares : nat; (** the amount of liquidity shares owned by the account. *)
  proceeds_owed : nat;  (** the amount of the proceeds token owed to the dex by the account. *)
  subsidy_owed : nat;  (** the amount of ctez subsidy owed to the dex by the account. *)
}

type t = { 
  liquidity_owners : (address, liquidity_owner) big_map; (** map of liquidity owners. *)
  total_liquidity_shares : nat;  (** total amount of liquidity shares. *)
  self_reserves : nat;  (** total amount of liquidity. *)
  proceeds_reserves : nat; (** total amount accumulated from proceeds. *)
  subsidy_reserves : nat; (** total amount accumulated from subsidy. *)
  fee_index : Float48.t; (** the fee index. *)
}

let default_liquidity_owner = { liquidity_shares = 0n ; proceeds_owed = 0n ; subsidy_owed = 0n }

let find_liquidity_owner  (t : t) (owner : address) : liquidity_owner = 
  Option.value default_liquidity_owner (Big_map.find_opt owner t.liquidity_owners)

let set_liquidity_owner  (t : t) (owner : address) (liquidity_owner : liquidity_owner) : t = 
  { t with liquidity_owners = Big_map.update owner (Some liquidity_owner) t.liquidity_owners }

let update_liquidity_owner (t : t) (owner : address) (f : liquidity_owner -> liquidity_owner) : t = 
  let liquidity_owner = find_liquidity_owner t owner in
  let liquidity_owner = f liquidity_owner in
  set_liquidity_owner t owner liquidity_owner

type add_liquidity = { 
  owner: address; (** the address that will own the liquidity shares. *)
  amount_deposited: nat; (** the amount of the 'self' token to deposit. *)
  min_liquidity: nat; (** the minimum amount of liquidity shares to add. *)
  deadline : timestamp; (** the deadline for the transaction. *)
}

[@inline]
let redeem_amount (x : nat) (reserve : nat) (total : nat) : nat = 
  (* The redeem rate is defined as 
        RX_i(t_0, t_1) := r_i / total(t_0, t_1)
  *)
  ceildiv (x * reserve) total

[@inline]
let redeem_amount_inverted (lqt : nat) (reserve: nat) (total: nat) : nat = 
    // The redeem amount is defined as
    //    lqt = x RX_i(t_0, t_1)
    // Thus
    //    x = (lqt * total(t_0, t_1)) / reserve
    ceildiv (lqt * total) reserve
    
let add_liquidity
    (t : t)
    ({ owner; amount_deposited; min_liquidity; deadline } : add_liquidity)
    : t =
  let d_liquidity = redeem_amount_inverted amount_deposited t.self_reserves t.total_liquidity_shares in
  let () = Assert.Error.assert (d_liquidity >= min_liquidity) Errors.insufficient_liquidity_created in
  let () = Assert.Error.assert (Tezos.get_now () <= deadline) Errors.deadline_has_passed in
  let d_proceeds = redeem_amount d_liquidity t.proceeds_reserves t.total_liquidity_shares in
  let d_subsidy = redeem_amount d_liquidity t.subsidy_reserves t.total_liquidity_shares in
  let t = update_liquidity_owner t owner (fun liquidity_owner -> { 
    liquidity_owner with
    liquidity_shares = liquidity_owner.liquidity_shares + d_liquidity;
    proceeds_owed = liquidity_owner.proceeds_owed + d_proceeds;
    subsidy_owed = liquidity_owner.subsidy_owed + d_subsidy;
  }) in
  { 
    t with
    total_liquidity_shares = t.total_liquidity_shares + d_liquidity;
    self_reserves = t.self_reserves + amount_deposited;
  }

type remove_liquidity = { 
  to_: address; (** the address to receive the tokens *)
  liquidity_redeemed : nat; (** the amount of liquidity shares to redeem *)
  min_self_received : nat; (* minimum amount of tez to receive *)
  min_proceeds_received : nat; (* minimum amount of ctez to receive *)
  min_subsidy_received : nat; (* minimum amount of ctez subsidy to receive *)
  deadline : timestamp; (* deadline for the transaction *)
}

[@inline]
let subtract_debt (debt : nat) (amt : nat) = 
  if amt < debt then (abs (debt - amt), 0n)
  else (0n, abs (amt - debt))

let remove_liquidity
    (t : t)
    (ctxt : Context.t)
    (env : environment)
    ({ 
      to_;
      liquidity_redeemed;
      min_self_received;
      min_proceeds_received;
      min_subsidy_received;
      deadline;
    } : remove_liquidity)
    : t with_operations =
  let () = Assert.Error.assert (Tezos.get_now () <= deadline) Errors.deadline_has_passed in
  let owner = Tezos.get_sender () in
  let liquidity_owner = find_liquidity_owner t owner in
  let () = Assert.Error.assert (liquidity_owner.liquidity_shares >= liquidity_redeemed) Errors.insufficient_liquidity in
  let self_redeemed = redeem_amount liquidity_redeemed t.self_reserves t.total_liquidity_shares in
  let () = Assert.Error.assert (self_redeemed >= min_self_received) Errors.insufficient_self_received in
  let proceeds_owed, proceeds_redeemed = subtract_debt
    liquidity_owner.proceeds_owed
    (redeem_amount liquidity_redeemed t.proceeds_reserves t.total_liquidity_shares)
  in
  let () = Assert.Error.assert (proceeds_redeemed >= min_proceeds_received) Errors.insufficient_proceeds_received in
  let subsidy_owed, subsidy_redeemed = subtract_debt
    liquidity_owner.subsidy_owed
    (redeem_amount liquidity_redeemed t.subsidy_reserves t.total_liquidity_shares)
  in
  let () = Assert.Error.assert (subsidy_redeemed >= min_subsidy_received) Errors.insufficient_subsidy_received in
  let t = update_liquidity_owner t owner (fun liquidity_owner -> { 
    liquidity_owner with
    liquidity_shares = abs (liquidity_owner.liquidity_shares - liquidity_redeemed);
    proceeds_owed;
    subsidy_owed;
  }) in
  let t = { 
    t with
    total_liquidity_shares = abs (t.total_liquidity_shares - liquidity_redeemed);
    self_reserves = abs (t.self_reserves - self_redeemed);
    proceeds_reserves = abs (t.proceeds_reserves - proceeds_redeemed);
    subsidy_reserves = abs (t.subsidy_reserves - subsidy_redeemed);
  } in
  let ops = [] in
  let ops = if ( subsidy_redeemed > 0n ) then Context.transfer_ctez ctxt (Tezos.get_self_address ()) to_ subsidy_redeemed :: ops else ops in
  let ops = if ( proceeds_redeemed > 0n ) then env.transfer_proceeds ctxt to_ proceeds_redeemed :: ops else ops in
  let ops = if ( self_redeemed > 0n ) then env.transfer_self ctxt (Tezos.get_self_address ()) to_ self_redeemed :: ops else ops in
  ops, t

type swap = { 
  to_: address; (** address that will own the 'self' tokens in the swap *)
  proceeds_amount : nat; (** the amount of the 'proceed' token used to buy the 'self' token *)    
  min_self : nat; (** the minimum amount of 'self' tokens to receive *)
  deadline : timestamp; (** deadline for the transaction *)
}

let swap 
    (t : t) 
    (ctxt : Context.t) 
    (env : environment) 
    ({ to_; proceeds_amount; min_self; deadline } : swap)
    : t with_operations =
  let () = Assert.Error.assert (Tezos.get_now () <= deadline) Errors.deadline_has_passed in
  let self_to_sell = Curve.swap_amount proceeds_amount t.self_reserves (env.target_self_reserves ctxt) in
  let () = Assert.Error.assert (self_to_sell >= min_self) Errors.insufficient_tokens_bought in
  let () = Assert.Error.assert (self_to_sell < t.self_reserves) Errors.insufficient_tokens_liquidity in
  let t = { 
    t with
    self_reserves = abs (t.self_reserves - self_to_sell); 
    proceeds_reserves = t.proceeds_reserves + proceeds_amount
  } in
  let receive_self = env.transfer_self ctxt (Tezos.get_self_address ()) to_ self_to_sell in
  [ receive_self ], t

type collect_proceeds_and_subsidy = { to_: address }

let collect_proceeds_and_subsidy
    (t : t)
    (ctxt : Context.t)
    (env : environment)
    ({ to_ } : collect_proceeds_and_subsidy)
    : t with_operations =
  let owner = Tezos.get_sender () in
  let liquidity_owner = find_liquidity_owner t owner in
  (* compute withdrawable amount of proceeds *)
  let share_of_proceeds = redeem_amount
    liquidity_owner.liquidity_shares
    t.proceeds_reserves
    t.total_liquidity_shares
  in
  let amount_proceeds_withdrawn = clamp_nat (share_of_proceeds - liquidity_owner.proceeds_owed) in
  (* compute withdrawable amount of subsidy *)
  let share_of_subsidy = redeem_amount
    liquidity_owner.liquidity_shares
    t.subsidy_reserves
    t.total_liquidity_shares
  in
  let amount_subsidy_withdrawn = clamp_nat (share_of_subsidy - liquidity_owner.subsidy_owed) in
  let t = set_liquidity_owner t owner { 
    liquidity_owner with
    proceeds_owed = share_of_proceeds;
    subsidy_owed = share_of_subsidy;
  }
  in
  let ops = [] in
  let ops = if (amount_subsidy_withdrawn > 0n) then Context.transfer_ctez ctxt (Tezos.get_self_address ()) to_ amount_subsidy_withdrawn :: ops else ops in
  let ops = if (amount_proceeds_withdrawn > 0n) then env.transfer_proceeds ctxt to_ amount_proceeds_withdrawn :: ops else ops in
  ops, t
