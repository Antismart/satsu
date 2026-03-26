/**
 * Privacy scoring module for Satsu withdrawal risk assessment.
 *
 * Before a user withdraws from the privacy pool, this module evaluates
 * the current privacy conditions and returns a score with actionable
 * warnings and recommendations. The score accounts for:
 *
 *   - Anonymity set size (primary factor)
 *   - Time elapsed since deposit (longer = better)
 *   - Number of intervening transfers (more = better)
 *   - Pool utilization (sparse pools are more analyzable)
 *
 * The scoring rubric is calibrated against Tornado Cash research:
 *   - < 10 unspent deposits  => critical (trivially deanonymizable)
 *   - 10-50                  => low
 *   - 50-200                 => moderate
 *   - 200-1000               => good
 *   - > 1000                 => strong
 *
 * @module
 */

import { MAX_LEAVES } from '../utils/constants.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrivacyScore {
  /** Overall privacy score from 0 (no privacy) to 100 (excellent). */
  overallScore: number;
  /** Number of unspent deposits in the pool (total deposits - total withdrawals). */
  anonymitySetSize: number;
  /** Number of blocks elapsed since the user's deposit. */
  timeSinceDeposit: number;
  /** Number of other transfers that occurred since the user's deposit. */
  interveningTransfers: number;
  /** Pool utilization ratio: anonymitySetSize / MAX_LEAVES. */
  poolUtilization: number;
  /** Human-readable privacy rating. */
  rating: 'critical' | 'low' | 'moderate' | 'good' | 'strong';
  /** Actionable warnings about current privacy conditions. */
  warnings: string[];
  /** Suggestions for improving privacy before withdrawing. */
  recommendations: string[];
}

export interface PrivacyScoreParams {
  /** Number of unspent deposits in the pool. */
  anonymitySetSize: number;
  /** Blocks elapsed since the user's deposit was confirmed. */
  timeSinceDepositBlocks: number;
  /** Number of other pool transfers since the user's deposit. */
  interveningTransfers: number;
  /** Total number of deposits ever made to the pool. */
  totalDeposits: number;
  /** Total number of withdrawals ever made from the pool. */
  totalWithdrawals: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Average Stacks block time in minutes (~10 minutes).
 * Used to convert block counts to approximate wall-clock time.
 */
const AVG_BLOCK_TIME_MINUTES = 10;

/** Blocks per day assuming ~10 minute block times. */
const BLOCKS_PER_DAY = (24 * 60) / AVG_BLOCK_TIME_MINUTES; // 144

/** Maximum bonus points awarded for time elapsed since deposit. */
const MAX_TIME_BONUS = 20;

/** Points awarded per day waited (up to MAX_TIME_BONUS). */
const TIME_BONUS_PER_DAY = 5;

/** Maximum bonus points awarded for intervening transfers. */
const MAX_TRANSFER_BONUS = 10;

/** Number of intervening transfers per bonus point. */
const TRANSFERS_PER_BONUS_POINT = 10;

/** Utilization threshold below which a penalty is applied. */
const LOW_UTILIZATION_THRESHOLD = 0.05;

/** Points deducted when pool utilization is below the threshold. */
const LOW_UTILIZATION_PENALTY = 10;

// ---------------------------------------------------------------------------
// Scoring thresholds
// ---------------------------------------------------------------------------

interface AnonymityBracket {
  readonly minSize: number;
  readonly maxSize: number;
  readonly minScore: number;
  readonly maxScore: number;
  readonly rating: PrivacyScore['rating'];
}

const ANONYMITY_BRACKETS: readonly AnonymityBracket[] = [
  { minSize: 0,    maxSize: 10,   minScore: 0,  maxScore: 20, rating: 'critical' },
  { minSize: 10,   maxSize: 50,   minScore: 20, maxScore: 40, rating: 'low' },
  { minSize: 50,   maxSize: 200,  minScore: 40, maxScore: 60, rating: 'moderate' },
  { minSize: 200,  maxSize: 1000, minScore: 60, maxScore: 80, rating: 'good' },
  { minSize: 1000, maxSize: Infinity, minScore: 80, maxScore: 100, rating: 'strong' },
] as const;

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

/**
 * Calculate a privacy score for a potential withdrawal.
 *
 * The score reflects how safe it is to withdraw right now. A higher
 * score means better privacy. The function also returns human-readable
 * warnings and recommendations to help the user decide whether to
 * proceed or wait.
 *
 * @param params - Current pool and deposit conditions
 * @returns Complete privacy score with rating, warnings, and recommendations
 */
export function calculatePrivacyScore(params: PrivacyScoreParams): PrivacyScore {
  const {
    anonymitySetSize,
    timeSinceDepositBlocks,
    interveningTransfers,
    totalDeposits,
    totalWithdrawals,
  } = params;

  // --- 1. Base score from anonymity set size ---
  const baseScore = calculateBaseScore(anonymitySetSize);
  const rating = determineRating(anonymitySetSize);

  // --- 2. Time bonus: +5 points per day, max +20 ---
  const daysWaited = timeSinceDepositBlocks / BLOCKS_PER_DAY;
  const timeBonus = Math.min(
    Math.floor(daysWaited) * TIME_BONUS_PER_DAY,
    MAX_TIME_BONUS,
  );

  // --- 3. Transfer bonus: +1 point per 10 transfers, max +10 ---
  const transferBonus = Math.min(
    Math.floor(interveningTransfers / TRANSFERS_PER_BONUS_POINT),
    MAX_TRANSFER_BONUS,
  );

  // --- 4. Utilization penalty ---
  const poolUtilization = MAX_LEAVES > 0 ? anonymitySetSize / MAX_LEAVES : 0;
  const utilizationPenalty = poolUtilization < LOW_UTILIZATION_THRESHOLD
    ? LOW_UTILIZATION_PENALTY
    : 0;

  // --- 5. Combine and clamp to [0, 100] ---
  const rawScore = baseScore + timeBonus + transferBonus - utilizationPenalty;
  const overallScore = Math.max(0, Math.min(100, rawScore));

  // --- 6. Generate warnings ---
  const warnings = generateWarnings(
    anonymitySetSize,
    timeSinceDepositBlocks,
    poolUtilization,
  );

  // --- 7. Generate recommendations ---
  const recommendations = generateRecommendations(
    anonymitySetSize,
    timeSinceDepositBlocks,
    interveningTransfers,
    poolUtilization,
    totalDeposits,
    totalWithdrawals,
  );

  return {
    overallScore,
    anonymitySetSize,
    timeSinceDeposit: timeSinceDepositBlocks,
    interveningTransfers,
    poolUtilization,
    rating,
    warnings,
    recommendations,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Calculate the base score from the anonymity set size using linear
 * interpolation within the appropriate bracket.
 */
function calculateBaseScore(anonymitySetSize: number): number {
  const size = Math.max(0, anonymitySetSize);

  for (const bracket of ANONYMITY_BRACKETS) {
    if (size < bracket.maxSize) {
      // Linear interpolation within this bracket
      const range = bracket.maxSize - bracket.minSize;
      const progress = (size - bracket.minSize) / range;
      return bracket.minScore + progress * (bracket.maxScore - bracket.minScore);
    }
  }

  // If we somehow exceed all brackets (size >= Infinity), return max
  return 100;
}

/**
 * Determine the human-readable rating from the anonymity set size.
 */
function determineRating(anonymitySetSize: number): PrivacyScore['rating'] {
  const size = Math.max(0, anonymitySetSize);

  for (const bracket of ANONYMITY_BRACKETS) {
    if (size < bracket.maxSize) {
      return bracket.rating;
    }
  }

  return 'strong';
}

/**
 * Generate warnings about conditions that weaken privacy.
 */
function generateWarnings(
  anonymitySetSize: number,
  timeSinceDepositBlocks: number,
  poolUtilization: number,
): string[] {
  const warnings: string[] = [];

  if (anonymitySetSize < 50) {
    warnings.push(
      'Anonymity set below 50 - consider waiting for more deposits',
    );
  }

  if (timeSinceDepositBlocks === 0) {
    warnings.push(
      'Deposit and withdrawal in same block - timing correlation risk',
    );
  }

  if (poolUtilization < LOW_UTILIZATION_THRESHOLD) {
    warnings.push(
      'Pool utilization very low - consider waiting',
    );
  }

  if (anonymitySetSize === 0) {
    warnings.push(
      'No other deposits in pool - withdrawal will be directly linkable to your deposit',
    );
  }

  return warnings;
}

/**
 * Generate actionable recommendations for improving privacy.
 */
function generateRecommendations(
  anonymitySetSize: number,
  timeSinceDepositBlocks: number,
  interveningTransfers: number,
  poolUtilization: number,
  _totalDeposits: number,
  _totalWithdrawals: number,
): string[] {
  const recommendations: string[] = [];

  if (anonymitySetSize < 200) {
    recommendations.push(
      `Wait for more deposits to grow the anonymity set (currently ${anonymitySetSize}, recommended: 200+)`,
    );
  }

  const daysWaited = timeSinceDepositBlocks / BLOCKS_PER_DAY;
  if (daysWaited < 1) {
    recommendations.push(
      'Wait at least 1 day after depositing before withdrawing to reduce timing correlation',
    );
  }

  if (interveningTransfers < 50) {
    recommendations.push(
      `Wait for more pool activity (${interveningTransfers} transfers since your deposit, recommended: 50+)`,
    );
  }

  if (poolUtilization < LOW_UTILIZATION_THRESHOLD) {
    recommendations.push(
      'Pool is sparsely used - your transactions are more conspicuous. Consider waiting for higher utilization.',
    );
  }

  if (anonymitySetSize >= 200 && daysWaited >= 1 && interveningTransfers >= 50) {
    recommendations.push(
      'Privacy conditions are favorable for withdrawal',
    );
  }

  return recommendations;
}
