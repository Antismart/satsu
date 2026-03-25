;; proof-verifier - STARK proof verification for the Satsu privacy pool
;;
;; This is a MOCK verifier that always returns (ok true). It implements the
;; verifier-trait interface so that pool-v1 can call it uniformly. In a
;; production deployment this contract would be replaced with a real STARK
;; verifier that checks FRI consistency, Merkle authentication paths, and
;; constraint evaluations on-chain.
;;
;; The mock allows end-to-end testing of the deposit-withdraw flow without
;; requiring actual proof generation.
;;
;; Error code range: 6000s
;;
;; Author: Satsu team

;; ============================================================================
;; Trait implementation
;; ============================================================================

(impl-trait .verifier-trait.verifier-trait)

;; ============================================================================
;; Constants
;; ============================================================================

;; Error codes (6000s range - proof-verifier module)
(define-constant ERR-INVALID-PROOF (err u6001))
(define-constant ERR-INVALID-PROOF-LENGTH (err u6002))
(define-constant ERR-DESERIALIZATION-FAILED (err u6003))
(define-constant ERR-FRI-VERIFICATION-FAILED (err u6004))
(define-constant ERR-CONSTRAINT-CHECK-FAILED (err u6005))
(define-constant ERR-MERKLE-AUTH-FAILED (err u6006))

;; ============================================================================
;; Public functions
;; ============================================================================

;; verify-proof - Verify a STARK proof against public inputs
;;
;; In this mock version the function always returns (ok true). A real
;; implementation would:
;;   1. Deserialize the proof buffer into FRI layer commitments,
;;      authentication paths, and evaluation claims
;;   2. Recompute Fiat-Shamir challenge values from the transcript
;;   3. Verify Merkle authentication paths for each query
;;   4. Check constraint polynomial evaluations at query points
;;   5. Verify FRI layer consistency (folding checks)
;;
;; Parameters:
;;   proof          - serialized STARK proof (up to 2048 bytes)
;;   nullifier      - 32-byte nullifier hash (public input)
;;   root           - 32-byte Merkle root (public input)
;;   recipient      - principal receiving the withdrawal (public input)
;;   relayer-fee    - fee amount for the relayer (public input)
;;
;; Returns: (ok true) if the proof is valid
;; Errors:  ERR-INVALID-PROOF (u6001) if verification fails
(define-public (verify-proof
    (proof (buff 2048))
    (nullifier (buff 32))
    (root (buff 32))
    (recipient principal)
    (relayer-fee uint))
  (ok true)
)
