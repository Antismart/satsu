/**
 * Stealth keypair generation for the Satsu privacy system.
 *
 * Each user in the Satsu system has two secp256k1 keypairs:
 *
 *   1. **Spend keypair** — controls spending of received funds.
 *      The spend private key MUST be kept secret; compromise means loss
 *      of all funds in the system.
 *
 *   2. **View keypair** — allows scanning the blockchain for incoming
 *      payments without the ability to spend. The view key can be shared
 *      with a "scanning" service to detect deposits addressed to the user
 *      without giving that service spending authority.
 *
 * The view key is derived deterministically from the spend key via
 * HMAC-SHA256 to reduce backup complexity: users only need to back up
 * a single 32-byte spend private key.
 */

import * as secp from '@noble/secp256k1';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { utf8ToBytes, concatBytes } from '@noble/hashes/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StealthKeypair {
  /** 32-byte spend private key (scalar). */
  spendPrivKey: Uint8Array;
  /** 33-byte compressed spend public key. */
  spendPubKey: Uint8Array;
  /** 32-byte view private key (scalar). */
  viewPrivKey: Uint8Array;
  /** 33-byte compressed view public key. */
  viewPubKey: Uint8Array;
}

export interface ViewKeypair {
  /** 32-byte view private key (scalar). */
  viewPrivKey: Uint8Array;
  /** 33-byte compressed view public key. */
  viewPubKey: Uint8Array;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Domain separation tag for view key derivation.
 * Ensures the HMAC output is specific to Satsu view key derivation
 * and cannot collide with other uses of the same spend key.
 */
const VIEW_KEY_DOMAIN = utf8ToBytes('satsu/view-key-derivation/v1');

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Generate a fresh pair of stealth keys (spend + view).
 *
 * The spend private key is generated from the platform CSPRNG via
 * @noble/secp256k1's randomPrivateKey, which rejection-samples to
 * ensure the scalar is in the valid range [1, n-1].
 *
 * The view key is deterministically derived from the spend key.
 */
export function generateStealthKeys(): StealthKeypair {
  const spendPrivKey = secp.utils.randomPrivateKey();
  const spendPubKey = secp.getPublicKey(spendPrivKey, true);

  const { viewPrivKey, viewPubKey } = deriveViewKeyFromSpend(spendPrivKey);

  return {
    spendPrivKey,
    spendPubKey,
    viewPrivKey,
    viewPubKey,
  };
}

/**
 * Derive the view keypair deterministically from a spend private key.
 *
 * Uses HMAC-SHA256 with a domain-separated tag to produce a 32-byte
 * value, then reduces it modulo the curve order n to obtain a valid
 * scalar. This is deterministic: the same spend key always produces
 * the same view key.
 *
 * The HMAC construction prevents length-extension attacks and provides
 * a clean PRF under the assumption that SHA-256 is a good hash.
 *
 * @param spendPrivKey - 32-byte spend private key
 * @returns View keypair derived from the spend key
 */
export function deriveViewKeyFromSpend(spendPrivKey: Uint8Array): ViewKeypair {
  // Derive 64 bytes of pseudorandom material using HMAC-SHA256 in a
  // two-round extraction scheme (similar to HKDF-Expand). We need at
  // least 40 bytes for hashToPrivateKey to have proper bias removal.
  //
  // Round 1: HMAC-SHA256(key = domain_tag, msg = spendPrivKey || 0x01) -> 32 bytes
  // Round 2: HMAC-SHA256(key = domain_tag, msg = round1 || spendPrivKey || 0x02) -> 32 bytes
  // Concatenated: 64 bytes of pseudorandom material.
  const tag1 = new Uint8Array([0x01]);
  const tag2 = new Uint8Array([0x02]);

  const round1 = hmac(sha256, VIEW_KEY_DOMAIN, concatBytes(spendPrivKey, tag1));
  const round2 = hmac(sha256, VIEW_KEY_DOMAIN, concatBytes(round1, spendPrivKey, tag2));
  const derived = concatBytes(round1, round2); // 64 bytes

  // hashToPrivateKey reduces the 64-byte hash modulo n with negligible
  // bias (~2^-192 for secp256k1 with 64-byte input).
  const viewPrivKey = secp.etc.hashToPrivateKey(derived);
  const viewPubKey = secp.getPublicKey(viewPrivKey, true);

  return { viewPrivKey, viewPubKey };
}
