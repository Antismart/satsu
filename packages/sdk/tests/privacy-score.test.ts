/**
 * Tests for the privacy scoring module.
 *
 * Verifies that:
 *   - Score is 'critical' when anonymity set is 0
 *   - Score improves with larger anonymity set
 *   - Time bonus adds points correctly
 *   - Transfer bonus adds points correctly
 *   - Warnings generated for low anonymity set
 *   - Recommendations suggest waiting when set is small
 *   - Score never exceeds 100
 *   - Score never goes below 0
 *   - Edge cases: max values, zero values
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePrivacyScore,
  type PrivacyScore,
  type PrivacyScoreParams,
} from '../src/privacy/score.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build params with sensible defaults, overridable per-test. */
function makeParams(overrides: Partial<PrivacyScoreParams> = {}): PrivacyScoreParams {
  return {
    anonymitySetSize: 500,
    timeSinceDepositBlocks: 288, // ~2 days
    interveningTransfers: 100,
    totalDeposits: 600,
    totalWithdrawals: 100,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Rating thresholds
// ---------------------------------------------------------------------------

describe('Privacy score rating thresholds', () => {
  it('should rate anonymity set of 0 as critical', () => {
    const result = calculatePrivacyScore(makeParams({ anonymitySetSize: 0 }));
    expect(result.rating).toBe('critical');
  });

  it('should rate anonymity set of 5 as critical', () => {
    const result = calculatePrivacyScore(makeParams({ anonymitySetSize: 5 }));
    expect(result.rating).toBe('critical');
  });

  it('should rate anonymity set of 10 as low', () => {
    const result = calculatePrivacyScore(makeParams({ anonymitySetSize: 10 }));
    expect(result.rating).toBe('low');
  });

  it('should rate anonymity set of 30 as low', () => {
    const result = calculatePrivacyScore(makeParams({ anonymitySetSize: 30 }));
    expect(result.rating).toBe('low');
  });

  it('should rate anonymity set of 50 as moderate', () => {
    const result = calculatePrivacyScore(makeParams({ anonymitySetSize: 50 }));
    expect(result.rating).toBe('moderate');
  });

  it('should rate anonymity set of 150 as moderate', () => {
    const result = calculatePrivacyScore(makeParams({ anonymitySetSize: 150 }));
    expect(result.rating).toBe('moderate');
  });

  it('should rate anonymity set of 200 as good', () => {
    const result = calculatePrivacyScore(makeParams({ anonymitySetSize: 200 }));
    expect(result.rating).toBe('good');
  });

  it('should rate anonymity set of 500 as good', () => {
    const result = calculatePrivacyScore(makeParams({ anonymitySetSize: 500 }));
    expect(result.rating).toBe('good');
  });

  it('should rate anonymity set of 1000 as strong', () => {
    const result = calculatePrivacyScore(makeParams({ anonymitySetSize: 1000 }));
    expect(result.rating).toBe('strong');
  });

  it('should rate anonymity set of 5000 as strong', () => {
    const result = calculatePrivacyScore(makeParams({ anonymitySetSize: 5000 }));
    expect(result.rating).toBe('strong');
  });
});

// ---------------------------------------------------------------------------
// Score improves with anonymity set
// ---------------------------------------------------------------------------

describe('Score improves with larger anonymity set', () => {
  it('should give higher score for 100 than for 10', () => {
    const small = calculatePrivacyScore(makeParams({
      anonymitySetSize: 10,
      timeSinceDepositBlocks: 0,
      interveningTransfers: 0,
    }));
    const large = calculatePrivacyScore(makeParams({
      anonymitySetSize: 100,
      timeSinceDepositBlocks: 0,
      interveningTransfers: 0,
    }));
    expect(large.overallScore).toBeGreaterThan(small.overallScore);
  });

  it('should give monotonically increasing scores', () => {
    const sizes = [0, 5, 10, 25, 50, 100, 200, 500, 1000, 5000];
    const scores = sizes.map((size) =>
      calculatePrivacyScore(makeParams({
        anonymitySetSize: size,
        timeSinceDepositBlocks: 0,
        interveningTransfers: 0,
      })).overallScore,
    );

    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });
});

// ---------------------------------------------------------------------------
// Time bonus
// ---------------------------------------------------------------------------

describe('Time bonus', () => {
  it('should add 5 points for 1 day waited', () => {
    const noWait = calculatePrivacyScore(makeParams({
      anonymitySetSize: 500,
      timeSinceDepositBlocks: 0,
      interveningTransfers: 0,
    }));
    const oneDay = calculatePrivacyScore(makeParams({
      anonymitySetSize: 500,
      timeSinceDepositBlocks: 144, // 1 day
      interveningTransfers: 0,
    }));
    expect(oneDay.overallScore - noWait.overallScore).toBe(5);
  });

  it('should add 10 points for 2 days waited', () => {
    const noWait = calculatePrivacyScore(makeParams({
      anonymitySetSize: 500,
      timeSinceDepositBlocks: 0,
      interveningTransfers: 0,
    }));
    const twoDays = calculatePrivacyScore(makeParams({
      anonymitySetSize: 500,
      timeSinceDepositBlocks: 288, // 2 days
      interveningTransfers: 0,
    }));
    expect(twoDays.overallScore - noWait.overallScore).toBe(10);
  });

  it('should cap time bonus at 20 points', () => {
    const noWait = calculatePrivacyScore(makeParams({
      anonymitySetSize: 500,
      timeSinceDepositBlocks: 0,
      interveningTransfers: 0,
    }));
    const tenDays = calculatePrivacyScore(makeParams({
      anonymitySetSize: 500,
      timeSinceDepositBlocks: 1440, // 10 days
      interveningTransfers: 0,
    }));
    expect(tenDays.overallScore - noWait.overallScore).toBe(20);
  });

  it('should not add bonus for partial days', () => {
    const noWait = calculatePrivacyScore(makeParams({
      anonymitySetSize: 500,
      timeSinceDepositBlocks: 0,
      interveningTransfers: 0,
    }));
    const halfDay = calculatePrivacyScore(makeParams({
      anonymitySetSize: 500,
      timeSinceDepositBlocks: 72, // 0.5 days
      interveningTransfers: 0,
    }));
    expect(halfDay.overallScore - noWait.overallScore).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Transfer bonus
// ---------------------------------------------------------------------------

describe('Transfer bonus', () => {
  it('should add 1 point per 10 intervening transfers', () => {
    const noTransfers = calculatePrivacyScore(makeParams({
      anonymitySetSize: 500,
      timeSinceDepositBlocks: 0,
      interveningTransfers: 0,
    }));
    const twentyTransfers = calculatePrivacyScore(makeParams({
      anonymitySetSize: 500,
      timeSinceDepositBlocks: 0,
      interveningTransfers: 20,
    }));
    expect(twentyTransfers.overallScore - noTransfers.overallScore).toBe(2);
  });

  it('should cap transfer bonus at 10 points', () => {
    const noTransfers = calculatePrivacyScore(makeParams({
      anonymitySetSize: 500,
      timeSinceDepositBlocks: 0,
      interveningTransfers: 0,
    }));
    const manyTransfers = calculatePrivacyScore(makeParams({
      anonymitySetSize: 500,
      timeSinceDepositBlocks: 0,
      interveningTransfers: 500,
    }));
    expect(manyTransfers.overallScore - noTransfers.overallScore).toBe(10);
  });

  it('should give 0 bonus for fewer than 10 transfers', () => {
    const noTransfers = calculatePrivacyScore(makeParams({
      anonymitySetSize: 500,
      timeSinceDepositBlocks: 0,
      interveningTransfers: 0,
    }));
    const fewTransfers = calculatePrivacyScore(makeParams({
      anonymitySetSize: 500,
      timeSinceDepositBlocks: 0,
      interveningTransfers: 9,
    }));
    expect(fewTransfers.overallScore).toBe(noTransfers.overallScore);
  });
});

// ---------------------------------------------------------------------------
// Pool utilization penalty
// ---------------------------------------------------------------------------

describe('Pool utilization penalty', () => {
  it('should deduct 10 points when utilization is below 5%', () => {
    // anonymitySetSize = 10 with MAX_LEAVES = 1,048,576 gives ~0.001% utilization
    const result = calculatePrivacyScore(makeParams({
      anonymitySetSize: 10,
      timeSinceDepositBlocks: 0,
      interveningTransfers: 0,
      totalDeposits: 20,
      totalWithdrawals: 10,
    }));
    // Base score for size 10 is 20. With -10 penalty = 10.
    expect(result.overallScore).toBe(10);
  });

  it('should not deduct when utilization is above 5%', () => {
    // Need anonymitySetSize >= 0.05 * 1,048,576 = 52,429
    const highUtil = calculatePrivacyScore(makeParams({
      anonymitySetSize: 60000,
      timeSinceDepositBlocks: 0,
      interveningTransfers: 0,
      totalDeposits: 70000,
      totalWithdrawals: 10000,
    }));
    // Base score for 60000 should be in the strong range (80+)
    // No utilization penalty should be applied
    expect(highUtil.poolUtilization).toBeGreaterThanOrEqual(0.05);
    expect(highUtil.overallScore).toBeGreaterThanOrEqual(80);
  });
});

// ---------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------

describe('Warnings', () => {
  it('should warn when anonymity set is below 50', () => {
    const result = calculatePrivacyScore(makeParams({ anonymitySetSize: 25 }));
    expect(result.warnings).toContain(
      'Anonymity set below 50 - consider waiting for more deposits',
    );
  });

  it('should warn about same-block deposit/withdrawal', () => {
    const result = calculatePrivacyScore(makeParams({ timeSinceDepositBlocks: 0 }));
    expect(result.warnings).toContain(
      'Deposit and withdrawal in same block - timing correlation risk',
    );
  });

  it('should warn about low pool utilization', () => {
    const result = calculatePrivacyScore(makeParams({ anonymitySetSize: 5 }));
    expect(result.warnings).toContain(
      'Pool utilization very low - consider waiting',
    );
  });

  it('should warn when anonymity set is 0', () => {
    const result = calculatePrivacyScore(makeParams({ anonymitySetSize: 0 }));
    expect(result.warnings).toContain(
      'No other deposits in pool - withdrawal will be directly linkable to your deposit',
    );
  });

  it('should have no warnings for healthy pool conditions', () => {
    const result = calculatePrivacyScore(makeParams({
      anonymitySetSize: 60000,
      timeSinceDepositBlocks: 288,
      interveningTransfers: 100,
      totalDeposits: 70000,
      totalWithdrawals: 10000,
    }));
    expect(result.warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

describe('Recommendations', () => {
  it('should recommend waiting for more deposits when set is small', () => {
    const result = calculatePrivacyScore(makeParams({ anonymitySetSize: 50 }));
    const hasWaitRec = result.recommendations.some((r) =>
      r.includes('Wait for more deposits'),
    );
    expect(hasWaitRec).toBe(true);
  });

  it('should recommend waiting 1 day when deposit is fresh', () => {
    const result = calculatePrivacyScore(makeParams({ timeSinceDepositBlocks: 10 }));
    const hasTimeRec = result.recommendations.some((r) =>
      r.includes('Wait at least 1 day'),
    );
    expect(hasTimeRec).toBe(true);
  });

  it('should recommend waiting for more transfers', () => {
    const result = calculatePrivacyScore(makeParams({ interveningTransfers: 10 }));
    const hasTransferRec = result.recommendations.some((r) =>
      r.includes('Wait for more pool activity'),
    );
    expect(hasTransferRec).toBe(true);
  });

  it('should recommend favorable conditions when privacy is good', () => {
    const result = calculatePrivacyScore(makeParams({
      anonymitySetSize: 500,
      timeSinceDepositBlocks: 288,
      interveningTransfers: 100,
    }));
    const hasFavorableRec = result.recommendations.some((r) =>
      r.includes('Privacy conditions are favorable'),
    );
    expect(hasFavorableRec).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Score bounds
// ---------------------------------------------------------------------------

describe('Score bounds', () => {
  it('should never exceed 100', () => {
    // Maximize everything: huge anonymity set, long wait, many transfers
    const result = calculatePrivacyScore(makeParams({
      anonymitySetSize: 100000,
      timeSinceDepositBlocks: 14400, // 100 days
      interveningTransfers: 10000,
      totalDeposits: 200000,
      totalWithdrawals: 100000,
    }));
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it('should never go below 0', () => {
    // Minimize everything: tiny set, no wait, sparse pool
    const result = calculatePrivacyScore(makeParams({
      anonymitySetSize: 0,
      timeSinceDepositBlocks: 0,
      interveningTransfers: 0,
      totalDeposits: 1,
      totalWithdrawals: 1,
    }));
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
  });

  it('should return 0 for the absolute worst case', () => {
    const result = calculatePrivacyScore(makeParams({
      anonymitySetSize: 0,
      timeSinceDepositBlocks: 0,
      interveningTransfers: 0,
      totalDeposits: 0,
      totalWithdrawals: 0,
    }));
    // base=0, time=0, transfer=0, penalty=-10 => clamped to 0
    expect(result.overallScore).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('Edge cases', () => {
  it('should handle very large anonymity set', () => {
    const result = calculatePrivacyScore(makeParams({
      anonymitySetSize: 1_000_000,
    }));
    expect(result.rating).toBe('strong');
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it('should handle anonymity set equal to MAX_LEAVES', () => {
    const result = calculatePrivacyScore(makeParams({
      anonymitySetSize: 1_048_576,
      totalDeposits: 1_048_576,
      totalWithdrawals: 0,
    }));
    expect(result.rating).toBe('strong');
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it('should store anonymity set size in the result', () => {
    const result = calculatePrivacyScore(makeParams({ anonymitySetSize: 42 }));
    expect(result.anonymitySetSize).toBe(42);
  });

  it('should store time since deposit in the result', () => {
    const result = calculatePrivacyScore(makeParams({ timeSinceDepositBlocks: 100 }));
    expect(result.timeSinceDeposit).toBe(100);
  });

  it('should store intervening transfers in the result', () => {
    const result = calculatePrivacyScore(makeParams({ interveningTransfers: 77 }));
    expect(result.interveningTransfers).toBe(77);
  });

  it('should compute pool utilization correctly', () => {
    const result = calculatePrivacyScore(makeParams({ anonymitySetSize: 104858 }));
    // 104858 / 1048576 ~ 0.10
    expect(result.poolUtilization).toBeCloseTo(0.1, 1);
  });

  it('should handle all bonuses and penalty simultaneously', () => {
    // Small set (base ~30), 3 days waited (+15), 50 transfers (+5), low utilization (-10)
    const result = calculatePrivacyScore(makeParams({
      anonymitySetSize: 25,
      timeSinceDepositBlocks: 432, // 3 days
      interveningTransfers: 50,
      totalDeposits: 30,
      totalWithdrawals: 5,
    }));
    // Base for 25: interpolated in [20, 40] bracket
    // 25 is 15/40 of the way from 10 to 50, so base ~ 20 + (15/40)*20 = 27.5
    // Time bonus: 3 * 5 = 15
    // Transfer bonus: 50/10 = 5
    // Utilization penalty: -10
    // Total: 27.5 + 15 + 5 - 10 = 37.5
    expect(result.overallScore).toBeGreaterThan(30);
    expect(result.overallScore).toBeLessThan(45);
  });

  it('should return correct types for all fields', () => {
    const result = calculatePrivacyScore(makeParams());

    expect(typeof result.overallScore).toBe('number');
    expect(typeof result.anonymitySetSize).toBe('number');
    expect(typeof result.timeSinceDeposit).toBe('number');
    expect(typeof result.interveningTransfers).toBe('number');
    expect(typeof result.poolUtilization).toBe('number');
    expect(typeof result.rating).toBe('string');
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(Array.isArray(result.recommendations)).toBe(true);
  });
});
