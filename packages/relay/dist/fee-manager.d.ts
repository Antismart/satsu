/**
 * @satsu/relay — Fee manager
 *
 * Calculates the relayer fee and validates that a user-submitted fee meets the
 * minimum threshold.  Fee increases dynamically with queue depth to
 * incentivise timely processing when the relayer is under load.
 */
import type { FeeConfig } from './config.js';
export declare class FeeManager {
    private readonly config;
    private pendingCountFn;
    /**
     * @param config       Fee schedule parameters.
     * @param pendingCount Callback that returns the current total pending queue
     *                     depth (deposits + withdrawals).  Used for dynamic
     *                     fee adjustment.
     */
    constructor(config: FeeConfig, pendingCount: () => number);
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
    getCurrentFee(): bigint;
    /**
     * Validate that the fee submitted by the user is at least as large as the
     * current required fee.
     */
    validateFee(fee: bigint): boolean;
}
