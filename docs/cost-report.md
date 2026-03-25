# Satsu Clarity Contracts -- Gas / Cost Benchmarking Report

**Date:** 2026-03-26
**Test runner:** Vitest 3.2.4 + Clarinet SDK 3.9.0 (Clarity v3, Epoch 3.0)
**Result:** All 316 tests pass across 18 test files (8.60 s)

---

## 1. Stacks Block Execution Limits

Every Stacks block enforces per-transaction **and** per-block limits.
The per-transaction limits (Epoch 3.0) used as the baseline throughout this report:

| Dimension        | Limit              |
|------------------|--------------------|
| `runtime`        | 5,000,000,000      |
| `read_length`    | 100,000,000 bytes  |
| `read_count`     | 15,000             |
| `write_length`   | 15,000,000 bytes   |
| `write_count`    | 15,000             |
| `memory`         | 100,000,000 bytes  |

---

## 2. Measured Costs (from `costs-reports.json`)

The Clarinet SDK `--costs` flag captured actual execution costs for every
contract call executed during the integration and unit test suites.

### 2a. Core Transaction Functions

| Contract | Function | Runtime | Write Len | Write Cnt | Read Len | Read Cnt | Memory | % of Runtime Limit |
|----------|----------|--------:|----------:|----------:|---------:|---------:|-------:|-------------------:|
| **pool-v1** | **deposit** (best case -- index 0) | **635,542** | 332 | 7 | 23,479 | 20 | 654 | **0.01271%** |
| **pool-v1** | **deposit** (index 1 -- extra hash) | **647,706** | 332 | 7 | 23,556 | 21 | 654 | **0.01295%** |
| pool-v1 | deposit -- duplicate rejection | 13,341 | 0 | 0 | 8,944 | 4 | 0 | 0.00027% |
| pool-v1 | deposit -- insufficient sBTC | 21,646 | 1 | 2 | 11,485 | 9 | 0 | 0.00043% |
| pool-v1 | deposit -- no approval | 24,982 | 0 | 0 | 11,548 | 8 | 0 | 0.00050% |

**Note:** `pool-v1::deposit` includes the full `merkle-tree::append-leaf`
contract-call cost inside its runtime figure. The Clarinet SDK reports the
top-level call cost inclusively.

### 2b. Supporting / Read-Only Functions

| Contract | Function | Runtime | % of Runtime Limit |
|----------|----------|--------:|-------------------:|
| stealth-v1 | register-meta-address | 35,213 | 0.00070% |
| pool-v1 | is-known-root | 24,916 | 0.00050% |
| stealth-v1 | get-meta-address | 13,009 | 0.00026% |
| merkle-tree | get-current-root | 12,577 | 0.00025% |
| merkle-tree | get-next-leaf-index | 12,557 | 0.00025% |
| pool-v1 | get-deposit-info | 12,137 | 0.00024% |
| sbtc-token | approve | 11,279 | 0.00023% |
| sbtc-token | get-allowance-of | 10,510 | 0.00021% |
| sbtc-token | mint (devnet only) | 5,985 | 0.00012% |
| sbtc-token | get-balance | 4,019 | 0.00008% |

---

## 3. Manual Cost Analysis -- Merkle Tree `append-leaf`

The Merkle tree is the most compute-intensive component. The `append-leaf`
function is called within `pool-v1::deposit` via a cross-contract call.

### 3a. Algorithm Overview

`append-leaf` performs two `fold` passes over `LEVEL-INDICES` (u0..u19):

1. **Insert fold** (`process-level` x 20 iterations):
   - For each level, checks a bit of `next-leaf-index`
   - If bit is 0: `map-set` frontier at that level, mark `done` = true
   - If bit is 1: `map-get?` frontier, `sha256(concat(left, current))`, continue

2. **Root computation fold** (`compute-root-level` x 20 iterations):
   - For each level above the stored level: `sha256(concat(...))` with zero hash

3. **Auxiliary ops**: `find-stored-level` fold (20 iterations, bit checks only, no hashing)

### 3b. SHA-256 Call Count by Leaf Index

The number of sha256 calls depends on the binary representation of `leaf-index`:

| Leaf Index | Binary | sha256 in Insert | sha256 in Root | Total sha256 |
|:----------:|:------:|:----------------:|:--------------:|:------------:|
| 0 | `00000...0` | 0 | 19 | **19** |
| 1 | `00000...1` | 1 | 18 | **19** |
| 2 | `00000..10` | 0 | 19 | **19** |
| 3 | `00000..11` | 2 | 17 | **19** |
| 7 | `00000.111` | 3 | 16 | **19** |
| 15 | `0000.1111` | 4 | 15 | **19** |
| 2^k - 1 | `k ones` | k | 20-k | **20** |
| **2^20 - 1** (worst) | `20 ones` | **20** | **0** | **20** |

**Key insight:** Every insert performs exactly 19 or 20 sha256 calls total
(insert + root computation), regardless of the leaf index. The worst case
(index = 2^20 - 1 = 1,048,575) performs 20 sha256 calls.

### 3c. Estimated Worst-Case Cost per Operation

Using Stacks Epoch 3.0 approximate unit costs:

| Operation | Approx. Unit Cost | Count (worst case) | Subtotal |
|-----------|-------------------:|-------------------:|---------:|
| `sha256` (64-byte input) | ~11,200 runtime | 20 | 224,000 |
| `map-get?` (tree-frontier) | ~4,500 runtime | 20 | 90,000 |
| `map-set` (tree-frontier) | ~6,000 runtime | 1 | 6,000 |
| `map-set` (known-roots) | ~6,000 runtime | 1 | 6,000 |
| `var-set` (current-root) | ~2,000 runtime | 1 | 2,000 |
| `var-set` (next-leaf-index) | ~2,000 runtime | 1 | 2,000 |
| `var-get` (next-leaf-index) | ~1,500 runtime | 1 | 1,500 |
| `bit-shift-right` / `bit-and` | ~200 runtime | 80 | 16,000 |
| `is-eq` comparisons | ~200 runtime | 80 | 16,000 |
| `concat` (64 bytes) | ~4,000 runtime | 20 | 80,000 |
| `print` event | ~5,000 runtime | 1 | 5,000 |
| Fold overhead (60 iterations) | ~150 runtime | 60 | 9,000 |
| **Estimated `append-leaf` total** | | | **~457,500** |

The measured deposit cost of ~635,000-648,000 includes `append-leaf` plus
the sBTC transfer, duplicate-commitment check, and `map-set` for
`deposit-commitments`. This aligns well with the manual estimate when
accounting for the additional pool-v1 operations.

---

## 4. Estimated `pool-v1::withdraw` Cost (Mock Verifier)

The `withdraw` function was not captured in the automated cost report
(the Clarinet SDK cost hook appears to exclude certain test patterns).
Manual cost analysis based on the contract code:

| Step | Operations | Estimated Runtime |
|------|-----------|------------------:|
| 1. Fee arithmetic (`<=`, `-`) | 2 comparisons | ~400 |
| 2. `merkle-tree::is-known-root` (read-only contract-call) | 1 `map-get?` on known-roots | ~15,000 |
| 3. `nullifier-registry::is-nullifier-used` (read-only contract-call) | 1 `map-get?` on used-nullifiers | ~15,000 |
| 4. `proof-verifier::verify-proof` (mock -- returns `(ok true)`) | trivial | ~5,000 |
| 5. `nullifier-registry::mark-used` (public contract-call) | 3 asserts + 1 `map-set` + 1 `print` | ~25,000 |
| 6. `sbtc-token::transfer` to recipient (as-contract) | ft-transfer? + allowance checks | ~15,000 |
| 7. `sbtc-token::transfer` relayer fee (as-contract, conditional) | ft-transfer? (if fee > 0) | ~15,000 |
| 8. `print` withdrawal event | 1 print | ~5,000 |
| **Estimated total (mock verifier, with relayer fee)** | | **~95,400** |
| **Estimated total (mock verifier, no relayer fee)** | | **~80,400** |

### 4a. Real STARK Verifier Cost Estimate

A production STARK verifier replaces the mock and is the dominant cost.
Based on typical STARK verification in Clarity (assuming a simplified
verifier with Fiat-Shamir hashing and Merkle authentication):

| Verifier Sub-operation | Estimated Count | Per-call Runtime | Subtotal |
|------------------------|----------------:|-----------------:|---------:|
| SHA-256 for Fiat-Shamir transcript | 10-20 | ~11,200 | 112,000 - 224,000 |
| SHA-256 for FRI Merkle auth paths (3-5 queries x 10-15 layers) | 30-75 | ~11,200 | 336,000 - 840,000 |
| Constraint polynomial evaluations (field arithmetic via `mod`) | 50-200 | ~2,000 | 100,000 - 400,000 |
| Buffer deserialization (`slice`, `buff-to-uint-be`) | 50-100 | ~1,000 | 50,000 - 100,000 |
| **Estimated real verifier range** | | | **598,000 - 1,564,000** |
| **Estimated full withdraw (real verifier)** | | | **693,000 - 1,659,000** |

---

## 5. Transactions per Block Analysis

### 5a. Deposits

| Metric | Value |
|--------|------:|
| Measured runtime per deposit | ~648,000 |
| Runtime limit per block | 5,000,000,000 |
| **Max deposits per block (runtime)** | **~7,716** |
| Write count per deposit | 7 |
| Write count limit per block | 15,000 |
| **Max deposits per block (write count)** | **~2,142** |
| Read count per deposit | 21 |
| Read count limit per block | 15,000 |
| **Max deposits per block (read count)** | **~714** |
| **Effective max deposits per block** | **~714** (read_count limited) |

### 5b. Withdrawals (Mock Verifier)

| Metric | Value |
|--------|------:|
| Estimated runtime per withdrawal (mock) | ~95,000 |
| **Max withdrawals per block (runtime, mock)** | **~52,631** |
| Estimated write count per withdrawal | ~5 |
| **Max withdrawals per block (write count)** | **~3,000** |
| Estimated read count per withdrawal | ~15 |
| **Max withdrawals per block (read count)** | **~1,000** |
| **Effective max withdrawals per block (mock)** | **~1,000** (read_count limited) |

### 5c. Withdrawals (Estimated Real STARK Verifier)

| Metric | Value |
|--------|------:|
| Estimated runtime per withdrawal (real) | ~700,000 - 1,660,000 |
| **Max withdrawals per block (runtime, real)** | **~3,012 - 7,142** |
| Read count per withdrawal (higher due to verifier reads) | ~25-50 |
| **Max withdrawals per block (read count, real)** | **~300 - 600** |
| **Effective max withdrawals per block (real, conservative)** | **~300** |

### 5d. Mixed Load (Deposits + Withdrawals)

In a typical block with mixed traffic, assuming a 50/50 split:

| Scenario | Deposits | Withdrawals | Total TXs |
|----------|:--------:|:-----------:|:---------:|
| Mock verifier | ~357 | ~357 | **~714** |
| Real verifier (optimistic) | ~200 | ~200 | **~400** |
| Real verifier (conservative) | ~150 | ~150 | **~300** |

---

## 6. Worst-Case Merkle Tree Analysis

**Question:** Can the tree handle the worst case (index 2^20 - 1, all 20 levels of hashing)?

### 6a. Runtime

- Worst-case `append-leaf`: ~460,000 runtime (20 sha256 calls)
- Best-case `append-leaf`: ~440,000 runtime (19 sha256 calls)
- **Difference is negligible** (<5% variation)
- 460,000 / 5,000,000,000 = **0.0092%** of the runtime limit

**Verdict: YES.** The worst case uses only 0.009% of the runtime budget.
The Merkle tree can handle any leaf index within the 2^20 capacity with
no risk of hitting execution limits.

### 6b. Memory

- Measured memory per deposit: 654 bytes
- Memory limit: 100,000,000 bytes
- **0.00065%** of memory limit

**Verdict: Safe.** Memory is not a concern.

### 6c. Read/Write Dimensions

- Worst-case read count: ~21 per deposit
- Worst-case write count: ~7 per deposit
- Both are trivial relative to the 15,000 per-block limits

---

## 7. Contract-by-Contract Summary

### merkle-tree.clar

| Function | Type | Estimated Runtime | Key Operations |
|----------|------|------------------:|---------------|
| `append-leaf` | public | ~440,000 - 460,000 | 2 folds x 20 levels, 19-20 sha256, 1 map-set frontier, 1 map-set known-roots |
| `get-current-root` | read-only | 12,577 | 1 var-get |
| `get-next-leaf-index` | read-only | 12,557 | 1 var-get |
| `is-known-root` | read-only | ~12,000 | 1 map-get? |
| `get-frontier` | read-only | ~12,000 | 1 map-get? |

### pool-v1.clar

| Function | Type | Measured Runtime | Key Operations |
|----------|------|------------------:|---------------|
| `deposit` | public | 635,542 - 647,706 | sBTC transfer + append-leaf + map-set commitment + print |
| `withdraw` | public | ~95,000 (mock) / ~700K-1.6M (real) | root check + nullifier check + proof verify + nullifier mark + 1-2 sBTC transfers + print |
| `get-current-root` | read-only | ~25,000 | cross-contract call to merkle-tree |
| `is-known-root` | read-only | 24,916 | cross-contract call to merkle-tree |
| `is-nullifier-used` | read-only | ~25,000 | cross-contract call to nullifier-registry |
| `get-pool-denomination` | read-only | ~5,000 | constant return |
| `get-deposit-info` | read-only | 12,137 | 1 map-get? |

### nullifier-registry.clar

| Function | Type | Estimated Runtime | Key Operations |
|----------|------|------------------:|---------------|
| `mark-used` | public | ~25,000 | 2 asserts + 1 map-set + 1 print |
| `set-authorized-contract` | public | ~15,000 | 1 assert + 1 var-set + 1 print |
| `is-nullifier-used` | read-only | ~10,000 | 1 map-get? + default-to |
| `get-nullifier-info` | read-only | ~10,000 | 1 map-get? |
| `get-authorized-contract` | read-only | ~5,000 | 1 var-get |

### stealth-v1.clar

| Function | Type | Measured Runtime | Key Operations |
|----------|------|------------------:|---------------|
| `register-meta-address` | public | 35,213 | 2 pubkey validations + 1 map-set + 1 print |
| `update-meta-address` | public | ~35,000 | 1 map-get? + 2 validations + 1 map-set + 1 print |
| `link-btc-name` | public | ~25,000 | 1 map-get? assert + 1 map-get? name + 1 map-set + 1 print |
| `unlink-btc-name` | public | ~20,000 | 1 map-get? + 1 map-delete + 1 print |
| `get-meta-address` | read-only | 13,009 | 1 map-get? |
| `get-meta-address-by-name` | read-only | ~15,000 | 1 map-get? name + 1 map-get? address |
| `has-meta-address` | read-only | ~10,000 | 1 map-get? + is-some |

### proof-verifier.clar (Mock)

| Function | Type | Measured Runtime | Key Operations |
|----------|------|------------------:|---------------|
| `verify-proof` | public | ~5,000 | returns `(ok true)` immediately |

### sbtc-token.clar (Mock SIP-010)

| Function | Type | Measured Runtime | Key Operations |
|----------|------|------------------:|---------------|
| `transfer` | public | ~15,000 | auth check + ft-transfer? + optional memo |
| `approve` | public | 11,279 | 1 map-set allowance |
| `mint` | public | 5,985 | 1 assert + ft-mint? |
| `get-balance` | read-only | 4,019 | ft-get-balance |
| `get-allowance-of` | read-only | 10,510 | 1 map-get? |

---

## 8. Optimization Recommendations

### 8.1 Current Design Is Well Within Limits

The current contracts are highly efficient:
- The most expensive operation (`deposit`) uses only **0.013%** of the runtime limit
- Even with a real STARK verifier, `withdraw` is projected to use at most **0.033%**
- There is no immediate need for optimization

### 8.2 Potential Future Optimizations (if needed)

1. **Reduce `get-zero-hash` chain:** The 20-deep `if` ladder in `get-zero-hash`
   could be replaced with a `map-get?` from a pre-populated map. This would
   reduce the branching overhead but is unlikely to save significant runtime
   since the cost is dominated by sha256 calls.

2. **Batch deposits:** If throughput becomes a bottleneck, a `deposit-batch`
   function could accept multiple commitments in a single transaction, amortizing
   the cross-contract call overhead. Each batch of N deposits would save
   ~(N-1) x 5,000 runtime from reduced contract-call overhead.

3. **Lazy root computation:** The root computation fold could be deferred to a
   separate read-only function, reducing the write-path cost of `append-leaf`.
   However, this changes the security model (root is no longer atomically updated).

4. **STARK verifier optimization:** The real STARK verifier will be the dominant
   cost. Key optimizations include:
   - Minimizing the number of FRI queries (fewer queries = fewer Merkle auth paths)
   - Using a binary-friendly hash (sha256 is already native and efficient in Clarity)
   - Pre-computing challenge values where possible
   - Keeping proof size under the 2048-byte buffer limit to avoid multiple passes

5. **Reduce `print` event data:** Print events contribute ~5,000 runtime each.
   The deposit event includes 5 fields and the withdrawal event includes 7.
   In a high-throughput scenario, reducing event payload size could save
   2,000-4,000 runtime per call.

### 8.3 Not Recommended

- **Reducing tree depth below 20:** The tree supports 2^20 = 1,048,576 deposits.
  Reducing depth would save at most 1 sha256 per level removed (~11,200 runtime),
  but significantly limits the pool capacity. The current depth is a good balance.

- **Switching from sha256:** SHA-256 is a native Clarity function with low
  overhead. Alternative hash functions would require manual field arithmetic
  and would be substantially more expensive.

---

## 9. Key Findings

1. **All operations fit comfortably within Stacks block limits.** The most
   expensive transaction (deposit) uses 0.013% of runtime budget.

2. **The Merkle tree worst case is safe.** At maximum fill (index 2^20 - 1),
   the tree performs 20 sha256 calls totaling ~460,000 runtime -- well under
   the 5 billion limit.

3. **Per-block throughput is limited by `read_count`, not runtime.** At ~21
   reads per deposit, the theoretical max is ~714 deposits per block. Runtime
   would allow ~7,700 deposits per block.

4. **Withdrawal cost depends heavily on the verifier.** With the mock verifier,
   withdrawals are cheap (~95K runtime). A real STARK verifier is estimated at
   700K-1.66M runtime, which is still only 0.013%-0.033% of the limit.

5. **The system can handle substantial transaction volume** even with a real
   verifier -- conservatively 300+ mixed operations per block.

---

## Appendix: Raw Cost Data Source

The measured costs were extracted from `/costs-reports.json`, generated by
running `npm run test:report` (`vitest run -- --coverage --costs`) via the
Clarinet SDK's built-in cost tracking hooks. Manual estimates supplement
the automated data for functions not captured in the cost report (primarily
`withdraw`, which runs in unit tests whose cost hooks produced incomplete
output).
