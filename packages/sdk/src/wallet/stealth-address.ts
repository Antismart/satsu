/**
 * ECDH-based stealth address derivation for the Satsu privacy system.
 *
 * Implements EIP-5564-style stealth addresses adapted for Stacks/secp256k1.
 *
 * Protocol overview:
 *   1. Recipient publishes a meta-address (spendPubKey, viewPubKey).
 *   2. Sender picks a random ephemeral scalar r, computes R = r*G.
 *   3. Sender computes shared secret S = r * viewPubKey (ECDH).
 *   4. Sender derives stealth public key: P_stealth = spendPubKey + hash(S)*G
 *   5. Sender publishes R on-chain alongside the deposit.
 *   6. Recipient scans: S' = viewPrivKey * R, checks if spendPubKey + hash(S')*G
 *      matches the stealth address. If so, the spending key is
 *      spendPrivKey + hash(S').
 *
 * Security properties:
 *   - Each payment goes to a fresh, unlinkable one-time address.
 *   - Only the view key holder can detect incoming payments.
 *   - Only the spend key holder can spend the funds.
 *   - The ephemeral key R reveals nothing about sender or recipient
 *     to observers who lack the view key.
 */

import * as secp from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '../utils/crypto.js';
import type { StealthMetaAddress } from './meta-address.js';

// Re-export the type for convenience
export type { StealthMetaAddress } from './meta-address.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StealthAddressResult {
  /** Stacks address derived from the stealth public key (SP... or ST...). */
  stealthAddress: string;
  /** 33-byte compressed stealth public key. */
  stealthPubKey: Uint8Array;
  /** 32-byte stealth private key (only available to the spender). */
  stealthPrivKey?: Uint8Array;
  /** 33-byte compressed ephemeral public key R (published on-chain). */
  ephemeralPubKey: Uint8Array;
}

export interface StealthPaymentCheck {
  /** Whether this payment is addressed to us. */
  match: boolean;
  /** Stacks address (set only if match is true). */
  stealthAddress?: string;
  /** 33-byte stealth public key (set only if match is true). */
  stealthPubKey?: Uint8Array;
  /** 32-byte stealth spending private key (set only if match is true). */
  stealthPrivKey?: Uint8Array;
}

// ---------------------------------------------------------------------------
// Main functions
// ---------------------------------------------------------------------------

/**
 * Derive a one-time stealth address for a recipient.
 *
 * This is called by the SENDER. The sender knows the recipient's
 * meta-address (spend + view public keys) and generates a fresh
 * ephemeral keypair for each payment.
 *
 * @param meta - Recipient's stealth meta-address
 * @param ephemeralPrivKey - Optional ephemeral private key (random if not provided)
 * @param network - Stacks network for address derivation ('mainnet' | 'testnet' | 'devnet')
 * @returns Stealth address result (no stealthPrivKey - sender can't compute it)
 */
export function deriveStealthAddress(
  meta: StealthMetaAddress,
  ephemeralPrivKey?: Uint8Array,
  network: 'mainnet' | 'testnet' | 'devnet' = 'testnet',
): StealthAddressResult {
  // 1. Generate or use provided ephemeral keypair
  const r = ephemeralPrivKey ?? secp.utils.randomPrivateKey();
  const R = secp.getPublicKey(r, true); // R = r * G

  // 2. Compute shared secret: S = r * viewPubKey (ECDH)
  const sharedSecretPoint = secp.getSharedSecret(r, meta.viewPubKey, true);

  // 3. Hash the shared secret to get a scalar
  const hashS = sha256(sharedSecretPoint);

  // 4. Reduce hash to a valid scalar and compute hash(S) * G
  const hashScalar = bytesToScalar(hashS);
  const hashPoint = secp.ProjectivePoint.BASE.multiply(hashScalar);

  // 5. Derive stealth public key: P_stealth = spendPubKey + hash(S) * G
  const spendPoint = secp.ProjectivePoint.fromHex(meta.spendPubKey);
  const stealthPoint = spendPoint.add(hashPoint);
  const stealthPubKey = stealthPoint.toRawBytes(true); // 33 bytes compressed

  // 6. Derive Stacks address from the stealth public key
  const stealthAddress = publicKeyToStacksAddress(stealthPubKey, network);

  return {
    stealthAddress,
    stealthPubKey,
    ephemeralPubKey: R,
    // Sender does NOT know stealthPrivKey (would need spendPrivKey)
  };
}

/**
 * Derive a stealth address for self-deposit.
 *
 * When depositing to your own pool, you know both your spend and view
 * private keys, so you can compute the stealth spending private key.
 * This is essential for later withdrawal.
 *
 * @param spendPrivKey - 32-byte spend private key
 * @param viewPrivKey - 32-byte view private key
 * @param network - Stacks network for address derivation
 * @returns Stealth address result including the stealth private key
 */
export function deriveSelfStealth(
  spendPrivKey: Uint8Array,
  viewPrivKey: Uint8Array,
  network: 'mainnet' | 'testnet' | 'devnet' = 'testnet',
): StealthAddressResult {
  // Generate ephemeral keypair
  const r = secp.utils.randomPrivateKey();
  const R = secp.getPublicKey(r, true);

  // Compute shared secret from sender side: S = r * viewPubKey
  const viewPubKey = secp.getPublicKey(viewPrivKey, true);
  const sharedSecretPoint = secp.getSharedSecret(r, viewPubKey, true);

  // Hash the shared secret
  const hashS = sha256(sharedSecretPoint);
  const hashScalar = bytesToScalar(hashS);

  // Derive stealth public key: P_stealth = spendPubKey + hash(S) * G
  const spendPubKey = secp.getPublicKey(spendPrivKey, true);
  const spendPoint = secp.ProjectivePoint.fromHex(spendPubKey);
  const hashPoint = secp.ProjectivePoint.BASE.multiply(hashScalar);
  const stealthPoint = spendPoint.add(hashPoint);
  const stealthPubKey = stealthPoint.toRawBytes(true);

  // Compute stealth private key: stealthPrivKey = spendPrivKey + hash(S) mod n
  const spendScalar = secp.etc.bytesToNumberBE(spendPrivKey);
  const stealthScalar = secp.etc.mod(
    spendScalar + hashScalar,
    secp.CURVE.n,
  );
  const stealthPrivKey = scalarToBytes(stealthScalar);

  const stealthAddress = publicKeyToStacksAddress(stealthPubKey, network);

  return {
    stealthAddress,
    stealthPubKey,
    stealthPrivKey,
    ephemeralPubKey: R,
  };
}

/**
 * Check if a stealth payment (identified by its ephemeral public key R)
 * is addressed to us, by comparing against a known target address.
 *
 * This is called by the RECIPIENT (or their scanning service). Given
 * the ephemeral key R published on-chain, the recipient uses their
 * view private key to reconstruct the shared secret and check if the
 * derived stealth address matches the on-chain target.
 *
 * @param ephemeralPubKey - 33-byte compressed ephemeral public key R (from on-chain event)
 * @param viewPrivKey - 32-byte view private key
 * @param spendPubKey - 33-byte compressed spend public key
 * @param targetAddress - The Stacks address to compare the derived address against
 * @param spendPrivKey - 32-byte spend private key (optional; needed to recover spending key)
 * @param network - Stacks network for address derivation
 * @returns Match result with stealth address and spending key if matched
 */
export function checkStealthPayment(
  ephemeralPubKey: Uint8Array,
  viewPrivKey: Uint8Array,
  spendPubKey: Uint8Array,
  targetAddress: string,
  spendPrivKey?: Uint8Array,
  network: 'mainnet' | 'testnet' | 'devnet' = 'testnet',
): StealthPaymentCheck {
  // 1. Compute shared secret: S = viewPrivKey * R (ECDH)
  const sharedSecretPoint = secp.getSharedSecret(viewPrivKey, ephemeralPubKey, true);

  // 2. Hash the shared secret
  const hashS = sha256(sharedSecretPoint);
  const hashScalar = bytesToScalar(hashS);

  // 3. Derive expected stealth public key: P = spendPubKey + hash(S) * G
  const spendPoint = secp.ProjectivePoint.fromHex(spendPubKey);
  const hashPoint = secp.ProjectivePoint.BASE.multiply(hashScalar);
  const stealthPoint = spendPoint.add(hashPoint);
  const stealthPubKey = stealthPoint.toRawBytes(true);

  // 4. Derive Stacks address
  const stealthAddress = publicKeyToStacksAddress(stealthPubKey, network);

  // 5. Compare derived address to the target address
  if (stealthAddress !== targetAddress) {
    return { match: false };
  }

  // 6. If we have the spend private key, compute the stealth spending key
  let stealthPrivKey: Uint8Array | undefined;
  if (spendPrivKey) {
    const spendScalar = secp.etc.bytesToNumberBE(spendPrivKey);
    const stealthScalar = secp.etc.mod(
      spendScalar + hashScalar,
      secp.CURVE.n,
    );
    stealthPrivKey = scalarToBytes(stealthScalar);
  }

  return {
    match: true,
    stealthAddress,
    stealthPubKey,
    stealthPrivKey,
  };
}

/**
 * Verify that a stealth address on-chain matches what we'd derive
 * from the given ephemeral key.
 *
 * Unlike checkStealthPayment (which always returns match: true with a
 * derived address), this function compares the derived address against
 * a known target address and returns match: false if they differ.
 *
 * @param ephemeralPubKey - 33-byte compressed ephemeral public key R
 * @param viewPrivKey - 32-byte view private key
 * @param spendPubKey - 33-byte compressed spend public key
 * @param targetAddress - The Stacks address to compare against
 * @param spendPrivKey - Optional spend private key for spending key recovery
 * @param network - Stacks network
 * @returns Match result
 */
export function verifyStealthPayment(
  ephemeralPubKey: Uint8Array,
  viewPrivKey: Uint8Array,
  spendPubKey: Uint8Array,
  targetAddress: string,
  spendPrivKey?: Uint8Array,
  network: 'mainnet' | 'testnet' | 'devnet' = 'testnet',
): StealthPaymentCheck {
  // Delegate to checkStealthPayment which now performs the address comparison
  return checkStealthPayment(
    ephemeralPubKey,
    viewPrivKey,
    spendPubKey,
    targetAddress,
    spendPrivKey,
    network,
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Reduce a 32-byte hash to a valid secp256k1 scalar in [1, n-1].
 *
 * Takes the big-endian interpretation of the bytes modulo the curve
 * order n. The probability of getting 0 is ~2^-128, negligible.
 * We handle it defensively by returning 1 in that case.
 */
function bytesToScalar(bytes: Uint8Array): bigint {
  const num = secp.etc.bytesToNumberBE(bytes);
  const scalar = secp.etc.mod(num, secp.CURVE.n);
  // Extremely unlikely: if hash reduces to 0, use 1 instead
  return scalar === 0n ? 1n : scalar;
}

/**
 * Convert a scalar (bigint) to a 32-byte big-endian Uint8Array.
 */
function scalarToBytes(scalar: bigint): Uint8Array {
  const hex = scalar.toString(16).padStart(64, '0');
  return secp.etc.hexToBytes(hex);
}

/**
 * Derive a Stacks address from a compressed public key.
 *
 * Uses hash160 (SHA-256 then RIPEMD-160) of the compressed public key,
 * then c32check encoding with the appropriate version byte.
 *
 * We use @stacks/transactions publicKeyToAddress when available,
 * falling back to manual derivation.
 */
function publicKeyToStacksAddress(
  compressedPubKey: Uint8Array,
  network: 'mainnet' | 'testnet' | 'devnet',
): string {
  // Import dynamically would add complexity. Instead, we use the
  // @stacks/transactions helper with the hex-encoded public key.
  // The publicKeyToAddress function accepts string|Uint8Array.
  const pubKeyHex = bytesToHex(compressedPubKey);

  // Map our network names to @stacks/transactions network names
  const stacksNetwork = network === 'devnet' ? 'testnet' : network;

  // Use dynamic import pattern - but since we're in sync context,
  // we do manual hash160 + c32check encoding.
  return hash160ToStacksAddress(
    hash160(compressedPubKey),
    stacksNetwork,
  );
}

/**
 * Compute hash160 = RIPEMD-160(SHA-256(data)).
 * This is the standard Bitcoin/Stacks public key hash.
 */
function hash160(data: Uint8Array): Uint8Array {
  const shaHash = sha256(data);
  // We need RIPEMD-160. Import from @noble/hashes/legacy.
  // Since we can't do top-level await or conditional imports easily,
  // we implement RIPEMD-160 inline or use the available module.
  return ripemd160(shaHash);
}

/**
 * RIPEMD-160 implementation using @noble/hashes.
 */
function ripemd160(data: Uint8Array): Uint8Array {
  // We import at the module level to avoid circular dependencies.
  // @noble/hashes/legacy exports ripemd160 as a function.
  // Since we need to keep this synchronous, we use a pre-imported reference.
  return _ripemd160(data);
}

// Pre-import ripemd160 - this will be initialized at module load time
import { ripemd160 as _ripemd160 } from '@noble/hashes/legacy';

/**
 * Encode a 20-byte hash160 as a Stacks c32check address.
 *
 * Stacks addresses use c32check encoding (a variant of base32 with a
 * checksum). The version byte determines the address prefix:
 *   - 22 (0x16) = mainnet single-sig (SP...)
 *   - 26 (0x1A) = testnet single-sig (ST...)
 */
function hash160ToStacksAddress(
  hash: Uint8Array,
  network: 'mainnet' | 'testnet',
): string {
  // Version bytes for single-sig P2PKH addresses
  const version = network === 'mainnet' ? 22 : 26;
  return c32checkEncode(version, hash);
}

// ---------------------------------------------------------------------------
// c32check encoding (minimal implementation)
// ---------------------------------------------------------------------------

const C32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Encode data with c32check (version byte + payload + 4-byte checksum).
 *
 * The checksum is SHA-256(SHA-256(version || data)), taking the first 4 bytes.
 * The result is c32-encoded with the version character prepended.
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

  // Prepend the version character (c32 digit)
  const versionChar = C32_ALPHABET[version]!;

  // Stacks addresses have the 'S' prefix
  return `S${versionChar}${c32Str}`;
}

/**
 * Base-c32 encoding of a byte array.
 *
 * Converts the byte array to a big-endian integer and repeatedly
 * divides by 32 to extract c32 digits. Leading zero bytes are
 * preserved as leading '0' characters.
 */
function c32Encode(data: Uint8Array): string {
  // Convert to a big number
  let num = 0n;
  for (const byte of data) {
    num = (num << 8n) | BigInt(byte);
  }

  if (num === 0n) {
    // Special case: all zeros
    const leadingZeros = data.length;
    return C32_ALPHABET[0]!.repeat(leadingZeros);
  }

  // Extract c32 digits (LSB first)
  const digits: string[] = [];
  while (num > 0n) {
    digits.push(C32_ALPHABET[Number(num % 32n)]!);
    num = num / 32n;
  }

  // Reverse to get MSB first
  digits.reverse();

  // Add leading zeros for leading zero bytes in input
  let leadingZeros = 0;
  for (const byte of data) {
    if (byte === 0) leadingZeros++;
    else break;
  }

  const prefix = C32_ALPHABET[0]!.repeat(leadingZeros);
  return prefix + digits.join('');
}
