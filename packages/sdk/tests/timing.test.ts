/**
 * Tests for the timing delay mechanism.
 *
 * Verifies that:
 *   - calculateDepositDelay returns delays within configured bounds
 *   - shouldDeposit returns false when too few transfers have occurred
 *   - shouldDeposit returns true when enough transfers have occurred
 *   - addJitter adds randomness within the specified bounds
 *   - Default config values are reasonable for privacy
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDepositDelay,
  shouldDeposit,
  addJitter,
  DEFAULT_TIMING_CONFIG,
  type TimingConfig,
} from '../src/pool/timing.js';

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

describe('DEFAULT_TIMING_CONFIG', () => {
  it('should have 50 minimum intervening transfers', () => {
    expect(DEFAULT_TIMING_CONFIG.minInterveningTransfers).toBe(50);
  });

  it('should have 24 hours as maximum delay', () => {
    expect(DEFAULT_TIMING_CONFIG.maxDelayMs).toBe(86_400_000);
  });

  it('should have 10 minutes as minimum delay', () => {
    expect(DEFAULT_TIMING_CONFIG.minDelayMs).toBe(600_000);
  });

  it('should have 5 minutes of jitter', () => {
    expect(DEFAULT_TIMING_CONFIG.jitterMs).toBe(300_000);
  });

  it('should have minDelayMs < maxDelayMs', () => {
    expect(DEFAULT_TIMING_CONFIG.minDelayMs).toBeLessThan(
      DEFAULT_TIMING_CONFIG.maxDelayMs,
    );
  });

  it('should have jitterMs < maxDelayMs - minDelayMs (jitter cannot push past max)', () => {
    const headroom =
      DEFAULT_TIMING_CONFIG.maxDelayMs - DEFAULT_TIMING_CONFIG.minDelayMs;
    expect(DEFAULT_TIMING_CONFIG.jitterMs).toBeLessThan(headroom);
  });
});

// ---------------------------------------------------------------------------
// addJitter
// ---------------------------------------------------------------------------

describe('addJitter', () => {
  it('should return at least the base delay', () => {
    for (let i = 0; i < 100; i++) {
      const result = addJitter(1000, 500);
      expect(result).toBeGreaterThanOrEqual(1000);
    }
  });

  it('should return at most baseDelay + jitterMs', () => {
    for (let i = 0; i < 100; i++) {
      const result = addJitter(1000, 500);
      expect(result).toBeLessThan(1000 + 500);
    }
  });

  it('should return the base delay when jitterMs is 0', () => {
    expect(addJitter(5000, 0)).toBe(5000);
  });

  it('should return the base delay when jitterMs is negative', () => {
    expect(addJitter(5000, -100)).toBe(5000);
  });

  it('should produce varying results (not always the same)', () => {
    const results = new Set<number>();
    for (let i = 0; i < 50; i++) {
      results.add(addJitter(1000, 10000));
    }
    // With 10 seconds of jitter, we should see multiple distinct values
    expect(results.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// calculateDepositDelay
// ---------------------------------------------------------------------------

describe('calculateDepositDelay', () => {
  it('should return delay within [minDelayMs, maxDelayMs] with default config', () => {
    for (let i = 0; i < 50; i++) {
      const { delayMs } = calculateDepositDelay();
      expect(delayMs).toBeGreaterThanOrEqual(DEFAULT_TIMING_CONFIG.minDelayMs);
      expect(delayMs).toBeLessThanOrEqual(DEFAULT_TIMING_CONFIG.maxDelayMs);
    }
  });

  it('should return delay within custom bounds', () => {
    const config: Partial<TimingConfig> = {
      minDelayMs: 1000,
      maxDelayMs: 5000,
      jitterMs: 2000,
    };
    for (let i = 0; i < 50; i++) {
      const { delayMs } = calculateDepositDelay(config);
      expect(delayMs).toBeGreaterThanOrEqual(1000);
      expect(delayMs).toBeLessThanOrEqual(5000);
    }
  });

  it('should clamp at maxDelayMs when jitter would exceed it', () => {
    const config: Partial<TimingConfig> = {
      minDelayMs: 9000,
      maxDelayMs: 10000,
      jitterMs: 5000, // Could push to 14000, but should be clamped to 10000
    };
    for (let i = 0; i < 50; i++) {
      const { delayMs } = calculateDepositDelay(config);
      expect(delayMs).toBeLessThanOrEqual(10000);
    }
  });

  it('should include a human-readable reason', () => {
    const { reason } = calculateDepositDelay();
    expect(reason).toContain('Delay set to');
    expect(reason).toContain('min');
  });

  it('should use defaults when no config is provided', () => {
    const { delayMs } = calculateDepositDelay();
    expect(delayMs).toBeGreaterThanOrEqual(DEFAULT_TIMING_CONFIG.minDelayMs);
  });
});

// ---------------------------------------------------------------------------
// shouldDeposit
// ---------------------------------------------------------------------------

describe('shouldDeposit', () => {
  it('should return false when too few transfers have occurred', () => {
    const result = shouldDeposit(100, 200, 10);
    expect(result.ready).toBe(false);
    expect(result.reason).toContain('10');
    expect(result.reason).toContain('50');
    expect(result.estimatedBlocksRemaining).toBeDefined();
    expect(result.estimatedBlocksRemaining).toBeGreaterThan(0);
  });

  it('should return true when enough transfers and minimum delay passed', () => {
    // 5 blocks elapsed = ~50 minutes at 10 min/block > 10 min minimum delay
    // but well under maxDelay (1440 min), so the "enough transfers" path fires
    const result = shouldDeposit(100, 105, 60);
    expect(result.ready).toBe(true);
    expect(result.reason).toContain('60');
    expect(result.reason).toContain('intervening transfers observed');
  });

  it('should return false when enough transfers but minimum delay not met', () => {
    // fundingTxBlock=100, currentBlock=100 means 0 blocks elapsed = 0ms
    // Even with 100 transfers, the minimum 10min delay is not met
    const result = shouldDeposit(100, 100, 100);
    expect(result.ready).toBe(false);
    expect(result.reason).toContain('minimum delay');
    expect(result.estimatedBlocksRemaining).toBeDefined();
  });

  it('should return true when max delay is exceeded regardless of transfers', () => {
    // With default config, maxDelay = 86400000ms = 144 blocks at 600000ms/block
    // 200 blocks > 144 blocks
    const result = shouldDeposit(100, 300, 5);
    expect(result.ready).toBe(true);
    expect(result.reason).toContain('Maximum delay exceeded');
  });

  it('should respect custom config', () => {
    const config: Partial<TimingConfig> = {
      minInterveningTransfers: 10,
      minDelayMs: 60_000, // 1 minute = ~0.1 blocks
    };
    // 2 blocks elapsed at 600000ms/block = 1200000ms >> 60000ms
    // 15 transfers > 10 required
    const result = shouldDeposit(100, 102, 15, config);
    expect(result.ready).toBe(true);
  });

  it('should return estimatedBlocksRemaining when not ready due to transfers', () => {
    // 10 blocks elapsed, 20 transfers, need 50 -> 30 more needed
    // Rate: 20/10 = 2 per block -> estimated 15 more blocks
    const result = shouldDeposit(100, 110, 20);
    expect(result.ready).toBe(false);
    expect(result.estimatedBlocksRemaining).toBeDefined();
    expect(result.estimatedBlocksRemaining).toBe(15);
  });

  it('should handle zero transfers gracefully', () => {
    const result = shouldDeposit(100, 105, 0);
    expect(result.ready).toBe(false);
    expect(result.estimatedBlocksRemaining).toBeDefined();
    expect(result.estimatedBlocksRemaining).toBe(50); // fallback: 1 transfer per block
  });

  it('should handle same block (0 blocks elapsed)', () => {
    const result = shouldDeposit(100, 100, 0);
    expect(result.ready).toBe(false);
  });

  it('should include a descriptive reason for every outcome', () => {
    const cases = [
      shouldDeposit(100, 105, 60),   // ready: enough transfers + time
      shouldDeposit(100, 102, 10),   // not ready: too few transfers
      shouldDeposit(100, 100, 100),  // not ready: min delay not met
      shouldDeposit(100, 300, 5),    // ready: max delay exceeded
    ];
    for (const result of cases) {
      expect(result.reason).toBeTruthy();
      expect(result.reason.length).toBeGreaterThan(10);
    }
  });
});
