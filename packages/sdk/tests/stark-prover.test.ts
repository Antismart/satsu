/**
 * Tests for the STARK prover WASM integration layer.
 *
 * Since the real WASM prover module is compiled separately (and may not
 * be available in the test environment), these tests use a mock that
 * implements the WasmProverModule interface. This verifies:
 *
 *   1. WASM loader state management (available/unavailable)
 *   2. Data marshalling between TypeScript and WASM format
 *   3. STARK proof generation delegates correctly to WASM
 *   4. Clarity serialization produces valid-size buffers
 *   5. Backend fallback logic in generateWithdrawalProof
 *   6. Regression: hash-based backend still works unchanged
 *   7. Witness data flattening for Merkle path concatenation
 *   8. Proof verification delegates to WASM verify_proof
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sha256 } from '@noble/hashes/sha256';
import { IncrementalMerkleTree } from '../src/pool/merkle.js';
import { createCommitment } from '../src/pool/commitment.js';
import { generateWitness } from '../src/proof/witness.js';
import {
  generateWithdrawalProof,
  verifyProofLocally,
  ProverBackend,
} from '../src/proof/prover.js';
import type { StarkProof } from '../src/proof/prover.js';
import {
  generateStarkProof,
  verifyStarkProof,
  serializeForClarity,
  flattenMerklePath,
} from '../src/proof/stark-prover.js';
import type { StarkProofResult } from '../src/proof/stark-prover.js';
import {
  isWasmAvailable,
  getWasmProver,
  setWasmProver,
  resetWasmLoader,
} from '../src/proof/wasm-loader.js';
import type { WasmProverModule } from '../src/proof/wasm-loader.js';
import type { PublicInputs, PrivateInputs } from '../src/proof/circuit.js';
import type { Witness } from '../src/proof/witness.js';
import {
  POOL_DENOMINATION,
  TREE_DEPTH,
  MAX_PROOF_BYTES,
  HASH_LENGTH,
} from '../src/utils/constants.js';
import { randomBytes, constantTimeEqual } from '../src/utils/crypto.js';

// ---------------------------------------------------------------------------
// Mock WASM prover
// ---------------------------------------------------------------------------

/** Fixed proof bytes returned by the mock WASM prover. */
const MOCK_PROOF_BYTES = new Uint8Array(512).fill(0xab);

/**
 * Mock WasmProverModule that returns deterministic results.
 * The generate_proof function captures the arguments for inspection.
 */
function createMockWasm(): WasmProverModule & {
  lastGenerateArgs: unknown[] | null;
  lastVerifyArgs: unknown[] | null;
  verifyResult: boolean;
} {
  const mock = {
    lastGenerateArgs: null as unknown[] | null,
    lastVerifyArgs: null as unknown[] | null,
    verifyResult: true,
    generate_proof(
      secret: Uint8Array,
      nullifier: Uint8Array,
      amount: bigint,
      leafIndex: number,
      merklePathFlat: Uint8Array,
      pathIndices: Uint8Array,
      nullifierHash: Uint8Array,
      root: Uint8Array,
      recipient: string,
      relayerFee: bigint,
    ): Uint8Array {
      mock.lastGenerateArgs = [
        secret, nullifier, amount, leafIndex,
        merklePathFlat, pathIndices, nullifierHash,
        root, recipient, relayerFee,
      ];
      return Uint8Array.from(MOCK_PROOF_BYTES);
    },
    verify_proof(
      proofBytes: Uint8Array,
      nullifierHash: Uint8Array,
      root: Uint8Array,
      recipient: string,
      relayerFee: bigint,
    ): boolean {
      mock.lastVerifyArgs = [proofBytes, nullifierHash, root, recipient, relayerFee];
      return mock.verifyResult;
    },
  };
  return mock;
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Create a valid witness for testing, matching the pattern from proof.test.ts.
 */
function createValidWitness(): {
  witness: Witness;
  publicInputs: PublicInputs;
  privateInputs: PrivateInputs;
} {
  const tree = new IncrementalMerkleTree();
  const commitment = createCommitment(POOL_DENOMINATION);
  const { root, index } = tree.insert(commitment.commitment);
  const merkleProof = tree.generateProof(index);

  const publicInputs: PublicInputs = {
    nullifierHash: commitment.nullifierHash,
    root,
    recipient: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    relayerFee: 0n,
  };

  const privateInputs: PrivateInputs = {
    secret: commitment.secret,
    nullifier: commitment.nullifier,
    amount: POOL_DENOMINATION,
    leafIndex: index,
    merklePathElements: merkleProof.pathElements,
    merklePathIndices: merkleProof.pathIndices,
  };

  const witness = generateWitness(privateInputs, publicInputs);
  return { witness, publicInputs, privateInputs };
}

// ---------------------------------------------------------------------------
// WASM loader tests
// ---------------------------------------------------------------------------

describe('WASM loader state management', () => {
  beforeEach(() => {
    resetWasmLoader();
  });

  afterEach(() => {
    resetWasmLoader();
  });

  it('should return null when WASM module is not available (test 1)', () => {
    expect(getWasmProver()).toBeNull();
  });

  it('should report WASM as unavailable initially (test 2)', () => {
    expect(isWasmAvailable()).toBe(false);
  });

  it('should report WASM as available after setWasmProver', () => {
    const mock = createMockWasm();
    setWasmProver(mock);
    expect(isWasmAvailable()).toBe(true);
    expect(getWasmProver()).toBe(mock);
  });

  it('should clear module on setWasmProver(null)', () => {
    const mock = createMockWasm();
    setWasmProver(mock);
    expect(isWasmAvailable()).toBe(true);

    setWasmProver(null);
    expect(isWasmAvailable()).toBe(false);
    expect(getWasmProver()).toBeNull();
  });

  it('should reset state fully on resetWasmLoader', () => {
    const mock = createMockWasm();
    setWasmProver(mock);
    expect(isWasmAvailable()).toBe(true);

    resetWasmLoader();
    expect(isWasmAvailable()).toBe(false);
    expect(getWasmProver()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// STARK proof generation tests
// ---------------------------------------------------------------------------

describe('generateStarkProof', () => {
  it('should call WASM generate_proof with correctly marshalled inputs (test 3)', async () => {
    const mock = createMockWasm();
    const { witness } = createValidWitness();

    const result = await generateStarkProof(witness, mock);

    expect(result.proof).toEqual(MOCK_PROOF_BYTES);
    expect(result.proofSize).toBe(512);
    expect(result.provingTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.publicInputs).toBe(witness.publicInputs);

    // Verify the arguments passed to WASM
    expect(mock.lastGenerateArgs).not.toBeNull();
    const args = mock.lastGenerateArgs!;

    // arg 0: secret (32 bytes)
    expect(args[0]).toEqual(witness.privateInputs.secret);

    // arg 1: nullifier (32 bytes)
    expect(args[1]).toEqual(witness.privateInputs.nullifier);

    // arg 2: amount (bigint)
    expect(args[2]).toBe(witness.privateInputs.amount);

    // arg 3: leafIndex (number)
    expect(args[3]).toBe(witness.privateInputs.leafIndex);

    // arg 4: merklePathFlat (19 * 32 = 608 bytes)
    const flatPath = args[4] as Uint8Array;
    expect(flatPath.length).toBe((TREE_DEPTH - 1) * HASH_LENGTH);

    // Verify each element is correctly placed in the flat array
    for (let i = 0; i < TREE_DEPTH - 1; i++) {
      const slice = flatPath.slice(i * HASH_LENGTH, (i + 1) * HASH_LENGTH);
      expect(
        constantTimeEqual(slice, witness.privateInputs.merklePathElements[i]!),
      ).toBe(true);
    }

    // arg 5: pathIndices (19 bytes)
    const indices = args[5] as Uint8Array;
    expect(indices.length).toBe(TREE_DEPTH - 1);
    for (let i = 0; i < TREE_DEPTH - 1; i++) {
      expect(indices[i]).toBe(witness.privateInputs.merklePathIndices[i]);
    }

    // arg 6: nullifierHash (32 bytes)
    expect(constantTimeEqual(args[6] as Uint8Array, witness.nullifierHash)).toBe(true);

    // arg 7: root (32 bytes)
    expect(constantTimeEqual(args[7] as Uint8Array, witness.publicInputs.root)).toBe(true);

    // arg 8: recipient (string)
    expect(args[8]).toBe(witness.publicInputs.recipient);

    // arg 9: relayerFee (bigint)
    expect(args[9]).toBe(witness.publicInputs.relayerFee);
  });

  it('should measure proving time', async () => {
    const mock = createMockWasm();
    const { witness } = createValidWitness();

    const result = await generateStarkProof(witness, mock);

    // Proving time should be a non-negative number
    expect(typeof result.provingTimeMs).toBe('number');
    expect(result.provingTimeMs).toBeGreaterThanOrEqual(0);
    // Should be very fast since mock returns immediately
    expect(result.provingTimeMs).toBeLessThan(1000);
  });
});

// ---------------------------------------------------------------------------
// Clarity serialization tests
// ---------------------------------------------------------------------------

describe('serializeForClarity', () => {
  it('should produce a buffer of exactly MAX_PROOF_BYTES (test 4)', () => {
    const serialized = serializeForClarity(MOCK_PROOF_BYTES);
    expect(serialized.length).toBe(MAX_PROOF_BYTES);
    expect(serialized.length).toBeLessThanOrEqual(2048);
  });

  it('should set version byte to 0x02', () => {
    const serialized = serializeForClarity(MOCK_PROOF_BYTES);
    expect(serialized[0]).toBe(0x02);
  });

  it('should encode proof length as big-endian uint32', () => {
    const serialized = serializeForClarity(MOCK_PROOF_BYTES);
    const len =
      (serialized[1]! << 24) |
      (serialized[2]! << 16) |
      (serialized[3]! << 8) |
      serialized[4]!;
    expect(len).toBe(MOCK_PROOF_BYTES.length);
  });

  it('should embed the proof data starting at offset 5', () => {
    const serialized = serializeForClarity(MOCK_PROOF_BYTES);
    const embedded = serialized.slice(5, 5 + MOCK_PROOF_BYTES.length);
    expect(constantTimeEqual(embedded, MOCK_PROOF_BYTES)).toBe(true);
  });

  it('should zero-pad the remaining bytes', () => {
    const serialized = serializeForClarity(MOCK_PROOF_BYTES);
    const padding = serialized.slice(5 + MOCK_PROOF_BYTES.length);
    expect(padding.every((b) => b === 0)).toBe(true);
  });

  it('should accept small proofs', () => {
    const tiny = new Uint8Array(16).fill(0xcc);
    const serialized = serializeForClarity(tiny);
    expect(serialized.length).toBe(MAX_PROOF_BYTES);
    expect(serialized[0]).toBe(0x02);
  });

  it('should reject proofs that exceed the buffer capacity', () => {
    // Max payload = 2048 - 5 = 2043 bytes
    const tooLarge = new Uint8Array(2044).fill(0xff);
    expect(() => serializeForClarity(tooLarge)).toThrow('too large');
  });

  it('should accept maximum-size proof', () => {
    // Exactly 2043 bytes = max payload
    const maxProof = new Uint8Array(2043).fill(0xdd);
    const serialized = serializeForClarity(maxProof);
    expect(serialized.length).toBe(MAX_PROOF_BYTES);
  });
});

// ---------------------------------------------------------------------------
// Backend fallback tests
// ---------------------------------------------------------------------------

describe('ProverBackend fallback', () => {
  beforeEach(() => {
    resetWasmLoader();
  });

  afterEach(() => {
    resetWasmLoader();
  });

  it('should fall back to hash-based when WASM is unavailable (test 5)', async () => {
    const { witness } = createValidWitness();

    // No WASM loaded, request STARK backend
    const proof = await generateWithdrawalProof(witness, {
      backend: ProverBackend.STARK_WASM,
    });

    // Should produce a hash-based proof (version 0x01)
    expect(proof.proof[0]).toBe(0x01);
    expect(proof.proof.length).toBe(MAX_PROOF_BYTES);
  });

  it('should use WASM backend when available and requested', async () => {
    const mock = createMockWasm();
    setWasmProver(mock);

    const { witness } = createValidWitness();

    const proof = await generateWithdrawalProof(witness, {
      backend: ProverBackend.STARK_WASM,
    });

    // Should produce a STARK proof (version 0x02)
    expect(proof.proof[0]).toBe(0x02);
    expect(proof.proof.length).toBe(MAX_PROOF_BYTES);

    // WASM should have been called
    expect(mock.lastGenerateArgs).not.toBeNull();
  });

  it('should use WASM backend by default when available', async () => {
    const mock = createMockWasm();
    setWasmProver(mock);

    const { witness } = createValidWitness();

    // No options = defaults to STARK_WASM
    const proof = await generateWithdrawalProof(witness);

    expect(proof.proof[0]).toBe(0x02);
    expect(mock.lastGenerateArgs).not.toBeNull();
  });

  it('should use hash-based when explicitly requested even if WASM available', async () => {
    const mock = createMockWasm();
    setWasmProver(mock);

    const { witness } = createValidWitness();

    const proof = await generateWithdrawalProof(witness, {
      backend: ProverBackend.HASH_BASED,
    });

    // Should produce hash-based proof despite WASM being available
    expect(proof.proof[0]).toBe(0x01);
    expect(mock.lastGenerateArgs).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Hash-based backend regression tests
// ---------------------------------------------------------------------------

describe('Hash-based backend regression', () => {
  beforeEach(() => {
    resetWasmLoader();
  });

  afterEach(() => {
    resetWasmLoader();
  });

  it('should still produce valid proofs with HASH_BASED backend (test 6)', async () => {
    const { witness } = createValidWitness();

    const proof = await generateWithdrawalProof(witness, {
      backend: ProverBackend.HASH_BASED,
    });

    expect(proof.proof.length).toBe(MAX_PROOF_BYTES);
    expect(proof.proof[0]).toBe(0x01);

    // Local verification should accept the proof
    expect(verifyProofLocally(proof)).toBe(true);
  });

  it('should produce identical results to calling without options', async () => {
    // Ensure no WASM is loaded so both paths use hash-based
    resetWasmLoader();

    const { witness } = createValidWitness();

    const proofWithOption = await generateWithdrawalProof(witness, {
      backend: ProverBackend.HASH_BASED,
    });

    // Since WASM is not available, default path also goes to hash-based
    const proofDefault = await generateWithdrawalProof(witness);

    expect(constantTimeEqual(proofWithOption.proof, proofDefault.proof)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Merkle path flattening tests
// ---------------------------------------------------------------------------

describe('Witness data flattening for WASM', () => {
  it('should correctly flatten merkle path elements (test 7)', () => {
    const { witness } = createValidWitness();
    const pathElements = witness.privateInputs.merklePathElements;

    const flat = flattenMerklePath(pathElements);

    // Should be 19 * 32 = 608 bytes
    expect(flat.length).toBe((TREE_DEPTH - 1) * HASH_LENGTH);

    // Each 32-byte chunk should match the original element
    for (let i = 0; i < TREE_DEPTH - 1; i++) {
      const chunk = flat.slice(i * HASH_LENGTH, (i + 1) * HASH_LENGTH);
      expect(constantTimeEqual(chunk, pathElements[i]!)).toBe(true);
    }
  });

  it('should reject wrong number of path elements', () => {
    expect(() => flattenMerklePath([])).toThrow('Expected 19');
    expect(() =>
      flattenMerklePath(Array.from({ length: 10 }, () => new Uint8Array(32))),
    ).toThrow('Expected 19');
  });

  it('should reject path elements with wrong size', () => {
    const elements = Array.from({ length: 19 }, () => new Uint8Array(32));
    elements[5] = new Uint8Array(16); // wrong size
    expect(() => flattenMerklePath(elements)).toThrow('32 bytes');
  });

  it('should produce distinct bytes for different path elements', () => {
    // Create two different path sets
    const elements1 = Array.from({ length: 19 }, (_, i) => {
      const buf = new Uint8Array(32);
      buf[0] = i;
      return buf;
    });
    const elements2 = Array.from({ length: 19 }, (_, i) => {
      const buf = new Uint8Array(32);
      buf[0] = i + 100;
      return buf;
    });

    const flat1 = flattenMerklePath(elements1);
    const flat2 = flattenMerklePath(elements2);

    expect(constantTimeEqual(flat1, flat2)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// STARK proof verification tests
// ---------------------------------------------------------------------------

describe('verifyStarkProof', () => {
  it('should delegate to WASM verify_proof (test 8)', () => {
    const mock = createMockWasm();
    const { publicInputs } = createValidWitness();
    const proofBytes = new Uint8Array(256).fill(0xcd);

    const result = verifyStarkProof(proofBytes, publicInputs, mock);

    expect(result).toBe(true);
    expect(mock.lastVerifyArgs).not.toBeNull();

    const args = mock.lastVerifyArgs!;
    expect(constantTimeEqual(args[0] as Uint8Array, proofBytes)).toBe(true);
    expect(
      constantTimeEqual(args[1] as Uint8Array, publicInputs.nullifierHash),
    ).toBe(true);
    expect(constantTimeEqual(args[2] as Uint8Array, publicInputs.root)).toBe(true);
    expect(args[3]).toBe(publicInputs.recipient);
    expect(args[4]).toBe(publicInputs.relayerFee);
  });

  it('should return false when WASM says invalid', () => {
    const mock = createMockWasm();
    mock.verifyResult = false;

    const { publicInputs } = createValidWitness();
    const proofBytes = new Uint8Array(256).fill(0xcd);

    expect(verifyStarkProof(proofBytes, publicInputs, mock)).toBe(false);
  });

  it('should return false when WASM throws', () => {
    const throwingMock: WasmProverModule = {
      generate_proof: () => new Uint8Array(0),
      verify_proof: () => {
        throw new Error('WASM panic');
      },
    };

    const { publicInputs } = createValidWitness();
    const proofBytes = new Uint8Array(256).fill(0xcd);

    expect(verifyStarkProof(proofBytes, publicInputs, throwingMock)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// End-to-end STARK flow tests
// ---------------------------------------------------------------------------

describe('End-to-end STARK proof flow', () => {
  beforeEach(() => {
    resetWasmLoader();
  });

  afterEach(() => {
    resetWasmLoader();
  });

  it('should produce a valid Clarity-serialized proof via WASM', async () => {
    const mock = createMockWasm();
    setWasmProver(mock);

    const tree = new IncrementalMerkleTree();
    const commitment = createCommitment(POOL_DENOMINATION);
    const { root, index } = tree.insert(commitment.commitment);
    const merkleProof = tree.generateProof(index);

    const publicInputs: PublicInputs = {
      nullifierHash: commitment.nullifierHash,
      root,
      recipient: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
      relayerFee: 50_000n,
    };

    const privateInputs: PrivateInputs = {
      secret: commitment.secret,
      nullifier: commitment.nullifier,
      amount: POOL_DENOMINATION,
      leafIndex: index,
      merklePathElements: merkleProof.pathElements,
      merklePathIndices: merkleProof.pathIndices,
    };

    const witness = generateWitness(privateInputs, publicInputs);
    const proof = await generateWithdrawalProof(witness);

    // Should be STARK proof (version 0x02)
    expect(proof.proof[0]).toBe(0x02);
    expect(proof.proof.length).toBe(MAX_PROOF_BYTES);

    // Public inputs should be passed through
    expect(proof.publicInputs.recipient).toBe('ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG');
    expect(proof.publicInputs.relayerFee).toBe(50_000n);

    // The embedded proof data should be the mock proof bytes
    const proofLen =
      (proof.proof[1]! << 24) |
      (proof.proof[2]! << 16) |
      (proof.proof[3]! << 8) |
      proof.proof[4]!;
    expect(proofLen).toBe(MOCK_PROOF_BYTES.length);

    const embedded = proof.proof.slice(5, 5 + proofLen);
    expect(constantTimeEqual(embedded, MOCK_PROOF_BYTES)).toBe(true);
  });

  it('should fall through gracefully in mixed scenarios', async () => {
    const { witness } = createValidWitness();

    // Start without WASM
    const proof1 = await generateWithdrawalProof(witness);
    expect(proof1.proof[0]).toBe(0x01); // hash-based

    // Load WASM
    const mock = createMockWasm();
    setWasmProver(mock);

    const proof2 = await generateWithdrawalProof(witness);
    expect(proof2.proof[0]).toBe(0x02); // STARK

    // Unload WASM
    setWasmProver(null);

    const proof3 = await generateWithdrawalProof(witness);
    expect(proof3.proof[0]).toBe(0x01); // back to hash-based
  });
});
