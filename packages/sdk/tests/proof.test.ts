/**
 * Tests for the ZK proof system: circuit validation, witness generation,
 * proof serialization, and local verification.
 *
 * Covers:
 *   1.  Witness generation with valid inputs
 *   2.  Witness generation fails with wrong secret
 *   3.  Witness generation fails with wrong Merkle path
 *   4.  Proof generation produces proof within 2048 bytes
 *   5.  Proof serialization round-trip
 *   6.  Local proof verification accepts valid proof
 *   7.  Local verification rejects tampered proof (modified nullifier)
 *   8.  Local verification rejects tampered proof (modified root)
 *   9.  Full flow: commitment -> tree insert -> Merkle proof -> witness -> ZK proof -> verify
 *   10. Proof binds to recipient (changing recipient fails verification)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { sha256 } from '@noble/hashes/sha256';
import { IncrementalMerkleTree } from '../src/pool/merkle.js';
import {
  createCommitment,
  computeCommitmentHash,
  computeNullifierHash,
} from '../src/pool/commitment.js';
import {
  validatePublicInputs,
  validatePrivateInputs,
  CIRCUIT_INFO,
} from '../src/proof/circuit.js';
import type { PublicInputs, PrivateInputs } from '../src/proof/circuit.js';
import { generateWitness } from '../src/proof/witness.js';
import type { Witness } from '../src/proof/witness.js';
import {
  generateWithdrawalProof,
  serializeProof,
  deserializeProof,
  verifyProofLocally,
  computeChallenge,
} from '../src/proof/prover.js';
import type { StarkProof, ProofData } from '../src/proof/prover.js';
import {
  POOL_DENOMINATION,
  TREE_DEPTH,
  MAX_PROOF_BYTES,
} from '../src/utils/constants.js';
import {
  randomBytes,
  bytesToHex,
  concatBytes,
  bigintToUint128BE,
  constantTimeEqual,
} from '../src/utils/crypto.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Create a full set of valid inputs for proof generation.
 *
 * Inserts a commitment into a fresh tree and extracts both public and
 * private inputs needed for witness generation.
 */
function createValidInputs(): {
  tree: IncrementalMerkleTree;
  publicInputs: PublicInputs;
  privateInputs: PrivateInputs;
  commitment: ReturnType<typeof createCommitment>;
} {
  const tree = new IncrementalMerkleTree();
  const commitment = createCommitment(POOL_DENOMINATION);

  // Insert the commitment as a leaf
  const { root, index } = tree.insert(commitment.commitment);

  // Generate Merkle proof
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

  return { tree, publicInputs, privateInputs, commitment };
}

// ---------------------------------------------------------------------------
// Circuit validation tests
// ---------------------------------------------------------------------------

describe('Circuit validation', () => {
  it('should accept valid public inputs', () => {
    const { publicInputs } = createValidInputs();
    expect(validatePublicInputs(publicInputs)).toBe(true);
  });

  it('should accept valid private inputs', () => {
    const { privateInputs } = createValidInputs();
    expect(validatePrivateInputs(privateInputs)).toBe(true);
  });

  it('should reject public inputs with wrong nullifierHash length', () => {
    const { publicInputs } = createValidInputs();
    publicInputs.nullifierHash = new Uint8Array(16);
    expect(() => validatePublicInputs(publicInputs)).toThrow('32 bytes');
  });

  it('should reject public inputs with wrong root length', () => {
    const { publicInputs } = createValidInputs();
    publicInputs.root = new Uint8Array(16);
    expect(() => validatePublicInputs(publicInputs)).toThrow('32 bytes');
  });

  it('should reject public inputs with empty recipient', () => {
    const { publicInputs } = createValidInputs();
    publicInputs.recipient = '';
    expect(() => validatePublicInputs(publicInputs)).toThrow('non-empty string');
  });

  it('should reject public inputs with negative relayerFee', () => {
    const { publicInputs } = createValidInputs();
    publicInputs.relayerFee = -1n;
    expect(() => validatePublicInputs(publicInputs)).toThrow('non-negative bigint');
  });

  it('should reject private inputs with wrong secret length', () => {
    const { privateInputs } = createValidInputs();
    privateInputs.secret = new Uint8Array(16);
    expect(() => validatePrivateInputs(privateInputs)).toThrow('32 bytes');
  });

  it('should reject private inputs with wrong path length', () => {
    const { privateInputs } = createValidInputs();
    privateInputs.merklePathElements = [];
    expect(() => validatePrivateInputs(privateInputs)).toThrow('19 elements');
  });

  it('should reject private inputs with invalid path index value', () => {
    const { privateInputs } = createValidInputs();
    privateInputs.merklePathIndices[0] = 2;
    expect(() => validatePrivateInputs(privateInputs)).toThrow('0 or 1');
  });

  it('should expose circuit metadata', () => {
    expect(CIRCUIT_INFO.name).toBe('satsu-membership-v1');
    expect(CIRCUIT_INFO.version).toBe('1.0.0');
    expect(CIRCUIT_INFO.hashFunction).toBe('sha256');
    expect(CIRCUIT_INFO.treeDepth).toBe(20);
    expect(CIRCUIT_INFO.proofPathLength).toBe(19);
  });
});

// ---------------------------------------------------------------------------
// Witness generation tests
// ---------------------------------------------------------------------------

describe('Witness generation', () => {
  it('should succeed with valid inputs (test 1)', () => {
    const { publicInputs, privateInputs } = createValidInputs();
    const witness = generateWitness(privateInputs, publicInputs);

    expect(witness.commitment.length).toBe(32);
    expect(witness.nullifierHash.length).toBe(32);
    expect(witness.merklePathHashes.length).toBe(TREE_DEPTH - 1);
    expect(witness.computedRoot.length).toBe(32);

    // Computed root must match public input root
    expect(constantTimeEqual(witness.computedRoot, publicInputs.root)).toBe(true);

    // Computed nullifierHash must match public input
    expect(constantTimeEqual(witness.nullifierHash, publicInputs.nullifierHash)).toBe(
      true,
    );
  });

  it('should recompute the commitment correctly', () => {
    const { publicInputs, privateInputs, commitment } = createValidInputs();
    const witness = generateWitness(privateInputs, publicInputs);

    // The witness commitment should match the original
    expect(constantTimeEqual(witness.commitment, commitment.commitment)).toBe(true);
  });

  it('should fail with wrong secret (test 2)', () => {
    const { publicInputs, privateInputs } = createValidInputs();

    // Corrupt the secret
    privateInputs.secret = randomBytes(32);

    // This should fail because the recomputed commitment won't match the tree leaf
    expect(() => generateWitness(privateInputs, publicInputs)).toThrow(
      'Merkle root does not match',
    );
  });

  it('should fail with wrong nullifier', () => {
    const { publicInputs, privateInputs } = createValidInputs();

    // Corrupt the nullifier -- nullifierHash won't match public input
    privateInputs.nullifier = randomBytes(32);

    expect(() => generateWitness(privateInputs, publicInputs)).toThrow(
      'nullifierHash does not match',
    );
  });

  it('should fail with wrong Merkle path (test 3)', () => {
    const { publicInputs, privateInputs } = createValidInputs();

    // Corrupt a path element
    privateInputs.merklePathElements[0] = randomBytes(32);

    expect(() => generateWitness(privateInputs, publicInputs)).toThrow(
      'Merkle root does not match',
    );
  });

  it('should fail with wrong amount', () => {
    const { publicInputs, privateInputs } = createValidInputs();

    // Change the amount -- commitment won't match
    privateInputs.amount = POOL_DENOMINATION + 1n;

    expect(() => generateWitness(privateInputs, publicInputs)).toThrow(
      'Merkle root does not match',
    );
  });

  it('should fail with wrong root in public inputs', () => {
    const { publicInputs, privateInputs } = createValidInputs();

    // Tamper with the root
    publicInputs.root = sha256(new Uint8Array(32).fill(0xff));

    expect(() => generateWitness(privateInputs, publicInputs)).toThrow(
      'Merkle root does not match',
    );
  });
});

// ---------------------------------------------------------------------------
// Proof generation tests
// ---------------------------------------------------------------------------

describe('Proof generation', () => {
  let witness: Witness;
  let publicInputs: PublicInputs;

  beforeEach(() => {
    const inputs = createValidInputs();
    publicInputs = inputs.publicInputs;
    witness = generateWitness(inputs.privateInputs, inputs.publicInputs);
  });

  it('should produce a proof within 2048 bytes (test 4)', async () => {
    const proof = await generateWithdrawalProof(witness);

    expect(proof.proof.length).toBe(MAX_PROOF_BYTES);
    expect(proof.proof.length).toBeLessThanOrEqual(2048);
  });

  it('should include the correct public inputs', async () => {
    const proof = await generateWithdrawalProof(witness);

    expect(constantTimeEqual(proof.publicInputs.nullifierHash, publicInputs.nullifierHash)).toBe(
      true,
    );
    expect(constantTimeEqual(proof.publicInputs.root, publicInputs.root)).toBe(true);
    expect(proof.publicInputs.recipient).toBe(publicInputs.recipient);
    expect(proof.publicInputs.relayerFee).toBe(publicInputs.relayerFee);
  });

  it('should start with version byte 0x01', async () => {
    const proof = await generateWithdrawalProof(witness);

    expect(proof.proof[0]).toBe(0x01);
  });

  it('should embed the nullifierHash at offset 1', async () => {
    const proof = await generateWithdrawalProof(witness);

    const embeddedNullifier = proof.proof.slice(1, 33);
    expect(constantTimeEqual(embeddedNullifier, publicInputs.nullifierHash)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Proof serialization round-trip tests
// ---------------------------------------------------------------------------

describe('Proof serialization round-trip', () => {
  it('should round-trip serialize/deserialize (test 5)', async () => {
    const inputs = createValidInputs();
    const witness = generateWitness(inputs.privateInputs, inputs.publicInputs);
    const proof = await generateWithdrawalProof(witness);

    const deserialized = deserializeProof(proof.proof);

    // nullifierHash should survive round-trip
    expect(
      constantTimeEqual(deserialized.nullifierHash, inputs.publicInputs.nullifierHash),
    ).toBe(true);

    // challengeHash should survive round-trip
    const expectedChallenge = computeChallenge(inputs.publicInputs);
    expect(constantTimeEqual(deserialized.challengeHash, expectedChallenge)).toBe(true);

    // Path elements should survive round-trip
    expect(deserialized.merklePathElements.length).toBe(TREE_DEPTH - 1);
    for (let i = 0; i < TREE_DEPTH - 1; i++) {
      expect(
        constantTimeEqual(
          deserialized.merklePathElements[i]!,
          inputs.privateInputs.merklePathElements[i]!,
        ),
      ).toBe(true);
    }

    // Path indices should survive round-trip
    expect(deserialized.merklePathIndices).toEqual(inputs.privateInputs.merklePathIndices);
  });

  it('should produce identical bytes when re-serializing deserialized data', async () => {
    const inputs = createValidInputs();
    const witness = generateWitness(inputs.privateInputs, inputs.publicInputs);
    const proof = await generateWithdrawalProof(witness);

    const deserialized = deserializeProof(proof.proof);
    const reserialized = serializeProof(deserialized);

    expect(constantTimeEqual(reserialized, proof.proof)).toBe(true);
  });

  it('should reject truncated proof bytes', () => {
    expect(() => deserializeProof(new Uint8Array(10))).toThrow('too short');
  });

  it('should reject wrong version', () => {
    const buf = new Uint8Array(MAX_PROOF_BYTES);
    buf[0] = 0xff; // wrong version
    expect(() => deserializeProof(buf)).toThrow('version');
  });

  it('should reject invalid path length', () => {
    const buf = new Uint8Array(MAX_PROOF_BYTES);
    buf[0] = 0x01; // version
    buf[97] = 0; // pathLength = 0 (invalid)
    expect(() => deserializeProof(buf)).toThrow('path length');
  });
});

// ---------------------------------------------------------------------------
// Local verification tests
// ---------------------------------------------------------------------------

describe('Local proof verification', () => {
  it('should accept a valid proof (test 6)', async () => {
    const inputs = createValidInputs();
    const witness = generateWitness(inputs.privateInputs, inputs.publicInputs);
    const proof = await generateWithdrawalProof(witness);

    expect(verifyProofLocally(proof)).toBe(true);
  });

  it('should reject tampered proof — modified nullifier in proof bytes (test 7)', async () => {
    const inputs = createValidInputs();
    const witness = generateWitness(inputs.privateInputs, inputs.publicInputs);
    const proof = await generateWithdrawalProof(witness);

    // Tamper with the nullifierHash inside the serialized proof (offset 1-33)
    const tampered = Uint8Array.from(proof.proof);
    tampered[1] ^= 0xff; // flip bits in first byte of nullifierHash

    const tamperedProof: StarkProof = {
      proof: tampered,
      publicInputs: proof.publicInputs,
    };

    expect(verifyProofLocally(tamperedProof)).toBe(false);
  });

  it('should reject tampered proof — modified root in public inputs (test 8)', async () => {
    const inputs = createValidInputs();
    const witness = generateWitness(inputs.privateInputs, inputs.publicInputs);
    const proof = await generateWithdrawalProof(witness);

    // Tamper with the root in public inputs
    const tamperedPublicInputs: PublicInputs = {
      ...proof.publicInputs,
      root: sha256(new Uint8Array(32).fill(0xab)),
    };

    const tamperedProof: StarkProof = {
      proof: proof.proof,
      publicInputs: tamperedPublicInputs,
    };

    // Should fail because challengeHash was computed with original root,
    // but verifier recomputes challenge with tampered root
    expect(verifyProofLocally(tamperedProof)).toBe(false);
  });

  it('should reject tampered proof — modified challengeHash in proof bytes', async () => {
    const inputs = createValidInputs();
    const witness = generateWitness(inputs.privateInputs, inputs.publicInputs);
    const proof = await generateWithdrawalProof(witness);

    // Tamper with the challengeHash inside the proof (offset 33-65)
    const tampered = Uint8Array.from(proof.proof);
    tampered[33] ^= 0xff;

    const tamperedProof: StarkProof = {
      proof: tampered,
      publicInputs: proof.publicInputs,
    };

    expect(verifyProofLocally(tamperedProof)).toBe(false);
  });

  it('should reject proof with zeroed response', async () => {
    const inputs = createValidInputs();
    const witness = generateWitness(inputs.privateInputs, inputs.publicInputs);
    const proof = await generateWithdrawalProof(witness);

    // Zero out the responseHash (offset 65-97)
    const tampered = Uint8Array.from(proof.proof);
    for (let i = 65; i < 97; i++) {
      tampered[i] = 0;
    }

    const tamperedProof: StarkProof = {
      proof: tampered,
      publicInputs: proof.publicInputs,
    };

    expect(verifyProofLocally(tamperedProof)).toBe(false);
  });

  it('should reject garbage bytes', () => {
    const garbage: StarkProof = {
      proof: new Uint8Array(10), // too short
      publicInputs: {
        nullifierHash: new Uint8Array(32),
        root: new Uint8Array(32),
        recipient: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
        relayerFee: 0n,
      },
    };

    expect(verifyProofLocally(garbage)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Full flow integration test
// ---------------------------------------------------------------------------

describe('Full flow integration', () => {
  it('complete deposit-to-verification flow (test 9)', async () => {
    // Step 1: Create a commitment
    const commitment = createCommitment(POOL_DENOMINATION);

    expect(commitment.secret.length).toBe(32);
    expect(commitment.nullifier.length).toBe(32);
    expect(commitment.commitment.length).toBe(32);
    expect(commitment.nullifierHash.length).toBe(32);

    // Step 2: Insert commitment into the Merkle tree
    const tree = new IncrementalMerkleTree();
    const { root, index } = tree.insert(commitment.commitment);

    expect(index).toBe(0);

    // Step 3: Generate Merkle proof for the inserted leaf
    const merkleProof = tree.generateProof(index);

    expect(merkleProof.pathElements.length).toBe(TREE_DEPTH - 1);
    expect(merkleProof.pathIndices.length).toBe(TREE_DEPTH - 1);

    // Verify the Merkle proof independently
    expect(tree.verifyProof(merkleProof, commitment.commitment, root)).toBe(true);

    // Step 4: Assemble inputs
    const publicInputs: PublicInputs = {
      nullifierHash: commitment.nullifierHash,
      root,
      recipient: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      relayerFee: 100_000n,
    };

    const privateInputs: PrivateInputs = {
      secret: commitment.secret,
      nullifier: commitment.nullifier,
      amount: POOL_DENOMINATION,
      leafIndex: index,
      merklePathElements: merkleProof.pathElements,
      merklePathIndices: merkleProof.pathIndices,
    };

    // Step 5: Generate witness
    const witness = generateWitness(privateInputs, publicInputs);

    expect(constantTimeEqual(witness.commitment, commitment.commitment)).toBe(true);
    expect(constantTimeEqual(witness.computedRoot, root)).toBe(true);

    // Step 6: Generate ZK proof
    const proof = await generateWithdrawalProof(witness);

    expect(proof.proof.length).toBe(MAX_PROOF_BYTES);
    expect(proof.proof[0]).toBe(0x01); // version

    // Step 7: Verify the proof locally
    expect(verifyProofLocally(proof)).toBe(true);

    // Step 8: Verify proof round-trips through serialization
    const deserialized = deserializeProof(proof.proof);
    const reserialized = serializeProof(deserialized);
    expect(constantTimeEqual(reserialized, proof.proof)).toBe(true);
  });

  it('full flow with multiple leaves in the tree', async () => {
    const tree = new IncrementalMerkleTree();

    // Insert several dummy leaves before and after the target to
    // exercise proof generation in a populated tree.
    const commitments: ReturnType<typeof createCommitment>[] = [];
    for (let i = 0; i < 8; i++) {
      commitments.push(createCommitment(POOL_DENOMINATION));
    }

    // Our target is the 6th commitment (index 5)
    const target = commitments[5]!;

    // Insert all leaves
    for (const c of commitments) {
      tree.insert(c.commitment);
    }

    const currentRoot = Uint8Array.from(tree.root);

    // Generate Merkle proof for the target
    const merkleProof = tree.generateProof(5);

    // Verify Merkle proof against current root
    expect(tree.verifyProof(merkleProof, target.commitment, currentRoot)).toBe(true);

    const publicInputs: PublicInputs = {
      nullifierHash: target.nullifierHash,
      root: currentRoot,
      recipient: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
      relayerFee: 50_000n,
    };

    const privateInputs: PrivateInputs = {
      secret: target.secret,
      nullifier: target.nullifier,
      amount: POOL_DENOMINATION,
      leafIndex: 5,
      merklePathElements: merkleProof.pathElements,
      merklePathIndices: merkleProof.pathIndices,
    };

    const witness = generateWitness(privateInputs, publicInputs);
    const proof = await generateWithdrawalProof(witness);

    expect(verifyProofLocally(proof)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Recipient binding tests
// ---------------------------------------------------------------------------

describe('Proof recipient binding', () => {
  it('changing recipient should invalidate proof (test 10)', async () => {
    const inputs = createValidInputs();
    const witness = generateWitness(inputs.privateInputs, inputs.publicInputs);
    const proof = await generateWithdrawalProof(witness);

    // Proof is valid with original recipient
    expect(verifyProofLocally(proof)).toBe(true);

    // Change recipient in public inputs
    const tamperedProof: StarkProof = {
      proof: proof.proof,
      publicInputs: {
        ...proof.publicInputs,
        recipient: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
      },
    };

    // Should fail because Fiat-Shamir challenge was computed with
    // original recipient
    expect(verifyProofLocally(tamperedProof)).toBe(false);
  });

  it('changing relayerFee should invalidate proof', async () => {
    const inputs = createValidInputs();
    const witness = generateWitness(inputs.privateInputs, inputs.publicInputs);
    const proof = await generateWithdrawalProof(witness);

    expect(verifyProofLocally(proof)).toBe(true);

    const tamperedProof: StarkProof = {
      proof: proof.proof,
      publicInputs: {
        ...proof.publicInputs,
        relayerFee: 999_999n,
      },
    };

    expect(verifyProofLocally(tamperedProof)).toBe(false);
  });

  it('changing nullifierHash in public inputs should invalidate proof', async () => {
    const inputs = createValidInputs();
    const witness = generateWitness(inputs.privateInputs, inputs.publicInputs);
    const proof = await generateWithdrawalProof(witness);

    expect(verifyProofLocally(proof)).toBe(true);

    const tamperedProof: StarkProof = {
      proof: proof.proof,
      publicInputs: {
        ...proof.publicInputs,
        nullifierHash: sha256(randomBytes(32)),
      },
    };

    expect(verifyProofLocally(tamperedProof)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Challenge computation tests
// ---------------------------------------------------------------------------

describe('Fiat-Shamir challenge', () => {
  it('should be deterministic for the same inputs', () => {
    const { publicInputs } = createValidInputs();
    const c1 = computeChallenge(publicInputs);
    const c2 = computeChallenge(publicInputs);

    expect(constantTimeEqual(c1, c2)).toBe(true);
  });

  it('should differ for different recipients', () => {
    const { publicInputs } = createValidInputs();
    const c1 = computeChallenge(publicInputs);

    const modified = { ...publicInputs, recipient: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG' };
    const c2 = computeChallenge(modified);

    expect(constantTimeEqual(c1, c2)).toBe(false);
  });

  it('should differ for different fees', () => {
    const { publicInputs } = createValidInputs();
    const c1 = computeChallenge(publicInputs);

    const modified = { ...publicInputs, relayerFee: 12345n };
    const c2 = computeChallenge(modified);

    expect(constantTimeEqual(c1, c2)).toBe(false);
  });

  it('should differ for different roots', () => {
    const { publicInputs } = createValidInputs();
    const c1 = computeChallenge(publicInputs);

    const modified = { ...publicInputs, root: sha256(new Uint8Array(32).fill(0xee)) };
    const c2 = computeChallenge(modified);

    expect(constantTimeEqual(c1, c2)).toBe(false);
  });

  it('should differ for different nullifierHashes', () => {
    const { publicInputs } = createValidInputs();
    const c1 = computeChallenge(publicInputs);

    const modified = {
      ...publicInputs,
      nullifierHash: sha256(randomBytes(32)),
    };
    const c2 = computeChallenge(modified);

    expect(constantTimeEqual(c1, c2)).toBe(false);
  });
});
