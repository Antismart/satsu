import { describe, it, expect, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

// --------------------------------------------------------------------------
// stealth-v1.test.ts
//
// Comprehensive tests for the stealth-v1 meta-address registry contract.
// Covers registration, updates, BNS name linking/unlinking, read-only
// lookups, and all error paths.
// --------------------------------------------------------------------------

// Valid compressed secp256k1 public keys (33 bytes = 66 hex chars, prefix 0x02 or 0x03)
const VALID_SPEND_KEY =
  "02a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";
const VALID_VIEW_KEY =
  "03b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2";

// Alternate valid keys for update tests (33 bytes = 66 hex chars each)
const ALT_SPEND_KEY =
  "03deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbe01";
const ALT_VIEW_KEY =
  "02cafebabecafebabecafebabecafebabecafebabecafebabecafebabecafeba01";

// Invalid: 0x04 prefix (uncompressed marker), still 33 bytes to test prefix not length
const INVALID_PREFIX_KEY =
  "04a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";

// BNS name buffers (hex-encoded ASCII)
// "alice.btc" = 616c6963652e627463 (9 bytes, padded to 48 bytes with zeros)
const BNS_ALICE =
  "616c6963652e627463000000000000000000000000000000000000000000000000000000000000000000000000000000";
// "bob.btc" = 626f622e627463 (7 bytes, padded to 48 bytes with zeros = 96 hex chars)
const BNS_BOB =
  "626f622e6274630000000000000000000000000000000000000000000000000000000000000000000000000000000000";

const CONTRACT_NAME = "stealth-v1";

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
// Registration
// ==========================================================================

describe("stealth-v1 :: register-meta-address", () => {
  it("should register a valid meta-address", () => {
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "register-meta-address",
      [Cl.bufferFromHex(VALID_SPEND_KEY), Cl.bufferFromHex(VALID_VIEW_KEY)],
      wallet1
    );

    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("should reject invalid pubkey prefix (0x04)", () => {
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "register-meta-address",
      [
        Cl.bufferFromHex(INVALID_PREFIX_KEY),
        Cl.bufferFromHex(VALID_VIEW_KEY),
      ],
      wallet1
    );

    // ERR-INVALID-PUBKEY = u2002
    expect(result.result).toBeErr(Cl.uint(2002));
  });

  it("should reject invalid view-key prefix (0x04) as well", () => {
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "register-meta-address",
      [
        Cl.bufferFromHex(VALID_SPEND_KEY),
        Cl.bufferFromHex(INVALID_PREFIX_KEY),
      ],
      wallet1
    );

    expect(result.result).toBeErr(Cl.uint(2002));
  });
});

// ==========================================================================
// Update
// ==========================================================================

describe("stealth-v1 :: update-meta-address", () => {
  it("should update an existing meta-address", () => {
    // Register first
    simnet.callPublicFn(
      CONTRACT_NAME,
      "register-meta-address",
      [Cl.bufferFromHex(VALID_SPEND_KEY), Cl.bufferFromHex(VALID_VIEW_KEY)],
      wallet1
    );

    // Now update
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "update-meta-address",
      [Cl.bufferFromHex(ALT_SPEND_KEY), Cl.bufferFromHex(ALT_VIEW_KEY)],
      wallet1
    );

    expect(result.result).toBeOk(Cl.bool(true));

    // Verify the stored keys are the updated ones
    const lookup = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-meta-address",
      [Cl.standardPrincipal(wallet1)],
      deployer
    );

    expect(lookup.result).toBeSome(
      Cl.tuple({
        "spend-pubkey": Cl.bufferFromHex(ALT_SPEND_KEY),
        "view-pubkey": Cl.bufferFromHex(ALT_VIEW_KEY),
      })
    );
  });

  it("should fail update if no meta-address registered (err u2003)", () => {
    // wallet2 has never registered
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "update-meta-address",
      [Cl.bufferFromHex(VALID_SPEND_KEY), Cl.bufferFromHex(VALID_VIEW_KEY)],
      wallet2
    );

    // ERR-NO-META-ADDRESS = u2003
    expect(result.result).toBeErr(Cl.uint(2003));
  });
});

// ==========================================================================
// Read-only lookups
// ==========================================================================

describe("stealth-v1 :: read-only lookups", () => {
  it("should look up meta-address by principal (get-meta-address)", () => {
    // Register
    simnet.callPublicFn(
      CONTRACT_NAME,
      "register-meta-address",
      [Cl.bufferFromHex(VALID_SPEND_KEY), Cl.bufferFromHex(VALID_VIEW_KEY)],
      wallet1
    );

    const result = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-meta-address",
      [Cl.standardPrincipal(wallet1)],
      deployer
    );

    expect(result.result).toBeSome(
      Cl.tuple({
        "spend-pubkey": Cl.bufferFromHex(VALID_SPEND_KEY),
        "view-pubkey": Cl.bufferFromHex(VALID_VIEW_KEY),
      })
    );
  });

  it("should return none for unregistered principal", () => {
    const result = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-meta-address",
      [Cl.standardPrincipal(wallet2)],
      deployer
    );

    expect(result.result).toBeNone();
  });

  it("should check has-meta-address correctly (true after registration)", () => {
    // Register wallet1
    simnet.callPublicFn(
      CONTRACT_NAME,
      "register-meta-address",
      [Cl.bufferFromHex(VALID_SPEND_KEY), Cl.bufferFromHex(VALID_VIEW_KEY)],
      wallet1
    );

    const hasIt = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "has-meta-address",
      [Cl.standardPrincipal(wallet1)],
      deployer
    );

    expect(hasIt.result).toBeBool(true);
  });

  it("should check has-meta-address correctly (false when unregistered)", () => {
    const hasIt = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "has-meta-address",
      [Cl.standardPrincipal(wallet2)],
      deployer
    );

    expect(hasIt.result).toBeBool(false);
  });
});

// ==========================================================================
// BNS name linking
// ==========================================================================

describe("stealth-v1 :: link-btc-name", () => {
  it("should link a BNS name", () => {
    // Must register meta-address first
    simnet.callPublicFn(
      CONTRACT_NAME,
      "register-meta-address",
      [Cl.bufferFromHex(VALID_SPEND_KEY), Cl.bufferFromHex(VALID_VIEW_KEY)],
      wallet1
    );

    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "link-btc-name",
      [Cl.bufferFromHex(BNS_ALICE)],
      wallet1
    );

    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("should look up by BNS name (get-meta-address-by-name)", () => {
    // Register + link
    simnet.callPublicFn(
      CONTRACT_NAME,
      "register-meta-address",
      [Cl.bufferFromHex(VALID_SPEND_KEY), Cl.bufferFromHex(VALID_VIEW_KEY)],
      wallet1
    );
    simnet.callPublicFn(
      CONTRACT_NAME,
      "link-btc-name",
      [Cl.bufferFromHex(BNS_ALICE)],
      wallet1
    );

    const result = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-meta-address-by-name",
      [Cl.bufferFromHex(BNS_ALICE)],
      deployer
    );

    expect(result.result).toBeSome(
      Cl.tuple({
        "spend-pubkey": Cl.bufferFromHex(VALID_SPEND_KEY),
        "view-pubkey": Cl.bufferFromHex(VALID_VIEW_KEY),
      })
    );
  });

  it("should return none for an unlinked BNS name", () => {
    const result = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-meta-address-by-name",
      [Cl.bufferFromHex(BNS_BOB)],
      deployer
    );

    expect(result.result).toBeNone();
  });

  it("should reject linking already-linked name by another principal (err u2004)", () => {
    // wallet1 registers and links "alice.btc"
    simnet.callPublicFn(
      CONTRACT_NAME,
      "register-meta-address",
      [Cl.bufferFromHex(VALID_SPEND_KEY), Cl.bufferFromHex(VALID_VIEW_KEY)],
      wallet1
    );
    simnet.callPublicFn(
      CONTRACT_NAME,
      "link-btc-name",
      [Cl.bufferFromHex(BNS_ALICE)],
      wallet1
    );

    // wallet2 tries to link the same name
    simnet.callPublicFn(
      CONTRACT_NAME,
      "register-meta-address",
      [Cl.bufferFromHex(ALT_SPEND_KEY), Cl.bufferFromHex(ALT_VIEW_KEY)],
      wallet2
    );
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "link-btc-name",
      [Cl.bufferFromHex(BNS_ALICE)],
      wallet2
    );

    // ERR-NAME-ALREADY-LINKED = u2004
    expect(result.result).toBeErr(Cl.uint(2004));
  });

  it("should allow the same principal to re-link their own name (idempotent)", () => {
    // Register + link
    simnet.callPublicFn(
      CONTRACT_NAME,
      "register-meta-address",
      [Cl.bufferFromHex(VALID_SPEND_KEY), Cl.bufferFromHex(VALID_VIEW_KEY)],
      wallet1
    );
    simnet.callPublicFn(
      CONTRACT_NAME,
      "link-btc-name",
      [Cl.bufferFromHex(BNS_ALICE)],
      wallet1
    );

    // Linking again with the same principal should succeed
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "link-btc-name",
      [Cl.bufferFromHex(BNS_ALICE)],
      wallet1
    );

    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("should reject linking if caller has no meta-address (err u2003)", () => {
    // wallet2 has no meta-address
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "link-btc-name",
      [Cl.bufferFromHex(BNS_BOB)],
      wallet2
    );

    // ERR-NO-META-ADDRESS = u2003
    expect(result.result).toBeErr(Cl.uint(2003));
  });
});

// ==========================================================================
// BNS name unlinking
// ==========================================================================

describe("stealth-v1 :: unlink-btc-name", () => {
  it("should unlink a BNS name", () => {
    // Register + link
    simnet.callPublicFn(
      CONTRACT_NAME,
      "register-meta-address",
      [Cl.bufferFromHex(VALID_SPEND_KEY), Cl.bufferFromHex(VALID_VIEW_KEY)],
      wallet1
    );
    simnet.callPublicFn(
      CONTRACT_NAME,
      "link-btc-name",
      [Cl.bufferFromHex(BNS_ALICE)],
      wallet1
    );

    // Unlink
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "unlink-btc-name",
      [Cl.bufferFromHex(BNS_ALICE)],
      wallet1
    );

    expect(result.result).toBeOk(Cl.bool(true));

    // Verify name no longer resolves
    const lookup = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-meta-address-by-name",
      [Cl.bufferFromHex(BNS_ALICE)],
      deployer
    );

    expect(lookup.result).toBeNone();
  });

  it("should reject unlinking name not owned by caller (err u2001)", () => {
    // wallet1 registers and links
    simnet.callPublicFn(
      CONTRACT_NAME,
      "register-meta-address",
      [Cl.bufferFromHex(VALID_SPEND_KEY), Cl.bufferFromHex(VALID_VIEW_KEY)],
      wallet1
    );
    simnet.callPublicFn(
      CONTRACT_NAME,
      "link-btc-name",
      [Cl.bufferFromHex(BNS_ALICE)],
      wallet1
    );

    // wallet2 tries to unlink wallet1's name
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "unlink-btc-name",
      [Cl.bufferFromHex(BNS_ALICE)],
      wallet2
    );

    // ERR-NOT-AUTHORIZED = u2001
    expect(result.result).toBeErr(Cl.uint(2001));
  });

  it("should reject unlinking a name that was never linked (err u2001)", () => {
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "unlink-btc-name",
      [Cl.bufferFromHex(BNS_BOB)],
      wallet1
    );

    // ERR-NOT-AUTHORIZED = u2001
    expect(result.result).toBeErr(Cl.uint(2001));
  });
});
