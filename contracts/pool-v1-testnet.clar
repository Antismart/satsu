;; pool-v1-testnet - Testnet variant of the Satsu privacy pool
;;
;; This contract is functionally identical to pool-v1.clar but references
;; the real sBTC token on Stacks testnet instead of the mock .sbtc-token
;; used on devnet.
;;
;; sBTC testnet contract: SN3R84XZYA63QS28932XQF3G1J8R9PC3W8AKR0EP.sbtc-token
;;
;; To update the sBTC address:
;;   1. Find the canonical testnet sBTC contract at https://explorer.hiro.so/?chain=testnet
;;   2. Replace the contract-call? references below
;;   3. Re-run `clarinet check` to verify
;;
;; In a future version, this duplication will be eliminated by using a
;; SIP-010 trait parameter. For now, static contract references in Clarity
;; require per-network variants.
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

;; Fixed deposit denomination: 0.1 sBTC (10,000,000 satoshis)
(define-constant POOL-DENOMINATION u10000000)

;; Error codes (1000s range - pool-v1 module)
(define-constant ERR-INVALID-AMOUNT (err u1002))
(define-constant ERR-NULLIFIER-USED (err u1003))
(define-constant ERR-INVALID-PROOF (err u1004))
(define-constant ERR-INVALID-ROOT (err u1005))
(define-constant ERR-TREE-FULL (err u1006))
(define-constant ERR-TRANSFER-FAILED (err u1007))
(define-constant ERR-DUPLICATE-COMMITMENT (err u1008))
(define-constant ERR-INVALID-COMMITMENT (err u1009))

;; 32-byte zero buffer for commitment validation
(define-constant ZERO-COMMITMENT 0x0000000000000000000000000000000000000000000000000000000000000000)

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
;; Parameters:
;;   commitment - 32-byte Pedersen commitment (hash of secret + nullifier)
;;   source     - principal whose sBTC will be transferred into the pool
;;
;; Returns: { root: (buff 32), leaf-index: uint }
(define-public (deposit (commitment (buff 32)) (source principal))
  (let
    (
      (pool-address (as-contract tx-sender))
    )

    ;; 0. Source validation: the source must be the tx-sender. This prevents
    ;;    an attacker from exploiting a victim's sBTC allowance to force
    ;;    deposits with attacker-controlled commitments, effectively stealing
    ;;    funds. Relayers should use Stacks sponsor transactions instead of
    ;;    a delegated source parameter.
    (asserts! (is-eq source tx-sender) ERR-TRANSFER-FAILED)

    ;; 1. Reject the zero commitment
    (asserts! (not (is-eq commitment ZERO-COMMITMENT)) ERR-INVALID-COMMITMENT)

    ;; 2. Verify commitment has not been used before
    (asserts! (is-none (map-get? deposit-commitments { commitment: commitment }))
              ERR-DUPLICATE-COMMITMENT)

    ;; 3. Transfer POOL-DENOMINATION sBTC from source to this contract
    ;;    NOTE: This calls the REAL sBTC testnet contract
    (unwrap! (contract-call? 'SN3R84XZYA63QS28932XQF3G1J8R9PC3W8AKR0EP.sbtc-token transfer
               POOL-DENOMINATION
               source
               pool-address
               none)
             ERR-TRANSFER-FAILED)

    ;; 4. Append commitment to the Merkle tree
    (let
      (
        (tree-result (unwrap! (contract-call? .merkle-tree append-leaf commitment)
                              ERR-TREE-FULL))
        (new-root (get root tree-result))
        (leaf-index (get leaf-index tree-result))
      )

      ;; 5. Store commitment metadata
      (map-set deposit-commitments
        { commitment: commitment }
        { amount: POOL-DENOMINATION, block-height: stacks-block-height }
      )

      ;; 6. Emit event for off-chain indexing
      (print {
        event: "deposit",
        commitment: commitment,
        root: new-root,
        leaf-index: leaf-index,
        amount: POOL-DENOMINATION,
        source: source
      })

      ;; 7. Return new root and leaf index
      (ok { root: new-root, leaf-index: leaf-index })
    )
  )
)

;; withdraw - Verify a ZK proof and release sBTC from the pool
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
    )

    ;; 0. Validate relayer fee before arithmetic to prevent underflow.
    (asserts! (< relayer-fee POOL-DENOMINATION) ERR-INVALID-AMOUNT)

    (let
      (
        (recipient-amount (- POOL-DENOMINATION relayer-fee))
      )

      ;; 1. Verify root is a known historical root
      (asserts! (contract-call? .merkle-tree is-known-root root) ERR-INVALID-ROOT)

      ;; 2. Verify nullifier has not been used
      (asserts! (not (contract-call? .nullifier-registry is-nullifier-used nullifier))
                ERR-NULLIFIER-USED)

      ;; 3. Verify the ZK proof against public inputs.
      (asserts! (unwrap! (contract-call? .proof-verifier verify-proof
                           proof nullifier root recipient relayer-fee)
                         ERR-INVALID-PROOF)
                ERR-INVALID-PROOF)

      ;; 4. Mark nullifier as used (prevents double-spend)
      (unwrap! (contract-call? .nullifier-registry mark-used nullifier)
               ERR-NULLIFIER-USED)

      ;; 5. Transfer sBTC to recipient (real sBTC testnet contract)
      (unwrap! (as-contract (contract-call? 'SN3R84XZYA63QS28932XQF3G1J8R9PC3W8AKR0EP.sbtc-token transfer
                 recipient-amount
                 tx-sender
                 recipient
                 none))
               ERR-TRANSFER-FAILED)

      ;; 6. Transfer relayer fee if non-zero
      (if (> relayer-fee u0)
        (unwrap! (as-contract (contract-call? 'SN3R84XZYA63QS28932XQF3G1J8R9PC3W8AKR0EP.sbtc-token transfer
                   relayer-fee
                   tx-sender
                   relayer
                   none))
                 ERR-TRANSFER-FAILED)
        true
      )

      ;; 7. Emit event
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
)

;; withdraw-optimistic - Submit a withdrawal through the optimistic escrow
;;
;; Instead of verifying the ZK-STARK proof synchronously on-chain, this path
;; routes through the withdrawal-escrow contract. A bond is posted and the
;; withdrawal enters a challenge period. Off-chain watchers verify the full
;; STARK proof and can challenge invalid submissions.
;;
;; Parameters:
;;   proof-hash       - sha256 of the full off-chain proof
;;   nullifier        - 32-byte nullifier hash (prevents double-spend)
;;   root             - 32-byte Merkle root the proof was generated against
;;   recipient        - principal to receive the sBTC after finalization
;;   ephemeral-pubkey - 33-byte compressed public key R for stealth detection
;;   relayer-fee      - fee amount deducted for the relayer
;;   bond             - bond amount in sBTC (must be >= escrow MIN-BOND)
;;
;; Returns: { withdrawal-id: uint }
(define-public (withdraw-optimistic
    (proof-hash (buff 32))
    (nullifier (buff 32))
    (root (buff 32))
    (recipient principal)
    (ephemeral-pubkey (buff 33))
    (relayer-fee uint)
    (bond uint))
  (begin
    ;; 1. Validate relayer fee
    (asserts! (< relayer-fee POOL-DENOMINATION) ERR-INVALID-AMOUNT)

    ;; 2. Transfer POOL-DENOMINATION from pool to escrow.
    (unwrap! (as-contract (contract-call? 'SN3R84XZYA63QS28932XQF3G1J8R9PC3W8AKR0EP.sbtc-token transfer
               POOL-DENOMINATION
               tx-sender
               .withdrawal-escrow
               none))
             ERR-TRANSFER-FAILED)

    ;; 3. Submit to the escrow contract.
    (let
      (
        (escrow-result
          (unwrap! (contract-call? .withdrawal-escrow submit-withdrawal
                     proof-hash
                     nullifier
                     root
                     recipient
                     ephemeral-pubkey
                     relayer-fee
                     bond)
                   ERR-TRANSFER-FAILED))
      )

      ;; 4. Emit event
      (print {
        event: "optimistic-withdrawal-submitted",
        withdrawal-id: (get withdrawal-id escrow-result),
        nullifier: nullifier,
        recipient: recipient,
        relayer: tx-sender,
        relayer-fee: relayer-fee,
        bond: bond
      })

      (ok { withdrawal-id: (get withdrawal-id escrow-result) })
    )
  )
)

;; ============================================================================
;; Read-only functions
;; ============================================================================

(define-read-only (get-current-root)
  (ok (contract-call? .merkle-tree get-current-root))
)

(define-read-only (is-known-root (root (buff 32)))
  (ok (contract-call? .merkle-tree is-known-root root))
)

(define-read-only (is-nullifier-used (nullifier (buff 32)))
  (ok (contract-call? .nullifier-registry is-nullifier-used nullifier))
)

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
