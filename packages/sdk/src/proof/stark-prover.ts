/**
 * STARK prover wrapper that bridges the TypeScript SDK to the Rust
 * WASM prover module.
 *
 * This module handles:
 *   1. Marshalling witness data from TypeScript types into the flat
 *      byte arrays expected by the WASM generate_proof function.
 *   2. Wrapping the raw STARK proof bytes into the StarkProofResult
 *      structure with timing metadata.
 *   3. Delegating verify_proof calls to WASM.
 *   4. Serializing the raw STARK proof into the 2048-byte format
 *      expected by the Clarity on-chain verifier.
 *
 * The WASM module expects:
 *   - merklePathFlat: 19 sibling hashes concatenated into 608 bytes
 *   - pathIndices:    19 direction bits as a Uint8Array(19)
 *   - amount/fee:     passed as bigint (WASM-bindgen handles conversion)
 *
 * If the WASM module is not available, callers should fall back to the
 * hash-based prover in prover.ts. This module does NOT handle fallback
 * logic itself -- that belongs in the top-level generateWithdrawalProof.
 */

import type { WasmProverModule } from './wasm-loader.js';
import type { Witness } from './witness.js';
import type { PublicInputs } from './circuit.js';
import { TREE_DEPTH, MAX_PROOF_BYTES, HASH_LENGTH } from '../utils/constants.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of sibling hashes in a Merkle proof (depth - 1). */
const PATH_LENGTH = TREE_DEPTH - 1;

/** Total bytes for the flattened Merkle path (19 * 32). */
const MERKLE_PATH_FLAT_SIZE = PATH_LENGTH * HASH_LENGTH;

/** STARK proof version byte for the serialized format. */
const STARK_PROOF_VERSION = 0x02;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result of generating a STARK proof via the WASM prover.
 *
 * Unlike the hash-based StarkProof (which is already serialized), this
 * contains the raw proof bytes from the Rust prover plus metadata about
 * proof generation.
 */
export interface StarkProofResult {
  /** Raw STARK proof bytes from the Rust prover. */
  proof: Uint8Array;
  /** Public inputs that accompany the proof. */
  publicInputs: PublicInputs;
  /** Size of the raw proof in bytes. */
  proofSize: number;
  /** Wall-clock time for proof generation in milliseconds. */
  provingTimeMs: number;
}

// ---------------------------------------------------------------------------
// Proof generation
// ---------------------------------------------------------------------------

/**
 * Generate a STARK proof using the WASM prover module.
 *
 * Marshals the witness data into the flat format expected by the Rust
 * `generate_proof` function and measures the proving time.
 *
 * @param witness    - Complete witness from generateWitness()
 * @param wasmProver - Loaded WASM prover module
 * @returns STARK proof result with raw proof bytes and metadata
 * @throws {Error} If the WASM prover call fails
 */
export async function generateStarkProof(
  witness: Witness,
  wasmProver: WasmProverModule,
): Promise<StarkProofResult> {
  const { publicInputs, privateInputs, nullifierHash } = witness;

  // -------------------------------------------------------------------------
  // Marshal Merkle path into a flat byte array (19 * 32 = 608 bytes)
  // -------------------------------------------------------------------------
  const merklePathFlat = flattenMerklePath(privateInputs.merklePathElements);

  // -------------------------------------------------------------------------
  // Marshal path indices into a Uint8Array(19)
  // -------------------------------------------------------------------------
  const pathIndices = new Uint8Array(PATH_LENGTH);
  for (let i = 0; i < PATH_LENGTH; i++) {
    pathIndices[i] = privateInputs.merklePathIndices[i]!;
  }

  // -------------------------------------------------------------------------
  // Call the WASM prover
  // -------------------------------------------------------------------------
  const startTime = performance.now();

  const rawProof = wasmProver.generate_proof(
    privateInputs.secret,
    privateInputs.nullifier,
    privateInputs.amount,
    privateInputs.leafIndex,
    merklePathFlat,
    pathIndices,
    nullifierHash,
    publicInputs.root,
    publicInputs.recipient,
    publicInputs.relayerFee,
  );

  const endTime = performance.now();

  return {
    proof: rawProof,
    publicInputs,
    proofSize: rawProof.length,
    provingTimeMs: endTime - startTime,
  };
}

// ---------------------------------------------------------------------------
// Proof verification
// ---------------------------------------------------------------------------

/**
 * Verify a STARK proof using the WASM prover module.
 *
 * Delegates directly to the Rust verify_proof function.
 *
 * @param proof        - Raw STARK proof bytes
 * @param publicInputs - Public inputs to verify against
 * @param wasmProver   - Loaded WASM prover module
 * @returns true if the proof is valid
 */
export function verifyStarkProof(
  proof: Uint8Array,
  publicInputs: PublicInputs,
  wasmProver: WasmProverModule,
): boolean {
  try {
    return wasmProver.verify_proof(
      proof,
      publicInputs.nullifierHash,
      publicInputs.root,
      publicInputs.recipient,
      publicInputs.relayerFee,
    );
  } catch {
    // If WASM verification throws (e.g., malformed proof), treat as invalid
    return false;
  }
}

// ---------------------------------------------------------------------------
// Serialization for Clarity contract submission
// ---------------------------------------------------------------------------

/**
 * Serialize a raw STARK proof into the 2048-byte buffer format
 * expected by the Clarity pool-v1 contract.
 *
 * Layout:
 *   [1 byte]              version (0x02 for STARK proofs)
 *   [4 bytes]             proof length (big-endian uint32)
 *   [proof length bytes]  raw STARK proof data
 *   [remaining]           zero padding to fill 2048 bytes
 *
 * The version byte 0x02 distinguishes STARK proofs from the hash-based
 * proofs (version 0x01), allowing the on-chain verifier to dispatch to
 * the correct verification logic.
 *
 * @param starkProof - Raw STARK proof bytes from the Rust prover
 * @returns 2048-byte buffer ready for on-chain submission
 * @throws {Error} If the proof exceeds the maximum size
 */
export function serializeForClarity(starkProof: Uint8Array): Uint8Array {
  // Header: 1 (version) + 4 (length) = 5 bytes
  const headerSize = 5;
  const maxPayload = MAX_PROOF_BYTES - headerSize;

  if (starkProof.length > maxPayload) {
    throw new Error(
      `STARK proof too large for Clarity buffer: ${starkProof.length} bytes ` +
        `exceeds maximum payload of ${maxPayload} bytes (2048 - ${headerSize} header)`,
    );
  }

  const buf = new Uint8Array(MAX_PROOF_BYTES); // zero-filled

  // Version byte (0x02 = STARK proof)
  buf[0] = STARK_PROOF_VERSION;

  // Proof length as big-endian uint32
  const len = starkProof.length;
  buf[1] = (len >>> 24) & 0xff;
  buf[2] = (len >>> 16) & 0xff;
  buf[3] = (len >>> 8) & 0xff;
  buf[4] = len & 0xff;

  // Proof data
  buf.set(starkProof, headerSize);

  // Remaining bytes are zero (padding)
  return buf;
}

// ---------------------------------------------------------------------------
// Data marshalling helpers
// ---------------------------------------------------------------------------

/**
 * Flatten an array of 32-byte Merkle path elements into a single
 * contiguous Uint8Array of (PATH_LENGTH * 32) bytes.
 *
 * This is the format expected by the Rust WASM prover: a single
 * &[u8] slice containing all sibling hashes concatenated in order
 * from leaf level to root level.
 *
 * @param pathElements - Array of 19 sibling hashes (each 32 bytes)
 * @returns Flat Uint8Array of 608 bytes
 * @throws {Error} If the path has wrong length or element sizes
 */
export function flattenMerklePath(pathElements: Uint8Array[]): Uint8Array {
  if (pathElements.length !== PATH_LENGTH) {
    throw new Error(
      `Expected ${PATH_LENGTH} path elements, got ${pathElements.length}`,
    );
  }

  const flat = new Uint8Array(MERKLE_PATH_FLAT_SIZE);
  for (let i = 0; i < PATH_LENGTH; i++) {
    const element = pathElements[i]!;
    if (element.length !== HASH_LENGTH) {
      throw new Error(
        `Path element ${i} must be ${HASH_LENGTH} bytes, got ${element.length}`,
      );
    }
    flat.set(element, i * HASH_LENGTH);
  }

  return flat;
}
