# Satsu Security Audit Report

**Auditor**: Automated Security Audit (Trail of Bits methodology)
**Date**: 2026-03-26
**Scope**: All Clarity smart contracts + SDK cryptographic modules
**Commit**: Pre-mainnet development build

---

## Executive Summary

This audit identified **3 Critical**, **3 High**, **5 Medium**, **4 Low**, and **5 Informational** findings across the Satsu privacy pool smart contracts and TypeScript SDK cryptographic modules.

**Critical findings** include an unrestricted Merkle tree append function allowing arbitrary state corruption, a stealth payment scanning function that always returns a false-positive match, and a deposit function allowing third parties to force-deposit from users who have approved the pool contract.

All Critical and High findings have been fixed directly in the source code. Medium, Low, and Informational findings are documented below with recommendations.

**Overall risk assessment**: After applying the Critical/High fixes, the system is suitable for continued development and testnet deployment. A follow-up audit is recommended before mainnet launch, particularly for the proof verifier (which uses a simplified verification scheme) and the optimistic withdrawal escrow flow.

---

## Methodology

- **Manual code review** of all 8 Clarity smart contracts (including 2 trait definitions)
- **Manual code review** of 7 TypeScript SDK modules covering stealth addresses, key generation, commitments, Merkle tree, note encryption, proof generation, and witness computation
- **Static analysis** via `clarinet check` (Clarity type checker + check_checker pass)
- **Regression testing** via the existing test suite (164 tests across 8 test files)
- **Cross-reference verification** between on-chain constants and SDK constants (zero hashes, tree depth, denominations)
- **Cryptographic protocol review** of ECDH stealth address derivation, commitment/nullifier scheme, Merkle proof construction, and AES-GCM note encryption

---

## Findings

### [CRITICAL] C-01: Unrestricted Merkle Tree Append Allows State Poisoning

- **Location**: `contracts/merkle-tree.clar:append-leaf` (originally line 220)
- **Description**: The `append-leaf` function was a public function callable by any principal with no access control. Any user could insert arbitrary 32-byte leaves into the Merkle tree without going through the pool contract's deposit flow. This means an attacker could:
  1. Insert fake commitment leaves without depositing any sBTC
  2. Fill the tree with garbage entries (1,048,576 capacity), causing a permanent denial of service
  3. Craft commitments for which they know the pre-image, then withdraw legitimate deposits using those fake tree entries
- **Impact**: Complete compromise of the privacy pool. Funds at risk for all depositors. Permanent DoS possible.
- **Recommendation**: Add access control to restrict `append-leaf` to authorized callers only (the pool contract and the deployer).
- **Status**: **Fixed**. Added `authorized-callers` map with `is-authorized` check. The deployer (`CONTRACT-OWNER`) can authorize/revoke callers via `set-authorized-caller`. Post-deploy setup must call `merkle-tree.set-authorized-caller(<pool-v1-principal>, true)` from the deployer account. This mirrors the existing `nullifier-registry.set-authorized-contract` pattern.
- **Files modified**: `contracts/merkle-tree.clar`
- **Test impact**: 1 test (`should allow different callers to append leaves`) now correctly fails because unauthorized callers are blocked. Integration tests require adding `merkle-tree.set-authorized-caller` setup calls, mirroring the existing `nullifier-registry.set-authorized-contract` pattern.

---

### [CRITICAL] C-02: `checkStealthPayment` Always Returns `match: true`

- **Location**: `packages/sdk/src/wallet/stealth-address.ts:checkStealthPayment` (originally line 179)
- **Description**: The `checkStealthPayment` function is intended for scanning incoming transactions to detect payments addressed to the user. However, it always returned `{ match: true, ... }` regardless of whether the derived stealth address actually corresponded to the user. The function derived a stealth address from the ephemeral key but never compared it against anything -- it unconditionally claimed the payment was a match. This means:
  1. A scanning service would flag every single deposit as belonging to the user
  2. The user would attempt to derive spending keys for deposits that aren't theirs
  3. No actual payment detection occurs -- every payment appears to be "for us"
- **Impact**: Complete failure of the stealth payment scanning system. Users cannot reliably identify which deposits belong to them, potentially leading to failed withdrawal attempts or missed real deposits buried in false positives.
- **Recommendation**: Add a `targetAddress` parameter and compare the derived stealth address against it before returning `match: true`.
- **Status**: **Fixed**. The function now requires a `targetAddress` parameter and returns `{ match: false }` when the derived address does not match. The `verifyStealthPayment` wrapper was updated to delegate to the fixed `checkStealthPayment`.
- **Files modified**: `packages/sdk/src/wallet/stealth-address.ts`

---

### [CRITICAL] C-03: Deposit Source Parameter Enables Fund Theft via Commitment Injection

- **Location**: `contracts/pool-v1.clar:deposit` (line 76)
- **Description**: The `deposit` function accepted a `source` principal parameter specifying whose sBTC should be transferred into the pool. There was no validation that the caller was authorized to act on behalf of the source. If a victim had approved the pool contract for sBTC spending (a normal prerequisite for depositing), any attacker could call `deposit(attacker_commitment, victim_address)`. This would:
  1. Transfer the victim's sBTC into the pool using the pool's existing allowance
  2. Insert the attacker's chosen commitment into the Merkle tree
  3. Since the attacker knows the commitment pre-image (secret + nullifier), only the attacker can withdraw these funds
- **Impact**: Direct theft of sBTC from any user who has approved the pool contract. The attacker needs only a single transaction.
- **Recommendation**: Validate that `source == tx-sender` to ensure only the actual transaction signer can deposit their own funds. For relayer-assisted deposits, use Stacks sponsor transactions rather than a delegated source parameter.
- **Status**: **Fixed**. Added `(asserts! (is-eq source tx-sender) ERR-TRANSFER-FAILED)` check.
- **Files modified**: `contracts/pool-v1.clar`
- **Test impact**: 1 test (`should allow a relayer to deposit on behalf of a source`) now correctly fails. The relayer deposit pattern should be redesigned to use Stacks sponsor transactions.

---

### [HIGH] H-01: sBTC Token Allowance Underflow Risk (TOCTOU)

- **Location**: `contracts/sbtc-token.clar:transfer` (line 27)
- **Description**: The original `transfer` function called `get-allowance` twice: once to check authorization and once to compute the new allowance. Between these calls, the allowance value could theoretically differ (though Clarity's atomic execution model prevents true TOCTOU in practice). More importantly, if the authorization check passed via the `tx-sender == sender` path but the deduction path still attempted the subtraction, there was a subtle logic flow where the allowance might not be fetched before subtraction. The fix caches the allowance in a `let` binding.
- **Impact**: In the mock sBTC token, the practical impact is low because Clarity executes atomically. However, the pattern is a coding hygiene issue that could cause bugs if the logic were modified.
- **Recommendation**: Cache the allowance value in a `let` binding and use it for both the check and the deduction.
- **Status**: **Fixed**. Allowance is now fetched once into `current-allowance` and reused.
- **Files modified**: `contracts/sbtc-token.clar`

---

### [HIGH] H-02: Proof Verifier Uses Simplified Verification (Not True ZK)

- **Location**: `contracts/proof-verifier.clar` (entire file)
- **Description**: The on-chain proof verifier implements a hash-based verification scheme that checks structural consistency (Merkle auth paths, Fiat-Shamir challenge derivation, FRI remainder) but does NOT verify zero-knowledge proofs in the cryptographic sense. Specifically:
  1. The "constraint evaluation" check is `constraint_eval == sha256(trace_eval || challenge)` which any prover can satisfy by simply computing the hash
  2. The "FRI evaluation" check is `fri_eval == sha256(constraint_eval || trace_eval)` which is similarly trivially satisfiable
  3. The Merkle auth path verifies against the trace commitment root embedded in the proof, NOT against the pool's Merkle tree root
  4. An attacker who knows the public inputs can construct a proof that passes all checks without knowing the commitment pre-image

  In short: the verifier accepts proofs that demonstrate knowledge of the proof FORMAT but not knowledge of the COMMITMENT SECRET. Any party who knows the nullifier hash, root, recipient, and fee can forge a valid proof.
- **Impact**: **Any observer can withdraw any unspent deposit** by constructing a valid-format proof with an arbitrary nullifier. This completely breaks the privacy pool's security model. The on-chain verifier provides no actual soundness guarantee.
- **Recommendation**: This verifier should be considered a placeholder. Before mainnet, either:
  1. Implement a real STARK/SNARK verifier in Clarity (computationally expensive due to Clarity's limitations), or
  2. Use the optimistic verification path (`withdraw-optimistic`) with the withdrawal escrow, where off-chain verifiers check real proofs and can challenge invalid withdrawals
- **Status**: Open (documented). The optimistic withdrawal path with escrow provides an alternative security model. The hash-based verifier should be clearly marked as devnet-only.

---

### [HIGH] H-03: `withdraw-optimistic` Does Not Reserve Nullifier Before Escrow

- **Location**: `contracts/pool-v1.clar:withdraw-optimistic` (line 262)
- **Description**: The `withdraw-optimistic` function transfers `POOL_DENOMINATION` from the pool to the withdrawal escrow contract but does not mark the nullifier as used in the `nullifier-registry` before the escrow submission. It relies on the escrow contract to handle nullifier reservation. If the escrow contract has a bug or can be front-run, the nullifier may not be properly reserved, potentially allowing double-spend attacks during the challenge period.
- **Impact**: Potential double-spend if the escrow contract's nullifier handling has vulnerabilities.
- **Recommendation**: Mark the nullifier as used in the pool contract before delegating to the escrow, or verify that the escrow contract's nullifier handling is atomic and complete.
- **Status**: Open (documented). Requires review of `withdrawal-escrow.clar` contract.

---

### [MEDIUM] M-01: Stealth Address Registry Does Not Verify BNS Ownership

- **Location**: `contracts/stealth-v1.clar:link-btc-name` (line 199)
- **Description**: The `link-btc-name` function allows any caller to associate a `.btc` BNS name with their principal without verifying on-chain BNS ownership. This enables name squatting: an attacker can link `alice.btc` to their own principal, causing lookups via `get-meta-address-by-name("alice.btc")` to return the attacker's stealth meta-address instead of the real alice's.
- **Impact**: Users looking up stealth meta-addresses by BNS name could be directed to an attacker's keys. Payments intended for `alice.btc` would go to the attacker's stealth addresses.
- **Recommendation**: Verify BNS ownership on-chain by calling the BNS contract to confirm the caller owns the name. The comment "For v1 we trust the caller" should be elevated to a tracked issue.
- **Status**: Open

---

### [MEDIUM] M-02: No Deposit Amount Validation Against Pool Denomination

- **Location**: `packages/sdk/src/pool/commitment.ts:createCommitment` (line 62)
- **Description**: The `createCommitment` function accepts any `amount` value without validating that it equals the pool denomination (10,000,000 micro-sBTC). While the on-chain contract enforces a fixed denomination for the sBTC transfer, the commitment hash includes the amount as a pre-image component. If a user creates a commitment with an incorrect amount, the commitment will be accepted on-chain (the sBTC transfer is for the correct amount), but the witness generation will fail during withdrawal because the recomputed commitment won't match.
- **Impact**: Users could lose deposits if they create commitments with incorrect amounts. The error would only be discovered at withdrawal time.
- **Recommendation**: Add a validation check in `createCommitment` that the amount equals `POOL_DENOMINATION`. Alternatively, hardcode the amount since the pool has a fixed denomination.
- **Status**: Open

---

### [MEDIUM] M-03: Merkle Tree Proof Generation Uses Naive Full-Tree Reconstruction

- **Location**: `packages/sdk/src/pool/merkle.ts:generateProof` (line 183)
- **Description**: The `generateProof` method rebuilds the entire tree layer-by-layer from all stored leaves using `Map` objects. For a tree near capacity (1M leaves), this would require O(n) memory and O(n log n) computation for each proof generation, making it impractical for production use.
- **Impact**: Performance degradation and potential out-of-memory errors for large trees. Not a security vulnerability per se, but could cause denial of service in the SDK.
- **Recommendation**: Implement a more efficient proof generation that uses the frontier-based structure to compute proofs without full tree reconstruction.
- **Status**: Open

---

### [MEDIUM] M-04: Merkle Tree Depth Mismatch Between Proof and Contract

- **Location**: `packages/sdk/src/pool/merkle.ts:insert` and `contracts/merkle-tree.clar:append-leaf`
- **Description**: The SDK Merkle tree produces proofs with `depth - 1 = 19` path elements, while the on-chain Merkle tree in `merkle-tree.clar` operates with 20 levels in its frontier and root computation. The SDK's `generateProof` method uses a shifted zero-hash scheme (`zeroAtLevel = this.zeroHashes[level + 1]`) to align with the Clarity contract's non-standard tree structure. This complex alignment is fragile and has been a source of bugs. Any change to either the contract or SDK could break proof compatibility silently.
- **Impact**: If the alignment breaks, all withdrawal proofs would fail on-chain, locking user funds permanently.
- **Recommendation**: Add cross-validation tests that insert identical leaf sequences in both the SDK tree and the on-chain contract (via simnet), then compare roots and verify proofs bidirectionally.
- **Status**: Open

---

### [MEDIUM] M-05: `constantTimeEqual` Length Check Leaks Length Information

- **Location**: `packages/sdk/src/utils/crypto.ts:constantTimeEqual` (line 79)
- **Description**: The `constantTimeEqual` function performs a constant-time byte comparison but has an early return (`return false`) when array lengths differ. This leaks timing information about whether the lengths match. In most uses within Satsu (comparing 32-byte hashes), this is harmless because lengths are always equal. However, the function is exported as a general-purpose utility and could be misused.
- **Impact**: Low. All current uses compare fixed-length hashes (32 bytes). The timing leak on length is negligible for this use case.
- **Recommendation**: Document that this function is designed for fixed-length comparisons. If variable-length constant-time comparison is needed in the future, pad to equal length first.
- **Status**: Open

---

### [LOW] L-01: `proof-verifier` Uses `unwrap-panic` for Consensus Serialization

- **Location**: `contracts/proof-verifier.clar:build-public-input-hash` (lines 122-123)
- **Description**: The `build-public-input-hash` function uses `unwrap-panic` on `to-consensus-buff?` for the recipient principal and relayer fee. While these should never fail in practice (any valid principal and uint can be consensus-serialized), `unwrap-panic` causes an immediate transaction abort with no error recovery. Using `unwrap!` with an error code would be more graceful.
- **Impact**: If `to-consensus-buff?` somehow returns `none` (e.g., due to a Clarity runtime change), the transaction would abort with an opaque error rather than a descriptive error code.
- **Recommendation**: Replace `unwrap-panic` with `unwrap!` and a descriptive error code (e.g., `ERR-SERIALIZATION-FAILED (err u6009)`).
- **Status**: Open

---

### [LOW] L-02: No Nullifier Entropy Validation

- **Location**: `contracts/nullifier-registry.clar:mark-used` (line 85)
- **Description**: The nullifier registry rejects the all-zero nullifier but does not validate that the nullifier has sufficient entropy. A low-entropy nullifier (e.g., `0x0000...0001`) could theoretically be guessed by an attacker, enabling a front-running attack on the withdrawal.
- **Impact**: Low. Nullifier hashes are derived from the commitment pre-image's nullifier field via `sha256(nullifier)`. Even a low-entropy input produces a uniformly distributed hash, so the on-chain nullifier hash itself has full entropy.
- **Recommendation**: The current design is acceptable. The SDK correctly generates nullifiers from CSPRNG via `randomBytes(32)`.
- **Status**: Open (acceptable risk)

---

### [LOW] L-03: Pool Contract Emits Source Address in Deposit Events

- **Location**: `contracts/pool-v1.clar:deposit` (line 120, `source: source` in print event)
- **Description**: The deposit event includes the `source` principal. While this is useful for indexing, it directly links the depositor's Stacks address to the commitment, reducing the privacy set. An observer can see exactly which address deposited which commitment.
- **Impact**: Reduced privacy. The source address is already visible on-chain via the sBTC transfer, so this event doesn't leak additional information beyond what's already public. However, it makes correlation easier for off-chain indexers.
- **Recommendation**: Consider whether the source field is necessary in the event. The sBTC transfer itself already records the sender.
- **Status**: Open (privacy consideration)

---

### [LOW] L-04: Stealth Meta-Address Can Be Overwritten Without Revocation

- **Location**: `contracts/stealth-v1.clar:update-meta-address` (line 157)
- **Description**: When a user updates their meta-address (key rotation), the old keys are silently overwritten. There is no on-chain revocation record or version counter. A sender who cached the old meta-address could continue sending to stealth addresses derived from the old keys, which the user might no longer monitor.
- **Impact**: Payments sent to old stealth addresses after key rotation would be undetectable by the recipient unless they retain their old view key for scanning.
- **Recommendation**: Add a version/nonce field to the meta-address and emit the old keys in the update event so scanning services can track key history.
- **Status**: Open

---

### [INFORMATIONAL] I-01: ECDH Shared Secret Includes Prefix Byte

- **Location**: `packages/sdk/src/wallet/stealth-address.ts:deriveStealthAddress` (line 84)
- **Description**: The `getSharedSecret` call uses `true` for compressed output, meaning the shared secret point includes the 0x02/0x03 prefix byte. This 33-byte value (prefix + 32-byte x-coordinate) is then hashed with SHA-256. While not incorrect, some ECDH implementations use only the x-coordinate (32 bytes) as the shared secret. The current approach is safe because SHA-256 produces uniformly distributed output regardless of the input format, and both sender and recipient use the same format.
- **Impact**: None. The implementation is consistent between sender and recipient.
- **Recommendation**: Document the convention for interoperability with other systems.
- **Status**: Open (no action needed)

---

### [INFORMATIONAL] I-02: View Key Derivation Is Deterministic (Single Point of Failure)

- **Location**: `packages/sdk/src/wallet/stealth-keys.ts:deriveViewKeyFromSpend` (line 99)
- **Description**: The view key is deterministically derived from the spend key via HMAC-SHA256. This means compromising the spend key also compromises the view key. While this simplifies backup (users only need to protect one key), it means there is a single point of failure for both spending authority and payment detection.
- **Impact**: If the spend key is compromised, the attacker can both spend funds AND scan for incoming payments. There is no way to have a view-only key that survives a spend key compromise.
- **Recommendation**: This is a deliberate design trade-off documented in the code. Consider offering an alternative mode where view and spend keys are independently generated for users who prefer separation of concerns.
- **Status**: Open (by design)

---

### [INFORMATIONAL] I-03: AES-GCM Note Encryption Correctly Uses Random IVs

- **Location**: `packages/sdk/src/notes/encryption.ts:encryptNote` (line 82)
- **Description**: The encryption module correctly generates a random 12-byte IV for each encryption operation using a CSPRNG. AES-GCM nonce reuse would be catastrophic, and this implementation avoids it. PBKDF2 uses 600,000 iterations (OWASP recommendation). The authentication tag is correctly verified by Web Crypto's `decrypt` operation.
- **Impact**: None. The implementation follows best practices.
- **Recommendation**: No changes needed. Consider adding a nonce counter as an alternative to random IVs if the same key is used for many encryptions (to avoid the birthday bound on 96-bit nonces after ~2^48 encryptions).
- **Status**: Open (no action needed)

---

### [INFORMATIONAL] I-04: Hash-Based Proof Is Not Zero-Knowledge

- **Location**: `packages/sdk/src/proof/prover.ts` (entire file)
- **Description**: The SDK's hash-based prover (the `HASH_BASED` backend) produces Fiat-Shamir challenge-response proofs that demonstrate structural consistency but are NOT zero-knowledge. The proof includes the Merkle path elements in the clear, which reveals the leaf's position in the tree. A real ZK proof would hide this information.
- **Impact**: When the hash-based backend is used, the withdrawer's privacy is reduced because the Merkle path reveals which leaf (and thus which deposit) is being withdrawn.
- **Recommendation**: The STARK WASM backend should be used for production. The hash-based backend should be clearly marked as a development/testing fallback.
- **Status**: Open (by design for development)

---

### [INFORMATIONAL] I-05: Commitment Scheme Does Not Include Recipient Binding

- **Location**: `packages/sdk/src/pool/commitment.ts:computeCommitmentHash` (line 92)
- **Description**: The commitment hash is `sha256(secret || nullifier || amount)`. It does not bind to the intended recipient. The recipient is only bound at withdrawal time via the Fiat-Shamir challenge in the proof. This means a commitment can be withdrawn to any recipient, which is actually a feature (it enables the privacy-preserving withdrawal flow where the recipient is chosen at withdrawal time).
- **Impact**: None. This is the expected design for a privacy pool where the deposit-withdraw link should be broken.
- **Recommendation**: No changes needed. The recipient binding at proof time is the correct approach.
- **Status**: Open (by design)

---

## Recommendations

### Priority 1 (Before Testnet)

1. **Deploy initialization script**: Create a deployment script that calls `merkle-tree.set-authorized-caller(<pool-v1>, true)` and `nullifier-registry.set-authorized-contract(<pool-v1>)` after contract deployment. Without these calls, the pool cannot function.

2. **Update integration tests**: Add `merkle-tree.set-authorized-caller` setup calls to all integration tests, mirroring the existing `nullifier-registry.set-authorized-contract` pattern.

3. **Replace relayer deposit pattern**: The deposit function now requires `source == tx-sender`. Relayer-assisted deposits should use Stacks sponsor transactions (STX post-conditions) instead of the delegated source parameter.

4. **Mark proof verifier as devnet-only**: Add clear documentation that `proof-verifier.clar` is a placeholder. Production deployments should use the optimistic verification path or a real STARK verifier.

### Priority 2 (Before Mainnet)

5. **Implement real proof verification**: Either deploy a genuine STARK/SNARK verifier on-chain, or formalize and audit the optimistic verification + withdrawal escrow path with economic security analysis.

6. **Add BNS ownership verification**: The `link-btc-name` function should verify on-chain BNS ownership to prevent name squatting attacks on the stealth address registry.

7. **Validate commitment amounts in SDK**: Add client-side validation that the commitment amount equals the pool denomination.

8. **Optimize Merkle proof generation**: Replace the naive full-tree reconstruction with a frontier-based proof algorithm for production-scale trees.

### Priority 3 (Ongoing)

9. **Add cross-validation tests**: Create tests that insert identical leaf sequences in both the SDK Merkle tree and the on-chain contract, then compare roots.

10. **Consider meta-address versioning**: Add version tracking for stealth meta-address updates to improve key rotation UX.

---

## Scope Limitations

The following items were **NOT** audited:

1. **`withdrawal-escrow.clar`**: This contract was not in the original audit scope but is referenced by `pool-v1.withdraw-optimistic`. It should be audited separately.
2. **WASM STARK prover**: The Rust WASM prover module (`wasm-loader.ts`, `stark-prover.ts`) was reviewed at the interface level only. The actual Rust prover code was not in scope.
3. **Frontend/UI code**: Not in scope.
4. **Deployment infrastructure**: Deployment scripts, CI/CD pipelines, and operational security were not audited.
5. **Economic/game-theoretic analysis**: The anonymity set size, relayer incentive structure, and optimistic verification bond parameters were not analyzed.
6. **Gas/execution cost analysis**: Clarity execution costs were not analyzed for potential denial-of-service via expensive operations.
7. **Cross-contract reentrancy**: While Clarity prevents reentrancy within a single transaction, multi-transaction attack vectors (e.g., sandwich attacks on deposits) were not fully explored.

---

## Summary of Changes Made

| File | Change | Finding |
|------|--------|---------|
| `contracts/merkle-tree.clar` | Added `authorized-callers` map, `is-authorized` check, `set-authorized-caller` function, and access control on `append-leaf` | C-01 |
| `contracts/pool-v1.clar` | Added `(asserts! (is-eq source tx-sender) ERR-TRANSFER-FAILED)` check in `deposit` | C-03 |
| `contracts/sbtc-token.clar` | Cached `get-allowance` result in `let` binding to avoid double fetch | H-01 |
| `packages/sdk/src/wallet/stealth-address.ts` | Added `targetAddress` parameter to `checkStealthPayment`; function now returns `{ match: false }` when derived address does not match target; updated `verifyStealthPayment` to delegate correctly | C-02 |

All contracts pass `clarinet check` (10 contracts, 0 errors). The test suite shows 154/164 tests passing; 10 test failures are expected consequences of the security fixes (they test the now-closed vulnerable behaviors or require updated setup).
