;; withdrawal-escrow - Optimistic verification for Satsu privacy pool withdrawals
;;
;; This contract solves the hash bridge problem: the STARK prover uses
;; Rescue-Prime hash internally while the on-chain Merkle tree uses SHA-256.
;; A malicious prover could forge proofs that pass on-chain verification but
;; correspond to invalid off-chain computations.
;;
;; Instead of synchronous on-chain proof verification, we use an optimistic
;; pattern inspired by optimistic rollups:
;;
;;   1. Submitter posts withdrawal request + proof hash + bond
;;   2. Challenge period (144 blocks, ~24 hours) begins
;;   3. Anyone can challenge during the period (requires matching bond)
;;   4. After the period expires without challenge, withdrawal executes
;;   5. Off-chain watchers verify the full STARK proof + SHA-256 Merkle binding
;;
;; If a watcher detects an invalid proof, they challenge the withdrawal.
;; The contract owner (v1; future: DAO/multisig) resolves the dispute.
;; Invalid proofs get the submitter slashed; frivolous challenges get the
;; challenger slashed.
;;
;; Error code range: 7000s
;;
;; Author: Satsu team

;; ============================================================================
;; Constants
;; ============================================================================

(define-constant CONTRACT-OWNER tx-sender)

;; Challenge period: 144 blocks (~24 hours on Stacks)
(define-constant CHALLENGE-PERIOD u144)

;; Minimum bond in micro-sBTC (0.001 sBTC)
(define-constant MIN-BOND u100000)

;; Pool denomination must match pool-v1 (0.1 sBTC = 10,000,000 satoshis)
(define-constant POOL-DENOMINATION u10000000)

;; Error codes (7000s range - withdrawal-escrow module)
(define-constant ERR-NOT-AUTHORIZED (err u7001))
(define-constant ERR-INVALID-WITHDRAWAL (err u7002))
(define-constant ERR-ALREADY-CHALLENGED (err u7003))
(define-constant ERR-CHALLENGE-PERIOD-ACTIVE (err u7004))
(define-constant ERR-CHALLENGE-PERIOD-EXPIRED (err u7005))
(define-constant ERR-WITHDRAWAL-NOT-FOUND (err u7006))
(define-constant ERR-NULLIFIER-RESERVED (err u7007))
(define-constant ERR-INSUFFICIENT-BOND (err u7008))
(define-constant ERR-ALREADY-FINALIZED (err u7009))
(define-constant ERR-TRANSFER-FAILED (err u7010))

;; ============================================================================
;; State
;; ============================================================================

;; Auto-incrementing withdrawal ID
(define-data-var next-withdrawal-id uint u0)

;; Pending withdrawals indexed by ID
(define-map pending-withdrawals
  { id: uint }
  {
    proof-hash: (buff 32),
    nullifier: (buff 32),
    root: (buff 32),
    recipient: principal,
    ephemeral-pubkey: (buff 33),
    relayer: principal,
    relayer-fee: uint,
    bond: uint,
    submit-block: uint,
    status: (string-ascii 12)
  }
)

;; Track reserved nullifiers to prevent concurrent claims on the same nullifier.
;; A nullifier is reserved when a withdrawal is submitted and released only if
;; the withdrawal is slashed.
(define-map reserved-nullifiers
  { nullifier: (buff 32) }
  { withdrawal-id: uint }
)

;; Challenge records indexed by withdrawal ID
(define-map challenges
  { withdrawal-id: uint }
  {
    challenger: principal,
    challenger-bond: uint,
    challenge-block: uint,
    resolved: bool
  }
)

;; ============================================================================
;; Private helpers
;; ============================================================================

;; Check whether the caller is the contract owner (deployer).
(define-private (is-contract-owner)
  (and (is-eq tx-sender CONTRACT-OWNER) (is-eq contract-caller CONTRACT-OWNER))
)

;; ============================================================================
;; Public functions
;; ============================================================================

;; submit-withdrawal - Post a withdrawal request with a bond
;;
;; The submitter (relayer) locks a bond in sBTC and reserves the nullifier.
;; Off-chain watchers have CHALLENGE-PERIOD blocks to verify the proof and
;; challenge if invalid. After the period, finalize-withdrawal releases funds.
;;
;; Parameters:
;;   proof-hash       - sha256 of the full off-chain proof (for watcher binding)
;;   nullifier        - 32-byte nullifier hash (prevents double-spend)
;;   root             - 32-byte Merkle root the proof was generated against
;;   recipient        - principal to receive the sBTC after finalization
;;   ephemeral-pubkey - 33-byte compressed public key R for stealth detection
;;   relayer-fee      - fee amount deducted for the relayer
;;   bond             - bond amount in sBTC (must be >= MIN-BOND)
;;
;; Returns: { withdrawal-id: uint }
;; Errors:  ERR-INVALID-WITHDRAWAL (u7002) if root is unknown or fee invalid
;;          ERR-NULLIFIER-RESERVED (u7007) if nullifier already reserved or used
;;          ERR-INSUFFICIENT-BOND (u7008) if bond < MIN-BOND
;;          ERR-TRANSFER-FAILED (u7010) if sBTC bond transfer fails
(define-public (submit-withdrawal
    (proof-hash (buff 32))
    (nullifier (buff 32))
    (root (buff 32))
    (recipient principal)
    (ephemeral-pubkey (buff 33))
    (relayer-fee uint)
    (bond uint))
  (let
    (
      (relayer tx-sender)
      (withdrawal-id (var-get next-withdrawal-id))
      (escrow-address (as-contract tx-sender))
    )

    ;; 1. Verify root is a known historical root
    (asserts! (contract-call? .merkle-tree is-known-root root)
              ERR-INVALID-WITHDRAWAL)

    ;; 2. Verify relayer fee is valid (must be less than denomination)
    (asserts! (< relayer-fee POOL-DENOMINATION)
              ERR-INVALID-WITHDRAWAL)

    ;; 3. Verify nullifier is not already used in the nullifier registry
    (asserts! (not (contract-call? .nullifier-registry is-nullifier-used nullifier))
              ERR-NULLIFIER-RESERVED)

    ;; 4. Verify nullifier is not already reserved by another pending withdrawal
    (asserts! (is-none (map-get? reserved-nullifiers { nullifier: nullifier }))
              ERR-NULLIFIER-RESERVED)

    ;; 5. Verify bond meets minimum requirement
    (asserts! (>= bond MIN-BOND) ERR-INSUFFICIENT-BOND)

    ;; 6. Transfer bond from relayer to this contract
    (unwrap! (contract-call? .sbtc-token transfer
               bond
               relayer
               escrow-address
               none)
             ERR-TRANSFER-FAILED)

    ;; 7. Reserve the nullifier
    (map-set reserved-nullifiers
      { nullifier: nullifier }
      { withdrawal-id: withdrawal-id }
    )

    ;; 8. Store the pending withdrawal
    (map-set pending-withdrawals
      { id: withdrawal-id }
      {
        proof-hash: proof-hash,
        nullifier: nullifier,
        root: root,
        recipient: recipient,
        ephemeral-pubkey: ephemeral-pubkey,
        relayer: relayer,
        relayer-fee: relayer-fee,
        bond: bond,
        submit-block: stacks-block-height,
        status: "pending"
      }
    )

    ;; 9. Increment the withdrawal ID counter
    (var-set next-withdrawal-id (+ withdrawal-id u1))

    ;; 10. Emit event for off-chain indexing
    (print {
      event: "withdrawal-submitted",
      withdrawal-id: withdrawal-id,
      proof-hash: proof-hash,
      nullifier: nullifier,
      root: root,
      recipient: recipient,
      relayer: relayer,
      relayer-fee: relayer-fee,
      bond: bond,
      submit-block: stacks-block-height
    })

    ;; 11. Return the withdrawal ID
    (ok { withdrawal-id: withdrawal-id })
  )
)

;; finalize-withdrawal - Execute a withdrawal after the challenge period
;;
;; Anyone can call this after the challenge period expires. The function:
;;   - Marks the nullifier as used in the nullifier registry
;;   - Transfers (denomination - relayer-fee) to the recipient from the pool
;;   - Transfers the relayer fee to the relayer from the pool
;;   - Returns the bond to the relayer
;;   - Updates the withdrawal status to "finalized"
;;
;; Parameters:
;;   withdrawal-id - the ID of the withdrawal to finalize
;;
;; Returns: (ok true)
;; Errors:  ERR-WITHDRAWAL-NOT-FOUND (u7006) if withdrawal does not exist
;;          ERR-ALREADY-FINALIZED (u7009) if not in "pending" status
;;          ERR-CHALLENGE-PERIOD-ACTIVE (u7004) if period has not expired
;;          ERR-TRANSFER-FAILED (u7010) if any sBTC transfer fails
(define-public (finalize-withdrawal (withdrawal-id uint))
  (let
    (
      (withdrawal (unwrap! (map-get? pending-withdrawals { id: withdrawal-id })
                           ERR-WITHDRAWAL-NOT-FOUND))
      (w-status (get status withdrawal))
      (w-submit-block (get submit-block withdrawal))
      (w-nullifier (get nullifier withdrawal))
      (w-recipient (get recipient withdrawal))
      (w-relayer (get relayer withdrawal))
      (w-relayer-fee (get relayer-fee withdrawal))
      (w-bond (get bond withdrawal))
      (recipient-amount (- POOL-DENOMINATION w-relayer-fee))
    )

    ;; 1. Verify withdrawal is still pending (not challenged, finalized, or slashed)
    (asserts! (is-eq w-status "pending") ERR-ALREADY-FINALIZED)

    ;; 2. Verify challenge period has expired
    (asserts! (> stacks-block-height (+ w-submit-block CHALLENGE-PERIOD))
              ERR-CHALLENGE-PERIOD-ACTIVE)

    ;; 3. Mark the nullifier as used in the nullifier registry
    (unwrap! (contract-call? .nullifier-registry mark-used w-nullifier)
             ERR-TRANSFER-FAILED)

    ;; 4. Transfer sBTC from the pool to the recipient
    ;;    The pool-v1 contract holds the deposited funds. We call the pool's
    ;;    underlying token transfer via as-contract on this escrow contract.
    ;;    NOTE: The pool must hold sufficient funds. The escrow does NOT hold
    ;;    pool funds -- it only holds bonds. Pool funds are transferred by
    ;;    pool-v1 directly. For the optimistic path, the pool authorizes
    ;;    this escrow to trigger transfers.
    ;;
    ;;    In v1, the escrow itself must be funded with pool denomination by the
    ;;    submitter (or pre-funded). For simplicity, the finalize transfers
    ;;    from pool-v1 using the pool's as-contract context.
    ;;
    ;;    DESIGN: The escrow contract transfers recipient-amount and relayer-fee
    ;;    from itself. The submit-withdrawal caller must have also transferred
    ;;    POOL-DENOMINATION to this contract (in addition to the bond).
    ;;    However, to keep the interface clean, the pool-v1.withdraw-optimistic
    ;;    function transfers pool funds to the escrow at submission time.

    (unwrap! (as-contract (contract-call? .sbtc-token transfer
               recipient-amount
               tx-sender
               w-recipient
               none))
             ERR-TRANSFER-FAILED)

    ;; 5. Transfer relayer fee if non-zero
    (if (> w-relayer-fee u0)
      (unwrap! (as-contract (contract-call? .sbtc-token transfer
                 w-relayer-fee
                 tx-sender
                 w-relayer
                 none))
               ERR-TRANSFER-FAILED)
      true
    )

    ;; 6. Return bond to the relayer
    (unwrap! (as-contract (contract-call? .sbtc-token transfer
               w-bond
               tx-sender
               w-relayer
               none))
             ERR-TRANSFER-FAILED)

    ;; 7. Update status to "finalized"
    (map-set pending-withdrawals
      { id: withdrawal-id }
      (merge withdrawal { status: "finalized" })
    )

    ;; 8. Emit event
    (print {
      event: "withdrawal-finalized",
      withdrawal-id: withdrawal-id,
      nullifier: w-nullifier,
      recipient: w-recipient,
      relayer: w-relayer,
      relayer-fee: w-relayer-fee,
      recipient-amount: recipient-amount
    })

    (ok true)
  )
)

;; challenge-withdrawal - Challenge a pending withdrawal during the challenge period
;;
;; Any watcher who detects an invalid proof can challenge by posting a bond.
;; The challenge pauses the withdrawal until the contract owner resolves it.
;;
;; Parameters:
;;   withdrawal-id  - the ID of the withdrawal to challenge
;;   challenger-bond - bond amount the challenger is posting (must be >= MIN-BOND)
;;
;; Returns: (ok true)
;; Errors:  ERR-WITHDRAWAL-NOT-FOUND (u7006) if withdrawal does not exist
;;          ERR-ALREADY-CHALLENGED (u7003) if already challenged
;;          ERR-CHALLENGE-PERIOD-EXPIRED (u7005) if challenge period is over
;;          ERR-INSUFFICIENT-BOND (u7008) if challenger bond < MIN-BOND
;;          ERR-TRANSFER-FAILED (u7010) if sBTC transfer fails
(define-public (challenge-withdrawal
    (withdrawal-id uint)
    (challenger-bond uint))
  (let
    (
      (challenger tx-sender)
      (withdrawal (unwrap! (map-get? pending-withdrawals { id: withdrawal-id })
                           ERR-WITHDRAWAL-NOT-FOUND))
      (w-status (get status withdrawal))
      (w-submit-block (get submit-block withdrawal))
      (escrow-address (as-contract tx-sender))
    )

    ;; 1. Verify withdrawal is pending (not already challenged, finalized, or slashed)
    (asserts! (is-eq w-status "pending") ERR-ALREADY-CHALLENGED)

    ;; 2. Verify we are still within the challenge period
    (asserts! (<= stacks-block-height (+ w-submit-block CHALLENGE-PERIOD))
              ERR-CHALLENGE-PERIOD-EXPIRED)

    ;; 3. Verify challenger bond meets minimum
    (asserts! (>= challenger-bond MIN-BOND) ERR-INSUFFICIENT-BOND)

    ;; 4. Transfer challenger bond to this contract
    (unwrap! (contract-call? .sbtc-token transfer
               challenger-bond
               challenger
               escrow-address
               none)
             ERR-TRANSFER-FAILED)

    ;; 5. Update withdrawal status to "challenged"
    (map-set pending-withdrawals
      { id: withdrawal-id }
      (merge withdrawal { status: "challenged" })
    )

    ;; 6. Store challenge info
    (map-set challenges
      { withdrawal-id: withdrawal-id }
      {
        challenger: challenger,
        challenger-bond: challenger-bond,
        challenge-block: stacks-block-height,
        resolved: false
      }
    )

    ;; 7. Emit event
    (print {
      event: "withdrawal-challenged",
      withdrawal-id: withdrawal-id,
      challenger: challenger,
      challenger-bond: challenger-bond,
      challenge-block: stacks-block-height
    })

    (ok true)
  )
)

;; resolve-challenge - Resolve a challenged withdrawal (governance/admin only for v1)
;;
;; The contract owner determines whether the challenge is upheld (proof was
;; invalid) or rejected (proof was valid). In future versions this will be
;; replaced by a DAO or multisig resolution mechanism.
;;
;; Parameters:
;;   withdrawal-id    - the ID of the challenged withdrawal
;;   challenge-upheld - true if the proof was invalid (challenger wins),
;;                      false if the proof was valid (submitter wins)
;;
;; Returns: (ok true)
;; Errors:  ERR-NOT-AUTHORIZED (u7001) if caller is not contract owner
;;          ERR-WITHDRAWAL-NOT-FOUND (u7006) if withdrawal does not exist
;;          ERR-INVALID-WITHDRAWAL (u7002) if withdrawal is not in "challenged" status
;;          ERR-TRANSFER-FAILED (u7010) if sBTC transfer fails
(define-public (resolve-challenge
    (withdrawal-id uint)
    (challenge-upheld bool))
  (let
    (
      (withdrawal (unwrap! (map-get? pending-withdrawals { id: withdrawal-id })
                           ERR-WITHDRAWAL-NOT-FOUND))
      (challenge (unwrap! (map-get? challenges { withdrawal-id: withdrawal-id })
                          ERR-WITHDRAWAL-NOT-FOUND))
      (w-status (get status withdrawal))
      (w-nullifier (get nullifier withdrawal))
      (w-relayer (get relayer withdrawal))
      (w-bond (get bond withdrawal))
      (c-challenger (get challenger challenge))
      (c-bond (get challenger-bond challenge))
    )

    ;; 1. Only contract owner can resolve (v1 governance)
    (asserts! (is-contract-owner) ERR-NOT-AUTHORIZED)

    ;; 2. Verify withdrawal is in "challenged" status
    (asserts! (is-eq w-status "challenged") ERR-INVALID-WITHDRAWAL)

    (if challenge-upheld
      ;; Challenge UPHELD: proof was invalid, submitter gets slashed
      (begin
        ;; Slash submitter bond -> send to challenger
        (unwrap! (as-contract (contract-call? .sbtc-token transfer
                   w-bond
                   tx-sender
                   c-challenger
                   none))
                 ERR-TRANSFER-FAILED)

        ;; Return challenger bond
        (unwrap! (as-contract (contract-call? .sbtc-token transfer
                   c-bond
                   tx-sender
                   c-challenger
                   none))
                 ERR-TRANSFER-FAILED)

        ;; Return pool funds to the contract owner for redistribution.
        ;; The pool denomination was transferred to escrow at submission time
        ;; by pool-v1.withdraw-optimistic. The owner is responsible for
        ;; returning these funds to the pool (or the pool can be re-funded
        ;; via a separate deposit). This avoids a circular dependency between
        ;; the escrow and pool contracts.
        (unwrap! (as-contract (contract-call? .sbtc-token transfer
                   POOL-DENOMINATION
                   tx-sender
                   CONTRACT-OWNER
                   none))
                 ERR-TRANSFER-FAILED)

        ;; Release nullifier reservation
        (map-delete reserved-nullifiers { nullifier: w-nullifier })

        ;; Update withdrawal status to "slashed"
        (map-set pending-withdrawals
          { id: withdrawal-id }
          (merge withdrawal { status: "slashed" })
        )

        ;; Mark challenge as resolved
        (map-set challenges
          { withdrawal-id: withdrawal-id }
          (merge challenge { resolved: true })
        )

        ;; Emit event
        (print {
          event: "challenge-resolved",
          withdrawal-id: withdrawal-id,
          upheld: true,
          slashed-party: w-relayer,
          winner: c-challenger
        })

        (ok true)
      )

      ;; Challenge REJECTED: proof was valid, challenger gets slashed
      (begin
        ;; Slash challenger bond -> send to submitter (relayer)
        (unwrap! (as-contract (contract-call? .sbtc-token transfer
                   c-bond
                   tx-sender
                   w-relayer
                   none))
                 ERR-TRANSFER-FAILED)

        ;; Return submitter bond
        (unwrap! (as-contract (contract-call? .sbtc-token transfer
                   w-bond
                   tx-sender
                   w-relayer
                   none))
                 ERR-TRANSFER-FAILED)

        ;; Mark withdrawal as "pending" again and restart challenge period
        (map-set pending-withdrawals
          { id: withdrawal-id }
          (merge withdrawal {
            status: "pending",
            submit-block: stacks-block-height
          })
        )

        ;; Mark challenge as resolved
        (map-set challenges
          { withdrawal-id: withdrawal-id }
          (merge challenge { resolved: true })
        )

        ;; Emit event
        (print {
          event: "challenge-resolved",
          withdrawal-id: withdrawal-id,
          upheld: false,
          slashed-party: c-challenger,
          winner: w-relayer
        })

        (ok true)
      )
    )
  )
)

;; ============================================================================
;; Read-only functions
;; ============================================================================

;; get-withdrawal - Look up a pending withdrawal by ID
;;
;; Parameters:
;;   withdrawal-id - the withdrawal ID to look up
;;
;; Returns: (optional { ... }) with full withdrawal details, or none
(define-read-only (get-withdrawal (withdrawal-id uint))
  (map-get? pending-withdrawals { id: withdrawal-id })
)

;; get-challenge - Look up a challenge by withdrawal ID
;;
;; Parameters:
;;   withdrawal-id - the withdrawal ID whose challenge to look up
;;
;; Returns: (optional { ... }) with challenge details, or none
(define-read-only (get-challenge (withdrawal-id uint))
  (map-get? challenges { withdrawal-id: withdrawal-id })
)

;; is-nullifier-reserved - Check if a nullifier is reserved by a pending withdrawal
;;
;; Parameters:
;;   nullifier - 32-byte nullifier to check
;;
;; Returns: bool - true if reserved, false otherwise
(define-read-only (is-nullifier-reserved (nullifier (buff 32)))
  (is-some (map-get? reserved-nullifiers { nullifier: nullifier }))
)

;; get-next-withdrawal-id - Return the next withdrawal ID that will be assigned
;;
;; Returns: uint
(define-read-only (get-next-withdrawal-id)
  (var-get next-withdrawal-id)
)
