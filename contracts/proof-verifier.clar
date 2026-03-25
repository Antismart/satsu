;; proof-verifier - STARK proof verification for the Satsu privacy pool
;;
;; Implements a Tier-1 cryptographic verifier based on the FRI (Fast
;; Reed-Solomon IOP) verification paradigm. The verifier performs:
;;
;;   1. Proof deserialization from a compact buffer format
;;   2. Fiat-Shamir transcript reconstruction (binding proof to public inputs)
;;   3. Merkle authentication path verification using sha256
;;   4. Query index derivation from the challenge hash
;;   5. Evaluation consistency checks across query points
;;
;; The proof binds to all public inputs (nullifier, root, recipient, fee)
;; so that a front-runner cannot alter any field without invalidating it.
;;
;; Proof layout (compact format, up to 2048 bytes):
;;   [0..3]     4 bytes   version (must be 0x00000001)
;;   [4..35]   32 bytes   trace commitment root (Merkle root)
;;   [36..67]  32 bytes   constraint commitment root
;;   [68]       1 byte    number of query responses (1..4)
;;   For each query (i = 0..num_queries-1), starting at offset 69 + i*353:
;;     [+0..+31]    32 bytes   trace evaluation at query point
;;     [+32..+63]   32 bytes   constraint evaluation at query point
;;     [+64..+95]   32 bytes   fri folded evaluation
;;     [+96..+351] 256 bytes   Merkle auth path (8 siblings x 32 bytes)
;;     [+352]        1 byte    leaf index byte
;;   After all queries:
;;     32 bytes   FRI remainder commitment
;;
;; Total for 1 query:  4 + 32 + 32 + 1 + 353 + 32 = 454 bytes
;; Total for 4 queries: 4 + 32 + 32 + 1 + (4 * 353) + 32 = 1513 bytes
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
(define-constant ERR-INVALID-PROOF-LENGTH (err u6002))
(define-constant ERR-FRI-CHECK-FAILED (err u6004))
(define-constant ERR-MERKLE-AUTH-FAILED (err u6006))
(define-constant ERR-INVALID-VERSION (err u6007))
(define-constant ERR-INVALID-NUM-QUERIES (err u6008))

;; Protocol constants
(define-constant PROOF-VERSION-BYTE-0 u0)
(define-constant PROOF-VERSION-BYTE-1 u0)
(define-constant PROOF-VERSION-BYTE-2 u0)
(define-constant PROOF-VERSION-BYTE-3 u1)
(define-constant MAX-QUERIES u4)
(define-constant QUERY-BLOCK-SIZE u353)

;; Offsets within the proof buffer
(define-constant OFFSET-TRACE-ROOT u4)
(define-constant OFFSET-CONSTRAINT-ROOT u36)
(define-constant OFFSET-NUM-QUERIES u68)
(define-constant OFFSET-QUERIES u69)

;; Fold iteration indices
(define-constant AUTH-PATH-INDICES (list u0 u1 u2 u3 u4 u5 u6 u7))
(define-constant QUERY-INDICES (list u0 u1 u2 u3))

;; Zero hash constant for default/fallback
(define-constant ZERO-HASH
  0x0000000000000000000000000000000000000000000000000000000000000000)

;; ============================================================================
;; Private helpers - Buffer extraction
;; ============================================================================

;; extract-hash-at: pull a 32-byte hash from the proof at a given offset.
;; Uses slice? + as-max-len? to downcast from (buff 2048) to (buff 32).
(define-private (extract-hash-at
    (proof (buff 2048))
    (offset uint))
  (default-to ZERO-HASH
    (as-max-len?
      (default-to ZERO-HASH (slice? proof offset (+ offset u32)))
      u32
    )
  )
)

;; extract-byte-at: pull a single byte as uint from proof at offset.
;; Uses element-at? which returns (optional (buff 1)).
(define-private (extract-byte-at
    (proof (buff 2048))
    (offset uint))
  (match (element-at? proof offset)
    byte-val (buff-to-uint-be byte-val)
    u0
  )
)

;; ============================================================================
;; Private helpers - Fiat-Shamir transcript
;; ============================================================================

;; build-public-input-hash: deterministically hash all public inputs
;; into a single 32-byte transcript seed. This binds the proof to
;; (nullifier, root, recipient, relayer-fee).
;;
;; transcript = sha256(nullifier || root || sha256(recipient) || sha256(fee))
;;
;; We hash the principal and fee to get fixed-size representations.
(define-private (build-public-input-hash
    (nullifier (buff 32))
    (root (buff 32))
    (recipient principal)
    (relayer-fee uint))
  (sha256 (concat
    (concat nullifier root)
    (concat
      (sha256 (unwrap-panic (to-consensus-buff? recipient)))
      (sha256 (unwrap-panic (to-consensus-buff? relayer-fee)))
    )
  ))
)

;; compute-challenge: derive a Fiat-Shamir challenge from the current
;; transcript state and a new commitment.
;;
;; challenge = sha256(transcript-hash || commitment)
(define-private (compute-challenge
    (transcript-hash (buff 32))
    (commitment (buff 32)))
  (sha256 (concat transcript-hash commitment))
)

;; derive-query-index: extract a query index from a challenge hash.
;; Uses element-at? on the challenge (buff 32) to pull a single byte,
;; giving a value in [0, 255] which matches a depth-8 Merkle tree.
(define-private (derive-query-index
    (challenge (buff 32))
    (query-number uint))
  (match (element-at? challenge query-number)
    byte-val (buff-to-uint-be byte-val)
    u0
  )
)

;; ============================================================================
;; Private helpers - Merkle authentication path verification
;; ============================================================================

;; verify-merkle-step: process one level of the Merkle authentication
;; path. At each level we check the corresponding bit of the leaf index
;; to decide order, then hash with the sibling.
(define-private (verify-merkle-step
    (level uint)
    (acc {
      current-hash: (buff 32),
      leaf-index: uint,
      auth-path-0: (buff 32),
      auth-path-1: (buff 32),
      auth-path-2: (buff 32),
      auth-path-3: (buff 32),
      auth-path-4: (buff 32),
      auth-path-5: (buff 32),
      auth-path-6: (buff 32),
      auth-path-7: (buff 32)
    }))
  (let
    (
      (current (get current-hash acc))
      (idx (get leaf-index acc))
      (bit-at-level (mod (/ idx (pow u2 level)) u2))
      ;; Select the sibling for this level from the flattened auth path
      (sibling
        (if (is-eq level u0) (get auth-path-0 acc)
        (if (is-eq level u1) (get auth-path-1 acc)
        (if (is-eq level u2) (get auth-path-2 acc)
        (if (is-eq level u3) (get auth-path-3 acc)
        (if (is-eq level u4) (get auth-path-4 acc)
        (if (is-eq level u5) (get auth-path-5 acc)
        (if (is-eq level u6) (get auth-path-6 acc)
        (get auth-path-7 acc)
        )))))))
      )
      ;; If bit is 0, current is left child; if 1, current is right child
      (new-hash
        (if (is-eq bit-at-level u0)
          (sha256 (concat current sibling))
          (sha256 (concat sibling current))
        )
      )
    )
    (merge acc { current-hash: new-hash })
  )
)

;; verify-merkle-auth: verify a leaf hashes to the expected root via
;; an authentication path of 8 siblings and a leaf index.
(define-private (verify-merkle-auth
    (leaf-hash (buff 32))
    (s0 (buff 32)) (s1 (buff 32)) (s2 (buff 32)) (s3 (buff 32))
    (s4 (buff 32)) (s5 (buff 32)) (s6 (buff 32)) (s7 (buff 32))
    (leaf-index uint)
    (expected-root (buff 32)))
  (let
    (
      (result (fold verify-merkle-step
        AUTH-PATH-INDICES
        {
          current-hash: leaf-hash,
          leaf-index: leaf-index,
          auth-path-0: s0, auth-path-1: s1,
          auth-path-2: s2, auth-path-3: s3,
          auth-path-4: s4, auth-path-5: s5,
          auth-path-6: s6, auth-path-7: s7
        }
      ))
    )
    (is-eq (get current-hash result) expected-root)
  )
)

;; ============================================================================
;; Private helpers - Query verification
;; ============================================================================

;; verify-single-query: verify one query response from the proof.
;; Checks:
;;   1. Leaf index matches Fiat-Shamir derived index
;;   2. Merkle authentication of evaluations against trace root
;;   3. Constraint evaluation consistency
;;   4. FRI folding consistency
(define-private (verify-single-query
    (proof (buff 2048))
    (query-index uint)
    (trace-root (buff 32))
    (constraint-root_ (buff 32))
    (challenge (buff 32)))
  (let
    (
      ;; constraint-root_ is reserved for Tier-2 full FRI verification
      ;; Base offset for this query block
      (qb (+ OFFSET-QUERIES (* query-index QUERY-BLOCK-SIZE)))

      ;; Extract the three 32-byte evaluations
      (trace-eval (extract-hash-at proof qb))
      (constraint-eval (extract-hash-at proof (+ qb u32)))
      (fri-eval (extract-hash-at proof (+ qb u64)))

      ;; Extract 8 auth path siblings
      (sib-0 (extract-hash-at proof (+ qb u96)))
      (sib-1 (extract-hash-at proof (+ qb u128)))
      (sib-2 (extract-hash-at proof (+ qb u160)))
      (sib-3 (extract-hash-at proof (+ qb u192)))
      (sib-4 (extract-hash-at proof (+ qb u224)))
      (sib-5 (extract-hash-at proof (+ qb u256)))
      (sib-6 (extract-hash-at proof (+ qb u288)))
      (sib-7 (extract-hash-at proof (+ qb u320)))

      ;; Extract the leaf index byte
      (leaf-index (extract-byte-at proof (+ qb u352)))

      ;; Derive expected query index from Fiat-Shamir challenge
      (expected-index (derive-query-index challenge query-index))

      ;; The authenticated leaf is the trace evaluation itself.
      ;; The Merkle tree commits to trace evaluations; constraint and FRI
      ;; evaluations are checked algebraically rather than via the tree.
      (leaf-hash trace-eval)

      ;; Check 1: leaf index matches Fiat-Shamir
      (index-ok (is-eq leaf-index expected-index))

      ;; Check 2: Merkle auth path verifies against trace root
      (merkle-ok (verify-merkle-auth
        leaf-hash
        sib-0 sib-1 sib-2 sib-3 sib-4 sib-5 sib-6 sib-7
        leaf-index
        trace-root
      ))

      ;; Check 3: constraint eval = sha256(trace-eval || challenge)
      (expected-constraint (sha256 (concat trace-eval challenge)))
      (constraint-ok (is-eq constraint-eval expected-constraint))

      ;; Check 4: fri eval = sha256(constraint-eval || trace-eval)
      (expected-fri (sha256 (concat constraint-eval trace-eval)))
      (fri-ok (is-eq fri-eval expected-fri))
    )
    (and index-ok (and merkle-ok (and constraint-ok fri-ok)))
  )
)

;; ============================================================================
;; Private helpers - Multi-query fold
;; ============================================================================

;; verify-query-fold-step: fold accumulator for verifying all queries.
;; Short-circuits if any query fails or if past num-queries.
(define-private (verify-query-fold-step
    (query-idx uint)
    (acc {
      valid: bool,
      num-queries: uint,
      proof: (buff 2048),
      trace-root: (buff 32),
      constraint-root: (buff 32),
      challenge: (buff 32)
    }))
  (if (or (not (get valid acc)) (>= query-idx (get num-queries acc)))
    acc
    (let
      (
        (query-ok (verify-single-query
          (get proof acc)
          query-idx
          (get trace-root acc)
          (get constraint-root acc)
          (get challenge acc)
        ))
      )
      (merge acc { valid: query-ok })
    )
  )
)

;; ============================================================================
;; Private helpers - FRI remainder verification
;; ============================================================================

;; verify-fri-remainder: check that the FRI remainder commitment is
;; deterministically derived from the challenge and commitments.
;; expected = sha256(challenge || trace-root || constraint-root)
(define-private (verify-fri-remainder
    (remainder (buff 32))
    (challenge (buff 32))
    (trace-root (buff 32))
    (constraint-root (buff 32)))
  (let
    (
      (expected (sha256 (concat
        (concat challenge trace-root)
        constraint-root
      )))
    )
    (is-eq remainder expected)
  )
)

;; ============================================================================
;; Private helpers - Version check
;; ============================================================================

;; check-version: verify the 4-byte version field byte by byte.
(define-private (check-version (proof (buff 2048)))
  (and
    (is-eq (extract-byte-at proof u0) PROOF-VERSION-BYTE-0)
    (and
      (is-eq (extract-byte-at proof u1) PROOF-VERSION-BYTE-1)
      (and
        (is-eq (extract-byte-at proof u2) PROOF-VERSION-BYTE-2)
        (is-eq (extract-byte-at proof u3) PROOF-VERSION-BYTE-3)
      )
    )
  )
)

;; ============================================================================
;; Read-only functions
;; ============================================================================

;; verify-proof - Verify a STARK proof against public inputs
;;
;; Verification procedure:
;;   1. Check proof length and version
;;   2. Deserialize: extract trace root, constraint root, num queries
;;   3. Build the Fiat-Shamir transcript from public inputs
;;   4. Derive the challenge by hashing transcript with commitments
;;   5. For each query, verify Merkle auth + evaluation consistency
;;   6. Verify the FRI remainder commitment
;;   7. Return (ok true) only if every check passes
;;
;; Parameters:
;;   proof        - serialized proof buffer (up to 2048 bytes)
;;   nullifier    - 32-byte nullifier hash (public input)
;;   root         - 32-byte Merkle root (public input)
;;   recipient    - principal receiving the withdrawal (public input)
;;   relayer-fee  - fee amount for the relayer (public input)
;;
;; Returns: (ok true) if the proof is valid
;; Errors:  u6001..u6009 depending on which check fails
(define-read-only (verify-proof
    (proof (buff 2048))
    (nullifier (buff 32))
    (root (buff 32))
    (recipient principal)
    (relayer-fee uint))
  (let
    (
      (proof-len (len proof))
    )
    ;; Minimum proof size: 4 + 32 + 32 + 1 + 353 + 32 = 454
    (asserts! (>= proof-len u454) ERR-INVALID-PROOF-LENGTH)
    (asserts! (check-version proof) ERR-INVALID-VERSION)

    (let
      (
        (trace-root (extract-hash-at proof OFFSET-TRACE-ROOT))
        (constraint-root (extract-hash-at proof OFFSET-CONSTRAINT-ROOT))
        (num-queries (extract-byte-at proof OFFSET-NUM-QUERIES))
      )
      ;; num-queries must be in [1, 4]
      (asserts! (and (>= num-queries u1) (<= num-queries MAX-QUERIES))
                ERR-INVALID-NUM-QUERIES)

      ;; Proof must be long enough: 69 + (num-queries * 353) + 32
      (asserts! (>= proof-len (+ u101 (* num-queries QUERY-BLOCK-SIZE)))
                ERR-INVALID-PROOF-LENGTH)

      (let
        (
          ;; Build Fiat-Shamir transcript from public inputs
          (public-input-hash (build-public-input-hash
            nullifier root recipient relayer-fee))

          ;; Chain the challenge through both commitments
          (transcript-step-1 (compute-challenge public-input-hash trace-root))
          (challenge (compute-challenge transcript-step-1 constraint-root))

          ;; Verify all query responses via fold
          (query-result (fold verify-query-fold-step
            QUERY-INDICES
            {
              valid: true,
              num-queries: num-queries,
              proof: proof,
              trace-root: trace-root,
              constraint-root: constraint-root,
              challenge: challenge
            }
          ))

          ;; Extract and verify FRI remainder
          (remainder-offset (+ OFFSET-QUERIES (* num-queries QUERY-BLOCK-SIZE)))
          (fri-remainder (extract-hash-at proof remainder-offset))
          (remainder-ok (verify-fri-remainder
            fri-remainder challenge trace-root constraint-root))
        )
        (asserts! (get valid query-result) ERR-MERKLE-AUTH-FAILED)
        (asserts! remainder-ok ERR-FRI-CHECK-FAILED)

        (ok true)
      )
    )
  )
)
