/**
 * AES-256-GCM note encryption for the Satsu privacy system.
 *
 * Notes contain all the secret material needed to withdraw funds.
 * They are encrypted at rest using AES-256-GCM, which provides both
 * confidentiality and authenticity (the "tag" prevents tampering).
 *
 * Key derivation uses PBKDF2-HMAC-SHA256 with a high iteration count
 * to resist brute-force attacks on user passwords. The salt is
 * randomly generated and stored alongside the ciphertext.
 *
 * This module uses the Web Crypto API (crypto.subtle) for AES-GCM
 * operations, which is available in all modern browsers and Node.js 15+.
 * For PBKDF2 key derivation we use @noble/hashes/pbkdf2 to avoid
 * Web Crypto's async-only API for this step when synchronous derivation
 * is acceptable.
 */

import { randomBytes } from '../utils/crypto.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { utf8ToBytes } from '@noble/hashes/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EncryptedData {
  /** AES-256-GCM ciphertext. */
  ciphertext: Uint8Array;
  /** 12-byte initialization vector (nonce). */
  iv: Uint8Array;
  /** 16-byte authentication tag. */
  tag: Uint8Array;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** AES-GCM initialization vector length in bytes. */
const IV_LENGTH = 12;

/** AES-GCM authentication tag length in bits. */
const TAG_LENGTH_BITS = 128;

/** AES-GCM authentication tag length in bytes. */
const TAG_LENGTH_BYTES = 16;

/** PBKDF2 iteration count. 600,000 is the current OWASP recommendation. */
const PBKDF2_ITERATIONS = 600_000;

/** PBKDF2 salt length in bytes. */
const PBKDF2_SALT_LENGTH = 32;

/** AES-256 key length in bytes. */
const AES_KEY_LENGTH = 32;

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Encrypt a serialized note using AES-256-GCM.
 *
 * Generates a random 12-byte IV for each encryption. The Web Crypto API
 * appends the authentication tag to the ciphertext; we split it out
 * into a separate field for explicit handling.
 *
 * @param plaintext - The serialized note to encrypt
 * @param key - 32-byte AES-256 encryption key
 * @returns Encrypted data with ciphertext, IV, and authentication tag
 */
export async function encryptNote(
  plaintext: Uint8Array,
  key: Uint8Array,
): Promise<EncryptedData> {
  if (key.length !== AES_KEY_LENGTH) {
    throw new Error(`Encryption key must be ${AES_KEY_LENGTH} bytes, got ${key.length}`);
  }

  const iv = randomBytes(IV_LENGTH);

  // Import the raw key into Web Crypto
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );

  // Encrypt with AES-256-GCM
  // Web Crypto returns ciphertext || tag concatenated
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: TAG_LENGTH_BITS,
    },
    cryptoKey,
    plaintext,
  );

  const encryptedBytes = new Uint8Array(encrypted);

  // Split out the tag (last 16 bytes) from the ciphertext
  const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - TAG_LENGTH_BYTES);
  const tag = encryptedBytes.slice(encryptedBytes.length - TAG_LENGTH_BYTES);

  return { ciphertext, iv, tag };
}

/**
 * Decrypt a note encrypted with AES-256-GCM.
 *
 * The authentication tag is verified automatically by the Web Crypto API;
 * if the ciphertext or tag has been tampered with, decryption will fail
 * with an error.
 *
 * @param ciphertext - The encrypted ciphertext
 * @param iv - 12-byte initialization vector used during encryption
 * @param tag - 16-byte authentication tag
 * @param key - 32-byte AES-256 encryption key
 * @returns Decrypted plaintext (the serialized note)
 * @throws {Error} If decryption fails (wrong key or tampered data)
 */
export async function decryptNote(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  tag: Uint8Array,
  key: Uint8Array,
): Promise<Uint8Array> {
  if (key.length !== AES_KEY_LENGTH) {
    throw new Error(`Encryption key must be ${AES_KEY_LENGTH} bytes, got ${key.length}`);
  }
  if (iv.length !== IV_LENGTH) {
    throw new Error(`IV must be ${IV_LENGTH} bytes, got ${iv.length}`);
  }
  if (tag.length !== TAG_LENGTH_BYTES) {
    throw new Error(`Tag must be ${TAG_LENGTH_BYTES} bytes, got ${tag.length}`);
  }

  // Import the raw key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );

  // Web Crypto expects ciphertext || tag concatenated
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);

  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: TAG_LENGTH_BITS,
      },
      cryptoKey,
      combined,
    );

    return new Uint8Array(decrypted);
  } catch {
    throw new Error(
      'Decryption failed: wrong key or tampered ciphertext. ' +
        'If this persists, the note data may be corrupted.',
    );
  }
}

/**
 * Derive an AES-256 encryption key from a user password.
 *
 * Uses PBKDF2-HMAC-SHA256 with 600,000 iterations (OWASP recommendation)
 * and a random 32-byte salt. The salt must be stored alongside the
 * encrypted data for later key re-derivation.
 *
 * @param password - User password (UTF-8 string)
 * @param salt - 32-byte salt (generate with randomBytes(32) for new keys)
 * @returns 32-byte AES-256 encryption key
 */
export function deriveEncryptionKey(
  password: string,
  salt: Uint8Array,
): Uint8Array {
  if (salt.length !== PBKDF2_SALT_LENGTH) {
    throw new Error(
      `Salt must be ${PBKDF2_SALT_LENGTH} bytes, got ${salt.length}`,
    );
  }

  return pbkdf2(sha256, utf8ToBytes(password), salt, {
    c: PBKDF2_ITERATIONS,
    dkLen: AES_KEY_LENGTH,
  });
}

/**
 * Generate a random salt for PBKDF2 key derivation.
 *
 * @returns 32-byte cryptographically random salt
 */
export function generateSalt(): Uint8Array {
  return randomBytes(PBKDF2_SALT_LENGTH);
}
