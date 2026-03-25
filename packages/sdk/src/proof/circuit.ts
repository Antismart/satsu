/**
 * Circuit definition for the Satsu membership proof.
 *
 * Describes the algebraic constraints that the ZK proof must satisfy.
 * The circuit proves the following statement:
 *
 *   "I know a secret and nullifier such that
 *    sha256(secret || nullifier || amount) is a leaf in the Merkle tree
 *    with the given root, and sha256(nullifier) equals the revealed
 *    nullifierHash."
 *
 * This module defines the public/private input interfaces and their
 * validation logic.  The constraints themselves are enforced by the
 * witness generator (witness.ts) and bound into the proof via a
 * Fiat-Shamir challenge (prover.ts).
 *
 * Private inputs (known only to the prover):
 *   1. secret          (32 bytes)
 *   2. nullifier       (32 bytes)
 *   3. amount          (uint128, encoded as 16-byte BE)
 *   4. leafIndex       (uint, position of the commitment in the tree)
 *   5. merklePathElements (array of sibling hashes, length = depth - 1)
 *   6. merklePathIndices  (array of 0/1 direction bits, length = depth - 1)
 *
 * Public inputs (verified on-chain):
 *   1. nullifierHash   = sha256(nullifier)
 *   2. root            (32-byte Merkle root)
 *   3. recipient       (Stacks address, bound to prevent front-running)
 *   4. relayerFee      (uint, bound to prevent fee manipulation)
 *
 * Circuit constraints:
 *   A. commitment = sha256(secret || nullifier || amount_be128)
 *   B. nullifierHash = sha256(nullifier) matches public input
 *   C. merkle_verify(commitment, path, indices) == root
 *   D. recipient and relayerFee are bound into the Fiat-Shamir challenge
 */

import { TREE_DEPTH, HASH_LENGTH, MAX_LEAVES } from '../utils/constants.js';

// ---------------------------------------------------------------------------
// Public inputs
// ---------------------------------------------------------------------------

/**
 * Values that are revealed on-chain and verified by the contract.
 * These are committed to inside the proof via the Fiat-Shamir challenge.
 */
export interface PublicInputs {
  /** sha256(nullifier) - used for double-spend prevention. */
  nullifierHash: Uint8Array;
  /** Current Merkle root that the commitment must belong to. */
  root: Uint8Array;
  /** Stacks address receiving the withdrawal (prevents front-running). */
  recipient: string;
  /** Fee paid to the relayer (prevents fee manipulation). */
  relayerFee: bigint;
}

// ---------------------------------------------------------------------------
// Private inputs
// ---------------------------------------------------------------------------

/**
 * Values known only to the prover.  Never revealed on-chain.
 */
export interface PrivateInputs {
  /** 32-byte random secret (pre-image component). */
  secret: Uint8Array;
  /** 32-byte random nullifier (pre-image component). */
  nullifier: Uint8Array;
  /** Deposit amount in micro-sBTC. */
  amount: bigint;
  /** Index of the commitment leaf in the Merkle tree. */
  leafIndex: number;
  /** Sibling hashes along the path from leaf to root (length = depth - 1). */
  merklePathElements: Uint8Array[];
  /** Direction bits for each proof step (0 = left, 1 = right). */
  merklePathIndices: number[];
}

// ---------------------------------------------------------------------------
// Circuit constraint description (for documentation / future compiler)
// ---------------------------------------------------------------------------

/**
 * Formal description of each constraint the circuit enforces.
 * This is a documentation type -- the actual enforcement happens in
 * the witness generator and prover.
 */
export interface CircuitConstraint {
  /** Human-readable identifier for the constraint. */
  name: string;
  /** Description of what the constraint checks. */
  description: string;
}

/** The set of constraints that make up the Satsu membership circuit. */
export const CIRCUIT_CONSTRAINTS: readonly CircuitConstraint[] = [
  {
    name: 'commitment_preimage',
    description:
      'commitment = sha256(secret || nullifier || amount_be128): the commitment is correctly formed from its pre-image components.',
  },
  {
    name: 'nullifier_hash',
    description:
      'nullifierHash = sha256(nullifier): the revealed nullifier hash matches the private nullifier.',
  },
  {
    name: 'merkle_membership',
    description:
      'merkle_verify(commitment, pathElements, pathIndices) == root: the commitment is a leaf in the Merkle tree with the stated root.',
  },
  {
    name: 'public_input_binding',
    description:
      'recipient and relayerFee are bound to the proof via the Fiat-Shamir challenge hash, preventing front-running and fee manipulation.',
  },
] as const;

/** Circuit metadata. */
export const CIRCUIT_INFO = {
  name: 'satsu-membership-v1',
  version: '1.0.0',
  hashFunction: 'sha256',
  treeDepth: TREE_DEPTH,
  proofPathLength: TREE_DEPTH - 1,
} as const;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate that the public inputs have the correct shape and sizes.
 *
 * @returns true if all fields are valid
 * @throws {Error} describing the first invalid field encountered
 */
export function validatePublicInputs(inputs: PublicInputs): boolean {
  if (!(inputs.nullifierHash instanceof Uint8Array)) {
    throw new Error('nullifierHash must be a Uint8Array');
  }
  if (inputs.nullifierHash.length !== HASH_LENGTH) {
    throw new Error(
      `nullifierHash must be ${HASH_LENGTH} bytes, got ${inputs.nullifierHash.length}`,
    );
  }

  if (!(inputs.root instanceof Uint8Array)) {
    throw new Error('root must be a Uint8Array');
  }
  if (inputs.root.length !== HASH_LENGTH) {
    throw new Error(
      `root must be ${HASH_LENGTH} bytes, got ${inputs.root.length}`,
    );
  }

  if (typeof inputs.recipient !== 'string' || inputs.recipient.length === 0) {
    throw new Error('recipient must be a non-empty string');
  }

  if (typeof inputs.relayerFee !== 'bigint' || inputs.relayerFee < 0n) {
    throw new Error('relayerFee must be a non-negative bigint');
  }

  return true;
}

/**
 * Validate that the private inputs have the correct shape and sizes.
 *
 * @returns true if all fields are valid
 * @throws {Error} describing the first invalid field encountered
 */
export function validatePrivateInputs(inputs: PrivateInputs): boolean {
  if (!(inputs.secret instanceof Uint8Array)) {
    throw new Error('secret must be a Uint8Array');
  }
  if (inputs.secret.length !== HASH_LENGTH) {
    throw new Error(
      `secret must be ${HASH_LENGTH} bytes, got ${inputs.secret.length}`,
    );
  }

  if (!(inputs.nullifier instanceof Uint8Array)) {
    throw new Error('nullifier must be a Uint8Array');
  }
  if (inputs.nullifier.length !== HASH_LENGTH) {
    throw new Error(
      `nullifier must be ${HASH_LENGTH} bytes, got ${inputs.nullifier.length}`,
    );
  }

  if (typeof inputs.amount !== 'bigint' || inputs.amount < 0n) {
    throw new Error('amount must be a non-negative bigint');
  }

  if (
    typeof inputs.leafIndex !== 'number' ||
    !Number.isInteger(inputs.leafIndex) ||
    inputs.leafIndex < 0 ||
    inputs.leafIndex >= MAX_LEAVES
  ) {
    throw new Error(
      `leafIndex must be an integer in [0, ${MAX_LEAVES - 1}], got ${inputs.leafIndex}`,
    );
  }

  const expectedPathLen = TREE_DEPTH - 1;

  if (!Array.isArray(inputs.merklePathElements)) {
    throw new Error('merklePathElements must be an array');
  }
  if (inputs.merklePathElements.length !== expectedPathLen) {
    throw new Error(
      `merklePathElements must have ${expectedPathLen} elements, got ${inputs.merklePathElements.length}`,
    );
  }
  for (let i = 0; i < inputs.merklePathElements.length; i++) {
    const el = inputs.merklePathElements[i]!;
    if (!(el instanceof Uint8Array) || el.length !== HASH_LENGTH) {
      throw new Error(
        `merklePathElements[${i}] must be a ${HASH_LENGTH}-byte Uint8Array`,
      );
    }
  }

  if (!Array.isArray(inputs.merklePathIndices)) {
    throw new Error('merklePathIndices must be an array');
  }
  if (inputs.merklePathIndices.length !== expectedPathLen) {
    throw new Error(
      `merklePathIndices must have ${expectedPathLen} elements, got ${inputs.merklePathIndices.length}`,
    );
  }
  for (let i = 0; i < inputs.merklePathIndices.length; i++) {
    const idx = inputs.merklePathIndices[i]!;
    if (idx !== 0 && idx !== 1) {
      throw new Error(
        `merklePathIndices[${i}] must be 0 or 1, got ${idx}`,
      );
    }
  }

  return true;
}
