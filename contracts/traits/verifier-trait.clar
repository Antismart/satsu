;; verifier-trait - Interface trait for ZK proof verification
;; Allows swapping between mock verifier (testing) and real STARK verifier.

(define-trait verifier-trait
  (
    ;; Verify a STARK proof against public inputs
    ;; Parameters: proof, nullifier, root, recipient, relayer-fee
    ;; Returns: (ok true) if valid, error if invalid
    (verify-proof ((buff 2048) (buff 32) (buff 32) principal uint) (response bool uint))
  )
)
