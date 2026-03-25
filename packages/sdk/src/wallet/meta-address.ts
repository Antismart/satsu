/**
 * Meta-address encoding/decoding for the Satsu stealth address system.
 *
 * A "meta-address" encodes a user's spend and view public keys into a
 * single string that can be shared publicly (e.g. on a profile page or
 * in a payment request). Senders use the meta-address to derive a fresh
 * one-time stealth address for each payment.
 *
 * Encoding format:
 *   "st:1:<spendPubKeyHex><viewPubKeyHex>"
 *
 * Where:
 *   - "st:" is the stealth address prefix
 *   - "1" is the scheme version (1 = secp256k1 + SHA-256)
 *   - spendPubKeyHex is the 33-byte compressed spend public key (66 hex chars)
 *   - viewPubKeyHex is the 33-byte compressed view public key (66 hex chars)
 *
 * This format is inspired by EIP-5564 but adapted for the Stacks ecosystem.
 */

import * as secp from '@noble/secp256k1';
import { bytesToHex, hexToBytes } from '../utils/crypto.js';
import { COMPRESSED_PUBKEY_LENGTH } from '../utils/constants.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StealthMetaAddress {
  /** 33-byte compressed secp256k1 spend public key. */
  spendPubKey: Uint8Array;
  /** 33-byte compressed secp256k1 view public key. */
  viewPubKey: Uint8Array;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const META_ADDRESS_PREFIX = 'st:';
const META_ADDRESS_VERSION = '1';
const META_ADDRESS_HEADER = `${META_ADDRESS_PREFIX}${META_ADDRESS_VERSION}:`;

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Encode spend and view public keys into a meta-address string.
 *
 * @param spendPubKey - 33-byte compressed spend public key
 * @param viewPubKey - 33-byte compressed view public key
 * @returns Encoded meta-address string
 *
 * @example
 * const encoded = encodeMetaAddress(spendPubKey, viewPubKey);
 * // "st:1:02abc...def03xyz...789"
 */
export function encodeMetaAddress(
  spendPubKey: Uint8Array,
  viewPubKey: Uint8Array,
): string {
  if (spendPubKey.length !== COMPRESSED_PUBKEY_LENGTH) {
    throw new Error(
      `Spend public key must be ${COMPRESSED_PUBKEY_LENGTH} bytes, got ${spendPubKey.length}`,
    );
  }
  if (viewPubKey.length !== COMPRESSED_PUBKEY_LENGTH) {
    throw new Error(
      `View public key must be ${COMPRESSED_PUBKEY_LENGTH} bytes, got ${viewPubKey.length}`,
    );
  }

  // Validate that both keys are valid secp256k1 points
  if (!isValidCompressedKey(spendPubKey)) {
    throw new Error('Invalid spend public key: not a valid secp256k1 point');
  }
  if (!isValidCompressedKey(viewPubKey)) {
    throw new Error('Invalid view public key: not a valid secp256k1 point');
  }

  return `${META_ADDRESS_HEADER}${bytesToHex(spendPubKey)}${bytesToHex(viewPubKey)}`;
}

/**
 * Decode a meta-address string back into spend and view public keys.
 *
 * @param encoded - Meta-address string (e.g. "st:1:02abc...def03xyz...789")
 * @returns Decoded StealthMetaAddress with spend and view public keys
 * @throws {Error} If the format is invalid, version unsupported, or keys invalid
 */
export function decodeMetaAddress(encoded: string): StealthMetaAddress {
  if (!encoded.startsWith(META_ADDRESS_HEADER)) {
    throw new Error(
      `Invalid meta-address: must start with "${META_ADDRESS_HEADER}"`,
    );
  }

  const payload = encoded.slice(META_ADDRESS_HEADER.length);

  // 33 bytes * 2 keys * 2 hex chars per byte = 132 hex chars
  const expectedHexLength = COMPRESSED_PUBKEY_LENGTH * 2 * 2;
  if (payload.length !== expectedHexLength) {
    throw new Error(
      `Invalid meta-address: expected ${expectedHexLength} hex chars after header, got ${payload.length}`,
    );
  }

  const spendHex = payload.slice(0, COMPRESSED_PUBKEY_LENGTH * 2);
  const viewHex = payload.slice(COMPRESSED_PUBKEY_LENGTH * 2);

  const spendPubKey = hexToBytes(spendHex);
  const viewPubKey = hexToBytes(viewHex);

  // Validate decoded keys
  if (!isValidCompressedKey(spendPubKey)) {
    throw new Error(
      'Invalid meta-address: spend public key is not a valid secp256k1 point',
    );
  }
  if (!isValidCompressedKey(viewPubKey)) {
    throw new Error(
      'Invalid meta-address: view public key is not a valid secp256k1 point',
    );
  }

  return { spendPubKey, viewPubKey };
}

/**
 * Validate a StealthMetaAddress structure.
 *
 * Checks that both keys are 33-byte compressed secp256k1 public keys
 * that lie on the curve. This is important to verify before using a
 * meta-address for stealth address derivation, as invalid keys could
 * lead to funds being sent to unspendable addresses.
 *
 * @param meta - The meta-address to validate
 * @returns true if valid, false otherwise
 */
export function validateMetaAddress(meta: StealthMetaAddress): boolean {
  if (
    meta.spendPubKey.length !== COMPRESSED_PUBKEY_LENGTH ||
    meta.viewPubKey.length !== COMPRESSED_PUBKEY_LENGTH
  ) {
    return false;
  }
  return (
    isValidCompressedKey(meta.spendPubKey) &&
    isValidCompressedKey(meta.viewPubKey)
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if a byte array is a valid compressed secp256k1 public key.
 *
 * A compressed key is 33 bytes: a 0x02 or 0x03 prefix followed by
 * the 32-byte x-coordinate. We verify it actually decodes to a
 * point on the curve.
 */
function isValidCompressedKey(key: Uint8Array): boolean {
  if (key.length !== COMPRESSED_PUBKEY_LENGTH) return false;
  if (key[0] !== 0x02 && key[0] !== 0x03) return false;
  try {
    // fromHex validates that the point is on the curve
    secp.Point.fromHex(key);
    return true;
  } catch {
    return false;
  }
}
