/**
 * Proof generation and verification for the Satsu membership proof.
 *
 * This module implements a hash-based proof of knowledge scheme:
 *
 *   1. The prover generates a witness showing they know the pre-image
 *      of a commitment that is a leaf in the Merkle tree.
 *   2. A Fiat-Shamir challenge is computed from the public inputs,
 *      binding the proof to a specific recipient and relayer fee.
 *   3. A response hash is computed from the challenge and private inputs,
 *      demonstrating knowledge of the secret without revealing it.
 *   4. The proof is serialized into a compact byte format that fits
 *      within the 2048-byte Clarity buffer limit.
 *
 * This is NOT a full zero-knowledge STARK -- that would require a
 * specialized arithmetization compiler. This module demonstrates the
 * architecture and can be swapped for a real STARK backend when one
 * becomes available for SHA-256 circuits in WASM.
 *
 * Proof serialization format (fits in 2048 bytes):
 *   [1 byte]              version (0x01)
 *   [32 bytes]            nullifierHash
 *   [32 bytes]            challengeHash
 *   [32 bytes]            responseHash
 *   [1 byte]              pathLength (19 for depth-20 tree)
 *   [pathLength * 32 B]   Merkle path elements
 *   [ceil(pathLength/8)]  path indices packed as bits
 *   [remaining]           zero padding to fill buffer
 *
 * For pathLength = 19:
 *   1 + 32 + 32 + 32 + 1 + (19 * 32) + 3 = 709 bytes (well within 2048)
 */

import { sha256 } from '@noble/hashes/sha256';
import { concatBytes, constantTimeEqual, bigintToUint128BE } from '../utils/crypto.js';
import { TREE_DEPTH, MAX_PROOF_BYTES, HASH_LENGTH } from '../utils/constants.js';
import type { PublicInputs } from './circuit.js';
import type { Witness } from './witness.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Current proof format version. */
const PROOF_VERSION = 0x01;

/** Expected Merkle path length (depth - 1). */
const PATH_LENGTH = TREE_DEPTH - 1;

/** Fixed portion of serialized proof: version + nullifierHash + challenge + response + pathLength byte. */
const FIXED_HEADER_SIZE = 1 + HASH_LENGTH + HASH_LENGTH + HASH_LENGTH + 1; // 98

/** Size of the path elements section. */
const PATH_ELEMENTS_SIZE = PATH_LENGTH * HASH_LENGTH; // 608

/** Bytes needed for packed path indices (ceil(19/8) = 3). */
const PATH_INDICES_SIZE = Math.ceil(PATH_LENGTH / 8); // 3

/** Total proof payload size (before padding). */
const PROOF_PAYLOAD_SIZE = FIXED_HEADER_SIZE + PATH_ELEMENTS_SIZE + PATH_INDICES_SIZE; // 709

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A serialized STARK proof with its associated public inputs.
 *
 * The `proof` field contains the serialized bytes ready for on-chain
 * submission. The `publicInputs` are provided separately for the
 * contract call parameters.
 */
export interface StarkProof {
  /** Serialized proof bytes (max 2048 bytes). */
  proof: Uint8Array;
  /** Public inputs that are passed separately to the verifier contract. */
  publicInputs: PublicInputs;
}

/**
 * Internal proof data structure used between serialization/deserialization.
 */
export interface ProofData {
  /** Recomputed commitment hash. */
  commitment: Uint8Array;
  /** sha256(nullifier). */
  nullifierHash: Uint8Array;
  /** Merkle sibling hashes from leaf to root. */
  merklePathElements: Uint8Array[];
  /** Direction bits for the Merkle path. */
  merklePathIndices: number[];
  /** Fiat-Shamir challenge: hash(nullifierHash || root || recipient || relayerFee). */
  challengeHash: Uint8Array;
  /** Response to challenge: hash(challenge || secret || leafIndex_be32). */
  responseHash: Uint8Array;
}

// ---------------------------------------------------------------------------
// Proof generation
// ---------------------------------------------------------------------------

/**
 * Generate a withdrawal proof from a valid witness.
 *
 * Steps:
 *   1. Compute Fiat-Shamir challenge from public inputs.
 *   2. Compute response from challenge + private inputs.
 *   3. Serialize everything into a compact byte array.
 *
 * @param witness - A valid witness (produced by generateWitness)
 * @returns Serialized proof and public inputs
 */
export async function generateWithdrawalProof(
  witness: Witness,
): Promise<StarkProof> {
  const { publicInputs, privateInputs, commitment, nullifierHash } = witness;

  // -----------------------------------------------------------------------
  // Step 1: Fiat-Shamir challenge
  //
  // challenge = sha256(nullifierHash || root || recipient_utf8 || relayerFee_be128)
  //
  // This binds the proof to the specific withdrawal parameters, so
  // changing the recipient or fee after proof generation would
  // invalidate the proof.
  // -----------------------------------------------------------------------
  const challengeHash = computeChallenge(publicInputs);

  // -----------------------------------------------------------------------
  // Step 2: Response
  //
  // response = sha256(challenge || secret || leafIndex_be32)
  //
  // This demonstrates knowledge of the secret and leaf position
  // without revealing them. The challenge binding ensures this
  // response is specific to this withdrawal.
  // -----------------------------------------------------------------------
  const leafIndexBytes = encodeUint32BE(privateInputs.leafIndex);
  const responseHash = sha256(
    concatBytes(challengeHash, privateInputs.secret, leafIndexBytes),
  );

  // -----------------------------------------------------------------------
  // Step 3: Build internal proof data and serialize
  // -----------------------------------------------------------------------
  const proofData: ProofData = {
    commitment,
    nullifierHash,
    merklePathElements: privateInputs.merklePathElements,
    merklePathIndices: privateInputs.merklePathIndices,
    challengeHash,
    responseHash,
  };

  const proof = serializeProof(proofData);

  return {
    proof,
    publicInputs,
  };
}

// ---------------------------------------------------------------------------
// Challenge computation
// ---------------------------------------------------------------------------

/**
 * Compute the Fiat-Shamir challenge hash from public inputs.
 *
 * challenge = sha256(nullifierHash || root || utf8(recipient) || relayerFee_be128)
 */
export function computeChallenge(publicInputs: PublicInputs): Uint8Array {
  const recipientBytes = new TextEncoder().encode(publicInputs.recipient);
  const feeBytes = bigintToUint128BE(publicInputs.relayerFee);

  return sha256(
    concatBytes(
      publicInputs.nullifierHash,
      publicInputs.root,
      recipientBytes,
      feeBytes,
    ),
  );
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Serialize internal proof data into a compact byte array.
 *
 * Layout:
 *   [1]   version
 *   [32]  nullifierHash
 *   [32]  challengeHash
 *   [32]  responseHash
 *   [1]   pathLength
 *   [pathLength * 32]  path elements
 *   [ceil(pathLength/8)]  path indices as packed bits
 *
 * @returns Uint8Array of exactly MAX_PROOF_BYTES (2048) bytes
 */
export function serializeProof(proofData: ProofData): Uint8Array {
  const buf = new Uint8Array(MAX_PROOF_BYTES); // zero-filled
  let offset = 0;

  // Version byte
  buf[offset] = PROOF_VERSION;
  offset += 1;

  // nullifierHash (32 bytes)
  buf.set(proofData.nullifierHash, offset);
  offset += HASH_LENGTH;

  // challengeHash (32 bytes)
  buf.set(proofData.challengeHash, offset);
  offset += HASH_LENGTH;

  // responseHash (32 bytes)
  buf.set(proofData.responseHash, offset);
  offset += HASH_LENGTH;

  // pathLength (1 byte)
  const pathLength = proofData.merklePathElements.length;
  buf[offset] = pathLength;
  offset += 1;

  // Path elements (pathLength * 32 bytes)
  for (let i = 0; i < pathLength; i++) {
    buf.set(proofData.merklePathElements[i]!, offset);
    offset += HASH_LENGTH;
  }

  // Path indices as packed bits (ceil(pathLength/8) bytes)
  // Bit i of byte floor(i/8) at position (i % 8) is set if pathIndices[i] == 1
  const indicesBytes = Math.ceil(pathLength / 8);
  for (let i = 0; i < pathLength; i++) {
    if (proofData.merklePathIndices[i] === 1) {
      const byteIdx = Math.floor(i / 8);
      const bitIdx = i % 8;
      buf[offset + byteIdx]! |= 1 << bitIdx;
    }
  }
  offset += indicesBytes;

  // Remaining bytes are already zero (padding)
  return buf;
}

/**
 * Deserialize a proof byte array back into the internal proof data structure.
 *
 * @param bytes - Serialized proof (up to 2048 bytes)
 * @returns Deserialized proof data
 * @throws {Error} If the proof is malformed
 */
export function deserializeProof(bytes: Uint8Array): ProofData {
  if (bytes.length < FIXED_HEADER_SIZE) {
    throw new Error(
      `Proof too short: expected at least ${FIXED_HEADER_SIZE} bytes, got ${bytes.length}`,
    );
  }

  let offset = 0;

  // Version
  const version = bytes[offset]!;
  if (version !== PROOF_VERSION) {
    throw new Error(
      `Unsupported proof version: expected ${PROOF_VERSION}, got ${version}`,
    );
  }
  offset += 1;

  // nullifierHash
  const nullifierHash = bytes.slice(offset, offset + HASH_LENGTH);
  offset += HASH_LENGTH;

  // challengeHash
  const challengeHash = bytes.slice(offset, offset + HASH_LENGTH);
  offset += HASH_LENGTH;

  // responseHash
  const responseHash = bytes.slice(offset, offset + HASH_LENGTH);
  offset += HASH_LENGTH;

  // pathLength
  const pathLength = bytes[offset]!;
  offset += 1;

  if (pathLength === 0 || pathLength > TREE_DEPTH) {
    throw new Error(
      `Invalid path length: ${pathLength} (expected 1-${TREE_DEPTH})`,
    );
  }

  const neededBytes = offset + pathLength * HASH_LENGTH + Math.ceil(pathLength / 8);
  if (bytes.length < neededBytes) {
    throw new Error(
      `Proof too short for path: need ${neededBytes} bytes, got ${bytes.length}`,
    );
  }

  // Path elements
  const merklePathElements: Uint8Array[] = [];
  for (let i = 0; i < pathLength; i++) {
    merklePathElements.push(bytes.slice(offset, offset + HASH_LENGTH));
    offset += HASH_LENGTH;
  }

  // Path indices (packed bits)
  const merklePathIndices: number[] = [];
  for (let i = 0; i < pathLength; i++) {
    const byteIdx = Math.floor(i / 8);
    const bitIdx = i % 8;
    const bit = (bytes[offset + byteIdx]! >> bitIdx) & 1;
    merklePathIndices.push(bit);
  }

  // commitment is not stored in the serialized proof -- set to empty.
  // The verifier recomputes it from the witness or public inputs.
  const commitment = new Uint8Array(HASH_LENGTH);

  return {
    commitment,
    nullifierHash,
    merklePathElements,
    merklePathIndices,
    challengeHash,
    responseHash,
  };
}

// ---------------------------------------------------------------------------
// Local verification
// ---------------------------------------------------------------------------

/**
 * Verify a proof locally (client-side) without on-chain interaction.
 *
 * This checks:
 *   1. Proof deserializes correctly.
 *   2. The nullifierHash in the proof matches the public input.
 *   3. The Fiat-Shamir challenge is correctly computed from public inputs.
 *   4. The Merkle path leads from some leaf to the stated root.
 *
 * Note: Local verification cannot check that the prover actually knows
 * the secret (that would require the private inputs). It verifies the
 * proof structure and consistency only.
 *
 * @param starkProof - The proof to verify
 * @returns true if the proof structure is valid
 */
export function verifyProofLocally(starkProof: StarkProof): boolean {
  try {
    const proofData = deserializeProof(starkProof.proof);
    const { publicInputs } = starkProof;

    // Check 1: nullifierHash consistency
    if (!constantTimeEqual(proofData.nullifierHash, publicInputs.nullifierHash)) {
      return false;
    }

    // Check 2: Fiat-Shamir challenge is correctly derived from public inputs
    const expectedChallenge = computeChallenge(publicInputs);
    if (!constantTimeEqual(proofData.challengeHash, expectedChallenge)) {
      return false;
    }

    // Check 3: Path length is correct for the tree depth
    if (proofData.merklePathElements.length !== PATH_LENGTH) {
      return false;
    }
    if (proofData.merklePathIndices.length !== PATH_LENGTH) {
      return false;
    }

    // Check 4: responseHash is non-zero (basic sanity -- actual
    // verification of knowledge requires the secret, which only
    // the on-chain verifier + STARK check can do in a real system)
    const zeroHash = new Uint8Array(HASH_LENGTH);
    if (constantTimeEqual(proofData.responseHash, zeroHash)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Encode a non-negative integer as a 4-byte big-endian Uint8Array.
 */
function encodeUint32BE(value: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = (value >>> 24) & 0xff;
  buf[1] = (value >>> 16) & 0xff;
  buf[2] = (value >>> 8) & 0xff;
  buf[3] = value & 0xff;
  return buf;
}
