#import "errors.mligo" "Errors"
#include "stdctez.mligo"
#include "oven_types.mligo"

let originate_oven (delegate : key_hash option) (amnt : tez) (storage : oven_storage) = Tezos.Next.Operation.create_contract
	(* Contract code for an oven *)
	(fun (p : oven_parameter) (s : oven_storage) -> (
	    (match p with
	    (* Withdraw form the oven, can only be called from the main contract. *)
	    | Oven_withdraw x ->
			if Tezos.get_sender () <> s.admin then
				(failwith Errors.only_main_contract_can_call : oven_result)
			else
				([Tezos.Next.Operation.transaction unit x.0 x.1], s)
	    (* Change delegation *)
	    | Oven_delegate ko ->
			let () = assert_no_tez_in_transaction() in
			if Tezos.get_sender () <> s.handle.owner then
				(failwith Errors.only_owner_can_call : oven_result)
			else 
				([Tezos.Next.Operation.set_delegate ko], s)
		(* Make a deposit. If authorized, this will notify the main contract. *)
	    | Oven_deposit ->
			if Tezos.get_sender () = s.handle.owner or (
			    match s.depositors with
				| Any -> true
				| Whitelist depositors -> Set.mem (Tezos.get_sender ()) depositors
			) then
			    let register = (
				match (Tezos.get_entrypoint_opt "%register_oven_deposit" s.admin : (register_oven_deposit contract) option) with
					| None -> (failwith Errors.missing_deposit_entrypoint : register_oven_deposit contract)
					| Some register -> register) in
			    (([ Tezos.Next.Operation.transaction {amount = Tezos.get_amount () ; handle = s.handle} 0mutez register] : operation list), s)
			else
			    (failwith Errors.unauthorized_depositor : oven_result)
	    (* Edit the set of authorized depositors. *)
	    | Oven_edit_depositor edit ->
			let () = assert_no_tez_in_transaction() in
			if Tezos.get_sender () <> s.handle.owner then
			    (failwith Errors.only_owner_can_call : oven_result)
			else
			    let depositors = (match edit with
				| Allow_any allow -> if allow then Any else Whitelist (Set.empty : address set)
				| Allow_account x -> let (allow, depositor) = x in (match s.depositors with
				    | Any -> (failwith Errors.set_any_off_first : depositors)
				    | Whitelist depositors -> Whitelist (
					if allow then Set.add depositor depositors else Set.remove depositor depositors))) in
			    (([] : operation list), {s with depositors = depositors})))
	)
	(* End of contract code for an oven *)
	delegate amnt storage
