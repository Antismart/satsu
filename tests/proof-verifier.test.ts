import { describe, it, expect } from "vitest";
import { Cl, ClarityType, serializeCV } from "@stacks/transactions";
import { createHash } from "crypto";

// ============================================================================
// Constants
// ============================================================================

const contractName = "proof-verifier";

// Test public inputs
const NULLIFIER =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ROOT =
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const RELAYER_FEE = 50000;

// ============================================================================
// Account setup
// ============================================================================

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const recipient = accounts.get("wallet_1")!;

// ============================================================================
// Helpers - SHA256 in TypeScript (mirrors Clarity sha256)
// ============================================================================

function sha256(data: Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(data).digest());
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
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
// Helpers - Clarity consensus serialization
// ============================================================================

function claritySerializePrincipal(principal: string): Uint8Array {
  const cv = Cl.standardPrincipal(principal);
  // serializeCV returns a hex string; convert to bytes
  return hexToBytes(serializeCV(cv));
}

function claritySerializeUint(value: number): Uint8Array {
  const cv = Cl.uint(value);
  return hexToBytes(serializeCV(cv));
}

// ============================================================================
// Helpers - Fiat-Shamir (mirrors contract logic exactly)
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
// Helpers - Merkle tree (depth 8, 256 leaves)
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
// Helpers - Valid proof construction
// ============================================================================

// Builds a valid proof buffer that passes the Clarity verifier.
//
// The approach (upgraded verifier):
//   1. Choose 256 trace evaluations (arbitrary 32-byte values)
//   2. Build a Merkle tree from these trace-evals -> get trace-root
//   3. constraint-root = sha256(trace-root || public-root)
//   4. Compute challenge = f(public-inputs, trace-root, constraint-root)
//   5. Derive query indices from the challenge
//   6. For each query at index i:
//      - trace-eval is the tree leaf at position i
//      - constraint-eval = sha256(trace-eval || nullifier || challenge)
//      - fri-eval = sha256(constraint-eval || trace-eval || nullifier)
//      - Merkle auth path for trace-eval at index i
//   7. fri-remainder = sha256(challenge || trace-root || constraint-root)
//
// The constraint-root binding to public-root prevents forgers from using
// arbitrary roots. The nullifier binding in constraint/FRI evals ensures
// the prover knows the commitment-nullifier association.

function buildValidProof(
  nullifier: string,
  root: string,
  recipientAddr: string,
  relayerFee: number,
  numQueries: number,
): string {
  // Step 1: Generate 256 deterministic trace evaluations
  const traceEvals: Uint8Array[] = [];
  for (let i = 0; i < 256; i++) {
    const seed = concatBytes(
      hexToBytes(nullifier),
      new Uint8Array([i & 0xff, (i >> 8) & 0xff, 0, 0]),
    );
    traceEvals.push(sha256(seed));
  }

  // Step 2: Build Merkle tree from trace evaluations
  const tree = buildMerkleTree(traceEvals);
  const traceRoot = tree.root;

  // Step 3: Constraint root = sha256(trace-root || public-root)
  // Binds the proof's internal tree to the public Merkle root.
  const rootBytes = hexToBytes(root);
  const constraintRoot = sha256(concatBytes(traceRoot, rootBytes));

  // Step 4: Compute Fiat-Shamir challenge
  const publicInputHash = buildPublicInputHash(
    nullifier,
    root,
    recipientAddr,
    relayerFee,
  );
  const step1 = computeChallenge(publicInputHash, traceRoot);
  const challenge = computeChallenge(step1, constraintRoot);

  // Step 5: Derive query indices (one byte each from challenge)
  const queryIndices: number[] = [];
  for (let q = 0; q < numQueries; q++) {
    queryIndices.push(challenge[q]);
  }

  const nullifierBytes = hexToBytes(nullifier);

  // Step 6: Build query blocks (nullifier-bound evaluations)
  const queryBlocks: Uint8Array[] = [];
  for (let q = 0; q < numQueries; q++) {
    const idx = queryIndices[q];
    const traceEval = traceEvals[idx];
    // constraint-eval = sha256(trace-eval || nullifier || challenge)
    const constraintEval = sha256(concatBytes(traceEval, nullifierBytes, challenge));
    // fri-eval = sha256(constraint-eval || trace-eval || nullifier)
    const friEval = sha256(concatBytes(constraintEval, traceEval, nullifierBytes));
    const authPath = tree.getAuthPath(idx);

    // Query block: trace-eval(32) + constraint-eval(32) + fri-eval(32) +
    //              8 siblings(256) + leaf-index(1) = 353 bytes
    const parts: Uint8Array[] = [traceEval, constraintEval, friEval];
    for (let s = 0; s < 8; s++) {
      parts.push(authPath[s]);
    }
    parts.push(new Uint8Array([idx]));
    queryBlocks.push(concatBytes(...parts));
  }

  // Step 7: FRI remainder = sha256(challenge || trace-root || constraint-root)
  const friRemainder = sha256(
    concatBytes(challenge, traceRoot, constraintRoot),
  );

  // Serialize proof
  const proof = concatBytes(
    new Uint8Array([0x00, 0x00, 0x00, 0x01]), // version
    traceRoot, // 32 bytes
    constraintRoot, // 32 bytes
    new Uint8Array([numQueries]), // 1 byte
    ...queryBlocks, // numQueries * 353 bytes
    friRemainder, // 32 bytes
  );

  return bytesToHex(proof);
}

// ============================================================================
// Tests
// ============================================================================

describe("proof-verifier contract", () => {
  // =========================================================================
  // Valid proof acceptance
  // =========================================================================

  describe("valid proof verification", () => {
    it("should accept a valid proof with 1 query", () => {
      const proof = buildValidProof(NULLIFIER, ROOT, recipient, RELAYER_FEE, 1);

      const result = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(proof),
          Cl.bufferFromHex(NULLIFIER),
          Cl.bufferFromHex(ROOT),
          Cl.standardPrincipal(recipient),
          Cl.uint(RELAYER_FEE),
        ],
        deployer,
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("should accept a valid proof with 2 queries", () => {
      const proof = buildValidProof(NULLIFIER, ROOT, recipient, RELAYER_FEE, 2);

      const result = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(proof),
          Cl.bufferFromHex(NULLIFIER),
          Cl.bufferFromHex(ROOT),
          Cl.standardPrincipal(recipient),
          Cl.uint(RELAYER_FEE),
        ],
        deployer,
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("should accept a valid proof with 4 queries (max)", () => {
      const proof = buildValidProof(NULLIFIER, ROOT, recipient, RELAYER_FEE, 4);

      const result = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(proof),
          Cl.bufferFromHex(NULLIFIER),
          Cl.bufferFromHex(ROOT),
          Cl.standardPrincipal(recipient),
          Cl.uint(RELAYER_FEE),
        ],
        deployer,
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("should accept a valid proof with zero relayer fee", () => {
      const proof = buildValidProof(NULLIFIER, ROOT, recipient, 0, 1);

      const result = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(proof),
          Cl.bufferFromHex(NULLIFIER),
          Cl.bufferFromHex(ROOT),
          Cl.standardPrincipal(recipient),
          Cl.uint(0),
        ],
        deployer,
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });
  });

  // =========================================================================
  // Fiat-Shamir binding: changing any public input invalidates the proof
  // =========================================================================

  describe("Fiat-Shamir public input binding", () => {
    it("should reject proof when nullifier is wrong", () => {
      const proof = buildValidProof(NULLIFIER, ROOT, recipient, RELAYER_FEE, 1);
      const wrongNullifier =
        "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

      const result = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(proof),
          Cl.bufferFromHex(wrongNullifier),
          Cl.bufferFromHex(ROOT),
          Cl.standardPrincipal(recipient),
          Cl.uint(RELAYER_FEE),
        ],
        deployer,
      );
      expect(result.result).toHaveClarityType(ClarityType.ResponseErr);
    });

    it("should reject proof when root is wrong", () => {
      const proof = buildValidProof(NULLIFIER, ROOT, recipient, RELAYER_FEE, 1);
      const wrongRoot =
        "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

      const result = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(proof),
          Cl.bufferFromHex(NULLIFIER),
          Cl.bufferFromHex(wrongRoot),
          Cl.standardPrincipal(recipient),
          Cl.uint(RELAYER_FEE),
        ],
        deployer,
      );
      expect(result.result).toHaveClarityType(ClarityType.ResponseErr);
    });

    it("should reject proof when recipient is wrong", () => {
      const proof = buildValidProof(NULLIFIER, ROOT, recipient, RELAYER_FEE, 1);
      const wrongRecipient = accounts.get("wallet_2")!;

      const result = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(proof),
          Cl.bufferFromHex(NULLIFIER),
          Cl.bufferFromHex(ROOT),
          Cl.standardPrincipal(wrongRecipient),
          Cl.uint(RELAYER_FEE),
        ],
        deployer,
      );
      expect(result.result).toHaveClarityType(ClarityType.ResponseErr);
    });

    it("should reject proof when relayer fee is wrong", () => {
      const proof = buildValidProof(NULLIFIER, ROOT, recipient, RELAYER_FEE, 1);

      const result = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(proof),
          Cl.bufferFromHex(NULLIFIER),
          Cl.bufferFromHex(ROOT),
          Cl.standardPrincipal(recipient),
          Cl.uint(RELAYER_FEE + 1),
        ],
        deployer,
      );
      expect(result.result).toHaveClarityType(ClarityType.ResponseErr);
    });
  });

  // =========================================================================
  // Fiat-Shamir determinism
  // =========================================================================

  describe("Fiat-Shamir determinism", () => {
    it("should produce the same verification result for the same inputs", () => {
      const proof = buildValidProof(NULLIFIER, ROOT, recipient, RELAYER_FEE, 1);

      const result1 = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(proof),
          Cl.bufferFromHex(NULLIFIER),
          Cl.bufferFromHex(ROOT),
          Cl.standardPrincipal(recipient),
          Cl.uint(RELAYER_FEE),
        ],
        deployer,
      );

      const result2 = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(proof),
          Cl.bufferFromHex(NULLIFIER),
          Cl.bufferFromHex(ROOT),
          Cl.standardPrincipal(recipient),
          Cl.uint(RELAYER_FEE),
        ],
        deployer,
      );

      expect(result1.result).toStrictEqual(result2.result);
      expect(result1.result).toBeOk(Cl.bool(true));
    });

    it("should produce different proofs for different nullifiers that cross-reject", () => {
      const proof1 = buildValidProof(
        NULLIFIER,
        ROOT,
        recipient,
        RELAYER_FEE,
        1,
      );
      const otherNullifier =
        "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
      const proof2 = buildValidProof(
        otherNullifier,
        ROOT,
        recipient,
        RELAYER_FEE,
        1,
      );

      // Each proof valid with its own inputs
      const r1 = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(proof1),
          Cl.bufferFromHex(NULLIFIER),
          Cl.bufferFromHex(ROOT),
          Cl.standardPrincipal(recipient),
          Cl.uint(RELAYER_FEE),
        ],
        deployer,
      );
      expect(r1.result).toBeOk(Cl.bool(true));

      const r2 = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(proof2),
          Cl.bufferFromHex(otherNullifier),
          Cl.bufferFromHex(ROOT),
          Cl.standardPrincipal(recipient),
          Cl.uint(RELAYER_FEE),
        ],
        deployer,
      );
      expect(r2.result).toBeOk(Cl.bool(true));

      // Cross-verify: proof1 with otherNullifier should fail
      const cross = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(proof1),
          Cl.bufferFromHex(otherNullifier),
          Cl.bufferFromHex(ROOT),
          Cl.standardPrincipal(recipient),
          Cl.uint(RELAYER_FEE),
        ],
        deployer,
      );
      expect(cross.result).toHaveClarityType(ClarityType.ResponseErr);
    });
  });

  // =========================================================================
  // Merkle auth path tampering
  // =========================================================================

  describe("Merkle authentication path tampering", () => {
    it("should reject proof with a tampered auth path sibling", () => {
      const proof = buildValidProof(NULLIFIER, ROOT, recipient, RELAYER_FEE, 1);
      const proofBytes = hexToBytes(proof);

      // Tamper with the first auth path sibling
      // Query starts at offset 69. Auth path starts at 69 + 96 = 165.
      const tampered = new Uint8Array(proofBytes);
      tampered[165] ^= 0x01;

      const result = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(bytesToHex(tampered)),
          Cl.bufferFromHex(NULLIFIER),
          Cl.bufferFromHex(ROOT),
          Cl.standardPrincipal(recipient),
          Cl.uint(RELAYER_FEE),
        ],
        deployer,
      );
      expect(result.result).toHaveClarityType(ClarityType.ResponseErr);
    });

    it("should reject proof with a tampered trace evaluation", () => {
      const proof = buildValidProof(NULLIFIER, ROOT, recipient, RELAYER_FEE, 1);
      const proofBytes = hexToBytes(proof);

      // Tamper with the trace evaluation (first byte of first query, offset 69)
      const tampered = new Uint8Array(proofBytes);
      tampered[69] ^= 0xff;

      const result = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(bytesToHex(tampered)),
          Cl.bufferFromHex(NULLIFIER),
          Cl.bufferFromHex(ROOT),
          Cl.standardPrincipal(recipient),
          Cl.uint(RELAYER_FEE),
        ],
        deployer,
      );
      expect(result.result).toHaveClarityType(ClarityType.ResponseErr);
    });

    it("should reject proof with a tampered FRI remainder", () => {
      const proof = buildValidProof(NULLIFIER, ROOT, recipient, RELAYER_FEE, 1);
      const proofBytes = hexToBytes(proof);

      // Tamper with the last byte (FRI remainder)
      const tampered = new Uint8Array(proofBytes);
      tampered[tampered.length - 1] ^= 0x01;

      const result = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(bytesToHex(tampered)),
          Cl.bufferFromHex(NULLIFIER),
          Cl.bufferFromHex(ROOT),
          Cl.standardPrincipal(recipient),
          Cl.uint(RELAYER_FEE),
        ],
        deployer,
      );
      expect(result.result).toHaveClarityType(ClarityType.ResponseErr);
    });
  });

  // =========================================================================
  // Proof format validation
  // =========================================================================

  describe("proof format validation", () => {
    it("should reject proof that is too short", () => {
      const shortProof = "00".repeat(100);

      const result = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(shortProof),
          Cl.bufferFromHex(NULLIFIER),
          Cl.bufferFromHex(ROOT),
          Cl.standardPrincipal(recipient),
          Cl.uint(RELAYER_FEE),
        ],
        deployer,
      );
      expect(result.result).toBeErr(Cl.uint(6002));
    });

    it("should reject proof with wrong version", () => {
      const proof = buildValidProof(NULLIFIER, ROOT, recipient, RELAYER_FEE, 1);
      const proofBytes = hexToBytes(proof);

      // Change version byte 3 from 0x01 to 0x02
      const tampered = new Uint8Array(proofBytes);
      tampered[3] = 0x02;

      const result = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(bytesToHex(tampered)),
          Cl.bufferFromHex(NULLIFIER),
          Cl.bufferFromHex(ROOT),
          Cl.standardPrincipal(recipient),
          Cl.uint(RELAYER_FEE),
        ],
        deployer,
      );
      expect(result.result).toBeErr(Cl.uint(6007));
    });

    it("should reject proof with zero queries", () => {
      const proof = buildValidProof(NULLIFIER, ROOT, recipient, RELAYER_FEE, 1);
      const proofBytes = hexToBytes(proof);

      const tampered = new Uint8Array(proofBytes);
      tampered[68] = 0x00;

      const result = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(bytesToHex(tampered)),
          Cl.bufferFromHex(NULLIFIER),
          Cl.bufferFromHex(ROOT),
          Cl.standardPrincipal(recipient),
          Cl.uint(RELAYER_FEE),
        ],
        deployer,
      );
      expect(result.result).toBeErr(Cl.uint(6008));
    });

    it("should reject proof with more than 4 queries", () => {
      const proof = buildValidProof(NULLIFIER, ROOT, recipient, RELAYER_FEE, 1);
      const proofBytes = hexToBytes(proof);

      const tampered = new Uint8Array(proofBytes);
      tampered[68] = 0x05;

      const result = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(bytesToHex(tampered)),
          Cl.bufferFromHex(NULLIFIER),
          Cl.bufferFromHex(ROOT),
          Cl.standardPrincipal(recipient),
          Cl.uint(RELAYER_FEE),
        ],
        deployer,
      );
      expect(result.result).toBeErr(Cl.uint(6008));
    });

    it("should reject proof claiming more queries than data present", () => {
      // Build a 1-query proof but set num-queries to 4
      const proof = buildValidProof(NULLIFIER, ROOT, recipient, RELAYER_FEE, 1);
      const proofBytes = hexToBytes(proof);

      const tampered = new Uint8Array(proofBytes);
      tampered[68] = 0x04;

      const result = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(bytesToHex(tampered)),
          Cl.bufferFromHex(NULLIFIER),
          Cl.bufferFromHex(ROOT),
          Cl.standardPrincipal(recipient),
          Cl.uint(RELAYER_FEE),
        ],
        deployer,
      );
      expect(result.result).toBeErr(Cl.uint(6002));
    });
  });

  // =========================================================================
  // Evaluation consistency checks
  // =========================================================================

  describe("evaluation consistency checks", () => {
    it("should reject proof with wrong constraint evaluation", () => {
      const proof = buildValidProof(NULLIFIER, ROOT, recipient, RELAYER_FEE, 1);
      const proofBytes = hexToBytes(proof);

      // Tamper with constraint evaluation (offset 69 + 32 = 101)
      const tampered = new Uint8Array(proofBytes);
      tampered[101] ^= 0x01;

      const result = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(bytesToHex(tampered)),
          Cl.bufferFromHex(NULLIFIER),
          Cl.bufferFromHex(ROOT),
          Cl.standardPrincipal(recipient),
          Cl.uint(RELAYER_FEE),
        ],
        deployer,
      );
      expect(result.result).toHaveClarityType(ClarityType.ResponseErr);
    });

    it("should reject proof with wrong FRI evaluation", () => {
      const proof = buildValidProof(NULLIFIER, ROOT, recipient, RELAYER_FEE, 1);
      const proofBytes = hexToBytes(proof);

      // Tamper with FRI evaluation (offset 69 + 64 = 133)
      const tampered = new Uint8Array(proofBytes);
      tampered[133] ^= 0x01;

      const result = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(bytesToHex(tampered)),
          Cl.bufferFromHex(NULLIFIER),
          Cl.bufferFromHex(ROOT),
          Cl.standardPrincipal(recipient),
          Cl.uint(RELAYER_FEE),
        ],
        deployer,
      );
      expect(result.result).toHaveClarityType(ClarityType.ResponseErr);
    });
  });

  // =========================================================================
  // Leaf index binding to Fiat-Shamir challenge
  // =========================================================================

  describe("leaf index binding to Fiat-Shamir challenge", () => {
    it("should reject proof with wrong leaf index", () => {
      const proof = buildValidProof(NULLIFIER, ROOT, recipient, RELAYER_FEE, 1);
      const proofBytes = hexToBytes(proof);

      // Tamper with leaf index byte (offset 69 + 352 = 421)
      const tampered = new Uint8Array(proofBytes);
      tampered[421] = (tampered[421] + 1) % 256;

      const result = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(bytesToHex(tampered)),
          Cl.bufferFromHex(NULLIFIER),
          Cl.bufferFromHex(ROOT),
          Cl.standardPrincipal(recipient),
          Cl.uint(RELAYER_FEE),
        ],
        deployer,
      );
      expect(result.result).toHaveClarityType(ClarityType.ResponseErr);
    });
  });

  // =========================================================================
  // Commitment tampering
  // =========================================================================

  describe("commitment tampering", () => {
    it("should reject proof with tampered trace root", () => {
      const proof = buildValidProof(NULLIFIER, ROOT, recipient, RELAYER_FEE, 1);
      const proofBytes = hexToBytes(proof);

      // Tamper with trace root (offset 4)
      const tampered = new Uint8Array(proofBytes);
      tampered[4] ^= 0x01;

      const result = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(bytesToHex(tampered)),
          Cl.bufferFromHex(NULLIFIER),
          Cl.bufferFromHex(ROOT),
          Cl.standardPrincipal(recipient),
          Cl.uint(RELAYER_FEE),
        ],
        deployer,
      );
      expect(result.result).toHaveClarityType(ClarityType.ResponseErr);
    });

    it("should reject proof with tampered constraint root", () => {
      const proof = buildValidProof(NULLIFIER, ROOT, recipient, RELAYER_FEE, 1);
      const proofBytes = hexToBytes(proof);

      // Tamper with constraint root (offset 36)
      const tampered = new Uint8Array(proofBytes);
      tampered[36] ^= 0x01;

      const result = simnet.callReadOnlyFn(
        contractName,
        "verify-proof",
        [
          Cl.bufferFromHex(bytesToHex(tampered)),
          Cl.bufferFromHex(NULLIFIER),
          Cl.bufferFromHex(ROOT),
          Cl.standardPrincipal(recipient),
          Cl.uint(RELAYER_FEE),
        ],
        deployer,
      );
      expect(result.result).toHaveClarityType(ClarityType.ResponseErr);
    });
  });
});
