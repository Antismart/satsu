import { describe, it, expect, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

// --------------------------------------------------------------------------
// nullifier-registry.test.ts
//
// Comprehensive tests for the nullifier-registry contract.
// Covers marking nullifiers, duplicate prevention, zero-nullifier rejection,
// authorization controls, read-only queries, and admin functions.
// --------------------------------------------------------------------------

// Valid 32-byte nullifier hashes (hex, no 0x prefix)
const NULLIFIER_A =
  "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
const NULLIFIER_B =
  "1111111111111111111111111111111111111111111111111111111111111111";
const NULLIFIER_C =
  "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

// The 32-byte zero nullifier (invalid per contract rules)
const ZERO_NULLIFIER =
  "0000000000000000000000000000000000000000000000000000000000000000";

const CONTRACT_NAME = "nullifier-registry";

let deployer: string;
let wallet1: string;
let wallet2: string;

beforeEach(() => {
  const accounts = simnet.getAccounts();
  deployer = accounts.get("deployer")!;
  wallet1 = accounts.get("wallet_1")!;
  wallet2 = accounts.get("wallet_2")!;
});

// ==========================================================================
// mark-used
// ==========================================================================

describe("nullifier-registry :: mark-used", () => {
  it("deployer should be able to mark a nullifier as used", () => {
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "mark-used",
      [Cl.bufferFromHex(NULLIFIER_A)],
      deployer
    );

    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("should reject marking the same nullifier twice (err u4002)", () => {
    // First mark succeeds
    simnet.callPublicFn(
      CONTRACT_NAME,
      "mark-used",
      [Cl.bufferFromHex(NULLIFIER_B)],
      deployer
    );

    // Second mark with same nullifier should fail
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "mark-used",
      [Cl.bufferFromHex(NULLIFIER_B)],
      deployer
    );

    // ERR-NULLIFIER-USED = u4002
    expect(result.result).toBeErr(Cl.uint(4002));
  });

  it("should reject zero nullifier (err u4003)", () => {
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "mark-used",
      [Cl.bufferFromHex(ZERO_NULLIFIER)],
      deployer
    );

    // ERR-INVALID-NULLIFIER = u4003
    expect(result.result).toBeErr(Cl.uint(4003));
  });

  it("non-authorized caller should be rejected (err u4001)", () => {
    // wallet1 is not the deployer and is not the authorized contract
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "mark-used",
      [Cl.bufferFromHex(NULLIFIER_A)],
      wallet1
    );

    // ERR-NOT-AUTHORIZED = u4001
    expect(result.result).toBeErr(Cl.uint(4001));
  });
});

// ==========================================================================
// Read-only: is-nullifier-used
// ==========================================================================

describe("nullifier-registry :: is-nullifier-used", () => {
  it("should report true for a used nullifier", () => {
    // Mark nullifier as used
    simnet.callPublicFn(
      CONTRACT_NAME,
      "mark-used",
      [Cl.bufferFromHex(NULLIFIER_A)],
      deployer
    );

    const result = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "is-nullifier-used",
      [Cl.bufferFromHex(NULLIFIER_A)],
      deployer
    );

    expect(result.result).toBeBool(true);
  });

  it("should report false for an unused nullifier", () => {
    const result = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "is-nullifier-used",
      [Cl.bufferFromHex(NULLIFIER_C)],
      deployer
    );

    expect(result.result).toBeBool(false);
  });
});

// ==========================================================================
// Read-only: get-nullifier-info
// ==========================================================================

describe("nullifier-registry :: get-nullifier-info", () => {
  it("should return nullifier info for a used nullifier", () => {
    // Mark nullifier
    simnet.callPublicFn(
      CONTRACT_NAME,
      "mark-used",
      [Cl.bufferFromHex(NULLIFIER_A)],
      deployer
    );

    const result = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-nullifier-info",
      [Cl.bufferFromHex(NULLIFIER_A)],
      deployer
    );

    // The result should be some tuple with used=true and a block-height uint.
    // We verify the `used` field is true. Block height will be whatever the
    // simnet is at, so we check the structure rather than the exact height.
    expect(result.result).toBeSome(
      Cl.tuple({
        used: Cl.bool(true),
        "block-height": Cl.uint(3),
      })
    );
  });

  it("should return none for unknown nullifier", () => {
    const result = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-nullifier-info",
      [Cl.bufferFromHex(NULLIFIER_C)],
      deployer
    );

    expect(result.result).toBeNone();
  });
});

// ==========================================================================
// set-authorized-contract
// ==========================================================================

describe("nullifier-registry :: set-authorized-contract", () => {
  it("owner should be able to set authorized contract", () => {
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "set-authorized-contract",
      [Cl.standardPrincipal(wallet1)],
      deployer
    );

    expect(result.result).toBeOk(Cl.bool(true));

    // Verify it was set
    const readResult = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-authorized-contract",
      [],
      deployer
    );

    expect(readResult.result).toStrictEqual(Cl.standardPrincipal(wallet1));
  });

  it("non-owner should fail to set authorized contract (err u4001)", () => {
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "set-authorized-contract",
      [Cl.standardPrincipal(wallet2)],
      wallet1
    );

    // ERR-NOT-AUTHORIZED = u4001
    expect(result.result).toBeErr(Cl.uint(4001));
  });

  it("newly authorized contract principal should be able to mark nullifiers", () => {
    // Authorize wallet1
    simnet.callPublicFn(
      CONTRACT_NAME,
      "set-authorized-contract",
      [Cl.standardPrincipal(wallet1)],
      deployer
    );

    // wallet1 should now be able to mark a nullifier
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "mark-used",
      [Cl.bufferFromHex(NULLIFIER_C)],
      wallet1
    );

    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("deployer should still be able to mark nullifiers after changing authorized contract", () => {
    // Change authorized contract to wallet1
    simnet.callPublicFn(
      CONTRACT_NAME,
      "set-authorized-contract",
      [Cl.standardPrincipal(wallet1)],
      deployer
    );

    // Deployer should still work (is-authorized-caller checks both)
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "mark-used",
      [Cl.bufferFromHex(NULLIFIER_A)],
      deployer
    );

    expect(result.result).toBeOk(Cl.bool(true));
  });
});
