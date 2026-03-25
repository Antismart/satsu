/**
 * Low-level cryptographic helpers shared across the SDK.
 *
 * All functions operate on Uint8Array (never Buffer) and are
 * side-effect free. Uses @noble/hashes for SHA-256 and CSPRNG
 * to ensure consistent cross-platform behavior.
 */

import { sha256 } from '@noble/hashes/sha256';
import {
  randomBytes as nobleRandomBytes,
  bytesToHex as nobleBytesToHex,
  hexToBytes as nobleHexToBytes,
  concatBytes as nobleConcatBytes,
} from '@noble/hashes/utils';

/**
 * Compute SHA-256 hash of arbitrary data.
 *
 * This is the core hash function used throughout Satsu: commitments,
 * nullifier hashes, and Merkle tree nodes all use SHA-256 to match
 * the Clarity contracts which use the built-in `sha256` function.
 */
export function hash(data: Uint8Array): Uint8Array {
  return sha256(data);
}

/**
 * Concatenate multiple Uint8Arrays into a single contiguous array.
 *
 * Used extensively in commitment construction (secret || nullifier || amount)
 * and Merkle tree hashing (left || right).
 */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  return nobleConcatBytes(...arrays);
}

/**
 * Generate cryptographically secure random bytes.
 *
 * Delegates to the platform CSPRNG (crypto.getRandomValues in browsers,
 * crypto.randomBytes in Node.js) via @noble/hashes.
 */
export function randomBytes(length: number): Uint8Array {
  return nobleRandomBytes(length);
}

/**
 * Convert a Uint8Array to a hex string (no 0x prefix).
 * @example bytesToHex(new Uint8Array([0xca, 0xfe])) // 'cafe'
 */
export function bytesToHex(bytes: Uint8Array): string {
  return nobleBytesToHex(bytes);
}

/**
 * Convert a hex string (with or without 0x prefix) to Uint8Array.
 * @example hexToBytes('cafe') // Uint8Array [0xca, 0xfe]
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (cleaned.length % 2 !== 0) {
    throw new Error('Hex string must have even length');
  }
  return nobleHexToBytes(cleaned);
}

/**
 * Constant-time comparison of two Uint8Array values.
 *
 * SECURITY: This function resists timing side-channel attacks by always
 * examining every byte of both arrays regardless of where a mismatch
 * occurs. The XOR-accumulate pattern ensures the final branch depends
 * only on the accumulated value, not on the position of any difference.
 *
 * Returns true if and only if both arrays have the same length and
 * identical byte content.
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
}

/** Alias for constantTimeEqual for callers that prefer this name. */
export const uint8ArrayEquals = constantTimeEqual;

/**
 * Encode a bigint as a big-endian unsigned 128-bit (16-byte) Uint8Array.
 *
 * This matches Clarity's uint representation: Clarity uints are 128-bit
 * unsigned integers stored in big-endian byte order. When we compute
 * commitment hashes as sha256(secret || nullifier || amount), the amount
 * must be encoded identically to how Clarity's `concat` and `sha256`
 * treat uint values.
 *
 * @throws {RangeError} If the value is negative or exceeds 2^128 - 1
 */
export function bigintToUint128BE(value: bigint): Uint8Array {
  if (value < 0n) {
    throw new RangeError('Value must be non-negative');
  }
  if (value >= 1n << 128n) {
    throw new RangeError('Value exceeds uint128 maximum');
  }
  const bytes = new Uint8Array(16);
  let remaining = value;
  for (let i = 15; i >= 0; i--) {
    bytes[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return bytes;
}

/**
 * Decode a big-endian 16-byte Uint8Array back to a bigint.
 * Inverse of bigintToUint128BE.
 */
export function uint128BEToBigint(bytes: Uint8Array): bigint {
  if (bytes.length !== 16) {
    throw new RangeError('Expected exactly 16 bytes for uint128');
  }
  let value = 0n;
  for (let i = 0; i < 16; i++) {
    value = (value << 8n) | BigInt(bytes[i]!);
  }
  return value;
}
