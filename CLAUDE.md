# CLAUDE.md — Satsū

> Private payments on Bitcoin. Stealth deposits. Shielded transfers. Zero knowledge.

Satsū is a privacy payment layer built on the Stacks blockchain (Bitcoin L2). It combines **stealth addresses** (unlinkable sender/receiver identities) with a **ZK-STARK shielded pool** (hidden transaction graph) to enable fully private sBTC transactions that settle on Bitcoin.

---

## Table of contents

1. [Product overview](#product-overview)
2. [Architecture](#architecture)
3. [Repository structure](#repository-structure)
4. [Smart contracts (Clarity)](#smart-contracts-clarity)
5. [Client SDK (TypeScript)](#client-sdk-typescript)
6. [Relayer service](#relayer-service)
7. [Scanner service](#scanner-service)
8. [Cryptographic design](#cryptographic-design)
9. [Development environment](#development-environment)
10. [Testing strategy](#testing-strategy)
11. [Security considerations](#security-considerations)
12. [Deployment](#deployment)
13. [Coding standards](#coding-standards)

---

## Product overview

### What Satsū does

Satsū enables a user (Alice) to send sBTC to another user (Bob) such that no on-chain observer can determine:

- **Who deposited** — stealth address + relayer hides Alice's identity at deposit time
- **Which deposit funded the withdrawal** — the shielded pool (ZK proof of Merkle membership) breaks the link
- **Who submitted the transaction** — the relayer submits both deposits and withdrawals on behalf of users
- **Who received the funds** — stealth address derivation creates a one-time ephemeral address for Bob

### Core user flows

**Flow 1: Stealth deposit**
1. Alice derives a one-time stealth address for herself (client-side ECDH)
2. Alice sends sBTC to that stealth address (looks like a normal SIP-010 transfer)
3. After a configurable delay, Alice computes a cryptographic commitment: `C = sha256(secret || nullifier || amount)`
4. Alice sends the signed deposit transaction (commitment + sBTC approval) to the relayer
5. The relayer submits the deposit to `satsu.pool-v1` — the pool locks sBTC and appends `C` as a Merkle leaf
6. Alice stores an encrypted note locally (secret, nullifier, amount, stealth spending key)

**Flow 2: Shielded withdrawal to stealth address**
1. Alice decides to send to Bob. She looks up Bob's stealth meta-address from `satsu.stealth-v1`
2. Alice derives a one-time stealth address for Bob (ECDH + hash)
3. Alice builds a ZK-STARK proof client-side proving:
   - She knows a secret `s` and nullifier `n` such that `sha256(s || n || amount)` is a leaf in the Merkle tree
   - She reveals the nullifier `n` (to prevent double-spend) but NOT the secret or leaf index
4. Alice sends the proof + nullifier + Bob's stealth address + ephemeral public key `R` to the relayer
5. The relayer submits the withdrawal to `satsu.pool-v1` — the pool verifies the proof, checks the nullifier hasn't been used, releases sBTC to Bob's stealth address, and emits `R` in an event log
6. Bob's scanner (powered by Chainhooks) detects the payment by trial-decrypting with his view key

**Flow 3: Stealth meta-address registration**
1. Bob generates a spend keypair and a view keypair
2. Bob calls `satsu.stealth-v1` to register his meta-address, optionally linking it to his `.btc` name
3. This is a one-time public action — the meta-address reveals nothing about future payments

### Privacy guarantees

| Property | Mechanism |
|----------|-----------|
| Sender privacy (deposit) | Stealth self-address + relayer |
| Sender privacy (withdrawal) | Relayer submits tx |
| Receiver privacy | Stealth address derivation from meta-address |
| Transaction graph privacy | ZK proof of Merkle membership (no leaf index revealed) |
| Amount privacy | Fixed denomination pools (v1) / Pedersen commitments (v2) |
| Double-spend prevention | Nullifier registry (each nullifier can only be used once) |

---

## Architecture

### System layers

```
┌─────────────────────────────────────────────────────────┐
│  @satsu/sdk — Client layer (TypeScript + WASM)          │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐  │
│  │ Wallet +     │ │ ZK proof     │ │ Encrypted note  │  │
│  │ stealth keys │ │ engine       │ │ store           │  │
│  └──────────────┘ └──────────────┘ └─────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  Stacks L2 — Clarity smart contracts                    │
│  ┌───────────────────────────────────┐ ┌──────────────┐ │
│  │ satsu.pool-v1                     │ │ Off-chain    │ │
│  │ ┌─────────┐ ┌──────────────────┐  │ │ services    │ │
│  │ │ Deposit │ │ Merkle tree      │  │ │             │ │
│  │ │ handler │ │ (incremental)    │  │ │ @satsu/     │ │
│  │ ├─────────┤ ├──────────────────┤  │ │   relay     │ │
│  │ │ Nullifi-│ │ Proof verifier   │  │ │             │ │
│  │ │ ers     │ │ (STARK, sha256)  │  │ │ @satsu/     │ │
│  │ └─────────┘ └──────────────────┘  │ │   scanner   │ │
│  ├───────────────────────────────────┤ │             │ │
│  │ satsu.stealth-v1                  │ └──────────────┘ │
│  │ ┌─────────────┐ ┌──────────────┐  │                 │
│  │ │ Address     │ │ Ephemeral    │  │                 │
│  │ │ registry    │ │ key log      │  │                 │
│  │ └─────────────┘ └──────────────┘  │                 │
│  └───────────────────────────────────┘                  │
├─────────────────────────────────────────────────────────┤
│  Settlement layer                                       │
│  ┌──────────────────────┐ ┌───────────────────────────┐ │
│  │ sBTC peg (SIP-010)   │ │ Bitcoin L1                │ │
│  │ Trust-minimized      │ │ Final settlement          │ │
│  └──────────────────────┘ └───────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Key design decisions

- **STARK over SNARK**: Clarity has no native elliptic curve pairing operations. STARKs are hash-based — verification is repeated `sha256` calls + Merkle path checks, which Clarity handles efficiently. Tradeoff: larger proof sizes (~50-200KB) but no trusted setup required.
- **Incremental Merkle tree**: The pool stores only the current root and a frontier array (one node per tree level). Each deposit appends a leaf and updates the frontier. With tree depth 20, that's ~20 `sha256` calls per deposit — well within Clarity execution limits. Supports up to ~1 million deposits.
- **Fixed denomination pools (v1)**: Each pool instance accepts exactly one denomination (e.g., 0.01 sBTC, 0.1 sBTC, 1 sBTC). This avoids the need for range proofs in the ZK circuit. Variable amounts with Pedersen commitments are a v2 feature.
- **Relayer-mediated deposits AND withdrawals**: The relayer submits all transactions to break the address link. It's a permissionless role — anyone can run a relayer and earn fees.
- **Stealth addresses at both ends**: Applied on deposit (Alice stealth-funds the pool) AND withdrawal (Bob receives at an ephemeral stealth address). This provides full sender + receiver privacy.

---

## Repository structure

```
satsu/
├── CLAUDE.md                          # This file
├── README.md                          # Public readme
├── Clarinet.toml                      # Clarinet project config
├── settings/
│   └── Mainnet.toml
│   └── Testnet.toml
│   └── Devnet.toml
├── contracts/                         # Clarity smart contracts
│   ├── pool-v1.clar                   # Core privacy pool
│   ├── merkle-tree.clar               # Incremental Merkle tree library
│   ├── nullifier-registry.clar        # Nullifier storage
│   ├── proof-verifier.clar            # STARK proof verification
│   ├── stealth-v1.clar                # Stealth address registry
│   └── traits/
│       ├── pool-trait.clar            # Pool interface trait
│       └── verifier-trait.clar        # Verifier interface trait
├── tests/                             # Clarity unit + integration tests
│   ├── pool-v1.test.ts                # Pool contract tests
│   ├── merkle-tree.test.ts            # Merkle tree tests
│   ├── nullifier-registry.test.ts     # Nullifier tests
│   ├── proof-verifier.test.ts         # Verifier tests
│   ├── stealth-v1.test.ts             # Stealth registry tests
│   └── integration/
│       ├── deposit-flow.test.ts       # Full stealth deposit E2E
│       └── withdrawal-flow.test.ts    # Full stealth withdrawal E2E
├── packages/
│   ├── sdk/                           # @satsu/sdk — TypeScript client
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts               # Public API exports
│   │   │   ├── wallet/
│   │   │   │   ├── stealth-keys.ts    # Spend + view keypair generation
│   │   │   │   ├── stealth-address.ts # ECDH stealth address derivation
│   │   │   │   └── meta-address.ts    # Meta-address encoding/decoding
│   │   │   ├── pool/
│   │   │   │   ├── commitment.ts      # Commitment computation (sha256)
│   │   │   │   ├── merkle.ts          # Client-side Merkle tree tracking
│   │   │   │   ├── deposit.ts         # Deposit transaction builder
│   │   │   │   └── withdraw.ts        # Withdrawal transaction builder
│   │   │   ├── proof/
│   │   │   │   ├── circuit.ts         # ZK circuit definition
│   │   │   │   ├── prover.ts          # WASM STARK prover wrapper
│   │   │   │   └── witness.ts         # Witness generation
│   │   │   ├── notes/
│   │   │   │   ├── note.ts            # Note data structure
│   │   │   │   ├── encryption.ts      # AES-GCM note encryption
│   │   │   │   └── store.ts           # Encrypted local storage
│   │   │   ├── relayer/
│   │   │   │   └── client.ts          # Relayer API client
│   │   │   └── utils/
│   │   │       ├── crypto.ts          # Shared crypto utilities
│   │   │       └── constants.ts       # Network constants, pool addresses
│   │   └── tests/
│   │       ├── stealth-address.test.ts
│   │       ├── commitment.test.ts
│   │       ├── merkle.test.ts
│   │       └── proof.test.ts
│   ├── relay/                         # @satsu/relay — Relayer daemon
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts               # Relayer entrypoint
│   │   │   ├── queue.ts               # Transaction batching queue
│   │   │   ├── submitter.ts           # Stacks transaction submission
│   │   │   ├── fee-manager.ts         # Fee calculation + collection
│   │   │   └── health.ts              # Health check endpoint
│   │   └── tests/
│   └── scanner/                       # @satsu/scanner — Chainhook indexer
│       ├── package.json
│       ├── src/
│       │   ├── index.ts               # Scanner entrypoint
│       │   ├── chainhook.ts           # Chainhook event subscription
│       │   ├── stealth-detector.ts    # View-key trial decryption
│       │   └── notification.ts        # Payment notification handler
│       └── tests/
├── circuits/                          # ZK circuit definitions
│   ├── membership.circom              # Merkle membership circuit (or equivalent STARK DSL)
│   └── build/                         # Compiled WASM prover artifacts
└── deployments/                       # Clarinet deployment plans
    ├── default.devnet-plan.yaml
    └── default.testnet-plan.yaml
```

---

## Smart contracts (Clarity)

### General Clarity guidelines

- Target Clarity 2+ (Stacks Nakamoto era)
- Use `define-read-only` for all pure query functions
- Use `define-public` for state-mutating functions
- Use `define-private` for internal helpers
- Use `(asserts! ...)` for all precondition checks, with descriptive error codes
- All error codes must be `uint` constants defined at the top of the file with `ERR-` prefix
- All public functions must return `(response ...)` types
- Use `define-map` for key-value storage, `define-data-var` for singleton state
- Prefer `(try! ...)` for propagating errors from nested calls
- Avoid deep nesting — factor complex logic into `define-private` helpers
- Use `(as-contract tx-sender)` when the contract needs to hold/transfer assets
- Every contract must have a thorough comment block at the top describing its purpose
- All map keys and value types should be documented with inline comments

### Contract: `satsu.pool-v1`

This is the core privacy pool contract. It handles deposits, proof verification, nullifier tracking, and withdrawals.

#### State

```clarity
;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant POOL-DENOMINATION u10000000)  ;; 0.1 sBTC in smallest unit
(define-constant TREE-DEPTH u20)               ;; Max ~1M deposits
(define-constant ZERO-VALUE 0x0000000000000000000000000000000000000000000000000000000000000000)

;; Error codes
(define-constant ERR-NOT-AUTHORIZED (err u1001))
(define-constant ERR-INVALID-AMOUNT (err u1002))
(define-constant ERR-NULLIFIER-USED (err u1003))
(define-constant ERR-INVALID-PROOF (err u1004))
(define-constant ERR-INVALID-ROOT (err u1005))
(define-constant ERR-TREE-FULL (err u1006))
(define-constant ERR-TRANSFER-FAILED (err u1007))

;; Merkle tree state (incremental)
(define-data-var current-root (buff 32) ZERO-VALUE)
(define-data-var next-leaf-index uint u0)
(define-map tree-frontier { level: uint } { hash: (buff 32) })
(define-map known-roots { root: (buff 32) } { block-height: uint })

;; Nullifier registry
(define-map used-nullifiers { nullifier: (buff 32) } { used: bool })

;; Deposit metadata (commitment → amount, for fixed denomination verification)
(define-map deposit-commitments { commitment: (buff 32) } { amount: uint, block-height: uint })
```

#### Key functions

```clarity
;; deposit: accepts sBTC + commitment, appends to Merkle tree
;; - The caller can be a relayer (delegated deposit pattern)
;; - The sBTC source is specified as a parameter (the stealth address)
;; - The stealth address must have pre-approved the pool contract for the transfer amount
(define-public (deposit (commitment (buff 32)) (source principal))
  ;; 1. Verify commitment hasn't been used
  ;; 2. Transfer POOL-DENOMINATION sBTC from source to (as-contract tx-sender)
  ;; 3. Call append-leaf to add commitment to Merkle tree
  ;; 4. Store commitment in deposit-commitments map
  ;; 5. Emit print event with commitment + new root
  ;; Returns: (ok { root: (buff 32), leaf-index: uint })
)

;; withdraw: verifies ZK proof, checks nullifier, releases sBTC
(define-public (withdraw
    (proof (buff 2048))          ;; Serialized STARK proof
    (nullifier (buff 32))         ;; Revealed nullifier (prevents double-spend)
    (root (buff 32))              ;; Merkle root the proof was generated against
    (recipient principal)         ;; Stealth address to receive sBTC
    (ephemeral-pubkey (buff 33))  ;; Compressed public key R for stealth detection
    (relayer-fee uint))           ;; Fee deducted for the relayer
  ;; 1. Verify root is a known historical root (within valid window)
  ;; 2. Verify nullifier has not been used
  ;; 3. Verify ZK proof against (nullifier, root, recipient, relayer-fee)
  ;; 4. Mark nullifier as used
  ;; 5. Transfer (POOL-DENOMINATION - relayer-fee) sBTC to recipient
  ;; 6. Transfer relayer-fee sBTC to tx-sender (the relayer)
  ;; 7. Emit print event with nullifier + ephemeral-pubkey + recipient
  ;; Returns: (ok { nullifier: (buff 32) })
)

;; append-leaf: internal function to add a commitment to the incremental Merkle tree
(define-private (append-leaf (leaf (buff 32)))
  ;; Implements the incremental Merkle tree insert algorithm:
  ;; 1. Start with the leaf hash at level 0
  ;; 2. For each level from 0 to TREE-DEPTH:
  ;;    - If the current leaf index bit at this level is 0, store as frontier and break
  ;;    - If 1, hash with the frontier at this level and continue up
  ;; 3. Update current-root
  ;; 4. Store root in known-roots with current block-height
  ;; 5. Increment next-leaf-index
)

;; get-current-root: read-only accessor
(define-read-only (get-current-root) (ok (var-get current-root)))

;; is-known-root: checks if a root was ever valid (within a configurable window)
(define-read-only (is-known-root (root (buff 32)))
  (is-some (map-get? known-roots { root: root }))
)

;; is-nullifier-used: checks if a nullifier has been spent
(define-read-only (is-nullifier-used (nullifier (buff 32)))
  (default-to false (get used (map-get? used-nullifiers { nullifier: nullifier })))
)
```

#### Incremental Merkle tree implementation detail

The tree uses pre-computed zero hashes for empty subtrees. Generate these at contract initialization:

```clarity
;; Zero hashes: hash of empty subtree at each level
;; Level 0: sha256(0x00...00)
;; Level n: sha256(zero_hash[n-1] || zero_hash[n-1])
(define-constant ZERO-HASHES (list
  0x... ;; level 0: sha256(ZERO-VALUE)
  0x... ;; level 1: sha256(zero_0 || zero_0)
  ;; ... up to TREE-DEPTH
))
```

The frontier stores one hash per level — the rightmost "filled" node at that level. When inserting a new leaf:

```
if bit i of next-leaf-index is 0:
    store current-hash at frontier[i], return
if bit i is 1:
    current-hash = sha256(frontier[i] || current-hash)
    continue to level i+1
```

This gives O(log N) insertions with O(log N) storage.

### Contract: `satsu.stealth-v1`

Stealth address registry. Maps principals (optionally linked to `.btc` names) to stealth meta-addresses.

#### State

```clarity
;; Meta-address: two compressed public keys (33 bytes each)
(define-map stealth-meta-addresses
  { owner: principal }
  {
    spend-pubkey: (buff 33),   ;; Compressed secp256k1 public key
    view-pubkey: (buff 33)     ;; Compressed secp256k1 public key
  }
)

;; Optional: link .btc BNS names to principals for UX
(define-map btc-name-to-owner
  { name: (buff 48) }
  { owner: principal }
)
```

#### Key functions

```clarity
;; register-meta-address: store or update a stealth meta-address
(define-public (register-meta-address (spend-pubkey (buff 33)) (view-pubkey (buff 33)))
  ;; 1. Validate pubkey lengths (must be 33 bytes, compressed format)
  ;; 2. Validate first byte is 0x02 or 0x03 (compressed key prefix)
  ;; 3. Store in stealth-meta-addresses keyed by tx-sender
  ;; 4. Emit print event
)

;; link-btc-name: associate a BNS name with the caller's meta-address
(define-public (link-btc-name (name (buff 48)))
  ;; 1. Verify caller owns this BNS name (call BNS contract)
  ;; 2. Verify caller has a registered meta-address
  ;; 3. Store mapping
)

;; get-meta-address: look up by principal
(define-read-only (get-meta-address (owner principal))
  (map-get? stealth-meta-addresses { owner: owner })
)

;; get-meta-address-by-name: look up by .btc name
(define-read-only (get-meta-address-by-name (name (buff 48)))
  (match (map-get? btc-name-to-owner { name: name })
    entry (get-meta-address (get owner entry))
    none
  )
)
```

### Contract: `satsu.proof-verifier`

STARK proof verification in Clarity. This is the most constrained component — Clarity must verify proofs using only `sha256` and basic arithmetic.

#### Design approach

The verifier implements the FRI (Fast Reed-Solomon Interactive Oracle Proof) verification protocol, which consists of:

1. **Merkle authentication paths** — verify claimed evaluations against committed Merkle roots using `sha256`
2. **Constraint evaluation** — check that the claimed witness satisfies the circuit constraints using Clarity's built-in arithmetic
3. **FRI consistency checks** — verify the polynomial decomposition at each FRI layer

The proof is a serialized buffer containing:
- Merkle roots for each FRI layer
- Authentication paths (sequences of `(buff 32)` hashes)
- Claimed evaluations at query points
- Constraint polynomial evaluations

```clarity
;; verify-proof: top-level verification function
;; Returns true if the proof is valid for the given public inputs
(define-public (verify-proof
    (proof (buff 2048))
    (nullifier (buff 32))
    (root (buff 32))
    (recipient principal)
    (relayer-fee uint))
  ;; 1. Deserialize proof buffer into components
  ;; 2. Recompute challenge values via Fiat-Shamir (hash transcript)
  ;; 3. Verify Merkle authentication paths for each query
  ;; 4. Check constraint evaluations at each query point
  ;; 5. Verify FRI layer consistency
  ;; Returns: (ok true) or ERR-INVALID-PROOF
)
```

**Important**: The proof size and verification cost must be benchmarked against Stacks block execution limits. If on-chain verification is too expensive, fall back to an **optimistic verification** pattern: the proof is submitted, and there's a challenge period during which anyone can submit a fraud proof. This is a design-time decision based on benchmarking.

---

## Client SDK (TypeScript)

### Package: `@satsu/sdk`

Built with TypeScript, targeting both browser (WASM for proof generation) and Node.js environments.

### Dependencies

- `@stacks/transactions` — Stacks transaction construction and signing
- `@stacks/network` — Network configuration (mainnet, testnet, devnet)
- `@stacks/connect` — Wallet connection (Hiro Wallet, Xverse)
- `@noble/secp256k1` — Elliptic curve operations (ECDH, key derivation)
- `@noble/hashes` — sha256, AES-GCM (note encryption)
- Custom WASM module — STARK prover compiled from Rust/C to WASM

### Stealth address module (`wallet/stealth-address.ts`)

Implements EIP-5564-style stealth addresses adapted for Stacks:

```typescript
interface StealthMetaAddress {
  spendPubKey: Uint8Array;  // 33 bytes compressed
  viewPubKey: Uint8Array;   // 33 bytes compressed
}

interface StealthAddressResult {
  stealthAddress: string;       // Stacks address (SP... or ST...)
  stealthPubKey: Uint8Array;    // 33 bytes
  stealthPrivKey: Uint8Array;   // 32 bytes (only if sender = self)
  ephemeralPubKey: Uint8Array;  // 33 bytes (R), published on-chain
}

// Derive a one-time stealth address for a recipient
function deriveStealthAddress(
  meta: StealthMetaAddress,
  ephemeralPrivKey?: Uint8Array  // random if not provided
): StealthAddressResult {
  // 1. Generate ephemeral keypair: r (random scalar), R = r * G
  // 2. Compute shared secret: S = r * viewPubKey (ECDH)
  // 3. Derive stealth public key: P = spendPubKey + hash(S) * G
  // 4. Derive Stacks address from P
  // 5. Return { stealthAddress, stealthPubKey, ephemeralPubKey: R }
}

// Derive stealth address for self (deposit scenario)
function deriveSelfStealth(
  spendPrivKey: Uint8Array,
  viewPrivKey: Uint8Array
): StealthAddressResult {
  // Same as above, but also computes the spending private key:
  // stealthPrivKey = spendPrivKey + hash(r * viewPubKey)
}

// Check if a stealth payment belongs to us (scanner)
function checkStealthPayment(
  ephemeralPubKey: Uint8Array,  // R from on-chain event
  viewPrivKey: Uint8Array,
  spendPubKey: Uint8Array
): { match: boolean; stealthAddress?: string; stealthPrivKey?: Uint8Array } {
  // 1. Compute shared secret: S = viewPrivKey * R (ECDH)
  // 2. Derive expected stealth public key: P = spendPubKey + hash(S) * G
  // 3. Derive expected Stacks address
  // 4. Return match result + spending key if match
}
```

### Commitment module (`pool/commitment.ts`)

```typescript
interface Commitment {
  secret: Uint8Array;      // 32 random bytes
  nullifier: Uint8Array;   // 32 random bytes
  amount: bigint;          // Pool denomination in micro-sBTC
  commitment: Uint8Array;  // sha256(secret || nullifier || amount)
  nullifierHash: Uint8Array; // sha256(nullifier) — revealed during withdrawal
}

function createCommitment(amount: bigint): Commitment {
  // 1. Generate cryptographically random secret (32 bytes)
  // 2. Generate cryptographically random nullifier (32 bytes)
  // 3. Compute commitment = sha256(secret || nullifier || amountToBytes(amount))
  // 4. Compute nullifierHash = sha256(nullifier)
  // 5. Return all components
}
```

### Merkle tree module (`pool/merkle.ts`)

Client-side mirror of the on-chain Merkle tree:

```typescript
class IncrementalMerkleTree {
  depth: number;
  zeroHashes: Uint8Array[];   // Pre-computed empty subtree hashes
  frontier: Uint8Array[];     // One hash per level (mirrors contract state)
  leaves: Uint8Array[];       // All known leaves (for proof generation)
  root: Uint8Array;
  nextIndex: number;

  constructor(depth: number);
  insert(leaf: Uint8Array): { root: Uint8Array; index: number };
  generateProof(leafIndex: number): MerkleProof;
  verifyProof(proof: MerkleProof, leaf: Uint8Array, root: Uint8Array): boolean;
}

interface MerkleProof {
  pathElements: Uint8Array[];  // Sibling hashes from leaf to root
  pathIndices: number[];       // 0 = left child, 1 = right child
}
```

The client must sync the tree state from on-chain events (via Chainhooks or Stacks API queries) to maintain an up-to-date leaf list for proof generation.

### Proof module (`proof/prover.ts`)

```typescript
interface WithdrawalWitness {
  // Private inputs (not revealed)
  secret: Uint8Array;
  leafIndex: number;
  merklePathElements: Uint8Array[];
  merklePathIndices: number[];

  // Public inputs (revealed on-chain)
  nullifier: Uint8Array;
  root: Uint8Array;
  recipient: string;        // Stacks address
  relayerFee: bigint;
}

interface StarkProof {
  proof: Uint8Array;        // Serialized proof bytes
  publicInputs: {
    nullifier: Uint8Array;
    root: Uint8Array;
    recipient: string;
    relayerFee: bigint;
  };
}

// Generate a STARK proof for withdrawal
async function generateWithdrawalProof(witness: WithdrawalWitness): Promise<StarkProof> {
  // 1. Load WASM prover module
  // 2. Construct circuit inputs from witness
  // 3. Generate STARK proof (this is the expensive step, ~2-10 seconds client-side)
  // 4. Serialize proof to bytes
  // 5. Return proof + public inputs
}
```

### Notes module (`notes/store.ts`)

Encrypted local storage for deposit notes — without these, funds are irrecoverable:

```typescript
interface EncryptedNote {
  id: string;                   // Random UUID
  ciphertext: Uint8Array;       // AES-256-GCM encrypted note data
  iv: Uint8Array;               // Initialization vector
  tag: Uint8Array;              // Authentication tag
  poolContract: string;         // Which pool this note belongs to
  createdAt: number;            // Timestamp
  spent: boolean;               // Whether this note has been withdrawn
}

interface DecryptedNote {
  secret: Uint8Array;
  nullifier: Uint8Array;
  amount: bigint;
  commitment: Uint8Array;
  leafIndex: number;
  stealthPrivKey: Uint8Array;   // Spending key for the stealth deposit address
}

class NoteStore {
  constructor(encryptionKey: Uint8Array);  // Derived from user's password or wallet key

  async save(note: DecryptedNote): Promise<string>;  // Returns note ID
  async load(id: string): Promise<DecryptedNote>;
  async listUnspent(): Promise<DecryptedNote[]>;
  async markSpent(id: string): Promise<void>;
  async export(): Promise<Uint8Array>;    // Encrypted backup blob
  async import(backup: Uint8Array): Promise<number>;  // Returns count imported
}
```

**Critical**: Notes MUST be persisted. If a user loses their notes, they lose access to their deposited funds. The SDK should:
1. Store encrypted notes in IndexedDB (browser) or filesystem (Node.js)
2. Offer an encrypted backup export feature
3. Warn users prominently about backup importance
4. Support cloud backup sync (optional, encrypted end-to-end)

### Relayer client (`relayer/client.ts`)

```typescript
interface RelayerClient {
  // Submit a deposit transaction via the relayer
  submitDeposit(params: {
    signedTx: Uint8Array;       // Pre-signed deposit transaction
    commitment: Uint8Array;
    source: string;             // Stealth address that holds the sBTC
  }): Promise<{ txId: string }>;

  // Submit a withdrawal transaction via the relayer
  submitWithdrawal(params: {
    proof: StarkProof;
    nullifier: Uint8Array;
    root: Uint8Array;
    recipient: string;          // Bob's stealth address
    ephemeralPubKey: Uint8Array;
    relayerFee: bigint;
  }): Promise<{ txId: string }>;

  // Query relayer status
  getStatus(): Promise<{
    pendingDeposits: number;
    pendingWithdrawals: number;
    currentFee: bigint;
  }>;
}
```

---

## Relayer service

### Package: `@satsu/relay`

A standalone Node.js daemon that:

1. Accepts signed deposit and withdrawal transactions from users via REST API
2. Batches transactions to reduce costs and improve privacy (multiple deposits in one block)
3. Submits transactions to the Stacks network, paying the STX gas fee
4. Collects a small sBTC fee from each operation (deducted in the smart contract)
5. Exposes a health check endpoint

### API endpoints

```
POST /api/v1/deposit     — Submit a signed deposit transaction
POST /api/v1/withdraw    — Submit a withdrawal proof + parameters
GET  /api/v1/status      — Relayer status (queue depth, current fee)
GET  /api/v1/health      — Health check
```

### Design principles

- The relayer is **permissionless** — anyone can run one. Users choose which relayer to use.
- The relayer **never has custody** of user funds. It only submits pre-signed transactions.
- The relayer **cannot censor** — if one relayer refuses, users can switch to another.
- The relayer **cannot steal** — smart contract logic ensures sBTC goes to the specified recipient.
- Batch multiple deposits into sequential blocks (not the same block, to avoid timing correlation).
- Use a simple in-memory queue with disk persistence for crash recovery.

---

## Scanner service

### Package: `@satsu/scanner`

A service that monitors the Stacks blockchain for stealth payments addressed to the user.

### How it works

1. Subscribe to `satsu.pool-v1` withdrawal events via **Chainhooks** (Hiro's blockchain event indexer)
2. For each withdrawal event, extract the `ephemeral-pubkey` (R) and `recipient` address
3. Attempt trial decryption: compute `S = viewPrivKey * R` (ECDH), derive expected stealth address
4. If the derived address matches the event's recipient, this payment belongs to the user
5. Derive the spending private key and notify the user

### Chainhook predicate

```json
{
  "chain": "stacks",
  "networks": {
    "mainnet": {
      "if_this": {
        "scope": "contract_call",
        "contract_identifier": "SP...satsu.pool-v1",
        "method": "withdraw"
      },
      "then_that": {
        "http_post": {
          "url": "http://localhost:3100/api/events/withdrawal",
          "authorization_header": "Bearer <token>"
        }
      }
    }
  }
}
```

The scanner can run as:
- An embedded module in the SDK (browser: polls the Stacks API periodically)
- A standalone daemon (server-side: uses Chainhooks for real-time detection)

---

## Cryptographic design

### Hash function

All hashing uses **SHA-256**. This is critical because:
- Clarity has native `sha256` support
- STARK proofs use hash-based commitments (no elliptic curve pairings needed)
- The Merkle tree, commitments, and nullifier hashes all use the same primitive

### Stealth address protocol

Based on DKSAP (Dual-Key Stealth Address Protocol):

```
Meta-address: (K_spend, K_view) — two secp256k1 public keys

Sending to meta-address:
1. r = random scalar
2. R = r * G                         (ephemeral public key, published)
3. S = r * K_view                    (shared secret via ECDH)
4. s = sha256(S)                     (hash to scalar)
5. P_stealth = K_spend + s * G       (stealth public key)
6. addr = stacks_address(P_stealth)  (one-time Stacks address)

Detecting as receiver:
1. S' = k_view * R                   (recover shared secret)
2. s' = sha256(S')                   (same hash)
3. P_stealth' = K_spend + s' * G     (recompute expected key)
4. Check if P_stealth' matches       (if yes, payment is ours)

Spending as receiver:
5. k_stealth = k_spend + s'          (derive spending private key)
```

### ZK circuit (Merkle membership proof)

The STARK circuit proves:

**Statement**: "I know a `secret` and `nullifier` such that `sha256(secret || nullifier || amount)` is a leaf in the Merkle tree with the given `root`, and `sha256(nullifier)` equals the revealed `nullifierHash`."

**Private inputs** (known only to prover):
- `secret` (32 bytes)
- `nullifier` (32 bytes) — the raw nullifier value
- `leafIndex` (uint)
- `merklePathElements` (array of 20 hashes)
- `merklePathIndices` (array of 20 bits)

**Public inputs** (verified on-chain):
- `nullifierHash` = sha256(nullifier)
- `root` (32 bytes) — Merkle root
- `recipient` (Stacks address) — included to prevent front-running
- `relayerFee` (uint) — included to prevent fee manipulation

**Circuit constraints**:
1. `commitment = sha256(secret || nullifier || amount)` — commitment is correctly formed
2. `nullifierHash = sha256(nullifier)` — nullifier hash matches
3. `merkle_verify(commitment, leafIndex, merklePathElements, merklePathIndices) == root` — commitment is in the tree
4. Public inputs are correctly bound to the proof

### Timing delay for deposit privacy

The SDK enforces a minimum delay between funding the stealth address (tx1) and submitting the deposit to the pool (tx2). This delay should be:
- **Minimum**: Wait until at least `MIN_INTERVENING_TRANSFERS` (default: 50) other sBTC transfers have occurred on-chain
- **Maximum**: Configurable upper bound (default: 24 hours)
- **Randomized**: Add jitter within the window to prevent predictable timing patterns

---

## Development environment

### Prerequisites

- Node.js 18+
- Clarinet 2.x (Clarity development CLI) — `brew install clarinet` or from GitHub releases
- Stacks API node (for testnet/mainnet interaction) or use Hiro's hosted API
- Rust toolchain (for STARK prover compilation to WASM)

### Setup

```bash
git clone https://github.com/satsu-fi/satsu.git
cd satsu

# Install Clarity tooling
clarinet check                  # Validate all contracts
clarinet console                # Interactive Clarity REPL

# Install SDK dependencies
cd packages/sdk && npm install
cd ../relay && npm install
cd ../scanner && npm install

# Run local devnet
clarinet integrate              # Spins up local Stacks + Bitcoin nodes
```

### Devnet configuration

Clarinet's devnet provides a local Stacks blockchain with pre-funded accounts. The `Devnet.toml` should configure:
- Pre-deployed `sbtc-token` mock contract (SIP-010 compliant)
- Pre-funded test accounts with STX and mock sBTC
- Fast block times (for rapid iteration)

---

## Testing strategy

### Clarity contract tests

Use Clarinet's built-in testing framework (Vitest + Clarinet SDK):

```typescript
// tests/pool-v1.test.ts
import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

describe("satsu.pool-v1", () => {
  it("should accept a valid deposit", () => {
    // 1. Setup: mint mock sBTC to a test account
    // 2. Approve pool contract for transfer
    // 3. Call deposit() with a valid commitment
    // 4. Assert: Merkle root changed, sBTC transferred, event emitted
  });

  it("should reject a duplicate commitment", () => { /* ... */ });
  it("should reject deposit with wrong denomination", () => { /* ... */ });
  it("should accept a valid withdrawal with proof", () => { /* ... */ });
  it("should reject withdrawal with used nullifier", () => { /* ... */ });
  it("should reject withdrawal with invalid proof", () => { /* ... */ });
  it("should reject withdrawal with unknown root", () => { /* ... */ });
  it("should correctly update Merkle tree frontier", () => { /* ... */ });
  it("should pay relayer fee on withdrawal", () => { /* ... */ });
});
```

### SDK unit tests

Standard Vitest/Jest tests for all crypto operations:

```typescript
// packages/sdk/tests/stealth-address.test.ts
describe("stealth addresses", () => {
  it("should derive matching addresses for sender and receiver", () => {
    // 1. Generate a meta-address (spend + view keys)
    // 2. Sender derives stealth address + ephemeral key R
    // 3. Receiver checks with view key — should match
    // 4. Receiver derives spending key — should produce valid signature
  });

  it("should produce unique addresses for each derivation", () => { /* ... */ });
  it("should not match with wrong view key", () => { /* ... */ });
});
```

### Integration tests

End-to-end tests running on Clarinet's devnet:

1. **Full deposit flow**: Generate stealth keys → fund stealth address → compute commitment → submit deposit via simulated relayer → verify Merkle tree update
2. **Full withdrawal flow**: Generate proof → submit via relayer → verify sBTC arrives at recipient stealth address → verify nullifier is marked used
3. **Double-spend attempt**: Try to withdraw with the same nullifier twice → should fail on second attempt
4. **Scanner detection**: Deposit + withdraw → scanner with receiver's view key should detect the payment

### Property-based tests

For cryptographic code, use property-based testing (e.g., `fast-check`):
- For any random secret/nullifier, `createCommitment` produces a unique commitment
- For any Merkle tree state, `generateProof` produces a proof that `verifyProof` accepts
- For any meta-address, `deriveStealthAddress` + `checkStealthPayment` always agrees
- Inserting N leaves into the incremental tree produces the same root as building a full tree

---

## Security considerations

### Threat model

- **On-chain observer**: Can see all transactions and contract calls. Satsū must prevent correlation of deposits and withdrawals.
- **Compromised relayer**: A malicious relayer can censor (refuse to submit) but cannot steal funds or break privacy. Users can switch relayers.
- **Compromised view key**: Reveals which stealth payments belong to the user but does NOT enable spending. This is by design — view keys are meant for auditors.
- **Lost notes**: If a user loses their encrypted notes (secret + nullifier), the deposited funds are **permanently irrecoverable**. The SDK must aggressively warn users and offer backup solutions.

### Attack vectors to defend against

1. **Timing analysis**: Mitigated by configurable delay between stealth funding and pool deposit, plus relayer batching.
2. **Amount correlation**: Mitigated by fixed-denomination pools. All deposits and withdrawals are the same amount.
3. **Gas price correlation**: The relayer pays gas, so the user's gas spending pattern is not visible.
4. **Merkle tree de-anonymization**: If the anonymity set (number of deposits) is too small, statistical analysis may narrow down the depositor. The pool should display anonymity set size in the UI.
5. **Front-running**: The withdrawal proof binds to the recipient and relayer fee, so a front-runner cannot redirect funds.
6. **Relayer censorship**: Multiple independent relayers should be available. The SDK should support relayer discovery and failover.

### Audit checklist

Before mainnet deployment:
- [ ] Formal verification of Merkle tree insertion logic
- [ ] Independent audit of ZK circuit constraints
- [ ] Fuzzing of Clarity contract inputs (buffer overflows, edge cases)
- [ ] Cryptographic review of stealth address protocol
- [ ] Economic review of relayer incentive structure
- [ ] Stacy static analyzer scan on all Clarity contracts
- [ ] Test with maximum tree capacity (2^20 leaves)
- [ ] Gas cost benchmarking for proof verification

---

## Deployment

### Contract deployment order

1. `satsu.stealth-v1` — no dependencies
2. `satsu.pool-v1` — depends on sBTC token contract address (configured at deploy time)
3. Register the deployer's stealth meta-address as a bootstrap action

### Deployment environments

| Environment | Network | sBTC Contract | Notes |
|-------------|---------|---------------|-------|
| Devnet | Local Clarinet | Mock SIP-010 | Fast blocks, pre-funded accounts |
| Testnet | Stacks testnet | sBTC testnet contract | Use faucet for STX, testnet sBTC |
| Mainnet | Stacks mainnet | Official sBTC contract | Requires security audit first |

### Clarinet deployment plan

Use Clarinet's deployment plan YAML to sequence contract deployments:

```yaml
# deployments/default.testnet-plan.yaml
plan:
  batches:
    - id: 0
      transactions:
        - contract-publish:
            contract-name: stealth-v1
            expected-sender: $DEPLOYER
            path: contracts/stealth-v1.clar
        - contract-publish:
            contract-name: pool-v1
            expected-sender: $DEPLOYER
            path: contracts/pool-v1.clar
```

---

## Coding standards

### Clarity

- 2-space indentation
- Constants: `SCREAMING-KEBAB-CASE` (e.g., `TREE-DEPTH`, `ERR-NOT-AUTHORIZED`)
- Functions: `kebab-case` (e.g., `append-leaf`, `get-current-root`)
- Maps: `kebab-case` (e.g., `used-nullifiers`, `stealth-meta-addresses`)
- Every public function has a doc comment explaining parameters, return value, and possible errors
- Max function length: ~50 lines. Factor complex logic into `define-private` helpers
- All error codes are `uint` constants with `ERR-` prefix, numbered by module (1000s for pool, 2000s for stealth, etc.)

### TypeScript

- Strict mode enabled (`"strict": true` in tsconfig)
- Use `Uint8Array` for all binary data (not `Buffer` — for browser compatibility)
- All async functions return `Promise<T>`, never callbacks
- Use named exports, not default exports
- Zod schemas for all external input validation (relayer API, user input)
- ESLint + Prettier for formatting
- All cryptographic operations in dedicated modules (not inline in business logic)

### Git conventions

- Conventional commits: `feat(pool):`, `fix(sdk):`, `test(stealth):`, `docs:`, `chore:`
- Branch naming: `feat/stealth-registry`, `fix/merkle-overflow`, `test/e2e-deposit`
- PR descriptions must include: what changed, why, and how to test

---

## Build order (suggested implementation sequence)

### Phase 1: Foundation
1. Initialize Clarinet project with directory structure
2. Implement `merkle-tree.clar` (incremental Merkle tree) — this is the hardest Clarity component
3. Write comprehensive Merkle tree tests
4. Implement `nullifier-registry.clar` (simple map, straightforward)
5. Implement `stealth-v1.clar` (registry, no crypto — just storage)

### Phase 2: Core pool
6. Implement `pool-v1.clar` deposit function (integrates Merkle tree + SIP-010 transfers)
7. Implement mock proof verifier (always returns true) for testing
8. Implement `pool-v1.clar` withdrawal function (integrates verifier + nullifiers)
9. Write full deposit/withdrawal integration tests on devnet

### Phase 3: Client SDK
10. Implement `stealth-address.ts` (ECDH + key derivation)
11. Implement `commitment.ts` (sha256 computation matching Clarity)
12. Implement `merkle.ts` (client-side tree, must produce same roots as Clarity)
13. Implement `notes/` module (encryption + storage)
14. Implement `deposit.ts` and `withdraw.ts` transaction builders
15. Cross-test: SDK-generated commitments must match Clarity sha256 output exactly

### Phase 4: ZK proofs
16. Define the STARK circuit for Merkle membership
17. Compile prover to WASM
18. Implement `prover.ts` and `witness.ts`
19. Replace mock verifier with real `proof-verifier.clar`
20. End-to-end test: SDK generates proof → Clarity verifies it

### Phase 5: Relayer + Scanner
21. Implement `@satsu/relay` REST API
22. Implement `@satsu/scanner` with Chainhook integration
23. Full E2E test: Alice deposits via relayer → Bob's scanner detects withdrawal

### Phase 6: Hardening
24. Security review + Stacy static analysis
25. Gas benchmarking on testnet
26. Anonymity set analysis and timing delay tuning
27. Note backup UX implementation
28. Testnet deployment and public testing

