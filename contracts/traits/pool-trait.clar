;; pool-trait - Interface trait for the Satsu privacy pool contract
;; Any pool implementation (v1, v2, etc.) must conform to this trait.

(define-trait pool-trait
  (
    ;; Deposit sBTC into the pool with a commitment
    ;; Parameters: commitment (buff 32), source principal
    ;; Returns: new Merkle root and the leaf index
    (deposit ((buff 32) principal) (response { root: (buff 32), leaf-index: uint } uint))

    ;; Withdraw from the pool with a ZK proof
    ;; Parameters: proof, nullifier, root, recipient, ephemeral-pubkey, relayer-fee
    ;; Returns: the nullifier that was spent
    (withdraw ((buff 2048) (buff 32) (buff 32) principal (buff 33) uint) (response { nullifier: (buff 32) } uint))

    ;; Get the current Merkle root
    (get-current-root () (response (buff 32) uint))

    ;; Check if a Merkle root is known/valid
    (is-known-root ((buff 32)) (response bool uint))

    ;; Check if a nullifier has been used
    (is-nullifier-used ((buff 32)) (response bool uint))
  )
)
