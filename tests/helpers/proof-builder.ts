// proof-builder.ts - Constructs valid STARK proofs for testing
//
// This module mirrors the exact verification logic in proof-verifier.clar,
// computing SHA256 hashes, Fiat-Shamir challenges, Merkle trees, and
// evaluation consistency checks identically to the on-chain verifier.
//
// Updated for the upgraded verifier that requires:
//   - trace-root == public Merkle root (binds proof to on-chain tree)
//   - constraint-eval = sha256(trace-eval || nullifier || challenge)
//   - fri-eval = sha256(constraint-eval || trace-eval || nullifier)
//
// Used by pool-v1 and integration tests that need valid proofs.

import { createHash } from "crypto";
import { Cl, serializeCV } from "@stacks/transactions";

// ============================================================================
// Low-level helpers
// ============================================================================

export function sha256(data: Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(data).digest());
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// ============================================================================
// Clarity consensus serialization
// ============================================================================

function claritySerializePrincipal(principal: string): Uint8Array {
  const cv = Cl.standardPrincipal(principal);
  return hexToBytes(serializeCV(cv));
}

function claritySerializeUint(value: number): Uint8Array {
  const cv = Cl.uint(value);
  return hexToBytes(serializeCV(cv));
}

// ============================================================================
// Fiat-Shamir (mirrors contract logic)
// ============================================================================

function buildPublicInputHash(
  nullifier: string,
  root: string,
  recipientAddr: string,
  relayerFee: number,
): Uint8Array {
  const nullifierBytes = hexToBytes(nullifier);
  const rootBytes = hexToBytes(root);
  const recipientHash = sha256(claritySerializePrincipal(recipientAddr));
  const feeHash = sha256(claritySerializeUint(relayerFee));
  return sha256(concatBytes(nullifierBytes, rootBytes, recipientHash, feeHash));
}

function computeChallenge(
  transcriptHash: Uint8Array,
  commitment: Uint8Array,
): Uint8Array {
  return sha256(concatBytes(transcriptHash, commitment));
}

// ============================================================================
// Merkle tree (depth 8, 256 leaves)
// ============================================================================

function buildMerkleTree(leaves: Uint8Array[]): {
  root: Uint8Array;
  getAuthPath: (index: number) => Uint8Array[];
} {
  const paddedLeaves = [...leaves];
  const zeroLeaf = new Uint8Array(32);
  while (paddedLeaves.length < 256) {
    paddedLeaves.push(zeroLeaf);
  }

  const layers: Uint8Array[][] = [paddedLeaves];
  let currentLayer = paddedLeaves;

  for (let depth = 0; depth < 8; depth++) {
    const nextLayer: Uint8Array[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      nextLayer.push(sha256(concatBytes(currentLayer[i], currentLayer[i + 1])));
    }
    layers.push(nextLayer);
    currentLayer = nextLayer;
  }

  const root = layers[8][0];

  function getAuthPath(index: number): Uint8Array[] {
    const path: Uint8Array[] = [];
    let idx = index;
    for (let depth = 0; depth < 8; depth++) {
      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      path.push(layers[depth][siblingIdx]);
      idx = Math.floor(idx / 2);
    }
    return path;
  }

  return { root, getAuthPath };
}

// ============================================================================
// Proof construction
// ============================================================================

// Build a valid proof buffer that passes the on-chain Clarity verifier.
//
// Protocol (upgraded verifier):
//   1. trace-root = public root (verifier asserts trace-root == root)
//   2. constraint-root = sha256(trace-root)
//   3. challenge = sha256(sha256(public-inputs || trace-root) || constraint-root)
//   4. For each query:
//      - trace-eval is a leaf; auth path verifies against trace-root
//      - constraint-eval = sha256(trace-eval || nullifier || challenge)
//      - fri-eval = sha256(constraint-eval || trace-eval || nullifier)
//   5. fri-remainder = sha256(challenge || trace-root || constraint-root)
//
// Since trace-root must equal the public root, and the verifier checks
// Merkle auth paths against trace-root, we build our internal tree and
// use its root as BOTH the trace-root and the public root that the
// caller passes to the verifier.
//
// Returns { proofHex, traceRoot } where traceRoot should be used as the
// `root` public input when calling the verifier.
export function buildValidProofWithRoot(
  nullifier: string,
  recipientAddr: string,
  relayerFee: number,
  numQueries: number = 1,
): { proofHex: string; traceRoot: string } {
  const nullifierBytes = hexToBytes(nullifier);

  // Generate 256 deterministic trace evaluations
  const traceEvals: Uint8Array[] = [];
  for (let i = 0; i < 256; i++) {
    const seed = concatBytes(
      nullifierBytes,
      new Uint8Array([i & 0xff, (i >> 8) & 0xff, 0, 0]),
    );
    traceEvals.push(sha256(seed));
  }

  // Build Merkle tree -- trace-root IS this tree's root
  const tree = buildMerkleTree(traceEvals);
  const traceRoot = tree.root;
  const traceRootHex = bytesToHex(traceRoot);
  // constraint-root = sha256(trace-root || public-root)
  // Since in this helper, traceRoot IS used as the public root:
  const constraintRoot = sha256(concatBytes(traceRoot, traceRoot));

  // Fiat-Shamir challenge using the tree root as both trace-root and public root
  const publicInputHash = buildPublicInputHash(
    nullifier,
    traceRootHex,
    recipientAddr,
    relayerFee,
  );
  const step1 = computeChallenge(publicInputHash, traceRoot);
  const challenge = computeChallenge(step1, constraintRoot);

  // Query indices
  const queryIndices: number[] = [];
  for (let q = 0; q < numQueries; q++) {
    queryIndices.push(challenge[q]);
  }

  // Build query blocks with nullifier-bound evaluations
  const queryBlocks: Uint8Array[] = [];
  for (let q = 0; q < numQueries; q++) {
    const idx = queryIndices[q];
    const traceEval = traceEvals[idx];
    // constraint-eval = sha256(trace-eval || nullifier || challenge)
    const constraintEval = sha256(concatBytes(traceEval, nullifierBytes, challenge));
    // fri-eval = sha256(constraint-eval || trace-eval || nullifier)
    const friEval = sha256(concatBytes(constraintEval, traceEval, nullifierBytes));
    const authPath = tree.getAuthPath(idx);

    const parts: Uint8Array[] = [traceEval, constraintEval, friEval];
    for (let s = 0; s < 8; s++) {
      parts.push(authPath[s]);
    }
    parts.push(new Uint8Array([idx]));
    queryBlocks.push(concatBytes(...parts));
  }

  // FRI remainder
  const friRemainder = sha256(
    concatBytes(challenge, traceRoot, constraintRoot),
  );

  // Serialize
  const proof = concatBytes(
    new Uint8Array([0x00, 0x00, 0x00, 0x01]),
    traceRoot,
    constraintRoot,
    new Uint8Array([numQueries]),
    ...queryBlocks,
    friRemainder,
  );

  return { proofHex: bytesToHex(proof), traceRoot: traceRootHex };
}

// Legacy API: build a proof using a caller-provided root.
// Since the verifier now requires trace-root == public root, this function
// sets trace-root to the provided root. Auth paths are computed against
// an internal tree, which means the Merkle auth check will only pass if
// the provided root happens to equal the internal tree's root.
//
// For tests that need exact root matching, use buildValidProofWithRoot()
// and register the returned traceRoot as a known root in the Merkle tree.
export function buildValidProof(
  nullifier: string,
  root: string,
  recipientAddr: string,
  relayerFee: number,
  numQueries: number = 1,
): string {
  const nullifierBytes = hexToBytes(nullifier);
  const rootBytes = hexToBytes(root);

  // Generate 256 deterministic trace evaluations
  const traceEvals: Uint8Array[] = [];
  for (let i = 0; i < 256; i++) {
    const seed = concatBytes(
      nullifierBytes,
      new Uint8Array([i & 0xff, (i >> 8) & 0xff, 0, 0]),
    );
    traceEvals.push(sha256(seed));
  }

  // Build Merkle tree for auth paths
  const tree = buildMerkleTree(traceEvals);
  const traceRoot = tree.root;
  // constraint-root = sha256(trace-root || public-root)
  const constraintRoot = sha256(concatBytes(traceRoot, rootBytes));

  // Fiat-Shamir challenge
  const publicInputHash = buildPublicInputHash(
    nullifier,
    root,
    recipientAddr,
    relayerFee,
  );
  const step1 = computeChallenge(publicInputHash, traceRoot);
  const challenge = computeChallenge(step1, constraintRoot);

  // Query indices
  const queryIndices: number[] = [];
  for (let q = 0; q < numQueries; q++) {
    queryIndices.push(challenge[q]);
  }

  // Build query blocks with nullifier-bound evaluations
  const queryBlocks: Uint8Array[] = [];
  for (let q = 0; q < numQueries; q++) {
    const idx = queryIndices[q];
    const traceEval = traceEvals[idx];
    // constraint-eval = sha256(trace-eval || nullifier || challenge)
    const constraintEval = sha256(concatBytes(traceEval, nullifierBytes, challenge));
    // fri-eval = sha256(constraint-eval || trace-eval || nullifier)
    const friEval = sha256(concatBytes(constraintEval, traceEval, nullifierBytes));
    const authPath = tree.getAuthPath(idx);

    const parts: Uint8Array[] = [traceEval, constraintEval, friEval];
    for (let s = 0; s < 8; s++) {
      parts.push(authPath[s]);
    }
    parts.push(new Uint8Array([idx]));
    queryBlocks.push(concatBytes(...parts));
  }

  // FRI remainder
  const friRemainder = sha256(
    concatBytes(challenge, traceRoot, constraintRoot),
  );

  // Serialize
  const proof = concatBytes(
    new Uint8Array([0x00, 0x00, 0x00, 0x01]),
    traceRoot,
    constraintRoot,
    new Uint8Array([numQueries]),
    ...queryBlocks,
    friRemainder,
  );

  return bytesToHex(proof);
}
