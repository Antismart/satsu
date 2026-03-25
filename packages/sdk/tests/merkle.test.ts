/**
 * Tests for the client-side incremental Merkle tree.
 *
 * Verifies that:
 *   - Empty tree has the correct EMPTY_ROOT
 *   - Single leaf insertion produces the correct root
 *   - Zero hashes match the contract constants
 *   - Proof generation and verification work correctly
 *   - Multiple insertions produce consistent roots
 *   - The tree matches the on-chain merkle-tree.clar contract behavior
 */

import { describe, it, expect } from 'vitest';
import { sha256 } from '@noble/hashes/sha256';
import { concatBytes } from '@noble/hashes/utils';
import { IncrementalMerkleTree, verifyMerkleProof } from '../src/pool/merkle.js';
import {
  TREE_DEPTH,
  getZeroHashes,
  getEmptyRoot,
  ZERO_HASHES_HEX,
  EMPTY_ROOT_HEX,
} from '../src/utils/constants.js';
import { bytesToHex, hexToBytes } from '../src/utils/crypto.js';

describe('Zero Hashes', () => {
  it('should have exactly 20 zero hashes', () => {
    expect(ZERO_HASHES_HEX.length).toBe(20);
    expect(getZeroHashes().length).toBe(20);
  });

  it('ZERO_HASH[0] should be sha256 of 32 zero bytes', () => {
    const zeroValue = new Uint8Array(32); // 32 zero bytes
    const expected = sha256(zeroValue);
    const actual = getZeroHashes()[0]!;

    expect(bytesToHex(actual)).toBe(ZERO_HASHES_HEX[0]);
    expect(actual).toEqual(expected);
  });

  it('each ZERO_HASH[n] should be sha256(ZERO_HASH[n-1] || ZERO_HASH[n-1])', () => {
    const zeroHashes = getZeroHashes();

    for (let i = 1; i < zeroHashes.length; i++) {
      const prev = zeroHashes[i - 1]!;
      const expected = sha256(concatBytes(prev, prev));
      expect(bytesToHex(zeroHashes[i]!)).toBe(bytesToHex(expected));
    }
  });

  it('EMPTY_ROOT should be sha256(ZERO_HASH[19] || ZERO_HASH[19])', () => {
    const zeroHashes = getZeroHashes();
    const zh19 = zeroHashes[19]!;
    const expected = sha256(concatBytes(zh19, zh19));

    expect(bytesToHex(getEmptyRoot())).toBe(EMPTY_ROOT_HEX);
    expect(getEmptyRoot()).toEqual(expected);
  });
});

describe('IncrementalMerkleTree', () => {
  it('should initialize with EMPTY_ROOT', () => {
    const tree = new IncrementalMerkleTree();
    expect(bytesToHex(tree.root)).toBe(EMPTY_ROOT_HEX);
    expect(tree.nextIndex).toBe(0);
    expect(tree.depth).toBe(TREE_DEPTH);
  });

  it('should update root after inserting a leaf', () => {
    const tree = new IncrementalMerkleTree();
    const leaf = sha256(new Uint8Array(32).fill(1));

    const { root, index } = tree.insert(leaf);

    expect(index).toBe(0);
    expect(bytesToHex(root)).not.toBe(EMPTY_ROOT_HEX);
    expect(tree.nextIndex).toBe(1);
  });

  it('should match the Clarity contract for single leaf insertion', () => {
    // Reproduce the Clarity append-leaf logic for leaf at index 0:
    // process-level stores at level 0 (bit=0), then compute-root-level
    // hashes from level 1 to 19 using zero hashes.
    const tree = new IncrementalMerkleTree();
    const leaf = sha256(new Uint8Array(32).fill(0x42));

    const { root } = tree.insert(leaf);

    // Manually compute expected root
    const zeroHashes = getZeroHashes();
    let expectedHash = Uint8Array.from(leaf);

    for (let level = 1; level < TREE_DEPTH; level++) {
      expectedHash = sha256(concatBytes(expectedHash, zeroHashes[level]!));
    }

    expect(bytesToHex(root)).toBe(bytesToHex(expectedHash));
  });

  it('should match Clarity for two leaf insertions', () => {
    const tree = new IncrementalMerkleTree();
    const zeroHashes = getZeroHashes();

    const leaf0 = sha256(new Uint8Array(32).fill(0x01));
    const leaf1 = sha256(new Uint8Array(32).fill(0x02));

    tree.insert(leaf0);
    const { root } = tree.insert(leaf1);

    // For leaf1 at index 1:
    // process-level: level 0 bit=1, hash = sha256(leaf0 || leaf1), level 1 bit=0, store
    // compute-root-level: sha256(sha256(leaf0||leaf1) || ZH[2]), etc.
    let expected = sha256(concatBytes(leaf0, leaf1));
    for (let level = 2; level < TREE_DEPTH; level++) {
      expected = sha256(concatBytes(expected, zeroHashes[level]!));
    }

    expect(bytesToHex(root)).toBe(bytesToHex(expected));
  });

  it('should produce different roots for different leaves', () => {
    const tree1 = new IncrementalMerkleTree();
    const tree2 = new IncrementalMerkleTree();

    tree1.insert(sha256(new Uint8Array(32).fill(1)));
    tree2.insert(sha256(new Uint8Array(32).fill(2)));

    expect(bytesToHex(tree1.root)).not.toBe(bytesToHex(tree2.root));
  });

  it('should reject non-32-byte leaves', () => {
    const tree = new IncrementalMerkleTree();
    expect(() => tree.insert(new Uint8Array(16))).toThrow('32 bytes');
  });

  it('should track nextIndex correctly', () => {
    const tree = new IncrementalMerkleTree();

    for (let i = 0; i < 5; i++) {
      const { index } = tree.insert(sha256(new Uint8Array(32).fill(i)));
      expect(index).toBe(i);
    }

    expect(tree.nextIndex).toBe(5);
    expect(tree.leaves.length).toBe(5);
  });
});

describe('Merkle Proof Generation & Verification', () => {
  const PROOF_LENGTH = TREE_DEPTH - 1;

  it('should generate and verify a proof for a single leaf', () => {
    const tree = new IncrementalMerkleTree();
    const leaf = sha256(new Uint8Array(32).fill(0x42));

    const { root } = tree.insert(leaf);
    const proof = tree.generateProof(0);

    expect(proof.pathElements.length).toBe(PROOF_LENGTH);
    expect(proof.pathIndices.length).toBe(PROOF_LENGTH);

    // For index 0, all path indices should be 0 (leaf is always left)
    expect(proof.pathIndices.every((idx) => idx === 0)).toBe(true);

    // Verify the proof
    expect(tree.verifyProof(proof, leaf, root)).toBe(true);
  });

  it('should generate and verify proofs for two leaves', () => {
    const tree = new IncrementalMerkleTree();
    const leaf0 = sha256(new Uint8Array(32).fill(0x10));
    const leaf1 = sha256(new Uint8Array(32).fill(0x20));

    tree.insert(leaf0);
    tree.insert(leaf1);

    const currentRoot = Uint8Array.from(tree.root);

    // Proof for leaf 0
    const proof0 = tree.generateProof(0);
    expect(proof0.pathElements.length).toBe(PROOF_LENGTH);
    expect(tree.verifyProof(proof0, leaf0, currentRoot)).toBe(true);

    // Proof for leaf 1
    const proof1 = tree.generateProof(1);
    expect(proof1.pathElements.length).toBe(PROOF_LENGTH);
    expect(tree.verifyProof(proof1, leaf1, currentRoot)).toBe(true);
  });

  it('should generate and verify proofs for multiple leaves', () => {
    const tree = new IncrementalMerkleTree();
    const leaves: Uint8Array[] = [];

    // Insert 8 leaves
    for (let i = 0; i < 8; i++) {
      const leaf = sha256(new Uint8Array(32).fill(i));
      leaves.push(leaf);
      tree.insert(leaf);
    }

    const currentRoot = Uint8Array.from(tree.root);

    // Verify proof for each leaf
    for (let i = 0; i < 8; i++) {
      const proof = tree.generateProof(i);
      expect(tree.verifyProof(proof, leaves[i]!, currentRoot)).toBe(true);
    }
  });

  it('should fail verification with wrong leaf', () => {
    const tree = new IncrementalMerkleTree();
    const leaf = sha256(new Uint8Array(32).fill(1));
    const wrongLeaf = sha256(new Uint8Array(32).fill(2));

    const { root } = tree.insert(leaf);
    const proof = tree.generateProof(0);

    expect(tree.verifyProof(proof, wrongLeaf, root)).toBe(false);
  });

  it('should fail verification with wrong root', () => {
    const tree = new IncrementalMerkleTree();
    const leaf = sha256(new Uint8Array(32).fill(1));

    tree.insert(leaf);
    const proof = tree.generateProof(0);

    const wrongRoot = sha256(new Uint8Array(32).fill(99));
    expect(tree.verifyProof(proof, leaf, wrongRoot)).toBe(false);
  });

  it('should throw for out-of-bounds leaf index', () => {
    const tree = new IncrementalMerkleTree();
    tree.insert(sha256(new Uint8Array(32).fill(1)));

    expect(() => tree.generateProof(-1)).toThrow('out of bounds');
    expect(() => tree.generateProof(1)).toThrow('out of bounds');
  });

  it('verifyMerkleProof static function should work', () => {
    const tree = new IncrementalMerkleTree();
    const leaf = sha256(new Uint8Array(32).fill(0x55));

    const { root } = tree.insert(leaf);
    const proof = tree.generateProof(0);

    expect(verifyMerkleProof(proof, leaf, root)).toBe(true);
    expect(
      verifyMerkleProof(proof, sha256(new Uint8Array(32).fill(0x66)), root),
    ).toBe(false);
  });
});

describe('Merkle Tree Root Computation (detailed)', () => {
  it('should compute the correct root for index 0', () => {
    const tree = new IncrementalMerkleTree();
    const leaf = hexToBytes(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );

    const { root } = tree.insert(leaf);

    // At index 0: stored at level 0, hash through levels 1-19
    const zeroHashes = getZeroHashes();
    let expected = Uint8Array.from(leaf);
    for (let level = 1; level < TREE_DEPTH; level++) {
      expected = sha256(concatBytes(expected, zeroHashes[level]!));
    }

    expect(bytesToHex(root)).toBe(bytesToHex(expected));
  });

  it('should compute the correct root for index 1', () => {
    const tree = new IncrementalMerkleTree();
    const zeroHashes = getZeroHashes();

    const leaf0 = hexToBytes(
      '1111111111111111111111111111111111111111111111111111111111111111',
    );
    const leaf1 = hexToBytes(
      '2222222222222222222222222222222222222222222222222222222222222222',
    );

    tree.insert(leaf0);
    const { root } = tree.insert(leaf1);

    // At index 1: process-level hashes leaf0 || leaf1 at level 0,
    // stores at level 1, then compute-root-level from level 2 to 19
    let expected = sha256(concatBytes(leaf0, leaf1));
    for (let level = 2; level < TREE_DEPTH; level++) {
      expected = sha256(concatBytes(expected, zeroHashes[level]!));
    }

    expect(bytesToHex(root)).toBe(bytesToHex(expected));
  });

  it('root after 4 leaves should be consistent', () => {
    const tree = new IncrementalMerkleTree();
    const zeroHashes = getZeroHashes();

    const leaves = [0x11, 0x22, 0x33, 0x44].map((b) =>
      sha256(new Uint8Array(32).fill(b)),
    );

    for (const leaf of leaves) {
      tree.insert(leaf);
    }

    // After 4 leaves (index 3, binary 11):
    // process-level for leaf3:
    //   Level 0: bit=1, hash = sha256(frontier[0] || leaf3) = sha256(leaf2 || leaf3)
    //   Level 1: bit=1, hash = sha256(frontier[1] || hash) = sha256(sha256(leaf0||leaf1) || sha256(leaf2||leaf3))
    //   Level 2: bit=0, store, done
    // compute-root-level from level 3 to 19
    const h01 = sha256(concatBytes(leaves[0]!, leaves[1]!));
    const h23 = sha256(concatBytes(leaves[2]!, leaves[3]!));
    let expected = sha256(concatBytes(h01, h23));
    for (let level = 3; level < TREE_DEPTH; level++) {
      expected = sha256(concatBytes(expected, zeroHashes[level]!));
    }

    expect(bytesToHex(tree.root)).toBe(bytesToHex(expected));
  });
});
