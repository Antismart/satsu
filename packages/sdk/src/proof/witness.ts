/**
 * Witness generation for the Satsu membership proof.
 *
 * The witness generator takes the prover's private inputs and the
 * public inputs, recomputes every intermediate value, and verifies
 * that all circuit constraints are satisfied.  If any constraint fails,
 * it throws with a descriptive error so the prover can diagnose the
 * issue before attempting (expensive) proof generation.
 *
 * The witness contains:
 *   - The recomputed commitment hash
 *   - The recomputed nullifier hash
 *   - All intermediate Merkle path hashes from leaf to root
 *   - The computed root (must equal the public root input)
 *   - References to both the public and private inputs
 */

import { sha256 } from '@noble/hashes/sha256';
import { concatBytes } from '../utils/crypto.js';
import { bigintToUint128BE } from '../utils/crypto.js';
import { constantTimeEqual } from '../utils/crypto.js';
import { TREE_DEPTH } from '../utils/constants.js';
import {
  validatePublicInputs,
  validatePrivateInputs,
} from './circuit.js';
import type { PublicInputs, PrivateInputs } from './circuit.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Complete witness for a membership proof.
 *
 * Contains all intermediate values needed by the prover, plus a copy
 * of the public and private inputs for reference.
 */
export interface Witness {
  /** Recomputed commitment: sha256(secret || nullifier || amount_be128). */
  commitment: Uint8Array;

  /** Recomputed nullifier hash: sha256(nullifier). */
  nullifierHash: Uint8Array;

  /**
   * Intermediate hashes along the Merkle path from the leaf to the root.
   * merklePathHashes[0] is the result of the first hash step (leaf + sibling),
   * and merklePathHashes[pathLength - 1] is the computed root.
   *
   * Length = depth - 1 (19 for TREE_DEPTH=20).
   */
  merklePathHashes: Uint8Array[];

  /** The root computed by walking the Merkle proof. */
  computedRoot: Uint8Array;

  /** Public inputs (referenced, not copied). */
  publicInputs: PublicInputs;

  /** Private inputs (referenced, not copied). */
  privateInputs: PrivateInputs;
}

// ---------------------------------------------------------------------------
// Witness generation
// ---------------------------------------------------------------------------

/**
 * Generate a complete witness from the given inputs.
 *
 * This function:
 *   1. Validates all input shapes and sizes.
 *   2. Recomputes the commitment hash from secret, nullifier, and amount.
 *   3. Recomputes the nullifier hash from the nullifier.
 *   4. Walks the Merkle proof path, computing each intermediate hash.
 *   5. Checks that the computed root matches the public root input.
 *   6. Checks that the computed nullifier hash matches the public input.
 *
 * If any constraint fails, the function throws with a descriptive error
 * message identifying which constraint was violated.
 *
 * @param privateInputs - Secret values known only to the prover
 * @param publicInputs  - Values that will be revealed on-chain
 * @returns A complete witness ready for proof generation
 * @throws {Error} If any circuit constraint is violated
 */
export function generateWitness(
  privateInputs: PrivateInputs,
  publicInputs: PublicInputs,
): Witness {
  // -----------------------------------------------------------------------
  // Step 1: Validate input shapes
  // -----------------------------------------------------------------------
  validatePrivateInputs(privateInputs);
  validatePublicInputs(publicInputs);

  // -----------------------------------------------------------------------
  // Step 2: Recompute commitment = sha256(secret || nullifier || amount_be128)
  // -----------------------------------------------------------------------
  const amountBytes = bigintToUint128BE(privateInputs.amount);
  const preimage = concatBytes(
    privateInputs.secret,
    privateInputs.nullifier,
    amountBytes,
  );
  const commitment = sha256(preimage);

  // -----------------------------------------------------------------------
  // Step 3: Recompute nullifierHash = sha256(nullifier)
  // -----------------------------------------------------------------------
  const nullifierHash = sha256(privateInputs.nullifier);

  // -----------------------------------------------------------------------
  // Constraint B: nullifierHash must match public input
  // -----------------------------------------------------------------------
  if (!constantTimeEqual(nullifierHash, publicInputs.nullifierHash)) {
    throw new Error(
      'Constraint violation: computed nullifierHash does not match public input. ' +
        'Either the nullifier is wrong or the public nullifierHash is incorrect.',
    );
  }

  // -----------------------------------------------------------------------
  // Step 4: Walk the Merkle proof from leaf to root
  //
  // The Merkle tree has depth=20 and the proof has (depth - 1) = 19
  // elements. Each step combines the current hash with a sibling
  // according to the path index (direction bit).
  // -----------------------------------------------------------------------
  const pathLength = TREE_DEPTH - 1;
  const merklePathHashes: Uint8Array[] = [];
  let currentHash: Uint8Array = Uint8Array.from(commitment);

  for (let i = 0; i < pathLength; i++) {
    const sibling = privateInputs.merklePathElements[i]!;
    const isRight = privateInputs.merklePathIndices[i]!;

    if (isRight === 1) {
      // Current node is on the right; sibling is on the left
      currentHash = sha256(concatBytes(sibling, currentHash));
    } else {
      // Current node is on the left; sibling is on the right
      currentHash = sha256(concatBytes(currentHash, sibling));
    }

    merklePathHashes.push(Uint8Array.from(currentHash));
  }

  const computedRoot = currentHash;

  // -----------------------------------------------------------------------
  // Constraint C: computed root must match the public root input
  // -----------------------------------------------------------------------
  if (!constantTimeEqual(computedRoot, publicInputs.root)) {
    throw new Error(
      'Constraint violation: computed Merkle root does not match public root input. ' +
        'The commitment may not be in the tree, or the Merkle path is incorrect.',
    );
  }

  // -----------------------------------------------------------------------
  // All constraints satisfied -- return the complete witness
  // -----------------------------------------------------------------------
  return {
    commitment,
    nullifierHash,
    merklePathHashes,
    computedRoot,
    publicInputs,
    privateInputs,
  };
}
