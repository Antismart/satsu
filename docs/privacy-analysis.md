# Privacy Analysis: Satsu Anonymity Set & Bootstrapping

> **Author**: Zooko (privacy review)
> **Status**: Living document -- update as the protocol evolves
> **Last updated**: 2026-03-26

---

## 1. Anonymity Set Analysis

### Definition

For any withdrawal from a Satsu fixed-denomination pool, the **anonymity set** is the number of unspent deposits that could plausibly be the source of the withdrawn funds. Because every deposit in a given pool is exactly the same denomination (e.g. 0.1 sBTC), an on-chain observer cannot distinguish one deposit from another by amount alone. The anonymity set therefore equals:

```
anonymity_set = total_deposits - total_withdrawals
```

This is the number of commitments in the Merkle tree that have not yet been nullified.

### What Size is "Good"?

Privacy is not binary -- it degrades gracefully as the anonymity set shrinks. Drawing on research from Tornado Cash and academic literature on mix networks:

| Anonymity Set Size | Rating     | Practical Meaning                                                                 |
|--------------------|------------|-----------------------------------------------------------------------------------|
| < 10               | **Critical** | Trivially deanonymizable. A motivated observer can narrow the depositor to a handful of candidates with basic chain analysis. |
| 10 -- 50           | **Low**      | Statistical attacks (timing, graph analysis) are highly effective. Privacy is marginal. |
| 50 -- 200          | **Moderate** | Provides meaningful privacy against casual observers, but a well-resourced adversary with timing data can still narrow candidates significantly. |
| 200 -- 1,000       | **Good**     | Strong privacy for most threat models. Timing and graph attacks become expensive and unreliable. |
| > 1,000            | **Strong**   | Excellent privacy. Even state-level adversaries face a computationally expensive search space. This is the target for a mature pool. |

**Key insight**: the anonymity set is only as strong as its weakest link. If 900 out of 1,000 deposits came from a single entity (e.g. a seeding program), a sophisticated observer who identifies that entity effectively reduces the set to 100.

### Relationship to Merkle Tree Capacity

Satsu's Merkle tree supports up to 2^20 = 1,048,576 leaves. The anonymity set can never exceed this value. Pool utilization (anonymity_set / MAX_LEAVES) is a useful health metric:

- **< 1%**: The pool is nearly empty. Every deposit and withdrawal is conspicuous.
- **1 -- 5%**: Early growth phase. Privacy is improving but still fragile.
- **5 -- 50%**: Healthy utilization. The pool provides strong privacy.
- **> 50%**: The pool is approaching capacity. Consider deploying a new pool generation.

---

## 2. The Bootstrapping Problem

### The Cold Start

When a pool first launches, the anonymity set is 0. The first depositor has an anonymity set of 1 (only themselves). The second depositor has an anonymity set of 2. This is a fundamental chicken-and-egg problem: users want privacy before depositing, but privacy requires deposits.

The first ~50 depositors are essentially sacrificing their privacy to bootstrap the system. Without mitigation, rational privacy-seeking users will wait for others to go first, and the pool never grows.

### Mitigation Strategies

#### Strategy 1: Seeding Deposits

The team (or a foundation) makes a set of initial deposits using independent stealth addresses to bootstrap the anonymity set before opening the pool to the public.

**Pros**:
- Immediately provides a non-trivial anonymity set at launch
- Simple to implement

**Cons**:
- If the seeding entity is identified, the effective anonymity set is reduced (all seed deposits collapse to one identity)
- Requires upfront capital (e.g. 50 x 0.1 sBTC = 5 sBTC for the default pool)
- Seed deposits should remain in the pool long-term; withdrawing them shrinks the set

**Recommendation**: Seed with at least 50 deposits. Use multiple independent wallets funded through different paths. Do NOT withdraw seed deposits for at least 6 months.

#### Strategy 2: Delayed First Withdrawal

Enforce a minimum anonymity set size before allowing the first withdrawal. The pool contract could include a guard:

```clarity
(asserts! (>= (var-get next-index) u50) (err ERR_POOL_TOO_SMALL))
```

**Pros**:
- Guarantees a minimum anonymity set for every withdrawal
- Simple on-chain enforcement

**Cons**:
- Depositors' funds are locked until the threshold is reached
- May discourage early depositors who fear the pool never reaches the threshold

**Recommendation**: Set a modest threshold (e.g. 25-50 deposits) and combine with seeding to ensure it is reached quickly.

#### Strategy 3: Multiple Denomination Pools

Deploy pools at multiple denominations: 0.01 sBTC, 0.1 sBTC, 1.0 sBTC.

**Pros**:
- Smaller denominations (0.01 sBTC) have a lower barrier to entry and fill faster
- Users with different amounts can participate
- Diversifies the anonymity set across price points

**Cons**:
- Splits the total user base across pools, potentially weakening each pool's anonymity set
- More contracts to audit and maintain

**Recommendation**: Launch with 0.1 sBTC as the primary pool. Add 0.01 sBTC as a "starter" pool with lower stakes. Only add 1.0 sBTC when the 0.1 pool demonstrates healthy utilization.

#### Strategy 4: Incentivized Deposits

Early depositors earn yield, governance tokens, or other rewards for keeping funds in the pool.

**Pros**:
- Directly addresses the rational-actor problem: early depositors are compensated for their reduced privacy
- Creates a positive feedback loop as rewards attract more deposits

**Cons**:
- Introduces tokenomics complexity
- Regulatory risk if the incentive token is classified as a security
- May attract deposits that are purely mercenary (deposit, claim reward, withdraw immediately)

**Recommendation**: If implemented, require a minimum lockup period (e.g. 30 days) to earn rewards. This ensures incentivized deposits actually contribute to the anonymity set over time.

---

## 3. Timing Analysis

### The Threat

Even with the configurable timing delay (see `packages/sdk/src/pool/timing.ts`), statistical analysis can narrow down depositors. The current system requires at least 50 intervening sBTC transfers and a minimum 10-minute delay before a deposit can be submitted after stealth address funding.

However, consider this scenario:

1. Alice funds a stealth address with 0.1 sBTC at block N.
2. Alice deposits 0.1 sBTC into the pool at block N+5 (after the timing delay).
3. An observer notes that only 3 unique addresses funded stealth addresses in the window [N-2, N+1].
4. The observer correlates the deposit at N+5 with those 3 candidates.

The timing delay reduces correlation but does not eliminate it, especially on a low-activity chain.

### Statistical Narrowing

If the chain processes T sBTC transfers per hour, and the timing delay is D hours, then approximately T * D transfers occur in the delay window. An observer who can identify which transfers are "normal" (exchange movements, DeFi, etc.) versus "privacy-related" can narrow the candidate set further.

On Stacks, sBTC transfer volume may be modest in early days. If only 5-10 sBTC transfers occur per hour, a 1-hour delay only provides ~5-10 intervening transfers -- well below the 50-transfer target.

### Mitigations

1. **Longer delays**: Increase `minDelayMs` and `minInterveningTransfers` when chain activity is low. The SDK should dynamically adjust based on observed transfer rates.

2. **Relayer batching**: Multiple deposits submitted in the same block by the relayer create ambiguity about which user initiated which deposit.

3. **Noise transactions**: The system could generate decoy sBTC transfers to increase the apparent transfer rate. This is expensive but effective.

4. **Cross-block deposit windows**: Instead of depositing at the first eligible block, add additional random delay (the existing jitter mechanism) to spread deposits across a wider window.

5. **Privacy score feedback**: The SDK should warn users when the timing conditions are weak (see `packages/sdk/src/privacy/score.ts`).

---

## 4. Amount Correlation

### The Threat

Fixed denominations are the primary defense against amount correlation. When every deposit and withdrawal is exactly 0.1 sBTC, an observer cannot link them by amount.

However, users who need to transfer larger amounts must make multiple deposits and withdrawals. This creates a pattern:

**Example**: Alice wants to privately transfer 0.3 sBTC.
1. She makes 3 deposits of 0.1 sBTC in quick succession (blocks N, N+1, N+2).
2. She withdraws 3 times of 0.1 sBTC to a recipient (blocks M, M+1, M+2).

An observer sees: 3 deposits in rapid succession, followed later by 3 withdrawals in rapid succession. Even though each individual transaction is indistinguishable, the *pattern* of 3-in-a-row is distinctive.

### Statistical Analysis

If the pool processes W withdrawals per day and a user makes K withdrawals in a short window, the probability of this pattern occurring by chance is approximately:

```
P(K withdrawals in window) ~ (W * window_size / total_time)^K
```

For K=3 and a 1-hour window with 20 withdrawals/day:

```
P ~ (20/24)^3 ~ 0.58
```

This is not very distinctive. But for K=10 (transferring 1.0 sBTC as ten 0.1 deposits):

```
P ~ (20/24)^10 ~ 0.016
```

Now the pattern is distinctive enough to narrow candidates significantly.

### Mitigations

1. **Spread deposits and withdrawals over time**: The SDK should enforce minimum spacing between successive deposits from the same user (e.g. at least 1 hour between deposits).

2. **Vary pool denominations**: Instead of 3 x 0.1 sBTC, use 1 x 0.1 sBTC + 2 x 0.01 sBTC + 8 x 0.01 sBTC across different pools. This makes the pattern less distinctive (though it requires multiple pool contracts).

3. **Random withdrawal timing**: Withdrawals should have their own jitter, similar to deposits. The SDK should discourage users from withdrawing all deposits in a single session.

4. **User education**: The UI should clearly warn users about the risks of depositing or withdrawing large multiples in quick succession.

---

## 5. Additional Attack Vectors

### Graph Analysis

Even without timing or amount correlation, an observer can build a transaction graph:
- Deposit source addresses (before stealth funding)
- Withdrawal destination addresses
- Relayer addresses

If Alice always uses the same relayer and the same withdrawal destination, the relayer can build a profile. Mitigation: support multiple relayers and encourage address rotation.

### Intersection Attacks

If a user deposits and withdraws at predictable times (e.g. every Monday), an observer can intersect the set of "active depositors" across multiple time windows to narrow candidates. Mitigation: encourage irregular timing and long deposit durations.

### Sybil Deposits

An adversary could flood the pool with deposits they control, then withdraw them, to reduce the effective anonymity set for honest users. If 90% of deposits are adversary-controlled, the honest user's effective anonymity set is 10% of the apparent set. Mitigation: this is inherently difficult to prevent in a permissionless system. A large and diverse user base is the best defense.

---

## 6. Recommendations Summary

| Priority | Recommendation | Impact |
|----------|---------------|--------|
| **P0** | Display anonymity set size prominently in the UI | Users can make informed decisions |
| **P0** | Implement privacy scoring (see `score.ts`) | Automated risk assessment before withdrawal |
| **P0** | Seed the pool with 50+ deposits before public launch | Minimum viable anonymity set |
| **P1** | Enforce minimum pool size before first withdrawal | Guaranteed minimum privacy |
| **P1** | Launch 0.01 sBTC pool alongside 0.1 sBTC | Lower barrier, faster bootstrapping |
| **P1** | Warn users who make multiple deposits/withdrawals in sequence | Prevent amount correlation |
| **P2** | Dynamic timing delay based on chain activity | Adaptive privacy guarantees |
| **P2** | Incentivize early depositors with lockup rewards | Accelerate bootstrapping |
| **P2** | Support multiple relayers with automatic failover | Reduce relayer correlation |
| **P3** | Noise transaction generation | Increase timing ambiguity |

---

## 7. References

- Tornado Cash privacy research: https://tornado-cash.medium.com/
- "An Empirical Analysis of Anonymity in Zcash" (Kappos et al., 2018)
- "Anonymity Analysis of Cryptocurrency Mixing Services" (Moser et al., 2017)
- Zcash specification: https://zips.z.cash/protocol/protocol.pdf
- Satsu threat model: see `CLAUDE.md` lines 920-947
