/**
 * Tests for FeeManager
 */

import { describe, it, expect } from 'vitest';
import { FeeManager } from '../src/fee-manager.js';
import type { FeeConfig } from '../src/config.js';

const defaultConfig: FeeConfig = {
  baseFee: 10_000n,
  feePercentage: 0.01, // 1 % of 10_000_000 = 100_000
  maxFee: 500_000n,
};

describe('FeeManager', () => {
  // -----------------------------------------------------------------------
  // getCurrentFee — base behaviour
  // -----------------------------------------------------------------------

  it('returns the percentage fee when it exceeds the base fee', () => {
    const fm = new FeeManager(defaultConfig, () => 0);
    // 1 % of 10_000_000 = 100_000, which is > baseFee of 10_000
    expect(fm.getCurrentFee()).toBe(100_000n);
  });

  it('returns the base fee when percentage fee is lower', () => {
    const config: FeeConfig = {
      baseFee: 200_000n,
      feePercentage: 0.001, // 0.1 % of 10_000_000 = 10_000
      maxFee: 500_000n,
    };
    const fm = new FeeManager(config, () => 0);
    expect(fm.getCurrentFee()).toBe(200_000n);
  });

  // -----------------------------------------------------------------------
  // Dynamic surcharge
  // -----------------------------------------------------------------------

  it('adds no surcharge when pending <= 5', () => {
    const fm = new FeeManager(defaultConfig, () => 5);
    expect(fm.getCurrentFee()).toBe(100_000n);
  });

  it('adds surcharge when pending > 5', () => {
    // 10 pending => extra = 5, surcharge = baseFee * 5 / 10 = 10000 * 5 / 10 = 5000
    // fee = 100_000 + 5_000 = 105_000
    const fm = new FeeManager(defaultConfig, () => 10);
    expect(fm.getCurrentFee()).toBe(105_000n);
  });

  it('surcharge scales with queue depth', () => {
    // 25 pending => extra = 20, surcharge = 10000 * 20 / 10 = 20_000
    // fee = 100_000 + 20_000 = 120_000
    const fm = new FeeManager(defaultConfig, () => 25);
    expect(fm.getCurrentFee()).toBe(120_000n);
  });

  // -----------------------------------------------------------------------
  // Fee cap
  // -----------------------------------------------------------------------

  it('caps fee at maxFee', () => {
    const config: FeeConfig = {
      baseFee: 10_000n,
      feePercentage: 0.01,
      maxFee: 100_000n, // lower cap
    };
    const fm = new FeeManager(config, () => 0);
    // percentage fee = 100_000, which equals the cap
    expect(fm.getCurrentFee()).toBe(100_000n);

    // With surcharge it would exceed 100_000 but cap kicks in
    const fm2 = new FeeManager(config, () => 20);
    expect(fm2.getCurrentFee()).toBe(100_000n);
  });

  it('applies cap even for very deep queues', () => {
    const fm = new FeeManager(defaultConfig, () => 10_000);
    expect(fm.getCurrentFee()).toBe(defaultConfig.maxFee);
  });

  // -----------------------------------------------------------------------
  // validateFee
  // -----------------------------------------------------------------------

  it('validates a fee that meets the minimum', () => {
    const fm = new FeeManager(defaultConfig, () => 0);
    const current = fm.getCurrentFee();
    expect(fm.validateFee(current)).toBe(true);
    expect(fm.validateFee(current + 1n)).toBe(true);
  });

  it('rejects a fee below the minimum', () => {
    const fm = new FeeManager(defaultConfig, () => 0);
    const current = fm.getCurrentFee();
    expect(fm.validateFee(current - 1n)).toBe(false);
  });

  it('rejects zero fee when minimum is positive', () => {
    const fm = new FeeManager(defaultConfig, () => 0);
    expect(fm.validateFee(0n)).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it('handles zero base fee and zero percentage', () => {
    const config: FeeConfig = {
      baseFee: 0n,
      feePercentage: 0,
      maxFee: 500_000n,
    };
    const fm = new FeeManager(config, () => 0);
    expect(fm.getCurrentFee()).toBe(0n);
    expect(fm.validateFee(0n)).toBe(true);
  });
});
