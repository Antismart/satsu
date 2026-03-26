;; merkle-tree - Incremental Merkle tree library for the Satsu privacy pool
;;
;; This contract implements a frontier-based incremental Merkle tree with
;; depth 20 (supporting ~1M deposits). It uses SHA-256 as the hash function
;; and stores only one hash per level (the "frontier") plus the current root.
;;
;; The tree enables ZK proofs of membership: a depositor can prove their
;; commitment exists in the tree without revealing which leaf it is.
;;
;; Design: Each new leaf is inserted at the next available index. The insert
;; algorithm walks up from the leaf, hashing with frontier nodes when the
;; corresponding bit of next-leaf-index is 1, and storing the new hash as
;; frontier when the bit is 0. Pre-computed zero hashes represent empty
;; subtrees at each level.
;;
;; Authorization: append-leaf is a public function. In the full system,
;; pool-v1 calls it during deposit. For the library contract, any caller
;; may append (pool-v1 will gate access in its own deposit function).

;; ============================================================================
;; Constants
;; ============================================================================

(define-constant MAX-LEAVES u1048576) ;; 2^20 (tree depth 20)

;; Error codes (3000s range for merkle-tree)
(define-constant ERR-TREE-FULL (err u3001))

;; ============================================================================
;; Pre-computed zero hashes
;; ============================================================================
;; Level 0: sha256(ZERO-VALUE)
;; Level n: sha256(zero_hash[n-1] || zero_hash[n-1])

(define-constant ZERO-HASH-0  0x66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925)
(define-constant ZERO-HASH-1  0x2eeb74a6177f588d80c0c752b99556902ddf9682d0b906f5aa2adbaf8466a4e9)
(define-constant ZERO-HASH-2  0x1223349a40d2ee10bd1bebb5889ef8018c8bc13359ed94b387810af96c6e4268)
(define-constant ZERO-HASH-3  0x5b82b695a7ac2668e188b75f7d4fa79faa504117d1fdfcbe8a46915c1a8a5191)
(define-constant ZERO-HASH-4  0x0c211f9b5384c68848a209ac1f93905330128cb710ae583779c07127ef88ff5c)
(define-constant ZERO-HASH-5  0x56460a80e1171e24ac1dcdc0d3f10a4f33bf31766260ab0ade1c7eb0dcbc5d70)
(define-constant ZERO-HASH-6  0x2dea2fc40d00e5b0af8bec53643e2bb68614f530bd0c6b927d3e5ed97173417b)
(define-constant ZERO-HASH-7  0xee935dcf025e3016579ec39fcfdea5688ab4ca5f3b54726ac395771a658d2ea1)
(define-constant ZERO-HASH-8  0x10a411babd72a3bf9c9f82793e7371f78539c1b80a2bc13791bdc8d8b85e3793)
(define-constant ZERO-HASH-9  0xa15c4a922d99997278612794a7c740469f7b45def6bef262e2eec2703d1872e7)
(define-constant ZERO-HASH-10 0x86e76e201c2ead88b8bded0b23912e431a1babc89ef151e505438622350bd991)
(define-constant ZERO-HASH-11 0xc7fe09c567bf12d179ffcf8653a64e1d0dcf11938fd444399fd54620a2edf7f9)
(define-constant ZERO-HASH-12 0x07ef7659ff16d14b61578319e7d9405ec9cbc5c470d987cfb426eed515a5fa50)
(define-constant ZERO-HASH-13 0xb7c2fa725e389b5179a99bc659c561b4c7881cca943d449122cdb56217385b0d)
(define-constant ZERO-HASH-14 0xd536d02ae6a0a727a6e907b2fafc71577544d256e4db5f2f22d5bedf73c0cd7c)
(define-constant ZERO-HASH-15 0xaa4c42f09ecb58a7667e1a27b644b2d4bc9fb4213cf83cce6e59350bbe477b9d)
(define-constant ZERO-HASH-16 0x2ed4373149a1dd68868e1d77da082a79caad470b6cb80f99f4a97730c327ad6f)
(define-constant ZERO-HASH-17 0xae733b66f70e8a852ed75b8d137ffdc011b233278b2f372679c25b5382b477f5)
(define-constant ZERO-HASH-18 0xf2fc7517a99d580bc0a970ebf98969b533d4d5929c10e0db91d7ef5aa724de0b)
(define-constant ZERO-HASH-19 0x4847eb8f74aa407babb518db4a37cef8363dfd1e1679d72893b74af39738e0ab)

;; The initial empty root: sha256(ZERO-HASH-19 || ZERO-HASH-19)
(define-constant EMPTY-ROOT 0x799881750019ca39515941a00231729514ca4029498a0c675e9d66a0f4340103)

;; Level indices for fold iteration
(define-constant LEVEL-INDICES (list u0 u1 u2 u3 u4 u5 u6 u7 u8 u9 u10 u11 u12 u13 u14 u15 u16 u17 u18 u19))

;; ============================================================================
;; Access control
;; ============================================================================

;; The deployer principal - used for admin operations.
(define-constant CONTRACT-OWNER tx-sender)

;; Map of authorized callers that may append leaves.
;; The pool contract is pre-authorized at deployment.
(define-map authorized-callers { caller: principal } { authorized: bool })

;; Error for unauthorized callers
(define-constant ERR-NOT-AUTHORIZED (err u3002))

;; Private helper: check if a caller is authorized
(define-private (is-authorized (caller principal))
  (or
    (is-eq caller CONTRACT-OWNER)
    (default-to false (get authorized (map-get? authorized-callers { caller: caller })))
  )
)

;; ============================================================================
;; State
;; ============================================================================

(define-data-var current-root (buff 32) EMPTY-ROOT)
(define-data-var next-leaf-index uint u0)

;; Frontier: one hash per level, the rightmost filled node at that level
(define-map tree-frontier { level: uint } { hash: (buff 32) })

;; Historical roots: every root that was ever the current root
(define-map known-roots { root: (buff 32) } { block-height: uint })

;; Initialize: the empty root is a known root at deployment
(map-set known-roots { root: EMPTY-ROOT } { block-height: u0 })

;; ============================================================================
;; Private helpers
;; ============================================================================

;; Look up the zero hash for a given level
(define-private (get-zero-hash (level uint))
  (if (is-eq level u0)  ZERO-HASH-0
  (if (is-eq level u1)  ZERO-HASH-1
  (if (is-eq level u2)  ZERO-HASH-2
  (if (is-eq level u3)  ZERO-HASH-3
  (if (is-eq level u4)  ZERO-HASH-4
  (if (is-eq level u5)  ZERO-HASH-5
  (if (is-eq level u6)  ZERO-HASH-6
  (if (is-eq level u7)  ZERO-HASH-7
  (if (is-eq level u8)  ZERO-HASH-8
  (if (is-eq level u9)  ZERO-HASH-9
  (if (is-eq level u10) ZERO-HASH-10
  (if (is-eq level u11) ZERO-HASH-11
  (if (is-eq level u12) ZERO-HASH-12
  (if (is-eq level u13) ZERO-HASH-13
  (if (is-eq level u14) ZERO-HASH-14
  (if (is-eq level u15) ZERO-HASH-15
  (if (is-eq level u16) ZERO-HASH-16
  (if (is-eq level u17) ZERO-HASH-17
  (if (is-eq level u18) ZERO-HASH-18
  ZERO-HASH-19
  )))))))))))))))))))
)

;; Get frontier hash at a level, defaulting to the zero hash for that level
(define-private (get-frontier-or-zero (level uint))
  (default-to
    (get-zero-hash level)
    (get hash (map-get? tree-frontier { level: level }))
  )
)

;; Process one level of the incremental insert algorithm.
;; Accumulator tracks: current hash being propagated upward, the leaf index,
;; and whether we've already stored and are done propagating.
(define-private (process-level
    (level uint)
    (acc { current-hash: (buff 32), current-index: uint, done: bool }))
  (if (get done acc)
    ;; Already stored at a lower level - nothing to do
    acc
    (let
      (
        (current-hash (get current-hash acc))
        (current-index (get current-index acc))
        ;; Check if bit at this level is 0 or 1
        (bit-at-level (bit-and (bit-shift-right current-index level) u1))
      )
      (if (is-eq bit-at-level u0)
        ;; Bit is 0: store current hash as frontier at this level and stop
        (begin
          (map-set tree-frontier { level: level } { hash: current-hash })
          { current-hash: current-hash, current-index: current-index, done: true }
        )
        ;; Bit is 1: hash frontier[level] || current-hash and continue up
        (let
          (
            (left (get-frontier-or-zero level))
            (combined (sha256 (concat left current-hash)))
          )
          { current-hash: combined, current-index: current-index, done: false }
        )
      )
    )
  )
)

;; Compute the current root by hashing from the result of the fold up to
;; TREE-DEPTH. After the fold, the accumulator's current-hash is the hash
;; at whatever level the fold stopped. We need to continue hashing with
;; zero hashes up to the root.
;;
;; We use a second fold for the root computation. Each level from 0 to 19
;; contributes: if the level is above where we stored (or if done was
;; already true at that level), we hash current-hash with the zero hash.
(define-private (compute-root-level
    (level uint)
    (acc { current-hash: (buff 32), current-index: uint, stored-level: uint }))
  (let
    (
      (current-hash (get current-hash acc))
      (current-index (get current-index acc))
      (stored-level (get stored-level acc))
    )
    (if (<= level stored-level)
      ;; At or below the level where we stored - skip
      acc
      ;; Above the stored level: hash current-hash with zero hash at this level
      (let
        (
          (bit-at-level (bit-and (bit-shift-right current-index level) u1))
          (zero (get-zero-hash level))
        )
        (if (is-eq bit-at-level u0)
          ;; Bit 0: current-hash is on the left, zero on the right
          {
            current-hash: (sha256 (concat current-hash zero)),
            current-index: current-index,
            stored-level: stored-level
          }
          ;; Bit 1: zero on the left, current-hash on the right
          {
            current-hash: (sha256 (concat zero current-hash)),
            current-index: current-index,
            stored-level: stored-level
          }
        )
      )
    )
  )
)

;; Find the level at which the insert fold stored the frontier.
;; This is the lowest level where the bit of next-leaf-index is 0.
(define-private (find-stored-level (leaf-index uint))
  (fold find-stored-level-iter LEVEL-INDICES { index: leaf-index, found-level: u20 })
)

(define-private (find-stored-level-iter
    (level uint)
    (acc { index: uint, found-level: uint }))
  (if (< (get found-level acc) u20)
    ;; Already found
    acc
    (if (is-eq (bit-and (bit-shift-right (get index acc) level) u1) u0)
      { index: (get index acc), found-level: level }
      acc
    )
  )
)

;; ============================================================================
;; Public functions
;; ============================================================================

;; set-authorized-caller: allow the deployer to authorize or revoke a caller.
;; Used to authorize pool contracts to append leaves.
(define-public (set-authorized-caller (caller principal) (authorized bool))
  (begin
    (asserts! (and (is-eq tx-sender CONTRACT-OWNER) (is-eq contract-caller CONTRACT-OWNER))
              ERR-NOT-AUTHORIZED)
    (map-set authorized-callers { caller: caller } { authorized: authorized })
    (ok true)
  )
)

;; append-leaf: add a commitment to the tree
;; Returns the new root and the leaf index where it was inserted.
;; Only authorized callers (pool contract or deployer) can append.
(define-public (append-leaf (leaf (buff 32)))
  (let
    (
      (leaf-index (var-get next-leaf-index))
    )
    ;; Access control: only authorized callers
    (asserts! (is-authorized contract-caller) ERR-NOT-AUTHORIZED)
    ;; Precondition: tree must not be full
    (asserts! (< leaf-index MAX-LEAVES) ERR-TREE-FULL)

    (let
      (
        ;; Run the incremental insert: fold over levels 0..19
        (insert-result
          (fold process-level
            LEVEL-INDICES
            { current-hash: leaf, current-index: leaf-index, done: false }
          )
        )
        ;; Find which level the frontier was stored at
        (stored (find-stored-level leaf-index))
        (stored-level (get found-level stored))
        ;; The hash at the stored level after the insert fold
        (hash-at-stored-level (get current-hash insert-result))
        ;; Now compute the root by hashing upward from stored-level with zero hashes
        (root-result
          (fold compute-root-level
            LEVEL-INDICES
            {
              current-hash: hash-at-stored-level,
              current-index: leaf-index,
              stored-level: stored-level
            }
          )
        )
        (new-root (get current-hash root-result))
      )
      ;; Update state
      (var-set current-root new-root)
      (var-set next-leaf-index (+ leaf-index u1))
      (map-set known-roots { root: new-root } { block-height: stacks-block-height })

      ;; Emit event for off-chain indexing
      (print {
        event: "leaf-appended",
        leaf: leaf,
        leaf-index: leaf-index,
        new-root: new-root
      })

      (ok { root: new-root, leaf-index: leaf-index })
    )
  )
)

;; ============================================================================
;; Read-only functions
;; ============================================================================

;; get-current-root: returns the current Merkle root
(define-read-only (get-current-root)
  (var-get current-root)
)

;; is-known-root: checks if a root was ever a valid tree root
(define-read-only (is-known-root (root (buff 32)))
  (is-some (map-get? known-roots { root: root }))
)

;; get-next-leaf-index: returns the next available leaf index
(define-read-only (get-next-leaf-index)
  (var-get next-leaf-index)
)

;; get-frontier: returns the frontier hash at a given level
(define-read-only (get-frontier (level uint))
  (map-get? tree-frontier { level: level })
)
