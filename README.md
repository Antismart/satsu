# Satsu

**Private payments on Bitcoin. Stealth deposits. Shielded transfers. Zero knowledge.**

[![Build Status](https://img.shields.io/github/actions/workflow/status/Antismart/satsu/ci.yml?branch=main)](https://github.com/Antismart/satsu/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)]()

---

## What is Satsu?

Satsu is a privacy payment layer built on the [Stacks](https://www.stacks.co/) blockchain (Bitcoin L2). It combines **stealth addresses** with a **ZK-STARK shielded pool** to enable fully private sBTC transactions that settle on Bitcoin.

No on-chain observer can determine:

- **Who deposited** -- stealth address + relayer hides the sender's identity
- **Who received** -- stealth address derivation creates a one-time ephemeral address for the recipient
- **Which deposit funded the withdrawal** -- ZK proof of Merkle membership breaks the transaction graph
- **Who submitted the transaction** -- the relayer submits both deposits and withdrawals on behalf of users

Satsu brings the privacy guarantees of systems like Tornado Cash and Zcash to Bitcoin-settled assets, without trusted setup and without requiring elliptic curve pairings on-chain.

---

## How It Works

Satsu operates through three core flows:

### 1. Stealth Deposit

Alice wants to privately deposit sBTC into the shielded pool.

1. Alice derives a one-time stealth address for herself (client-side ECDH)
2. Alice sends sBTC to that stealth address (appears as a normal SIP-010 transfer)
3. After a configurable timing delay, Alice computes a commitment: `C = sha256(secret || nullifier || amount)`
4. Alice sends the signed deposit transaction to the relayer
5. The relayer submits the deposit to the pool contract -- sBTC is locked and the commitment is appended as a Merkle tree leaf
6. Alice stores an encrypted note locally containing all data needed for future withdrawal

### 2. Shielded Withdrawal

Alice sends funds to Bob without any on-chain link to her deposit.

1. Alice looks up Bob's stealth meta-address from the on-chain registry
2. Alice derives a one-time stealth address for Bob (ECDH + hash)
3. Alice builds a ZK-STARK proof client-side proving she knows a valid commitment in the Merkle tree, revealing only the nullifier (to prevent double-spend) but not the secret or leaf index
4. Alice sends the proof, nullifier, Bob's stealth address, and an ephemeral public key to the relayer
5. The relayer submits the withdrawal -- the pool verifies the proof, checks the nullifier, and releases sBTC to Bob's stealth address
6. Bob's scanner detects the payment by trial-decrypting with his view key

### 3. Stealth Meta-Address Registration

Bob registers his stealth meta-address on-chain so others can derive ephemeral addresses for him. This is a one-time public action -- the meta-address reveals nothing about future payments.

### Privacy Guarantees

| Property | Mechanism |
|---|---|
| Sender privacy (deposit) | Stealth self-address + relayer |
| Sender privacy (withdrawal) | Relayer submits transaction |
| Receiver privacy | Stealth address derivation from meta-address |
| Transaction graph privacy | ZK proof of Merkle membership (no leaf index revealed) |
| Amount privacy | Fixed denomination pools (v1) / Pedersen commitments (v2) |
| Double-spend prevention | Nullifier registry (each nullifier used only once) |

---

## Architecture

```
+-----------------------------------------------------------+
|  @satsu/sdk -- Client layer (TypeScript + WASM)           |
|  +----------------+ +---------------+ +-----------------+ |
|  | Wallet +       | | ZK proof      | | Encrypted note  | |
|  | stealth keys   | | engine        | | store           | |
|  +----------------+ +---------------+ +-----------------+ |
+-----------------------------------------------------------+
|  Stacks L2 -- Clarity smart contracts                     |
|  +-------------------------------------+ +--------------+ |
|  | satsu.pool-v1                       | | Off-chain    | |
|  |  - Deposit handler                  | | services     | |
|  |  - Merkle tree (incremental)        | |              | |
|  |  - Nullifier registry               | | @satsu/relay | |
|  |  - Proof verifier (STARK, sha256)   | | @satsu/      | |
|  +-------------------------------------+ |   scanner    | |
|  | satsu.stealth-v1                    | +--------------+ |
|  |  - Address registry                 |                  |
|  |  - Ephemeral key log               |                  |
|  +-------------------------------------+                  |
+-----------------------------------------------------------+
|  Settlement layer                                         |
|  +------------------------+ +---------------------------+ |
|  | sBTC peg (SIP-010)     | | Bitcoin L1                | |
|  | Trust-minimized        | | Final settlement          | |
|  +------------------------+ +---------------------------+ |
+-----------------------------------------------------------+
```

### Key Design Decisions

- **STARK over SNARK**: Clarity has no native elliptic curve pairing operations. STARKs are hash-based -- verification uses repeated `sha256` calls and Merkle path checks, which Clarity handles efficiently. No trusted setup required.
- **Incremental Merkle tree**: The pool stores only the current root and a frontier array (one node per tree level). Depth 20 supports approximately 1 million deposits with O(log N) insertion cost.
- **Fixed denomination pools (v1)**: Each pool instance accepts exactly one denomination (e.g., 0.1 sBTC). This avoids the need for range proofs. Variable amounts via Pedersen commitments are planned for v2.
- **Relayer-mediated transactions**: The relayer submits all transactions to break address links. It is a permissionless role -- anyone can run a relayer and earn fees.
- **Stealth addresses at both ends**: Applied on deposit (sender stealth-funds the pool) and withdrawal (receiver gets funds at an ephemeral stealth address). Full sender + receiver privacy.

---

## Repository Structure

```
satsu/
├── contracts/                        # Clarity smart contracts
│   ├── pool-v1.clar                  # Core privacy pool (deposit/withdraw)
│   ├── merkle-tree.clar              # Incremental Merkle tree (depth 20)
│   ├── nullifier-registry.clar       # Double-spend prevention
│   ├── proof-verifier.clar           # STARK proof verification
│   ├── stealth-v1.clar               # Stealth address registry
│   ├── sbtc-token.clar               # Mock SIP-010 token (devnet)
│   └── traits/
│       ├── pool-trait.clar           # Pool interface trait
│       └── verifier-trait.clar       # Verifier interface trait
├── tests/                            # Clarity contract tests (Vitest)
│   ├── pool-v1.test.ts
│   ├── merkle-tree.test.ts
│   ├── nullifier-registry.test.ts
│   ├── stealth-v1.test.ts
│   └── integration/
│       ├── deposit-flow.test.ts      # End-to-end deposit flow
│       └── withdrawal-flow.test.ts   # End-to-end withdrawal flow
├── packages/
│   ├── sdk/                          # @satsu/sdk -- TypeScript client library
│   │   └── src/
│   │       ├── wallet/               # Stealth key generation + ECDH
│   │       ├── pool/                 # Commitments, Merkle, deposit/withdraw
│   │       ├── proof/                # ZK circuit, witness, STARK prover
│   │       ├── notes/                # Encrypted note storage
│   │       ├── relayer/              # Relayer API client
│   │       └── utils/                # Crypto helpers + constants
│   ├── relay/                        # @satsu/relay -- Relayer daemon
│   │   └── src/
│   │       ├── index.ts              # Entrypoint
│   │       ├── queue.ts              # Transaction batching queue
│   │       ├── submitter.ts          # Stacks transaction submission
│   │       ├── fee-manager.ts        # Fee calculation
│   │       └── health.ts             # Health check endpoint
│   └── scanner/                      # @satsu/scanner -- Stealth payment scanner
│       └── src/
│           ├── index.ts              # Entrypoint
│           ├── chainhook.ts          # Chainhook event subscription
│           ├── stealth-detector.ts   # View-key trial decryption
│           └── notification.ts       # Payment notification handler
├── circuits/                         # ZK circuit definitions
│   └── membership.json               # Merkle membership circuit
├── deployments/                      # Clarinet deployment plans
│   ├── default.devnet-plan.yaml
│   ├── default.simnet-plan.yaml
│   └── default.testnet-plan.yaml
├── Clarinet.toml                     # Clarinet project configuration
└── package.json                      # Root workspace
```

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Clarinet](https://github.com/hirosystems/clarinet) 2.x -- `brew install clarinet` or from [GitHub releases](https://github.com/hirosystems/clarinet/releases)

### Clone and Setup

```bash
git clone https://github.com/Antismart/satsu.git
cd satsu
npm install
```

### Validate Contracts

```bash
clarinet check
```

### Run Contract Tests

```bash
npm test
```

### Run SDK Tests

```bash
cd packages/sdk
npm install
npm test
```

### Launch Local Devnet

```bash
clarinet integrate
```

This spins up a local Stacks + Bitcoin node pair with pre-funded accounts and the mock sBTC token deployed.

---

## Smart Contracts

All contracts target Clarity 3 (Stacks Nakamoto era) and are configured in `Clarinet.toml`.

### `merkle-tree.clar`

Incremental Merkle tree library with a depth of 20, supporting approximately 1 million deposits. Uses a frontier array (one hash per level) for O(log N) insertions with O(log N) storage. Pre-computed zero hashes represent empty subtrees at each level. All hashing uses the native Clarity `sha256` built-in.

### `pool-v1.clar`

Core privacy pool contract. Handles deposits (accepting sBTC + commitment, appending to the Merkle tree), withdrawals (verifying ZK proofs, checking nullifiers, releasing sBTC), and relayer fee distribution. The pool denomination is fixed at 0.1 sBTC (10,000,000 micro-sBTC) per deposit/withdrawal.

### `stealth-v1.clar`

Stealth address registry. Maps principals to stealth meta-addresses (a spend public key + view public key, each 33-byte compressed secp256k1 keys). Optionally links `.btc` BNS names to meta-addresses for discoverability.

### `nullifier-registry.clar`

Tracks spent nullifiers to prevent double-spend. Each nullifier hash can only be marked as used once. Queried by the pool contract during withdrawal verification.

### `proof-verifier.clar`

STARK proof verification in Clarity. Implements FRI (Fast Reed-Solomon Interactive Oracle Proof) verification using `sha256` Merkle authentication paths, constraint evaluation, and FRI layer consistency checks. Proofs are serialized as buffers up to 2048 bytes.

### `sbtc-token.clar`

Mock SIP-010 compliant token for local development and testing. Simulates sBTC behavior on devnet with mintable supply. Not deployed to testnet or mainnet.

### Traits

- **`pool-trait.clar`** -- Interface trait for pool contracts (deposit, withdraw, query functions)
- **`verifier-trait.clar`** -- Interface trait for proof verifier implementations

---

## SDK Usage

The `@satsu/sdk` package provides the complete client-side API for interacting with Satsu.

### Generate Stealth Keys

```typescript
import { generateStealthKeys } from '@satsu/sdk';

// Generate a spend + view keypair
const keys = generateStealthKeys();
// keys.spendPrivKey  -- 32-byte private key
// keys.spendPubKey   -- 33-byte compressed public key
// keys.viewPrivKey   -- 32-byte private key
// keys.viewPubKey    -- 33-byte compressed public key
```

### Derive a Stealth Address

```typescript
import { deriveStealthAddress } from '@satsu/sdk';

// Derive a one-time stealth address for a recipient
const stealth = deriveStealthAddress({
  spendPubKey: recipientSpendPubKey,
  viewPubKey: recipientViewPubKey,
});
// stealth.stealthAddress   -- one-time Stacks address
// stealth.ephemeralPubKey  -- published on-chain for detection
```

### Create a Deposit Commitment

```typescript
import { createCommitment } from '@satsu/sdk';

// Create a commitment for the pool denomination (0.1 sBTC)
const commitment = createCommitment(10_000_000n);
// commitment.secret       -- 32-byte random secret
// commitment.nullifier    -- 32-byte random nullifier
// commitment.commitment   -- sha256(secret || nullifier || amount)
// commitment.nullifierHash -- sha256(nullifier), revealed at withdrawal
```

### Build and Submit a Deposit

```typescript
import { buildDepositTx, buildApprovalTx, submitDeposit } from '@satsu/sdk';

// 1. Approve the pool contract to transfer sBTC
const approvalTx = buildApprovalTx({ amount: 10_000_000n });

// 2. Build the deposit transaction
const depositTx = buildDepositTx({
  commitment: commitment.commitment,
  source: stealthAddress,
});

// 3. Submit via relayer
const result = await submitDeposit({ signedTx: depositTx });
```

### Generate a Withdrawal Proof

```typescript
import { generateWithdrawalProof, RelayerClient } from '@satsu/sdk';

// Generate the ZK-STARK proof (runs client-side, ~2-10 seconds)
const proof = await generateWithdrawalProof({
  secret: note.secret,
  nullifier: note.nullifier,
  leafIndex: note.leafIndex,
  merklePathElements: merkleProof.pathElements,
  merklePathIndices: merkleProof.pathIndices,
  root: currentRoot,
  recipient: bobStealthAddress,
  relayerFee: 50_000n,
});

// Submit withdrawal via relayer
const relayer = new RelayerClient('http://localhost:3000');
const result = await relayer.submitWithdrawal({
  proof,
  nullifier: commitment.nullifierHash,
  root: currentRoot,
  recipient: bobStealthAddress,
  ephemeralPubKey: stealth.ephemeralPubKey,
  relayerFee: 50_000n,
});
```

### Detect Incoming Payments

```typescript
import { checkStealthPayment } from '@satsu/sdk';

// Check if an on-chain withdrawal event is addressed to us
const check = checkStealthPayment(
  ephemeralPubKeyFromEvent,  // R from the withdrawal event
  myViewPrivKey,
  mySpendPubKey,
);

if (check.match) {
  // Payment is ours
  // check.stealthAddress -- the receiving address
  // check.stealthPrivKey -- the spending key
}
```

---

## Running the Relayer

The `@satsu/relay` package is a standalone Node.js daemon that accepts signed transactions from users and submits them to the Stacks network on their behalf.

```bash
cd packages/relay
npm install
```

### Development

```bash
PORT=3000 STACKS_API_URL=http://localhost:20443 npm run dev
```

### Production

```bash
npm run build
PORT=3000 STACKS_API_URL=https://api.mainnet.hiro.so npm start
```

### API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/deposit` | Submit a signed deposit transaction |
| `POST` | `/api/v1/withdraw` | Submit a withdrawal proof + parameters |
| `GET` | `/api/v1/status` | Relayer status (queue depth, current fee) |
| `GET` | `/api/v1/health` | Health check |

The relayer is **permissionless** -- anyone can run one. It never has custody of user funds, cannot steal (smart contract logic enforces correct recipients), and cannot unilaterally censor (users can switch relayers).

---

## Running the Scanner

The `@satsu/scanner` package monitors the Stacks blockchain for stealth payments addressed to the user, powered by [Chainhooks](https://docs.hiro.so/chainhook).

```bash
cd packages/scanner
npm install
```

### Development

```bash
VIEW_PRIVATE_KEY=<hex> SPEND_PUBLIC_KEY=<hex> npm run dev
```

### How It Works

1. Subscribes to `satsu.pool-v1` withdrawal events via Chainhooks
2. For each event, extracts the ephemeral public key (R) and recipient address
3. Performs trial decryption: computes the ECDH shared secret using the view private key
4. If the derived stealth address matches the event's recipient, the payment belongs to the user
5. Derives the spending private key and triggers a notification

---

## Security

### Threat Model

- **On-chain observer**: Can see all transactions and contract calls. Satsu prevents correlation of deposits and withdrawals through stealth addresses, the shielded pool, and relayer-mediated submission.
- **Compromised relayer**: Can censor (refuse to submit transactions) but cannot steal funds or break privacy. Users can switch to another relayer at any time.
- **Compromised view key**: Reveals which stealth payments belong to the user but does NOT enable spending. View keys are designed for audit scenarios.
- **Lost notes**: If a user loses their encrypted notes (containing the secret and nullifier), deposited funds are **permanently irrecoverable**. The SDK provides encrypted backup and export features.

### Attack Mitigations

| Attack Vector | Mitigation |
|---|---|
| Timing analysis | Configurable delay between stealth funding and pool deposit, plus relayer batching |
| Amount correlation | Fixed-denomination pools (all deposits/withdrawals are the same amount) |
| Gas price correlation | Relayer pays gas; user's spending pattern is not visible |
| Merkle tree de-anonymization | Pool displays anonymity set size; privacy improves with more deposits |
| Front-running | Withdrawal proof binds to the recipient and relayer fee |
| Relayer censorship | Multiple independent relayers; SDK supports relayer discovery and failover |

### Audit Status

Satsu has **not yet been audited**. The following must be completed before mainnet deployment:

- Formal verification of Merkle tree insertion logic
- Independent audit of ZK circuit constraints
- Fuzzing of Clarity contract inputs
- Cryptographic review of the stealth address protocol
- Economic review of the relayer incentive structure
- Gas cost benchmarking for proof verification

### Responsible Disclosure

If you discover a security vulnerability, please report it privately. Do not open a public issue. Contact the maintainers through the repository's security advisory feature at [https://github.com/Antismart/satsu/security/advisories](https://github.com/Antismart/satsu/security/advisories).

---

## Development

### Prerequisites

- Node.js 18+
- Clarinet 2.x
- Rust toolchain (for STARK prover compilation to WASM)

### Setup

```bash
git clone https://github.com/Antismart/satsu.git
cd satsu
npm install

# Validate contracts
clarinet check

# Interactive Clarity REPL
clarinet console
```

### Testing

```bash
# Run all contract tests
npm test

# Run contract tests with coverage and cost report
npm run test:report

# Watch mode (re-runs on file changes)
npm run test:watch

# Run SDK tests
cd packages/sdk && npm test

# Run relayer tests
cd packages/relay && npm test

# Run scanner tests
cd packages/scanner && npm test
```

### Project Configuration

- **Smart contracts**: Configured in `Clarinet.toml`. All contracts use Clarity version 3, epoch 3.0.
- **Contract tests**: Use Vitest with the `vitest-environment-clarinet` package and `@stacks/clarinet-sdk`.
- **SDK/Relay/Scanner**: Each package has its own `tsconfig.json` and `vitest.config.ts`. TypeScript strict mode is enabled.

### Contributing

1. Fork the repository
2. Create a feature branch (`feat/your-feature`) following conventional commit naming
3. Write tests for your changes
4. Run `clarinet check` and `npm test` to verify nothing is broken
5. Submit a pull request with a description of what changed, why, and how to test it

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat(pool):`, `fix(sdk):`, `test(stealth):`, `docs:`, `chore:`.

---

## License

[MIT](https://opensource.org/licenses/MIT)
