// Various helpful stdlib extensions for ctez 

type 'a with_operations = operation list * 'a

[@inline]
let clamp_nat (x : int) : nat = 
  match is_nat x with
  | None -> 0n
  | Some x -> x

[@inline]
let min (x : nat) (y : nat) : nat = if x < y then x else y

[@inline]
let ceildiv (numerator : nat) (denominator : nat) : nat = abs ((- numerator) / (int denominator))

module Float48 = struct
  type t = int

  // TODO
end

module List = struct
  include List

  [@inline]
  let append t1 t2 = fold_right (fun (x, tl) -> x :: tl) t1 t2
end