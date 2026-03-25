/**
 * Timing delay mechanism for deposit privacy.
 *
 * After Alice funds a stealth address (tx1), she must wait before
 * submitting the deposit to the pool (tx2). This delay breaks timing
 * correlation between the two transactions by ensuring a sufficient
 * number of other sBTC transfers have occurred on-chain in between.
 *
 * The delay is randomized with configurable jitter to prevent
 * predictable timing patterns across deposits.
 *
 * Usage:
 *   1. Alice funds stealth address and records the block number.
 *   2. Before depositing, call `shouldDeposit()` with the current
 *      block and number of intervening sBTC transfers.
 *   3. If not ready, use `calculateDepositDelay()` to determine
 *      how long to wait before checking again.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimingConfig {
  /** Minimum number of sBTC transfers that must occur between tx1 and tx2. Default: 50 */
  minInterveningTransfers: number;
  /** Maximum delay in milliseconds before the deposit should proceed anyway. Default: 24 hours (86400000) */
  maxDelayMs: number;
  /** Minimum delay in milliseconds before the deposit can be submitted. Default: 10 minutes (600000) */
  minDelayMs: number;
  /** Maximum random jitter added to the base delay. Default: 5 minutes (300000) */
  jitterMs: number;
}

export interface DepositDelayResult {
  /** Calculated delay in milliseconds (includes jitter). */
  delayMs: number;
  /** Human-readable explanation of how the delay was calculated. */
  reason: string;
}

export interface DepositReadinessResult {
  /** Whether the deposit is ready to be submitted. */
  ready: boolean;
  /** Human-readable explanation of the readiness status. */
  reason: string;
  /** Estimated number of blocks remaining before the deposit is ready (if not ready). */
  estimatedBlocksRemaining?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_TIMING_CONFIG: TimingConfig = {
  minInterveningTransfers: 50,
  maxDelayMs: 86_400_000,    // 24 hours
  minDelayMs: 600_000,       // 10 minutes
  jitterMs: 300_000,         // 5 minutes
};

/**
 * Average Stacks block time in milliseconds (~10 minutes).
 * Used for estimating blocks remaining from time-based delays.
 */
const AVG_BLOCK_TIME_MS = 600_000;

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Add random jitter to a base delay to prevent timing pattern analysis.
 *
 * The jitter is drawn uniformly from [0, jitterMs) and added to the
 * base delay. This ensures deposits from different users (or the same
 * user at different times) do not cluster at predictable intervals.
 *
 * @param baseDelayMs - The base delay in milliseconds before jitter
 * @param jitterMs - Maximum jitter to add (exclusive upper bound)
 * @returns The base delay plus a random jitter component
 */
export function addJitter(baseDelayMs: number, jitterMs: number): number {
  if (jitterMs <= 0) {
    return baseDelayMs;
  }
  const jitter = Math.floor(Math.random() * jitterMs);
  return baseDelayMs + jitter;
}

/**
 * Calculate a randomized deposit delay with jitter.
 *
 * Returns a delay between minDelayMs and maxDelayMs (inclusive of jitter).
 * The delay is clamped to never exceed maxDelayMs regardless of jitter.
 *
 * @param config - Optional partial timing configuration (defaults are filled in)
 * @returns The calculated delay and a human-readable reason
 */
export function calculateDepositDelay(
  config?: Partial<TimingConfig>,
): DepositDelayResult {
  const cfg = resolveConfig(config);

  const withJitter = addJitter(cfg.minDelayMs, cfg.jitterMs);
  const delayMs = Math.min(withJitter, cfg.maxDelayMs);

  const delayMinutes = Math.round(delayMs / 60_000);

  return {
    delayMs,
    reason:
      `Delay set to ~${delayMinutes} minute(s) ` +
      `(base: ${Math.round(cfg.minDelayMs / 60_000)}min + ` +
      `jitter up to ${Math.round(cfg.jitterMs / 60_000)}min, ` +
      `capped at ${Math.round(cfg.maxDelayMs / 60_000)}min).`,
  };
}

/**
 * Determine whether a deposit is ready to be submitted.
 *
 * A deposit is considered ready when at least `minInterveningTransfers`
 * other sBTC transfers have occurred on-chain since the stealth address
 * was funded. This breaks the timing link between the funding transaction
 * and the pool deposit.
 *
 * If the maximum delay has been exceeded (based on block times), the
 * deposit is considered ready regardless of the transfer count to prevent
 * indefinite waiting on a low-activity chain.
 *
 * @param fundingTxBlock - Block number of the stealth address funding transaction
 * @param currentBlock - Current block number
 * @param transfersSinceFunding - Number of sBTC transfers observed since the funding block
 * @param config - Optional partial timing configuration
 * @returns Readiness status with explanation and optional estimated blocks remaining
 */
export function shouldDeposit(
  fundingTxBlock: number,
  currentBlock: number,
  transfersSinceFunding: number,
  config?: Partial<TimingConfig>,
): DepositReadinessResult {
  const cfg = resolveConfig(config);

  const blocksSinceFunding = currentBlock - fundingTxBlock;
  const elapsedMs = blocksSinceFunding * AVG_BLOCK_TIME_MS;

  // If maximum delay has been exceeded, allow the deposit regardless
  // of transfer count to prevent indefinite waiting.
  if (elapsedMs >= cfg.maxDelayMs) {
    return {
      ready: true,
      reason:
        `Maximum delay exceeded (${Math.round(elapsedMs / 60_000)}min >= ` +
        `${Math.round(cfg.maxDelayMs / 60_000)}min). ` +
        `Proceeding despite only ${transfersSinceFunding} intervening transfers ` +
        `(target: ${cfg.minInterveningTransfers}).`,
    };
  }

  // Check if enough intervening transfers have occurred
  if (transfersSinceFunding >= cfg.minInterveningTransfers) {
    // Also enforce the minimum delay
    if (elapsedMs >= cfg.minDelayMs) {
      return {
        ready: true,
        reason:
          `${transfersSinceFunding} intervening transfers observed ` +
          `(>= ${cfg.minInterveningTransfers} required) and minimum delay ` +
          `of ${Math.round(cfg.minDelayMs / 60_000)}min has passed.`,
      };
    }

    // Enough transfers but minimum delay not met
    const remainingMs = cfg.minDelayMs - elapsedMs;
    const estimatedBlocksRemaining = Math.ceil(remainingMs / AVG_BLOCK_TIME_MS);

    return {
      ready: false,
      reason:
        `${transfersSinceFunding} intervening transfers observed ` +
        `(>= ${cfg.minInterveningTransfers} required) but minimum delay ` +
        `not yet met (${Math.round(elapsedMs / 60_000)}min / ` +
        `${Math.round(cfg.minDelayMs / 60_000)}min). ` +
        `Wait ~${estimatedBlocksRemaining} more block(s).`,
      estimatedBlocksRemaining,
    };
  }

  // Not enough intervening transfers yet
  const transfersNeeded = cfg.minInterveningTransfers - transfersSinceFunding;

  // Rough estimate: assume transfers arrive at a rate proportional to
  // what we have seen so far (or fall back to 1 per block if none yet).
  const blocksElapsed = Math.max(blocksSinceFunding, 1);
  const transfersPerBlock = blocksSinceFunding > 0
    ? transfersSinceFunding / blocksElapsed
    : 0;
  const estimatedBlocksRemaining = transfersPerBlock > 0
    ? Math.ceil(transfersNeeded / transfersPerBlock)
    : transfersNeeded; // Worst case: 1 transfer per block

  return {
    ready: false,
    reason:
      `Only ${transfersSinceFunding} of ${cfg.minInterveningTransfers} ` +
      `required intervening transfers observed. ` +
      `Need ${transfersNeeded} more transfer(s). ` +
      `Estimated ~${estimatedBlocksRemaining} block(s) remaining.`,
    estimatedBlocksRemaining,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Merge a partial config with the defaults to produce a complete TimingConfig.
 */
function resolveConfig(partial?: Partial<TimingConfig>): TimingConfig {
  return {
    ...DEFAULT_TIMING_CONFIG,
    ...partial,
  };
}
