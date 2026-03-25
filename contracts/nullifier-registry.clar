;; nullifier-registry - Nullifier storage for double-spend prevention
;;
;; This contract is the single source of truth for which nullifiers have been
;; used across all pool versions. It is deliberately separated from the pool
;; contract so that a pool upgrade (e.g., pool-v2) can point to the same
;; nullifier set, preventing cross-version double-spends.
;;
;; Only the authorized pool contract (or the deployer during setup) may mark
;; a nullifier as used. Read-only queries are open to any caller.
;;
;; Error code range: 4000s
;;
;; Author: Satsu team

;; ============================================================================
;; Constants
;; ============================================================================

(define-constant CONTRACT-OWNER tx-sender)

;; 32-byte zero buffer for validation
(define-constant ZERO-NULLIFIER 0x0000000000000000000000000000000000000000000000000000000000000000)

;; Error codes (4000s range - nullifier-registry module)
(define-constant ERR-NOT-AUTHORIZED (err u4001))
(define-constant ERR-NULLIFIER-USED (err u4002))
(define-constant ERR-INVALID-NULLIFIER (err u4003))

;; ============================================================================
;; State
;; ============================================================================

;; The contract principal that is authorized to mark nullifiers as used.
;; Initially set to the deployer; should be updated to the pool contract
;; address after deployment via set-authorized-contract.
(define-data-var authorized-contract principal tx-sender)

;; Map of nullifiers that have been spent.
;; Key: the 32-byte nullifier hash revealed during withdrawal.
;; Value: usage flag and the block height at which it was marked.
(define-map used-nullifiers
  { nullifier: (buff 32) }
  { used: bool, block-height: uint }
)

;; ============================================================================
;; Authorization helpers
;; ============================================================================

;; Check whether the caller is the contract owner (deployer).
(define-private (is-contract-owner)
  (is-eq tx-sender CONTRACT-OWNER)
)

;; Check whether the caller is the authorized pool contract or the deployer.
;; contract-caller is used so that inter-contract calls from the pool are
;; correctly recognized.
(define-private (is-authorized-caller)
  (or
    (is-eq contract-caller (var-get authorized-contract))
    (is-eq contract-caller CONTRACT-OWNER)
  )
)

;; ============================================================================
;; Public functions
;; ============================================================================

;; mark-used - Record a nullifier as spent.
;;
;; Parameters:
;;   nullifier: 32-byte hash revealed by the withdrawer
;;
;; Preconditions:
;;   - Caller must be the authorized pool contract or the deployer
;;   - Nullifier must not be all zeros
;;   - Nullifier must not already be marked as used
;;
;; Returns: (ok true)
;; Errors: ERR-NOT-AUTHORIZED (u4001), ERR-INVALID-NULLIFIER (u4003),
;;         ERR-NULLIFIER-USED (u4002)
(define-public (mark-used (nullifier (buff 32)))
  (begin
    ;; Only the authorized contract or deployer can mark nullifiers
    (asserts! (is-authorized-caller) ERR-NOT-AUTHORIZED)

    ;; Reject the zero nullifier - it is reserved / invalid
    (asserts! (not (is-eq nullifier ZERO-NULLIFIER)) ERR-INVALID-NULLIFIER)

    ;; Reject if this nullifier has already been spent
    (asserts! (not (is-nullifier-used nullifier)) ERR-NULLIFIER-USED)

    ;; Record the nullifier with the current block height
    (map-set used-nullifiers
      { nullifier: nullifier }
      { used: true, block-height: stacks-block-height }
    )

    ;; Emit an event for off-chain indexers (scanner, explorer)
    (print {
      event: "nullifier-used",
      nullifier: nullifier,
      block-height: stacks-block-height
    })

    (ok true)
  )
)

;; set-authorized-contract - Update the contract principal that may mark
;; nullifiers as used. This enables pool upgrades: deploy pool-v2, then
;; point the nullifier registry to the new pool.
;;
;; Parameters:
;;   new-contract: the principal of the pool contract to authorize
;;
;; Preconditions:
;;   - Caller must be the contract owner (deployer)
;;
;; Returns: (ok true)
;; Errors: ERR-NOT-AUTHORIZED (u4001)
(define-public (set-authorized-contract (new-contract principal))
  (begin
    (asserts! (is-contract-owner) ERR-NOT-AUTHORIZED)
    (var-set authorized-contract new-contract)

    (print {
      event: "authorized-contract-updated",
      new-contract: new-contract
    })

    (ok true)
  )
)

;; ============================================================================
;; Read-only functions
;; ============================================================================

;; is-nullifier-used - Check whether a nullifier has been spent.
;;
;; Parameters:
;;   nullifier: 32-byte hash to check
;;
;; Returns: bool - true if the nullifier has been used, false otherwise
(define-read-only (is-nullifier-used (nullifier (buff 32)))
  (default-to false
    (get used (map-get? used-nullifiers { nullifier: nullifier }))
  )
)

;; get-nullifier-info - Retrieve full metadata for a nullifier.
;;
;; Parameters:
;;   nullifier: 32-byte hash to look up
;;
;; Returns: (optional { used: bool, block-height: uint })
;;          none if the nullifier has never been recorded
(define-read-only (get-nullifier-info (nullifier (buff 32)))
  (map-get? used-nullifiers { nullifier: nullifier })
)

;; get-authorized-contract - Return the currently authorized pool contract.
;;
;; Returns: principal
(define-read-only (get-authorized-contract)
  (var-get authorized-contract)
)
