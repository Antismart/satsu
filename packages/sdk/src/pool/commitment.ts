/**
 * Commitment computation for the Satsu privacy pool.
 *
 * A commitment is the cryptographic "receipt" of a deposit. It binds a
 * secret, a nullifier, and an amount together via SHA-256:
 *
 *   commitment = sha256(secret || nullifier || amount_be128)
 *   nullifierHash = sha256(nullifier)
 *
 * The commitment is stored as a leaf in the on-chain Merkle tree.
 * To withdraw, the user reveals the nullifierHash (preventing double-spend)
 * and proves knowledge of the pre-image via a ZK-STARK proof, without
 * revealing the secret or which leaf is theirs.
 *
 * CRITICAL: The amount is encoded as a 16-byte big-endian uint128 to
 * match Clarity's native uint representation. The Clarity contract
 * computes:
 *   (sha256 (concat (concat secret nullifier) amount-as-uint))
 * where Clarity serializes the uint as 16 big-endian bytes.
 */

import { sha256 } from '@noble/hashes/sha256';
import { concatBytes, randomBytes, bigintToUint128BE } from '../utils/crypto.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Commitment {
  /** 32-byte random secret (pre-image component). */
  secret: Uint8Array;
  /** 32-byte random nullifier (used for double-spend prevention). */
  nullifier: Uint8Array;
  /** Deposit amount in micro-sBTC. */
  amount: bigint;
  /** 32-byte commitment hash: sha256(secret || nullifier || amount). */
  commitment: Uint8Array;
  /** 32-byte nullifier hash: sha256(nullifier). Revealed at withdrawal. */
  nullifierHash: Uint8Array;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Create a fresh commitment for a pool deposit.
 *
 * Generates cryptographically random secret and nullifier values,
 * then computes the commitment hash and nullifier hash.
 *
 * @param amount - Deposit amount in micro-sBTC (must equal POOL_DENOMINATION)
 * @returns Complete commitment structure with all components
 *
 * @example
 * import { POOL_DENOMINATION } from '../utils/constants.js';
 * const commitment = createCommitment(POOL_DENOMINATION);
 * // commitment.commitment -> 32-byte hash to submit on-chain
 * // commitment.nullifierHash -> revealed at withdrawal
 * // commitment.secret, commitment.nullifier -> KEEP SECRET
 */
export function createCommitment(amount: bigint): Commitment {
  const secret = randomBytes(32);
  const nullifier = randomBytes(32);

  const commitment = computeCommitmentHash(secret, nullifier, amount);
  const nullifierHash = computeNullifierHash(nullifier);

  return {
    secret,
    nullifier,
    amount,
    commitment,
    nullifierHash,
  };
}

/**
 * Compute the commitment hash from its pre-image components.
 *
 * commitment = sha256(secret || nullifier || amount_be128)
 *
 * The amount is encoded as a 16-byte big-endian uint128 to match
 * how Clarity's `sha256` function processes uint values when they
 * are concatenated with buffers.
 *
 * @param secret - 32-byte secret
 * @param nullifier - 32-byte nullifier
 * @param amount - Amount as bigint
 * @returns 32-byte SHA-256 commitment hash
 */
export function computeCommitmentHash(
  secret: Uint8Array,
  nullifier: Uint8Array,
  amount: bigint,
): Uint8Array {
  if (secret.length !== 32) {
    throw new Error(`Secret must be 32 bytes, got ${secret.length}`);
  }
  if (nullifier.length !== 32) {
    throw new Error(`Nullifier must be 32 bytes, got ${nullifier.length}`);
  }

  const amountBytes = bigintToUint128BE(amount);
  const preimage = concatBytes(secret, nullifier, amountBytes);
  return sha256(preimage);
}

/**
 * Compute the nullifier hash.
 *
 * nullifierHash = sha256(nullifier)
 *
 * This value is revealed during withdrawal. It is recorded on-chain
 * to prevent double-spending: once a nullifier hash is consumed,
 * no other withdrawal can use it.
 *
 * @param nullifier - 32-byte nullifier
 * @returns 32-byte SHA-256 nullifier hash
 */
export function computeNullifierHash(nullifier: Uint8Array): Uint8Array {
  if (nullifier.length !== 32) {
    throw new Error(`Nullifier must be 32 bytes, got ${nullifier.length}`);
  }
  return sha256(nullifier);
}
