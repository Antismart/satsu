/**
 * Failover-aware relayer client.
 *
 * Wraps the RelayerRegistry and RelayerClient to provide automatic retry
 * across multiple healthy relayers.  When a submission fails against the
 * primary relayer, the client walks down the ranked list until one succeeds
 * or all healthy relayers have been exhausted.
 *
 * Usage:
 * ```ts
 * const client = new FailoverRelayerClient([
 *   'https://relay1.satsu.xyz',
 *   'https://relay2.satsu.xyz',
 * ]);
 *
 * const { txId, relayerUrl } = await client.submitDeposit({
 *   signedTx, commitment, source,
 * });
 * ```
 */

import { RelayerRegistry } from './discovery.js';
import { RelayerClient, RelayerError, type DepositRequest, type WithdrawRequest } from './client.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FailoverOptions {
  /**
   * Maximum number of relayers to try before giving up.
   * Defaults to 3.  Set to Infinity to try every healthy relayer.
   */
  maxRetries?: number;
}

export interface FailoverResult<T> {
  /** The result returned by the successful relayer call. */
  result: T;
  /** The URL of the relayer that handled the request. */
  relayerUrl: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when all relayers have been exhausted without a successful response.
 */
export class AllRelayersFailedError extends Error {
  /** Per-relayer errors, keyed by URL. */
  readonly attempts: ReadonlyMap<string, Error>;

  constructor(attempts: Map<string, Error>) {
    const count = attempts.size;
    const summary = Array.from(attempts.entries())
      .map(([url, err]) => `  ${url}: ${err.message}`)
      .join('\n');

    super(
      `All ${count} relayer(s) failed:\n${summary}`,
    );
    this.name = 'AllRelayersFailedError';
    this.attempts = attempts;
  }
}

// ---------------------------------------------------------------------------
// FailoverRelayerClient
// ---------------------------------------------------------------------------

export class FailoverRelayerClient {
  private readonly registry: RelayerRegistry;
  private readonly maxRetries: number;

  /**
   * @param relayerUrls - Seed list of relayer base URLs
   * @param options.maxRetries - Max relayers to try (default 3)
   */
  constructor(relayerUrls: string[], options?: FailoverOptions) {
    this.registry = new RelayerRegistry(relayerUrls);
    this.maxRetries = options?.maxRetries ?? 3;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Submit a deposit with automatic failover across healthy relayers.
   *
   * Returns the resulting txId and the URL of the relayer that succeeded.
   */
  async submitDeposit(
    params: DepositRequest,
  ): Promise<{ txId: string; relayerUrl: string }> {
    const { result, relayerUrl } = await this.tryWithFailover(
      (client) => client.submitDeposit(params),
    );
    return { txId: result.txId, relayerUrl };
  }

  /**
   * Submit a withdrawal with automatic failover across healthy relayers.
   *
   * Returns the resulting txId and the URL of the relayer that succeeded.
   */
  async submitWithdrawal(
    params: WithdrawRequest,
  ): Promise<{ txId: string; relayerUrl: string }> {
    const { result, relayerUrl } = await this.tryWithFailover(
      (client) => client.submitWithdrawal(params),
    );
    return { txId: result.txId, relayerUrl };
  }

  /**
   * Refresh the registry, probing all registered relayers for health
   * and latency.  Call this periodically or before a batch of operations.
   */
  async refreshRelayers(): Promise<void> {
    await this.registry.refreshAll();
  }

  /**
   * Expose the underlying registry for advanced inspection.
   */
  getRegistry(): RelayerRegistry {
    return this.registry;
  }

  // -----------------------------------------------------------------------
  // Core failover logic
  // -----------------------------------------------------------------------

  /**
   * Walk through healthy relayers and call `operation` on each until one
   * succeeds.  Up to `maxRetries` relayers are attempted.
   *
   * The registry is refreshed once at the start of each call to ensure
   * the health/rank data is current.
   *
   * @throws {AllRelayersFailedError} when every attempted relayer fails
   */
  private async tryWithFailover<T>(
    operation: (client: RelayerClient) => Promise<T>,
  ): Promise<FailoverResult<T>> {
    // Ensure we have current health data
    await this.registry.refreshAll();

    const healthy = await this.registry.getHealthyRelayers();
    if (healthy.length === 0) {
      throw new AllRelayersFailedError(
        new Map([['(none)', new Error('No healthy relayers available')]]),
      );
    }

    const attempts = new Map<string, Error>();
    const limit = Math.min(this.maxRetries, healthy.length);

    for (let i = 0; i < limit; i++) {
      const relayer = healthy[i]!;
      const client = new RelayerClient(relayer.url);

      try {
        const result = await operation(client);
        return { result, relayerUrl: relayer.url };
      } catch (err) {
        const wrapped =
          err instanceof Error ? err : new Error(String(err));
        attempts.set(relayer.url, wrapped);
        // Continue to next relayer
      }
    }

    throw new AllRelayersFailedError(attempts);
  }
}
