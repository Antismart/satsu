/**
 * @satsu/relay — Fee manager
 *
 * Calculates the relayer fee and validates that a user-submitted fee meets the
 * minimum threshold.  Fee increases dynamically with queue depth to
 * incentivise timely processing when the relayer is under load.
 */

import type { FeeConfig } from './config.js';

// ---------------------------------------------------------------------------
// Pool denomination (must match the on-chain constant)
// ---------------------------------------------------------------------------

const POOL_DENOMINATION = BigInt(10_000_000); // 0.1 sBTC in satoshis

// ---------------------------------------------------------------------------
// FeeManager
// ---------------------------------------------------------------------------

export class FeeManager {
  private readonly config: FeeConfig;
  private pendingCountFn: () => number;

  /**
   * @param config       Fee schedule parameters.
   * @param pendingCount Callback that returns the current total pending queue
   *                     depth (deposits + withdrawals).  Used for dynamic
   *                     fee adjustment.
   */
  constructor(config: FeeConfig, pendingCount: () => number) {
    this.config = config;
    this.pendingCountFn = pendingCount;
  }

  /**
   * Compute the current fee in micro-sBTC.
   *
   * The fee is the maximum of:
   *   1. The base fee
   *   2. feePercentage * POOL_DENOMINATION
   *
   * When the pending queue depth exceeds 5 items, an additional surcharge of
   * 10 % of the base fee per extra item is added.  The result is capped at
   * maxFee.
   */
  getCurrentFee(): bigint {
    const percentageFee = BigInt(
      Math.floor(this.config.feePercentage * Number(POOL_DENOMINATION)),
    );
    let fee = this.config.baseFee > percentageFee ? this.config.baseFee : percentageFee;

    // Dynamic surcharge when queue is deep
    const pending = this.pendingCountFn();
    if (pending > 5) {
      const extra = BigInt(pending - 5);
      const surcharge = (this.config.baseFee * extra) / 10n;
      fee += surcharge;
    }

    // Cap at maxFee
    if (fee > this.config.maxFee) {
      fee = this.config.maxFee;
    }

    return fee;
  }

  /**
   * Validate that the fee submitted by the user is at least as large as the
   * current required fee.
   */
  validateFee(fee: bigint): boolean {
    return fee >= this.getCurrentFee();
  }
}
