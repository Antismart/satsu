;; pool-v1 - Core privacy pool contract for Satsu
;;
;; This contract integrates the Merkle tree, nullifier registry, sBTC token,
;; and proof verifier into a complete deposit-withdraw privacy pool.
;;
;; Deposits: A user sends a fixed denomination of sBTC along with a Pedersen
;; commitment. The commitment is appended to an incremental Merkle tree. The
;; user receives a proof-of-inclusion that they can later use to withdraw.
;;
;; Withdrawals: A user presents a ZK-STARK proof that they know a secret
;; corresponding to a commitment in the tree, along with a nullifier that
;; prevents double-spending. The proof is verified on-chain and the sBTC is
;; released to a recipient address.
;;
;; The fixed denomination (0.1 sBTC) ensures that all deposits look identical,
;; breaking the link between deposit and withdrawal amounts.
;;
;; Error code range: 1000s
;;
;; Author: Satsu team

;; ============================================================================
;; Trait implementation
;; ============================================================================

(impl-trait .pool-trait.pool-trait)

;; ============================================================================
;; Constants
;; ============================================================================

(define-constant CONTRACT-OWNER tx-sender)

;; Fixed deposit denomination: 0.1 sBTC (10,000,000 satoshis)
(define-constant POOL-DENOMINATION u10000000)

;; Error codes (1000s range - pool-v1 module)
(define-constant ERR-NOT-AUTHORIZED (err u1001))
(define-constant ERR-INVALID-AMOUNT (err u1002))
(define-constant ERR-NULLIFIER-USED (err u1003))
(define-constant ERR-INVALID-PROOF (err u1004))
(define-constant ERR-INVALID-ROOT (err u1005))
(define-constant ERR-TREE-FULL (err u1006))
(define-constant ERR-TRANSFER-FAILED (err u1007))
(define-constant ERR-DUPLICATE-COMMITMENT (err u1008))

;; ============================================================================
;; State
;; ============================================================================

;; Tracks deposit commitments to prevent duplicates and store metadata
(define-map deposit-commitments
  { commitment: (buff 32) }
  { amount: uint, block-height: uint }
)

;; ============================================================================
;; Public functions
;; ============================================================================

;; deposit - Accept sBTC and a commitment into the privacy pool
;;
;; The caller may be a relayer performing a delegated deposit on behalf of
;; the source principal. The source must have pre-approved this contract
;; for the transfer amount via the sBTC allowance mechanism.
;;
;; Parameters:
;;   commitment - 32-byte Pedersen commitment (hash of secret + nullifier)
;;   source     - principal whose sBTC will be transferred into the pool
;;
;; Returns: { root: (buff 32), leaf-index: uint }
;; Errors:  ERR-DUPLICATE-COMMITMENT (u1008) if commitment already exists
;;          ERR-TRANSFER-FAILED (u1007) if sBTC transfer fails
;;          ERR-TREE-FULL (u1006) if the Merkle tree is at capacity
(define-public (deposit (commitment (buff 32)) (source principal))
  (let
    (
      (pool-address (as-contract tx-sender))
    )

    ;; 1. Verify commitment has not been used before
    (asserts! (is-none (map-get? deposit-commitments { commitment: commitment }))
              ERR-DUPLICATE-COMMITMENT)

    ;; 2. Transfer POOL-DENOMINATION sBTC from source to this contract
    (unwrap! (contract-call? .sbtc-token transfer
               POOL-DENOMINATION
               source
               pool-address
               none)
             ERR-TRANSFER-FAILED)

    ;; 3. Append commitment to the Merkle tree
    (let
      (
        (tree-result (unwrap! (contract-call? .merkle-tree append-leaf commitment)
                              ERR-TREE-FULL))
        (new-root (get root tree-result))
        (leaf-index (get leaf-index tree-result))
      )

      ;; 4. Store commitment metadata
      (map-set deposit-commitments
        { commitment: commitment }
        { amount: POOL-DENOMINATION, block-height: stacks-block-height }
      )

      ;; 5. Emit event for off-chain indexing
      (print {
        event: "deposit",
        commitment: commitment,
        root: new-root,
        leaf-index: leaf-index,
        amount: POOL-DENOMINATION,
        source: source
      })

      ;; 6. Return new root and leaf index
      (ok { root: new-root, leaf-index: leaf-index })
    )
  )
)

;; withdraw - Verify a ZK proof and release sBTC from the pool
;;
;; The caller is typically a relayer who submits the proof on behalf of the
;; withdrawer. The relayer receives a fee deducted from the withdrawal
;; amount. The remainder goes to the specified recipient (stealth address).
;;
;; Parameters:
;;   proof           - serialized STARK proof (up to 2048 bytes)
;;   nullifier       - 32-byte nullifier hash (prevents double-spend)
;;   root            - 32-byte Merkle root the proof was generated against
;;   recipient       - principal to receive the sBTC
;;   ephemeral-pubkey - 33-byte compressed public key R for stealth detection
;;   relayer-fee     - fee amount deducted for the relayer (tx-sender)
;;
;; Returns: { nullifier: (buff 32) }
;; Errors:  ERR-INVALID-ROOT (u1005) if root is not a known historical root
;;          ERR-NULLIFIER-USED (u1003) if nullifier was already spent
;;          ERR-INVALID-PROOF (u1004) if the ZK proof fails verification
;;          ERR-INVALID-AMOUNT (u1002) if relayer-fee exceeds denomination
;;          ERR-TRANSFER-FAILED (u1007) if sBTC transfer fails
(define-public (withdraw
    (proof (buff 2048))
    (nullifier (buff 32))
    (root (buff 32))
    (recipient principal)
    (ephemeral-pubkey (buff 33))
    (relayer-fee uint))
  (let
    (
      (relayer tx-sender)
      (recipient-amount (- POOL-DENOMINATION relayer-fee))
    )

    ;; 0. Sanity check: relayer fee must not exceed the denomination
    (asserts! (<= relayer-fee POOL-DENOMINATION) ERR-INVALID-AMOUNT)

    ;; 1. Verify root is a known historical root
    (asserts! (contract-call? .merkle-tree is-known-root root) ERR-INVALID-ROOT)

    ;; 2. Verify nullifier has not been used
    (asserts! (not (contract-call? .nullifier-registry is-nullifier-used nullifier))
              ERR-NULLIFIER-USED)

    ;; 3. Verify the ZK proof against public inputs
    (asserts! (unwrap! (contract-call? .proof-verifier verify-proof
                         proof nullifier root recipient relayer-fee)
                       ERR-INVALID-PROOF)
              ERR-INVALID-PROOF)

    ;; 4. Mark nullifier as used (prevents double-spend)
    (unwrap! (contract-call? .nullifier-registry mark-used nullifier)
             ERR-NULLIFIER-USED)

    ;; 5. Transfer sBTC from this contract to the recipient
    (unwrap! (as-contract (contract-call? .sbtc-token transfer
               recipient-amount
               tx-sender
               recipient
               none))
             ERR-TRANSFER-FAILED)

    ;; 6. Transfer relayer fee if non-zero
    (if (> relayer-fee u0)
      (unwrap! (as-contract (contract-call? .sbtc-token transfer
                 relayer-fee
                 tx-sender
                 relayer
                 none))
               ERR-TRANSFER-FAILED)
      true
    )

    ;; 7. Emit event for off-chain indexing
    (print {
      event: "withdrawal",
      nullifier: nullifier,
      recipient: recipient,
      ephemeral-pubkey: ephemeral-pubkey,
      relayer: relayer,
      relayer-fee: relayer-fee,
      amount: recipient-amount
    })

    ;; 8. Return the spent nullifier
    (ok { nullifier: nullifier })
  )
)

;; ============================================================================
;; Read-only functions
;; ============================================================================

;; get-current-root - Returns the current Merkle tree root
(define-read-only (get-current-root)
  (ok (contract-call? .merkle-tree get-current-root))
)

;; is-known-root - Check if a root was ever a valid tree root
(define-read-only (is-known-root (root (buff 32)))
  (ok (contract-call? .merkle-tree is-known-root root))
)

;; is-nullifier-used - Check if a nullifier has been spent
(define-read-only (is-nullifier-used (nullifier (buff 32)))
  (ok (contract-call? .nullifier-registry is-nullifier-used nullifier))
)

;; get-pool-denomination - Returns the fixed deposit denomination
(define-read-only (get-pool-denomination)
  POOL-DENOMINATION
)

;; get-deposit-info - Look up metadata for a deposit commitment
;;
;; Parameters:
;;   commitment - 32-byte commitment to look up
;;
;; Returns: (optional { amount: uint, block-height: uint })
(define-read-only (get-deposit-info (commitment (buff 32)))
  (map-get? deposit-commitments { commitment: commitment })
)
