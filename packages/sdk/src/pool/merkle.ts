/**
 * Client-side incremental Merkle tree that mirrors the on-chain
 * merkle-tree.clar contract.
 *
 * This implementation MUST produce identical roots to the Clarity
 * contract for any sequence of leaf insertions. It uses:
 *   - SHA-256 as the hash function
 *   - The same pre-computed zero hashes (from constants.ts)
 *   - The same frontier-based incremental insertion algorithm
 *
 * The tree has depth 20, supporting up to 2^20 = 1,048,576 leaves.
 * Empty subtrees are represented by pre-computed zero hashes.
 *
 * IMPORTANT DESIGN NOTE:
 * The Clarity contract uses a non-standard tree structure where:
 *   - Frontier level 0 stores raw leaves (no hashing)
 *   - Zero hashes start from sha256(ZERO_VALUE) at level 0
 *   - compute-root-level uses zero hashes indexed by Clarity level
 *
 * This means the tree's root computation involves (depth - 1) hash
 * operations from a leaf to the root, and the zero hash at each
 * Clarity level k in compute-root-level is ZH[k], not the zero hash
 * of a subtree at level k-1.
 *
 * For proof generation and verification, we reproduce the exact root
 * computation by replaying the Clarity algorithm. The proof has
 * (depth - 1) path elements corresponding to the (depth - 1)
 * hashing steps from leaf to root.
 */

import { sha256 } from '@noble/hashes/sha256';
import { concatBytes, constantTimeEqual } from '../utils/crypto.js';
import { TREE_DEPTH, MAX_LEAVES, getZeroHashes, getEmptyRoot } from '../utils/constants.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MerkleProof {
  /**
   * Sibling hashes along the path from leaf to root.
   * Length = depth - 1 (19 for TREE_DEPTH=20).
   *
   * Each element is the hash that gets combined with the current
   * running hash at that proof step to produce the next level's hash.
   */
  pathElements: Uint8Array[];

  /**
   * Direction indicators for each proof step.
   * 0 = current hash is on the left, sibling on the right.
   * 1 = current hash is on the right, sibling on the left.
   *
   * These correspond to the bit pattern of the leaf index in the
   * Clarity tree's level structure.
   */
  pathIndices: number[];
}

// ---------------------------------------------------------------------------
// IncrementalMerkleTree
// ---------------------------------------------------------------------------

export class IncrementalMerkleTree {
  /** Tree depth (number of frontier levels). */
  readonly depth: number;

  /** Pre-computed hashes of empty subtrees at each level. */
  readonly zeroHashes: Uint8Array[];

  /**
   * Frontier array: one hash per level (0..depth-1).
   * frontier[i] holds the rightmost filled node at level i.
   * Initialized to zero hashes (empty frontier).
   */
  frontier: Uint8Array[];

  /** All inserted leaves, in order. Used for proof generation. */
  leaves: Uint8Array[];

  /** Current Merkle root. */
  root: Uint8Array;

  /** Index of the next leaf to be inserted. */
  nextIndex: number;

  constructor(depth: number = TREE_DEPTH) {
    this.depth = depth;
    this.zeroHashes = getZeroHashes().slice(0, depth);
    this.frontier = this.zeroHashes.map((h) => Uint8Array.from(h));
    this.leaves = [];
    this.root = Uint8Array.from(getEmptyRoot());
    this.nextIndex = 0;
  }

  /**
   * Insert a leaf into the tree, updating the frontier and root.
   *
   * This mirrors the Clarity `append-leaf` function exactly:
   *   1. Walk up from the leaf level. At each level:
   *      - If bit is 0: store current hash as frontier, mark done.
   *      - If bit is 1: hash frontier[level] || current_hash, continue.
   *   2. After the walk, compute the root from the stored level upward,
   *      hashing with zero hashes as needed.
   *
   * @param leaf - 32-byte leaf hash (commitment hash)
   * @returns The new root and the index where the leaf was inserted
   * @throws {Error} If the tree is full
   */
  insert(leaf: Uint8Array): { root: Uint8Array; index: number } {
    if (leaf.length !== 32) {
      throw new Error(`Leaf must be 32 bytes, got ${leaf.length}`);
    }
    if (this.nextIndex >= MAX_LEAVES) {
      throw new Error('Merkle tree is full');
    }

    const leafIndex = this.nextIndex;
    this.leaves.push(Uint8Array.from(leaf));

    // Phase 1: Walk up and update the frontier (mirrors process-level fold)
    let currentHash: Uint8Array = Uint8Array.from(leaf);
    let storedLevel = -1;

    for (let level = 0; level < this.depth; level++) {
      const bitAtLevel = (leafIndex >> level) & 1;

      if (bitAtLevel === 0) {
        // Bit is 0: store current hash as frontier at this level and stop
        this.frontier[level] = Uint8Array.from(currentHash);
        storedLevel = level;
        break;
      } else {
        // Bit is 1: hash frontier[level] || current_hash and continue up
        const left = this.frontier[level]!;
        currentHash = sha256(concatBytes(left, currentHash));
      }
    }

    // Defensive: should never happen for valid indices < 2^depth
    if (storedLevel === -1) {
      storedLevel = this.depth - 1;
      this.frontier[storedLevel] = Uint8Array.from(currentHash);
    }

    // Phase 2: Compute the root from storedLevel upward
    let rootHash: Uint8Array = this.frontier[storedLevel]!;

    for (let level = storedLevel + 1; level < this.depth; level++) {
      const bitAtLevel = (leafIndex >> level) & 1;
      const zero = this.zeroHashes[level]!;

      if (bitAtLevel === 0) {
        rootHash = sha256(concatBytes(rootHash, zero));
      } else {
        rootHash = sha256(concatBytes(zero, rootHash));
      }
    }

    this.root = Uint8Array.from(rootHash);
    this.nextIndex = leafIndex + 1;

    return {
      root: Uint8Array.from(this.root),
      index: leafIndex,
    };
  }

  /**
   * Generate a Merkle proof for a leaf at the given index.
   *
   * The proof allows verifying that a specific leaf is included in the
   * tree that produced the current root. The proof consists of sibling
   * hashes at each level and direction bits.
   *
   * The proof has (depth - 1) elements because the Clarity tree's root
   * is computed with (depth - 1) hash operations from a raw leaf.
   *
   * @param leafIndex - Index of the leaf to prove
   * @returns Merkle proof with path elements and indices
   * @throws {Error} If the leaf index is out of bounds
   */
  generateProof(leafIndex: number): MerkleProof {
    if (leafIndex < 0 || leafIndex >= this.nextIndex) {
      throw new Error(
        `Leaf index ${leafIndex} out of bounds [0, ${this.nextIndex - 1}]`,
      );
    }

    const pathElements: Uint8Array[] = [];
    const pathIndices: number[] = [];

    // Build the tree layer-by-layer from the leaves.
    //
    // CRITICAL: The Clarity tree uses a shifted zero-hash scheme. At each
    // tree level k, the default for an empty node is ZH[k+1] (not ZH[k]).
    // This is because the Clarity frontier stores raw leaves at level 0,
    // and its zero hash chain starts with ZH[0] = sha256(ZERO_VALUE),
    // meaning ZH[0] represents a hashed empty leaf, not a raw empty leaf.
    //
    // When building the tree bottom-up:
    //   - Tree level 0 = raw leaves (commitment hashes)
    //   - Empty leaf at level 0 defaults to ZH[1] for combining purposes
    //     (because ZH[1] is what the Clarity algorithm uses as the default
    //     sibling when hashing at Clarity level 1, which corresponds to
    //     tree level 0 in our framework)
    //   - More generally: the default at tree level k = ZH[k+1]
    //
    // This ensures the proof root matches the Clarity insert root.

    let currentLayerNodes = new Map<number, Uint8Array>();
    for (let i = 0; i < this.leaves.length; i++) {
      currentLayerNodes.set(i, this.leaves[i]!);
    }

    for (let level = 0; level < this.depth - 1; level++) {
      const nodeIdx = leafIndex >> level;
      const isRight = nodeIdx & 1;
      const siblingIdx = nodeIdx ^ 1;

      // The zero hash for empty nodes at this level is ZH[level + 1],
      // matching the Clarity algorithm's use of get-zero-hash(level)
      // at compute-root-level where Clarity's level = our level + 1.
      const zeroAtLevel = this.zeroHashes[level + 1]!;

      const sibling = currentLayerNodes.get(siblingIdx) ?? zeroAtLevel;
      pathElements.push(Uint8Array.from(sibling));
      pathIndices.push(isRight);

      // Build next layer
      const nextLayerNodes = new Map<number, Uint8Array>();
      const parentsSeen = new Set<number>();

      for (const idx of currentLayerNodes.keys()) {
        const parentIdx = idx >> 1;
        if (parentsSeen.has(parentIdx)) continue;
        parentsSeen.add(parentIdx);

        const leftIdx = parentIdx << 1;
        const rightIdx = leftIdx | 1;
        const left = currentLayerNodes.get(leftIdx) ?? zeroAtLevel;
        const right = currentLayerNodes.get(rightIdx) ?? zeroAtLevel;
        nextLayerNodes.set(parentIdx, sha256(concatBytes(left, right)));
      }

      currentLayerNodes = nextLayerNodes;
    }

    return { pathElements, pathIndices };
  }

  /**
   * Verify a Merkle proof against a leaf and root.
   *
   * Starting from the leaf hash, walk up the tree using the proof
   * siblings and direction indicators. If the computed root matches
   * the expected root, the proof is valid.
   *
   * @param proof - The Merkle proof to verify
   * @param leaf - 32-byte leaf hash
   * @param root - 32-byte expected root
   * @returns true if the proof is valid
   */
  verifyProof(proof: MerkleProof, leaf: Uint8Array, root: Uint8Array): boolean {
    const proofLen = this.depth - 1;
    if (proof.pathElements.length !== proofLen) {
      return false;
    }
    if (proof.pathIndices.length !== proofLen) {
      return false;
    }

    let currentHash: Uint8Array = Uint8Array.from(leaf);

    for (let i = 0; i < proofLen; i++) {
      const sibling = proof.pathElements[i]!;
      const isRight = proof.pathIndices[i]!;

      if (isRight) {
        currentHash = sha256(concatBytes(sibling, currentHash));
      } else {
        currentHash = sha256(concatBytes(currentHash, sibling));
      }
    }

    return constantTimeEqual(currentHash, root);
  }
}

/**
 * Static utility: verify a Merkle proof without instantiating a tree.
 *
 * Useful for verifying proofs received from other sources.
 */
export function verifyMerkleProof(
  proof: MerkleProof,
  leaf: Uint8Array,
  root: Uint8Array,
  depth: number = TREE_DEPTH,
): boolean {
  const proofLen = depth - 1;
  if (proof.pathElements.length !== proofLen) return false;
  if (proof.pathIndices.length !== proofLen) return false;

  let currentHash: Uint8Array = Uint8Array.from(leaf);

  for (let i = 0; i < proofLen; i++) {
    const sibling = proof.pathElements[i]!;
    const isRight = proof.pathIndices[i]!;

    if (isRight) {
      currentHash = sha256(concatBytes(sibling, currentHash));
    } else {
      currentHash = sha256(concatBytes(currentHash, sibling));
    }
  }

  return constantTimeEqual(currentHash, root);
}
