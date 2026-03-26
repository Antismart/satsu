import { describe, it, expect } from "vitest";
import { Cl, ClarityType } from "@stacks/transactions";

// Pre-computed constants from the contract
const EMPTY_ROOT =
  "799881750019ca39515941a00231729514ca4029498a0c675e9d66a0f4340103";

// Test leaves (32-byte buffers)
const LEAF_1 =
  "0000000000000000000000000000000000000000000000000000000000000001";
const LEAF_2 =
  "0000000000000000000000000000000000000000000000000000000000000002";
const LEAF_3 =
  "0000000000000000000000000000000000000000000000000000000000000003";

// Pre-computed expected roots (verified against the incremental Merkle tree algorithm
// using SHA-256 with the zero hashes defined in the contract)
const ROOT_AFTER_LEAF_1 =
  "c8412e1986902b8c368971b6a6c7df6e6fe7041aeae275bd1a896e22dcaf13fa";
const ROOT_AFTER_LEAF_1_THEN_2 =
  "bf6cf224777e25babfbf3d9ed3f8d97fdaaeea594203150a2048e43ac1278541";
const ROOT_AFTER_THREE_LEAVES =
  "422742aa44b28eb6e55c1c5f9c00f9eb19e454c890e82c2948193892b576b460";

// sha256(LEAF_1 || LEAF_2) - the frontier hash stored at level 1 after two inserts
const FRONTIER_LEVEL_1_AFTER_TWO =
  "d6ba9329f8932c12192b37849f772104d20048f76434a3290512d9d814e4116f";

// Root after inserting LEAF_1 twice (same leaf at index 0 and 1)
const ROOT_AFTER_DUPLICATE_LEAVES =
  "8843554e752da8bffc2c8afd71911987ec86de9578748fd4e8c18d72d8e439a2";

const contractName = "merkle-tree";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;

// Helper to extract the hex string from a BufferCV result
function bufferCvToHex(cv: any): string {
  if (cv && cv.type === ClarityType.Buffer) {
    return Array.from(cv.value as Uint8Array)
      .map((b: number) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return "";
}

describe("merkle-tree contract", () => {
  // =========================================================================
  // Initial state tests
  // =========================================================================

  describe("initial state", () => {
    it("should have the current root equal to EMPTY-ROOT", () => {
      const result = simnet.callReadOnlyFn(
        contractName,
        "get-current-root",
        [],
        deployer,
      );
      expect(result.result).toBeBuff(EMPTY_ROOT);
    });

    it("should have next-leaf-index starting at 0", () => {
      const result = simnet.callReadOnlyFn(
        contractName,
        "get-next-leaf-index",
        [],
        deployer,
      );
      expect(result.result).toBeUint(0);
    });

    it("should recognize EMPTY-ROOT as a known root", () => {
      const result = simnet.callReadOnlyFn(
        contractName,
        "is-known-root",
        [Cl.bufferFromHex(EMPTY_ROOT)],
        deployer,
      );
      expect(result.result).toBeBool(true);
    });

    it("should not recognize an arbitrary hash as a known root", () => {
      const fakeRoot =
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const result = simnet.callReadOnlyFn(
        contractName,
        "is-known-root",
        [Cl.bufferFromHex(fakeRoot)],
        deployer,
      );
      expect(result.result).toBeBool(false);
    });

    it("should return none for frontier at any level before inserts", () => {
      for (const level of [0, 1, 5, 10, 19]) {
        const result = simnet.callReadOnlyFn(
          contractName,
          "get-frontier",
          [Cl.uint(level)],
          deployer,
        );
        expect(result.result).toBeNone();
      }
    });
  });

  // =========================================================================
  // Single leaf append tests
  // =========================================================================

  describe("appending a single leaf", () => {
    it("should succeed and return the new root and leaf-index 0", () => {
      const result = simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_1)],
        deployer,
      );
      expect(result.result).toBeOk(
        Cl.tuple({
          root: Cl.bufferFromHex(ROOT_AFTER_LEAF_1),
          "leaf-index": Cl.uint(0),
        }),
      );
    });

    it("should change the current root from EMPTY-ROOT", () => {
      simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_1)],
        deployer,
      );

      const result = simnet.callReadOnlyFn(
        contractName,
        "get-current-root",
        [],
        deployer,
      );
      expect(result.result).not.toBeBuff(EMPTY_ROOT);
    });

    it("should produce the expected known root after one insert", () => {
      simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_1)],
        deployer,
      );

      const result = simnet.callReadOnlyFn(
        contractName,
        "get-current-root",
        [],
        deployer,
      );
      expect(result.result).toBeBuff(ROOT_AFTER_LEAF_1);
    });

    it("should register the new root as a known root", () => {
      simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_1)],
        deployer,
      );

      const result = simnet.callReadOnlyFn(
        contractName,
        "is-known-root",
        [Cl.bufferFromHex(ROOT_AFTER_LEAF_1)],
        deployer,
      );
      expect(result.result).toBeBool(true);
    });

    it("should keep EMPTY-ROOT as a known root after appending", () => {
      simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_1)],
        deployer,
      );

      const result = simnet.callReadOnlyFn(
        contractName,
        "is-known-root",
        [Cl.bufferFromHex(EMPTY_ROOT)],
        deployer,
      );
      expect(result.result).toBeBool(true);
    });

    it("should increment next-leaf-index to 1", () => {
      simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_1)],
        deployer,
      );

      const result = simnet.callReadOnlyFn(
        contractName,
        "get-next-leaf-index",
        [],
        deployer,
      );
      expect(result.result).toBeUint(1);
    });

    it("should set frontier at level 0 after inserting at index 0", () => {
      simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_1)],
        deployer,
      );

      const result = simnet.callReadOnlyFn(
        contractName,
        "get-frontier",
        [Cl.uint(0)],
        deployer,
      );
      // For index 0, bit 0 is 0, so the leaf itself is stored at frontier level 0
      expect(result.result).toBeSome(
        Cl.tuple({ hash: Cl.bufferFromHex(LEAF_1) }),
      );
    });
  });

  // =========================================================================
  // Multiple sequential appends
  // =========================================================================

  describe("multiple sequential appends", () => {
    it("should increment next-leaf-index after each append", () => {
      for (let i = 0; i < 5; i++) {
        const leafHex = (i + 1).toString(16).padStart(64, "0");
        simnet.callPublicFn(
          contractName,
          "append-leaf",
          [Cl.bufferFromHex(leafHex)],
          deployer,
        );

        const result = simnet.callReadOnlyFn(
          contractName,
          "get-next-leaf-index",
          [],
          deployer,
        );
        expect(result.result).toBeUint(i + 1);
      }
    });

    it("should produce correct roots after two appends", () => {
      // First append
      const result1 = simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_1)],
        deployer,
      );
      expect(result1.result).toBeOk(
        Cl.tuple({
          root: Cl.bufferFromHex(ROOT_AFTER_LEAF_1),
          "leaf-index": Cl.uint(0),
        }),
      );

      // Second append
      const result2 = simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_2)],
        deployer,
      );
      expect(result2.result).toBeOk(
        Cl.tuple({
          root: Cl.bufferFromHex(ROOT_AFTER_LEAF_1_THEN_2),
          "leaf-index": Cl.uint(1),
        }),
      );

      // Verify current root matches
      const rootResult = simnet.callReadOnlyFn(
        contractName,
        "get-current-root",
        [],
        deployer,
      );
      expect(rootResult.result).toBeBuff(ROOT_AFTER_LEAF_1_THEN_2);
    });

    it("should produce correct root after three sequential appends", () => {
      simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_1)],
        deployer,
      );
      simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_2)],
        deployer,
      );
      const result3 = simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_3)],
        deployer,
      );

      expect(result3.result).toBeOk(
        Cl.tuple({
          root: Cl.bufferFromHex(ROOT_AFTER_THREE_LEAVES),
          "leaf-index": Cl.uint(2),
        }),
      );
    });

    it("should keep all historical roots as known roots", () => {
      simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_1)],
        deployer,
      );
      simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_2)],
        deployer,
      );
      simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_3)],
        deployer,
      );

      // All roots (including the initial empty root) should be known
      const roots = [
        EMPTY_ROOT,
        ROOT_AFTER_LEAF_1,
        ROOT_AFTER_LEAF_1_THEN_2,
        ROOT_AFTER_THREE_LEAVES,
      ];

      for (const root of roots) {
        const result = simnet.callReadOnlyFn(
          contractName,
          "is-known-root",
          [Cl.bufferFromHex(root)],
          deployer,
        );
        expect(result.result).toBeBool(true);
      }
    });

    it("should produce different roots for different leaves appended sequentially", () => {
      // Append LEAF_1
      const result1 = simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_1)],
        deployer,
      );

      // Append LEAF_2 (different leaf at a different index)
      const result2 = simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_2)],
        deployer,
      );

      // The two return values should be different (different roots, different indices)
      expect(result1.result).not.toStrictEqual(result2.result);
    });
  });

  // =========================================================================
  // Frontier state tests
  // =========================================================================

  describe("frontier updates", () => {
    it("should set frontier at level 0 and leave level 1 empty after index 0", () => {
      simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_1)],
        deployer,
      );

      const f0 = simnet.callReadOnlyFn(
        contractName,
        "get-frontier",
        [Cl.uint(0)],
        deployer,
      );
      // Index 0: bit 0 is 0, so the leaf is stored at frontier[0]
      expect(f0.result).toBeSome(
        Cl.tuple({ hash: Cl.bufferFromHex(LEAF_1) }),
      );

      // Level 1 should still be none (only one leaf inserted)
      const f1 = simnet.callReadOnlyFn(
        contractName,
        "get-frontier",
        [Cl.uint(1)],
        deployer,
      );
      expect(f1.result).toBeNone();
    });

    it("should set frontier at level 1 after insert at index 1", () => {
      simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_1)],
        deployer,
      );
      simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_2)],
        deployer,
      );

      // For index 1: bit 0 is 1, so we hash frontier[0]||leaf and propagate up.
      // At level 1: bit 1 of 1 is 0, so the combined hash is stored at frontier[1].
      const f1 = simnet.callReadOnlyFn(
        contractName,
        "get-frontier",
        [Cl.uint(1)],
        deployer,
      );
      // sha256(LEAF_1 || LEAF_2)
      expect(f1.result).toBeSome(
        Cl.tuple({
          hash: Cl.bufferFromHex(FRONTIER_LEVEL_1_AFTER_TWO),
        }),
      );
    });

    it("should update frontier at level 0 after insert at index 2", () => {
      simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_1)],
        deployer,
      );
      simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_2)],
        deployer,
      );
      simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_3)],
        deployer,
      );

      // Index 2 (binary 10): bit 0 is 0, so LEAF_3 stored at frontier[0]
      const f0 = simnet.callReadOnlyFn(
        contractName,
        "get-frontier",
        [Cl.uint(0)],
        deployer,
      );
      expect(f0.result).toBeSome(
        Cl.tuple({ hash: Cl.bufferFromHex(LEAF_3) }),
      );

      // Frontier at level 1 should remain from the second insert
      const f1 = simnet.callReadOnlyFn(
        contractName,
        "get-frontier",
        [Cl.uint(1)],
        deployer,
      );
      expect(f1.result).toBeSome(
        Cl.tuple({
          hash: Cl.bufferFromHex(FRONTIER_LEVEL_1_AFTER_TWO),
        }),
      );
    });
  });

  // =========================================================================
  // Determinism and consistency
  // =========================================================================

  describe("determinism", () => {
    it("should produce the same root when the same leaf is appended in fresh state", () => {
      const result = simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_1)],
        deployer,
      );

      expect(result.result).toBeOk(
        Cl.tuple({
          root: Cl.bufferFromHex(ROOT_AFTER_LEAF_1),
          "leaf-index": Cl.uint(0),
        }),
      );
    });

    it("should allow different callers to append leaves", () => {
      // Deployer appends leaf 1
      const result1 = simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_1)],
        deployer,
      );
      expect(result1.result).toBeOk(
        Cl.tuple({
          root: Cl.bufferFromHex(ROOT_AFTER_LEAF_1),
          "leaf-index": Cl.uint(0),
        }),
      );

      // Authorize wallet_1 to append
      simnet.callPublicFn(
        contractName,
        "set-authorized-caller",
        [Cl.standardPrincipal(wallet1), Cl.bool(true)],
        deployer,
      );

      // wallet_1 appends leaf 2 -- the caller does not affect the root
      const result2 = simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_2)],
        wallet1,
      );
      expect(result2.result).toBeOk(
        Cl.tuple({
          root: Cl.bufferFromHex(ROOT_AFTER_LEAF_1_THEN_2),
          "leaf-index": Cl.uint(1),
        }),
      );
    });

    it("should produce a different root when inserting the same leaf twice vs two different leaves", () => {
      // Insert LEAF_1 twice
      simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_1)],
        deployer,
      );
      simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_1)],
        deployer,
      );

      const dupRoot = simnet.callReadOnlyFn(
        contractName,
        "get-current-root",
        [],
        deployer,
      );

      // Root for two identical leaves (LEAF_1, LEAF_1)
      expect(dupRoot.result).toBeBuff(ROOT_AFTER_DUPLICATE_LEAVES);

      // It should differ from the root for (LEAF_1, LEAF_2)
      expect(dupRoot.result).not.toBeBuff(ROOT_AFTER_LEAF_1_THEN_2);
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe("edge cases", () => {
    it("should handle a zero-value leaf", () => {
      const zeroLeaf =
        "0000000000000000000000000000000000000000000000000000000000000000";
      const result = simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(zeroLeaf)],
        deployer,
      );
      // Should succeed
      expect(result.result).toHaveClarityType(ClarityType.ResponseOk);

      // The root should change from EMPTY-ROOT even for a zero leaf,
      // because the zero leaf (0x00...00) differs from ZERO-HASH-0 (sha256(0x00...00))
      const rootResult = simnet.callReadOnlyFn(
        contractName,
        "get-current-root",
        [],
        deployer,
      );
      expect(rootResult.result).not.toBeBuff(EMPTY_ROOT);
    });

    it("should handle a max-value leaf (all 0xff)", () => {
      const maxLeaf =
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
      const result = simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(maxLeaf)],
        deployer,
      );
      // Should succeed
      expect(result.result).toHaveClarityType(ClarityType.ResponseOk);

      // next-leaf-index should be 1
      const indexResult = simnet.callReadOnlyFn(
        contractName,
        "get-next-leaf-index",
        [],
        deployer,
      );
      expect(indexResult.result).toBeUint(1);
    });

    it("should emit a print event on leaf append", () => {
      const result = simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_1)],
        deployer,
      );

      // Check that events were emitted
      expect(result.events.length).toBeGreaterThan(0);

      // Look for the print event
      const printEvent = result.events.find(
        (e: any) => e.event === "print_event",
      );
      expect(printEvent).toBeDefined();
    });
  });

  // =========================================================================
  // Multiple inserts consistency
  // =========================================================================

  describe("multiple inserts consistency", () => {
    it("should handle 10 sequential inserts with consistent state", () => {
      for (let i = 0; i < 10; i++) {
        const leafHex = (i + 1).toString(16).padStart(64, "0");
        const result = simnet.callPublicFn(
          contractName,
          "append-leaf",
          [Cl.bufferFromHex(leafHex)],
          deployer,
        );

        // Each append should succeed (returns ok)
        expect(result.result).toHaveClarityType(ClarityType.ResponseOk);
      }

      // After 10 inserts, next-leaf-index should be 10
      const indexResult = simnet.callReadOnlyFn(
        contractName,
        "get-next-leaf-index",
        [],
        deployer,
      );
      expect(indexResult.result).toBeUint(10);
    });

    it("should maintain unique roots for each distinct tree state", () => {
      const roots: string[] = [];

      // Insert 5 different leaves and collect all intermediate roots
      for (let i = 0; i < 5; i++) {
        const leafHex = (i + 1).toString(16).padStart(64, "0");
        simnet.callPublicFn(
          contractName,
          "append-leaf",
          [Cl.bufferFromHex(leafHex)],
          deployer,
        );

        const rootResult = simnet.callReadOnlyFn(
          contractName,
          "get-current-root",
          [],
          deployer,
        );

        roots.push(bufferCvToHex(rootResult.result));
      }

      // All roots should be unique (each insertion produces a different tree)
      const uniqueRoots = new Set(roots);
      expect(uniqueRoots.size).toBe(5);
    });

    it("all intermediate roots should be known roots after multiple appends", () => {
      // Build up the tree with 4 inserts
      simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_1)],
        deployer,
      );
      simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_2)],
        deployer,
      );
      simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(LEAF_3)],
        deployer,
      );
      const leafHex4 = (4).toString(16).padStart(64, "0");
      simnet.callPublicFn(
        contractName,
        "append-leaf",
        [Cl.bufferFromHex(leafHex4)],
        deployer,
      );

      // Every historical root should still be recognized as known
      const rootsToCheck = [
        EMPTY_ROOT,
        ROOT_AFTER_LEAF_1,
        ROOT_AFTER_LEAF_1_THEN_2,
        ROOT_AFTER_THREE_LEAVES,
      ];

      for (const root of rootsToCheck) {
        const result = simnet.callReadOnlyFn(
          contractName,
          "is-known-root",
          [Cl.bufferFromHex(root)],
          deployer,
        );
        expect(result.result).toBeBool(true);
      }
    });
  });
});
