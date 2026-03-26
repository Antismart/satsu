/**
 * Multi-relayer discovery and health monitoring.
 *
 * The Satsu protocol is designed so that users can switch relayers at will.
 * This module maintains a registry of known relayers, periodically probes
 * their health and latency, and provides a ranked view so callers can
 * pick the best available relayer or iterate through them during failover.
 *
 * Discovery is pull-based: the caller supplies an initial seed list of
 * URLs and can add/remove relayers at runtime.  Each relayer is probed
 * via GET /api/v1/info (metadata) and GET /api/v1/health (liveness).
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RelayerInfo {
  /** Base URL of the relayer (e.g. "https://relay.satsu.xyz"). */
  url: string;
  /** Human-readable relayer name. */
  name: string;
  /** Current minimum fee in micro-sBTC. */
  fee: bigint;
  /** Whether the last health check succeeded. */
  healthy: boolean;
  /** Round-trip latency of the last probe in milliseconds. */
  latencyMs: number;
  /** Timestamp (ms since epoch) of the last completed probe. */
  lastChecked: number;
}

// ---------------------------------------------------------------------------
// Zod schema for the /api/v1/info response
// ---------------------------------------------------------------------------

const RelayerInfoResponseSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  fee: z.string().regex(/^\d+$/, 'fee must be a non-negative integer string'),
  supportedPools: z.array(z.string()).optional().default([]),
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default request timeout for probes (ms). */
const PROBE_TIMEOUT_MS = 8_000;

/** Relayers whose last check is older than this are considered stale. */
const STALE_THRESHOLD_MS = 5 * 60 * 1_000; // 5 minutes

// ---------------------------------------------------------------------------
// RelayerRegistry
// ---------------------------------------------------------------------------

export class RelayerRegistry {
  private relayers: Map<string, RelayerInfo> = new Map();
  private readonly probeTimeoutMs: number;

  /**
   * Create a new registry, optionally seeded with a list of relayer URLs.
   *
   * The seed URLs are NOT probed during construction — call `refreshAll()`
   * or `addRelayer()` to trigger the initial health check.
   *
   * @param initialRelayers - Seed URLs to register (without probing)
   * @param options.probeTimeoutMs - Per-probe HTTP timeout (default 8 000 ms)
   */
  constructor(
    initialRelayers?: string[],
    options?: { probeTimeoutMs?: number },
  ) {
    this.probeTimeoutMs = options?.probeTimeoutMs ?? PROBE_TIMEOUT_MS;

    if (initialRelayers) {
      for (const url of initialRelayers) {
        const normalised = normaliseUrl(url);
        this.relayers.set(normalised, {
          url: normalised,
          name: '',
          fee: 0n,
          healthy: false,
          latencyMs: Infinity,
          lastChecked: 0,
        });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Add a relayer URL and immediately probe it.
   *
   * If the relayer is already registered, re-probes and returns updated info.
   *
   * @param url - Relayer base URL
   * @returns Probed relayer info
   */
  async addRelayer(url: string): Promise<RelayerInfo> {
    const normalised = normaliseUrl(url);
    const info = await this.probeRelayer(normalised);
    this.relayers.set(normalised, info);
    return info;
  }

  /**
   * Remove a relayer from the registry.
   *
   * @param url - Relayer base URL
   */
  removeRelayer(url: string): void {
    this.relayers.delete(normaliseUrl(url));
  }

  /**
   * Get the best available relayer.
   *
   * "Best" is defined as: healthy, lowest fee, then lowest latency as
   * a tiebreaker.  Relayers whose last check is older than the stale
   * threshold are re-probed before ranking.
   *
   * @returns The best RelayerInfo, or null if no healthy relayer exists.
   */
  async getBestRelayer(): Promise<RelayerInfo | null> {
    await this.refreshStale();
    const healthy = this.getHealthyFromCache();
    if (healthy.length === 0) return null;
    return healthy[0]!;
  }

  /**
   * Get all healthy relayers, sorted by fee ascending then latency ascending.
   *
   * Stale relayers are refreshed before filtering.
   */
  async getHealthyRelayers(): Promise<RelayerInfo[]> {
    await this.refreshStale();
    return this.getHealthyFromCache();
  }

  /**
   * Probe every registered relayer in parallel and update the registry.
   */
  async refreshAll(): Promise<void> {
    const urls = Array.from(this.relayers.keys());
    const results = await Promise.allSettled(
      urls.map((url) => this.probeRelayer(url)),
    );

    for (let i = 0; i < urls.length; i++) {
      const result = results[i]!;
      if (result.status === 'fulfilled') {
        this.relayers.set(urls[i]!, result.value);
      } else {
        // Mark as unhealthy on probe failure
        const existing = this.relayers.get(urls[i]!);
        if (existing) {
          existing.healthy = false;
          existing.lastChecked = Date.now();
          existing.latencyMs = Infinity;
        }
      }
    }
  }

  /**
   * Return the number of registered relayers (healthy or not).
   */
  get size(): number {
    return this.relayers.size;
  }

  /**
   * Return a snapshot of all registered relayers.
   */
  getAll(): RelayerInfo[] {
    return Array.from(this.relayers.values());
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Probe a single relayer by hitting /api/v1/info and /api/v1/health.
   *
   * The probe measures round-trip latency of the /api/v1/info request.
   * If /api/v1/info is unreachable or invalid, the relayer is marked
   * unhealthy.  If /api/v1/info succeeds but /api/v1/health returns a
   * non-OK status, the relayer is also marked unhealthy.
   */
  private async probeRelayer(url: string): Promise<RelayerInfo> {
    const base: RelayerInfo = {
      url,
      name: '',
      fee: 0n,
      healthy: false,
      latencyMs: Infinity,
      lastChecked: Date.now(),
    };

    try {
      // Probe /api/v1/info (with latency measurement)
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.probeTimeoutMs,
      );

      const t0 = performance.now();
      const infoRes = await fetch(`${url}/api/v1/info`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      const t1 = performance.now();
      clearTimeout(timeout);

      base.latencyMs = Math.round(t1 - t0);

      if (!infoRes.ok) {
        return base; // unhealthy
      }

      const infoJson = await infoRes.json();
      const parsed = RelayerInfoResponseSchema.safeParse(infoJson);
      if (!parsed.success) {
        return base; // malformed /info response
      }

      base.name = parsed.data.name;
      base.fee = BigInt(parsed.data.fee);

      // Probe /api/v1/health
      const healthController = new AbortController();
      const healthTimeout = setTimeout(
        () => healthController.abort(),
        this.probeTimeoutMs,
      );

      const healthRes = await fetch(`${url}/api/v1/health`, {
        signal: healthController.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(healthTimeout);

      // Accept 200 as healthy (503 means degraded/unhealthy)
      base.healthy = healthRes.ok;
    } catch {
      // Network error, timeout, etc. — leave defaults (unhealthy)
    }

    base.lastChecked = Date.now();
    return base;
  }

  /**
   * Re-probe relayers whose lastChecked timestamp exceeds the stale
   * threshold, without touching recently-checked relayers.
   */
  private async refreshStale(): Promise<void> {
    const now = Date.now();
    const staleUrls: string[] = [];

    for (const [url, info] of this.relayers) {
      if (now - info.lastChecked > STALE_THRESHOLD_MS) {
        staleUrls.push(url);
      }
    }

    if (staleUrls.length === 0) return;

    const results = await Promise.allSettled(
      staleUrls.map((url) => this.probeRelayer(url)),
    );

    for (let i = 0; i < staleUrls.length; i++) {
      const result = results[i]!;
      if (result.status === 'fulfilled') {
        this.relayers.set(staleUrls[i]!, result.value);
      } else {
        const existing = this.relayers.get(staleUrls[i]!);
        if (existing) {
          existing.healthy = false;
          existing.lastChecked = Date.now();
        }
      }
    }
  }

  /**
   * Return healthy relayers from the in-memory cache, sorted by
   * fee ascending then latency ascending.
   */
  private getHealthyFromCache(): RelayerInfo[] {
    return Array.from(this.relayers.values())
      .filter((r) => r.healthy)
      .sort((a, b) => {
        const feeDiff = Number(a.fee - b.fee);
        if (feeDiff !== 0) return feeDiff;
        return a.latencyMs - b.latencyMs;
      });
  }
}

// ---------------------------------------------------------------------------
// URL normalisation
// ---------------------------------------------------------------------------

function normaliseUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
