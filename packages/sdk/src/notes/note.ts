/**
 * Note data structures and serialization for the Satsu privacy pool.
 *
 * A "note" is the client-side record of a deposit. It contains all the
 * secret material needed to later withdraw funds from the pool:
 *   - The commitment pre-image (secret + nullifier + amount)
 *   - The leaf index in the Merkle tree (for proof generation)
 *   - The stealth spending private key (for address control)
 *
 * Notes MUST be persisted securely. If a user loses their notes, they
 * lose access to their deposited funds permanently — there is no
 * recovery mechanism because the secret values are never stored on-chain.
 *
 * Serialization format (binary, big-endian):
 *   Bytes  0..31:  secret (32 bytes)
 *   Bytes 32..63:  nullifier (32 bytes)
 *   Bytes 64..79:  amount as uint128 BE (16 bytes)
 *   Bytes 80..111: commitment hash (32 bytes)
 *   Bytes 112..115: leafIndex as uint32 BE (4 bytes)
 *   Bytes 116..147: stealthPrivKey (32 bytes)
 *   Total: 148 bytes
 */

import { concatBytes, bigintToUint128BE, uint128BEToBigint } from '../utils/crypto.js';
import type { Commitment } from '../pool/commitment.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DecryptedNote {
  /** 32-byte secret (commitment pre-image component). */
  secret: Uint8Array;
  /** 32-byte nullifier (commitment pre-image component). */
  nullifier: Uint8Array;
  /** Deposit amount in micro-sBTC. */
  amount: bigint;
  /** 32-byte commitment hash (the leaf stored in the Merkle tree). */
  commitment: Uint8Array;
  /** Index of this commitment's leaf in the Merkle tree. */
  leafIndex: number;
  /** 32-byte stealth spending private key. */
  stealthPrivKey: Uint8Array;
}

/** Total serialized note size in bytes. */
export const SERIALIZED_NOTE_LENGTH = 148;

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Create a DecryptedNote from a commitment, leaf index, and stealth key.
 *
 * This is typically called right after a successful deposit transaction,
 * combining the commitment data with the on-chain leaf index.
 *
 * @param commitment - The commitment created for the deposit
 * @param leafIndex - The Merkle tree leaf index (from the on-chain event)
 * @param stealthPrivKey - 32-byte stealth spending private key
 * @returns A complete DecryptedNote ready for storage
 */
export function createNote(
  commitment: Commitment,
  leafIndex: number,
  stealthPrivKey: Uint8Array,
): DecryptedNote {
  if (stealthPrivKey.length !== 32) {
    throw new Error(
      `Stealth private key must be 32 bytes, got ${stealthPrivKey.length}`,
    );
  }
  if (leafIndex < 0 || !Number.isInteger(leafIndex)) {
    throw new Error(`Leaf index must be a non-negative integer, got ${leafIndex}`);
  }

  return {
    secret: Uint8Array.from(commitment.secret),
    nullifier: Uint8Array.from(commitment.nullifier),
    amount: commitment.amount,
    commitment: Uint8Array.from(commitment.commitment),
    leafIndex,
    stealthPrivKey: Uint8Array.from(stealthPrivKey),
  };
}

/**
 * Serialize a DecryptedNote into a compact binary format.
 *
 * The output is a 148-byte Uint8Array suitable for encryption
 * and storage. The format is deterministic: the same note always
 * produces the same serialization.
 *
 * @param note - The note to serialize
 * @returns 148-byte serialized note
 */
export function serializeNote(note: DecryptedNote): Uint8Array {
  const amountBytes = bigintToUint128BE(note.amount);

  // Leaf index as 4-byte big-endian uint32
  const leafIndexBytes = new Uint8Array(4);
  const view = new DataView(leafIndexBytes.buffer);
  view.setUint32(0, note.leafIndex, false); // false = big-endian

  return concatBytes(
    note.secret,          // 32 bytes
    note.nullifier,       // 32 bytes
    amountBytes,          // 16 bytes
    note.commitment,      // 32 bytes
    leafIndexBytes,       // 4 bytes
    note.stealthPrivKey,  // 32 bytes
  );                      // Total: 148 bytes
}

/**
 * Deserialize a 148-byte binary blob back into a DecryptedNote.
 *
 * @param data - 148-byte serialized note
 * @returns Deserialized DecryptedNote
 * @throws {Error} If the data length is not exactly 148 bytes
 */
export function deserializeNote(data: Uint8Array): DecryptedNote {
  if (data.length !== SERIALIZED_NOTE_LENGTH) {
    throw new Error(
      `Serialized note must be ${SERIALIZED_NOTE_LENGTH} bytes, got ${data.length}`,
    );
  }

  let offset = 0;

  const secret = data.slice(offset, offset + 32);
  offset += 32;

  const nullifier = data.slice(offset, offset + 32);
  offset += 32;

  const amountBytes = data.slice(offset, offset + 16);
  const amount = uint128BEToBigint(amountBytes);
  offset += 16;

  const commitment = data.slice(offset, offset + 32);
  offset += 32;

  const leafIndexBytes = data.slice(offset, offset + 4);
  const leafIndexView = new DataView(
    leafIndexBytes.buffer,
    leafIndexBytes.byteOffset,
    leafIndexBytes.byteLength,
  );
  const leafIndex = leafIndexView.getUint32(0, false); // big-endian
  offset += 4;

  const stealthPrivKey = data.slice(offset, offset + 32);
  offset += 32;

  return {
    secret,
    nullifier,
    amount,
    commitment,
    leafIndex,
    stealthPrivKey,
  };
}
