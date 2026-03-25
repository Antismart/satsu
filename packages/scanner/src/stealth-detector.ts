/**
 * Stealth payment detection via view-key trial decryption.
 *
 * This is the cryptographic core of the scanner. For every withdrawal
 * event observed on-chain, the scanner performs an ECDH computation
 * with the user's view private key and the on-chain ephemeral public
 * key. If the derived stealth address matches the event's recipient,
 * the payment belongs to the user.
 *
 * Security model:
 * - The scanner holds the VIEW private key (for detection only).
 * - The scanner holds the SPEND public key (for address derivation).
 * - The scanner NEVER holds the spend private key.
 * - The shared secret hash is returned so the user's device can compute
 *   the stealth spending key: stealthPrivKey = spendPrivKey + s (mod n).
 *
 * @module
 */

import * as secp from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { ripemd160 } from '@noble/hashes/ripemd160';

import type { WithdrawalEvent } from './chainhook.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DetectedPayment {
  /** Transaction ID of the withdrawal. */
  txId: string;
  /** Stacks address that received the payment. */
  stealthAddress: string;
  /** 33-byte compressed stealth public key. */
  stealthPubKey: Uint8Array;
  /**
   * s = sha256(S) where S is the ECDH shared secret point.
   * The user computes: stealthPrivKey = spendPrivKey + s (mod n).
   */
  sharedSecretHash: Uint8Array;
  /** 33-byte compressed ephemeral public key R from the event. */
  ephemeralPubKey: Uint8Array;
  /** Pool denomination amount in satoshis. */
  amount: bigint;
  /** Block height at which the withdrawal was confirmed. */
  blockHeight: number;
  /** Unix timestamp (ms) when the scanner detected this payment. */
  detectedAt: number;
}

export interface ScannerKeys {
  /** 32-byte private view key. */
  viewPrivKey: Uint8Array;
  /** 33-byte compressed public spend key. */
  spendPubKey: Uint8Array;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Pool denomination: 0.1 sBTC = 10,000,000 satoshis. */
const POOL_DENOMINATION = 10_000_000n;

// ---------------------------------------------------------------------------
// Core detection
// ---------------------------------------------------------------------------

/**
 * Attempt trial decryption of a single withdrawal event.
 *
 * Algorithm:
 * 1. Parse ephemeral public key R from the event.
 * 2. Compute shared secret point: S = viewPrivKey * R (ECDH).
 * 3. Hash the compressed shared secret: s = sha256(S_compressed).
 * 4. Reduce s to a valid secp256k1 scalar.
 * 5. Derive expected stealth public key: P = spendPubKey + s * G.
 * 6. Derive the expected Stacks address from P.
 * 7. If the address matches the event recipient, this payment is ours.
 *
 * @param event - Withdrawal event from the blockchain
 * @param keys - Scanner's view private key and spend public key
 * @param network - Stacks network for address derivation
 * @returns Detected payment details, or null if this payment is not ours
 */
export function tryDecryptPayment(
  event: WithdrawalEvent,
  keys: ScannerKeys,
  network: 'mainnet' | 'testnet' | 'devnet' = 'devnet',
): DetectedPayment | null {
  try {
    // 1. Validate ephemeral public key
    const R = event.ephemeralPubKey;
    if (R.length !== 33) {
      return null;
    }

    // 2. ECDH: S = viewPrivKey * R
    const sharedSecretPoint = secp.getSharedSecret(keys.viewPrivKey, R, true);

    // 3. Hash the shared secret to get a scalar
    const hashS = sha256(sharedSecretPoint);

    // 4. Reduce to a valid scalar
    const hashScalar = bytesToScalar(hashS);

    // 5. Derive stealth public key: P = spendPubKey + hash(S) * G
    const spendPoint = secp.Point.fromHex(keys.spendPubKey);
    const hashPoint = secp.Point.BASE.multiply(hashScalar);
    const stealthPoint = spendPoint.add(hashPoint);
    const stealthPubKey = stealthPoint.toRawBytes(true);

    // 6. Derive expected Stacks address
    const stacksNetwork = network === 'devnet' ? 'testnet' : network;
    const expectedAddress = publicKeyToStacksAddress(stealthPubKey, stacksNetwork);

    // 7. Compare with event recipient
    if (expectedAddress !== event.recipient) {
      return null;
    }

    // Match found - this payment is addressed to us
    return {
      txId: event.txId,
      stealthAddress: expectedAddress,
      stealthPubKey,
      sharedSecretHash: hashS,
      ephemeralPubKey: R,
      amount: POOL_DENOMINATION - event.relayerFee,
      blockHeight: event.blockHeight,
      detectedAt: Date.now(),
    };
  } catch {
    // Invalid point, bad key, etc. - not our payment.
    return null;
  }
}

/**
 * Scan a batch of withdrawal events and return all detected payments.
 *
 * @param events - Array of withdrawal events to scan
 * @param keys - Scanner's view private key and spend public key
 * @param network - Stacks network for address derivation
 * @returns Array of detected payments (may be empty)
 */
export function scanEvents(
  events: WithdrawalEvent[],
  keys: ScannerKeys,
  network: 'mainnet' | 'testnet' | 'devnet' = 'devnet',
): DetectedPayment[] {
  const detected: DetectedPayment[] = [];
  for (const event of events) {
    const payment = tryDecryptPayment(event, keys, network);
    if (payment !== null) {
      detected.push(payment);
    }
  }
  return detected;
}

// ---------------------------------------------------------------------------
// Address derivation helpers
// ---------------------------------------------------------------------------

/**
 * Derive a Stacks address from a compressed secp256k1 public key.
 *
 * Steps:
 * 1. Compute hash160 = RIPEMD-160(SHA-256(pubkey))
 * 2. Encode as c32check with appropriate version byte
 */
export function publicKeyToStacksAddress(
  compressedPubKey: Uint8Array,
  network: 'mainnet' | 'testnet',
): string {
  const hash = hash160(compressedPubKey);
  const version = network === 'mainnet' ? 22 : 26;
  return c32checkEncode(version, hash);
}

/**
 * Compute hash160 = RIPEMD-160(SHA-256(data)).
 */
function hash160(data: Uint8Array): Uint8Array {
  return ripemd160(sha256(data));
}

// ---------------------------------------------------------------------------
// Scalar helpers
// ---------------------------------------------------------------------------

/**
 * Reduce a 32-byte hash to a valid secp256k1 scalar in [1, n-1].
 */
function bytesToScalar(bytes: Uint8Array): bigint {
  const num = secp.etc.bytesToNumberBE(bytes);
  const scalar = secp.etc.mod(num, secp.CURVE.n);
  return scalar === 0n ? 1n : scalar;
}

// ---------------------------------------------------------------------------
// c32check encoding (minimal implementation)
// ---------------------------------------------------------------------------

const C32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Encode a hash160 as a Stacks c32check address.
 *
 * Format: "S" + version_char + c32encode(hash160 || checksum)
 * where checksum = sha256(sha256(version || hash160))[0..4]
 */
function c32checkEncode(version: number, data: Uint8Array): string {
  // Compute checksum: double-SHA-256 of (version || data)
  const versionedData = new Uint8Array(1 + data.length);
  versionedData[0] = version;
  versionedData.set(data, 1);

  const checksum = sha256(sha256(versionedData)).slice(0, 4);

  // c32 encode the data + checksum (NOT the version byte)
  const payload = new Uint8Array(data.length + 4);
  payload.set(data, 0);
  payload.set(checksum, data.length);

  const c32Str = c32Encode(payload);

  // Prepend the version character
  const versionChar = C32_ALPHABET[version]!;

  return `S${versionChar}${c32Str}`;
}

/**
 * Base-c32 encoding of a byte array.
 *
 * Converts the byte array to a big-endian integer and repeatedly
 * divides by 32 to extract c32 digits. Leading zero bytes in the
 * input are preserved as leading '0' characters in the output.
 */
function c32Encode(data: Uint8Array): string {
  let num = 0n;
  for (const byte of data) {
    num = (num << 8n) | BigInt(byte);
  }

  if (num === 0n) {
    return C32_ALPHABET[0]!.repeat(data.length);
  }

  const digits: string[] = [];
  while (num > 0n) {
    digits.push(C32_ALPHABET[Number(num % 32n)]!);
    num = num / 32n;
  }

  digits.reverse();

  // Preserve leading zero bytes
  let leadingZeros = 0;
  for (const byte of data) {
    if (byte === 0) leadingZeros++;
    else break;
  }

  const prefix = C32_ALPHABET[0]!.repeat(leadingZeros);
  return prefix + digits.join('');
}
