/**
 * Tests for commitment hash computation.
 *
 * Verifies that:
 *   - Commitment hashes are deterministic for the same inputs
 *   - Different secrets/nullifiers produce different commitments
 *   - Amount encoding matches Clarity's uint128 big-endian format
 *   - Nullifier hashes are correct
 *   - The bigintToUint128BE encoding is correct
 */

import { describe, it, expect } from 'vitest';
import { sha256 } from '@noble/hashes/sha256';
import { concatBytes } from '@noble/hashes/utils';
import {
  createCommitment,
  computeCommitmentHash,
  computeNullifierHash,
} from '../src/pool/commitment.js';
import {
  bigintToUint128BE,
  uint128BEToBigint,
  bytesToHex,
  hexToBytes,
} from '../src/utils/crypto.js';
import { POOL_DENOMINATION } from '../src/utils/constants.js';

describe('bigintToUint128BE', () => {
  it('should encode 0 as 16 zero bytes', () => {
    const bytes = bigintToUint128BE(0n);
    expect(bytes.length).toBe(16);
    expect(bytes.every((b) => b === 0)).toBe(true);
  });

  it('should encode 1 correctly', () => {
    const bytes = bigintToUint128BE(1n);
    expect(bytes.length).toBe(16);
    expect(bytes[15]).toBe(1);
    // All other bytes should be 0
    for (let i = 0; i < 15; i++) {
      expect(bytes[i]).toBe(0);
    }
  });

  it('should encode POOL_DENOMINATION (10_000_000) correctly', () => {
    const bytes = bigintToUint128BE(POOL_DENOMINATION);
    expect(bytes.length).toBe(16);

    // 10_000_000 = 0x989680
    // In 16 bytes big-endian: 00 00 00 00 00 00 00 00 00 00 00 00 00 98 96 80
    expect(bytesToHex(bytes)).toBe('00000000000000000000000000989680');
  });

  it('should round-trip with uint128BEToBigint', () => {
    const values = [0n, 1n, 255n, 65536n, POOL_DENOMINATION, (1n << 128n) - 1n];
    for (const val of values) {
      const encoded = bigintToUint128BE(val);
      const decoded = uint128BEToBigint(encoded);
      expect(decoded).toBe(val);
    }
  });

  it('should reject negative values', () => {
    expect(() => bigintToUint128BE(-1n)).toThrow('non-negative');
  });

  it('should reject values exceeding uint128 max', () => {
    expect(() => bigintToUint128BE(1n << 128n)).toThrow('exceeds');
  });
});

describe('Commitment Hash', () => {
  it('should produce a 32-byte hash', () => {
    const commitment = createCommitment(POOL_DENOMINATION);
    expect(commitment.commitment.length).toBe(32);
    expect(commitment.nullifierHash.length).toBe(32);
  });

  it('should be deterministic for the same inputs', () => {
    const secret = new Uint8Array(32).fill(1);
    const nullifier = new Uint8Array(32).fill(2);
    const amount = POOL_DENOMINATION;

    const hash1 = computeCommitmentHash(secret, nullifier, amount);
    const hash2 = computeCommitmentHash(secret, nullifier, amount);

    expect(hash1).toEqual(hash2);
  });

  it('should differ for different secrets', () => {
    const secret1 = new Uint8Array(32).fill(1);
    const secret2 = new Uint8Array(32).fill(3);
    const nullifier = new Uint8Array(32).fill(2);
    const amount = POOL_DENOMINATION;

    const hash1 = computeCommitmentHash(secret1, nullifier, amount);
    const hash2 = computeCommitmentHash(secret2, nullifier, amount);

    expect(hash1).not.toEqual(hash2);
  });

  it('should differ for different nullifiers', () => {
    const secret = new Uint8Array(32).fill(1);
    const nullifier1 = new Uint8Array(32).fill(2);
    const nullifier2 = new Uint8Array(32).fill(4);
    const amount = POOL_DENOMINATION;

    const hash1 = computeCommitmentHash(secret, nullifier1, amount);
    const hash2 = computeCommitmentHash(secret, nullifier2, amount);

    expect(hash1).not.toEqual(hash2);
  });

  it('should differ for different amounts', () => {
    const secret = new Uint8Array(32).fill(1);
    const nullifier = new Uint8Array(32).fill(2);

    const hash1 = computeCommitmentHash(secret, nullifier, 100n);
    const hash2 = computeCommitmentHash(secret, nullifier, 200n);

    expect(hash1).not.toEqual(hash2);
  });

  it('should match manual SHA-256 computation', () => {
    const secret = new Uint8Array(32).fill(0xaa);
    const nullifier = new Uint8Array(32).fill(0xbb);
    const amount = POOL_DENOMINATION;

    const amountBytes = bigintToUint128BE(amount);
    const preimage = concatBytes(secret, nullifier, amountBytes);
    const expectedHash = sha256(preimage);

    const computed = computeCommitmentHash(secret, nullifier, amount);
    expect(computed).toEqual(expectedHash);
  });

  it('should reject invalid secret length', () => {
    expect(() =>
      computeCommitmentHash(
        new Uint8Array(16), // wrong length
        new Uint8Array(32),
        POOL_DENOMINATION,
      ),
    ).toThrow('32 bytes');
  });

  it('should reject invalid nullifier length', () => {
    expect(() =>
      computeCommitmentHash(
        new Uint8Array(32),
        new Uint8Array(16), // wrong length
        POOL_DENOMINATION,
      ),
    ).toThrow('32 bytes');
  });
});

describe('Nullifier Hash', () => {
  it('should produce sha256(nullifier)', () => {
    const nullifier = new Uint8Array(32).fill(0xcc);
    const expected = sha256(nullifier);
    const computed = computeNullifierHash(nullifier);

    expect(computed).toEqual(expected);
  });

  it('should be deterministic', () => {
    const nullifier = new Uint8Array(32).fill(0xdd);
    const hash1 = computeNullifierHash(nullifier);
    const hash2 = computeNullifierHash(nullifier);

    expect(hash1).toEqual(hash2);
  });

  it('should differ for different nullifiers', () => {
    const n1 = new Uint8Array(32).fill(1);
    const n2 = new Uint8Array(32).fill(2);

    expect(computeNullifierHash(n1)).not.toEqual(computeNullifierHash(n2));
  });
});

describe('createCommitment', () => {
  it('should generate unique commitments', () => {
    const c1 = createCommitment(POOL_DENOMINATION);
    const c2 = createCommitment(POOL_DENOMINATION);

    // Random secrets and nullifiers should produce different commitments
    expect(c1.secret).not.toEqual(c2.secret);
    expect(c1.nullifier).not.toEqual(c2.nullifier);
    expect(c1.commitment).not.toEqual(c2.commitment);
    expect(c1.nullifierHash).not.toEqual(c2.nullifierHash);
  });

  it('should store the correct amount', () => {
    const commitment = createCommitment(POOL_DENOMINATION);
    expect(commitment.amount).toBe(POOL_DENOMINATION);
  });

  it('should have consistent commitment and nullifierHash', () => {
    const c = createCommitment(POOL_DENOMINATION);

    // Recompute and verify
    const recomputedCommitment = computeCommitmentHash(
      c.secret,
      c.nullifier,
      c.amount,
    );
    const recomputedNullifierHash = computeNullifierHash(c.nullifier);

    expect(c.commitment).toEqual(recomputedCommitment);
    expect(c.nullifierHash).toEqual(recomputedNullifierHash);
  });
});
