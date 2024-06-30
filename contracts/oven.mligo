#include "common/stdctez.mligo"
#import "common/errors.mligo" "Errors"

type edit =
  | Allow_any of bool
  | Allow_account of bool * address

type entrypoint =
  | Delegate of (key_hash option)
  | [@annot:default] Deposit
  | Edit_depositor of edit
  | Withdraw of tez * (unit contract)

type depositors =
  | Any
  | Whitelist of address set

type handle = {
	id : nat; 
	owner : address;
}

type register_deposit = { 
  handle : handle; 
  amount : tez;
}

type storage = {
  admin : address (* vault admin contract *) ;
  handle : handle (* owner of the oven *) ;
  depositors : depositors (* who can deposit in the oven *) ;
}

type result = storage with_operations

[@inline]
let assert_sender_is
    (expected_sender : address)
    (error : string)
    : unit =
  Assert.Error.assert (Tezos.get_sender() = expected_sender) error

[@inline]
let assert_depositor_authorized
    (owner : address)
    (depositors : depositors)
    : unit =
  let is_authorized = Tezos.get_sender () = owner or (
    match depositors with
      | Any -> true
      | Whitelist depositors -> Set.mem (Tezos.get_sender ()) depositors
  ) in
  Assert.Error.assert is_authorized Errors.unauthorized_depositor

let originate_oven (delegate : key_hash option) (amount : tez) (storage : storage) = Tezos.Next.Operation.create_contract
	(* Contract code for an oven *)
	(fun (p : entrypoint) (s : storage) -> (
	    (match p with
	      (* Withdraw form the oven, can only be called from the main contract. *)
	      | Withdraw x ->
          let () = assert_sender_is s.admin Errors.only_main_contract_can_call in 
				  ([Tezos.Next.Operation.transaction unit x.0 x.1], s)
	      
        (* Change delegation *)
	      | Delegate ko ->
			    let () = assert_no_tez_in_transaction() in
          let () = assert_sender_is s.handle.owner Errors.only_owner_can_call in 
          ([Tezos.Next.Operation.set_delegate ko], s)
		
        (* Make a deposit. If authorized, this will notify the main contract. *)
        | Deposit ->
          let () = assert_depositor_authorized s.handle.owner s.depositors in
          let register = (
            match (Tezos.get_entrypoint_opt "%register_oven_deposit" s.admin : (register_deposit contract) option) with
              | None -> (failwith Errors.missing_deposit_entrypoint : register_deposit contract)
              | Some register -> register) in
          (([ Tezos.Next.Operation.transaction {amount = Tezos.get_amount () ; handle = s.handle} 0mutez register] : operation list), s)
      
        (* Edit the set of authorized depositors. *)
        | Edit_depositor edit ->
          let () = assert_no_tez_in_transaction() in
          let () = assert_sender_is s.handle.owner Errors.only_owner_can_call in 
          let depositors = (match edit with
            | Allow_any allow -> if allow then Any else Whitelist (Set.empty : address set)
            | Allow_account x -> let (allow, depositor) = x in (match s.depositors with
              | Any -> (failwith Errors.set_any_off_first : depositors)
              | Whitelist depositors -> Whitelist (
            if allow then Set.add depositor depositors else Set.remove depositor depositors))) in
          (([] : operation list), { s with depositors })))
	)
	(* End of contract code for an oven *)
	delegate amount storage
