import { describe, it, expect, beforeEach } from "vitest";
import { Cl, ClarityType } from "@stacks/transactions";
import { buildValidProof } from "../helpers/proof-builder";

// ============================================================================
// Constants
// ============================================================================

const POOL_DENOMINATION = 10_000_000; // 0.1 sBTC
const MINT_AMOUNT = 100_000_000; // 1 sBTC

// Commitments
const COMMITMENT_1 =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const COMMITMENT_2 =
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

// Nullifiers
const NULLIFIER_1 =
  "1111111111111111111111111111111111111111111111111111111111111111";
const NULLIFIER_2 =
  "2222222222222222222222222222222222222222222222222222222222222222";

// Ephemeral pubkey (33-byte compressed secp256k1 key for stealth detection)
const EPHEMERAL_PUBKEY =
  "020000000000000000000000000000000000000000000000000000000000000001";

// Stealth meta-address keys
const SPEND_PUBKEY =
  "021111111111111111111111111111111111111111111111111111111111111111";
const VIEW_PUBKEY =
  "031111111111111111111111111111111111111111111111111111111111111111";

// ============================================================================
// Account setup
// ============================================================================

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const depositor = accounts.get("wallet_1")!;
const recipient = accounts.get("wallet_2")!;
const relayer = accounts.get("wallet_3")!;

// ============================================================================
// Helpers
// ============================================================================

function authorizePoolOnMerkleTree() {
  simnet.callPublicFn(
    "merkle-tree",
    "set-authorized-caller",
    [Cl.contractPrincipal(deployer, "pool-v1"), Cl.bool(true)],
    deployer,
  );
}

function bufferCvToHex(cv: any): string {
  if (cv && cv.type === ClarityType.Buffer) {
    return cv.value as string;
  }
  return "";
}

function getBalance(address: string): bigint {
  const result = simnet.callReadOnlyFn(
    "sbtc-token",
    "get-balance",
    [Cl.standardPrincipal(address)],
    deployer,
  );
  if (
    result.result.type === ClarityType.ResponseOk &&
    result.result.value.type === ClarityType.UInt
  ) {
    return result.result.value.value;
  }
  return 0n;
}

function getContractBalance(
  contractAddr: string,
  contractName: string,
): bigint {
  const result = simnet.callReadOnlyFn(
    "sbtc-token",
    "get-balance",
    [Cl.contractPrincipal(contractAddr, contractName)],
    deployer,
  );
  if (
    result.result.type === ClarityType.ResponseOk &&
    result.result.value.type === ClarityType.UInt
  ) {
    return result.result.value.value;
  }
  return 0n;
}

function getCurrentRootHex(): string {
  const result = simnet.callReadOnlyFn(
    "merkle-tree",
    "get-current-root",
    [],
    deployer,
  );
  return bufferCvToHex(result.result);
}

// ============================================================================
// Integration test: End-to-end withdrawal flow
// ============================================================================

describe("integration: withdrawal flow", () => {
  beforeEach(() => {
    authorizePoolOnMerkleTree();
  });
  it("should complete a full deposit -> withdrawal cycle", () => {
    // -----------------------------------------------------------------------
    // Phase 1: Setup - mint sBTC and register stealth meta-address
    // -----------------------------------------------------------------------
    const mintResult = simnet.callPublicFn(
      "sbtc-token",
      "mint",
      [Cl.uint(MINT_AMOUNT), Cl.standardPrincipal(depositor)],
      deployer,
    );
    expect(mintResult.result).toHaveClarityType(ClarityType.ResponseOk);

    // Register recipient's stealth meta-address (simulates off-chain discovery)
    const registerResult = simnet.callPublicFn(
      "stealth-v1",
      "register-meta-address",
      [Cl.bufferFromHex(SPEND_PUBKEY), Cl.bufferFromHex(VIEW_PUBKEY)],
      recipient,
    );
    expect(registerResult.result).toBeOk(Cl.bool(true));

    // -----------------------------------------------------------------------
    // Phase 2: Approve pool contract and deposit
    // -----------------------------------------------------------------------
    simnet.callPublicFn(
      "sbtc-token",
      "approve",
      [
        Cl.contractPrincipal(deployer, "pool-v1"),
        Cl.uint(POOL_DENOMINATION),
      ],
      depositor,
    );

    const depositResult = simnet.callPublicFn(
      "pool-v1",
      "deposit",
      [
        Cl.bufferFromHex(COMMITMENT_1),
        Cl.standardPrincipal(depositor),
      ],
      depositor,
    );
    expect(depositResult.result).toHaveClarityType(ClarityType.ResponseOk);

    // Verify pool holds the funds
    const poolBalance = getContractBalance(deployer, "pool-v1");
    expect(poolBalance).toBe(BigInt(POOL_DENOMINATION));

    const root = getCurrentRootHex();

    // -----------------------------------------------------------------------
    // Phase 3: Authorize pool-v1 on nullifier-registry
    // -----------------------------------------------------------------------
    const authResult = simnet.callPublicFn(
      "nullifier-registry",
      "set-authorized-contract",
      [Cl.contractPrincipal(deployer, "pool-v1")],
      deployer,
    );
    expect(authResult.result).toBeOk(Cl.bool(true));

    // -----------------------------------------------------------------------
    // Phase 4: Submit withdrawal
    // -----------------------------------------------------------------------
    const relayerFee = 50_000; // 0.0005 sBTC
    const recipientAmount = POOL_DENOMINATION - relayerFee;

    const recipientBalanceBefore = getBalance(recipient);
    const relayerBalanceBefore = getBalance(relayer);

    const withdrawProof = buildValidProof(NULLIFIER_1, root, recipient, relayerFee);
    const withdrawResult = simnet.callPublicFn(
      "pool-v1",
      "withdraw",
      [
        Cl.bufferFromHex(withdrawProof),
        Cl.bufferFromHex(NULLIFIER_1),
        Cl.bufferFromHex(root),
        Cl.standardPrincipal(recipient),
        Cl.bufferFromHex(EPHEMERAL_PUBKEY),
        Cl.uint(relayerFee),
      ],
      relayer,
    );
    expect(withdrawResult.result).toBeOk(
      Cl.tuple({ nullifier: Cl.bufferFromHex(NULLIFIER_1) }),
    );

    // -----------------------------------------------------------------------
    // Phase 5: Verify post-withdrawal state
    // -----------------------------------------------------------------------

    // 5a: sBTC transferred to recipient (minus relayer fee)
    const recipientBalanceAfter = getBalance(recipient);
    expect(recipientBalanceAfter - recipientBalanceBefore).toBe(
      BigInt(recipientAmount),
    );

    // 5b: Relayer fee paid
    const relayerBalanceAfter = getBalance(relayer);
    expect(relayerBalanceAfter - relayerBalanceBefore).toBe(
      BigInt(relayerFee),
    );

    // 5c: Pool is now empty
    const poolBalanceAfter = getContractBalance(deployer, "pool-v1");
    expect(poolBalanceAfter).toBe(0n);

    // 5d: Nullifier marked as used
    const nullifierUsed = simnet.callReadOnlyFn(
      "pool-v1",
      "is-nullifier-used",
      [Cl.bufferFromHex(NULLIFIER_1)],
      deployer,
    );
    expect(nullifierUsed.result).toBeOk(Cl.bool(true));

    // 5e: Root is still known (historical)
    const rootKnown = simnet.callReadOnlyFn(
      "pool-v1",
      "is-known-root",
      [Cl.bufferFromHex(root)],
      deployer,
    );
    expect(rootKnown.result).toBeOk(Cl.bool(true));
  });

  it("should reject double-spend (same nullifier used twice)", () => {
    // Setup: two deposits so pool has enough funds for two withdrawals
    simnet.callPublicFn(
      "sbtc-token",
      "mint",
      [Cl.uint(MINT_AMOUNT), Cl.standardPrincipal(depositor)],
      deployer,
    );
    simnet.callPublicFn(
      "sbtc-token",
      "approve",
      [
        Cl.contractPrincipal(deployer, "pool-v1"),
        Cl.uint(POOL_DENOMINATION * 2),
      ],
      depositor,
    );

    simnet.callPublicFn(
      "pool-v1",
      "deposit",
      [
        Cl.bufferFromHex(COMMITMENT_1),
        Cl.standardPrincipal(depositor),
      ],
      depositor,
    );
    simnet.callPublicFn(
      "pool-v1",
      "deposit",
      [
        Cl.bufferFromHex(COMMITMENT_2),
        Cl.standardPrincipal(depositor),
      ],
      depositor,
    );

    const root = getCurrentRootHex();

    // Authorize pool on nullifier registry
    simnet.callPublicFn(
      "nullifier-registry",
      "set-authorized-contract",
      [Cl.contractPrincipal(deployer, "pool-v1")],
      deployer,
    );

    // First withdrawal succeeds
    const dsProof1 = buildValidProof(NULLIFIER_1, root, recipient, 0);
    const firstWithdraw = simnet.callPublicFn(
      "pool-v1",
      "withdraw",
      [
        Cl.bufferFromHex(dsProof1),
        Cl.bufferFromHex(NULLIFIER_1),
        Cl.bufferFromHex(root),
        Cl.standardPrincipal(recipient),
        Cl.bufferFromHex(EPHEMERAL_PUBKEY),
        Cl.uint(0),
      ],
      relayer,
    );
    expect(firstWithdraw.result).toHaveClarityType(ClarityType.ResponseOk);

    // Second withdrawal with SAME nullifier is rejected (double-spend attempt)
    const dsProof2 = buildValidProof(NULLIFIER_1, root, recipient, 0);
    const secondWithdraw = simnet.callPublicFn(
      "pool-v1",
      "withdraw",
      [
        Cl.bufferFromHex(dsProof2),
        Cl.bufferFromHex(NULLIFIER_1),
        Cl.bufferFromHex(root),
        Cl.standardPrincipal(recipient),
        Cl.bufferFromHex(EPHEMERAL_PUBKEY),
        Cl.uint(0),
      ],
      relayer,
    );
    expect(secondWithdraw.result).toBeErr(Cl.uint(1003));

    // Recipient should have received exactly one denomination
    const recipientBalance = getBalance(recipient);
    expect(recipientBalance).toBe(BigInt(POOL_DENOMINATION));
  });

  it("should allow two independent withdrawals with different nullifiers", () => {
    // Setup: two deposits
    simnet.callPublicFn(
      "sbtc-token",
      "mint",
      [Cl.uint(MINT_AMOUNT), Cl.standardPrincipal(depositor)],
      deployer,
    );
    simnet.callPublicFn(
      "sbtc-token",
      "approve",
      [
        Cl.contractPrincipal(deployer, "pool-v1"),
        Cl.uint(POOL_DENOMINATION * 2),
      ],
      depositor,
    );
    simnet.callPublicFn(
      "pool-v1",
      "deposit",
      [
        Cl.bufferFromHex(COMMITMENT_1),
        Cl.standardPrincipal(depositor),
      ],
      depositor,
    );
    simnet.callPublicFn(
      "pool-v1",
      "deposit",
      [
        Cl.bufferFromHex(COMMITMENT_2),
        Cl.standardPrincipal(depositor),
      ],
      depositor,
    );

    const root = getCurrentRootHex();

    // Authorize
    simnet.callPublicFn(
      "nullifier-registry",
      "set-authorized-contract",
      [Cl.contractPrincipal(deployer, "pool-v1")],
      deployer,
    );

    // First withdrawal with NULLIFIER_1
    const indepProof1 = buildValidProof(NULLIFIER_1, root, recipient, 0);
    const withdraw1 = simnet.callPublicFn(
      "pool-v1",
      "withdraw",
      [
        Cl.bufferFromHex(indepProof1),
        Cl.bufferFromHex(NULLIFIER_1),
        Cl.bufferFromHex(root),
        Cl.standardPrincipal(recipient),
        Cl.bufferFromHex(EPHEMERAL_PUBKEY),
        Cl.uint(0),
      ],
      relayer,
    );
    expect(withdraw1.result).toHaveClarityType(ClarityType.ResponseOk);

    // Second withdrawal with NULLIFIER_2 (different nullifier)
    const indepProof2 = buildValidProof(NULLIFIER_2, root, recipient, 0);
    const withdraw2 = simnet.callPublicFn(
      "pool-v1",
      "withdraw",
      [
        Cl.bufferFromHex(indepProof2),
        Cl.bufferFromHex(NULLIFIER_2),
        Cl.bufferFromHex(root),
        Cl.standardPrincipal(recipient),
        Cl.bufferFromHex(EPHEMERAL_PUBKEY),
        Cl.uint(0),
      ],
      relayer,
    );
    expect(withdraw2.result).toHaveClarityType(ClarityType.ResponseOk);

    // Both nullifiers should be marked used
    const used1 = simnet.callReadOnlyFn(
      "pool-v1",
      "is-nullifier-used",
      [Cl.bufferFromHex(NULLIFIER_1)],
      deployer,
    );
    expect(used1.result).toBeOk(Cl.bool(true));

    const used2 = simnet.callReadOnlyFn(
      "pool-v1",
      "is-nullifier-used",
      [Cl.bufferFromHex(NULLIFIER_2)],
      deployer,
    );
    expect(used2.result).toBeOk(Cl.bool(true));

    // Pool should be fully drained
    const poolBalance = getContractBalance(deployer, "pool-v1");
    expect(poolBalance).toBe(0n);

    // Recipient received 2x denomination
    const recipientBalance = getBalance(recipient);
    expect(recipientBalance).toBe(BigInt(POOL_DENOMINATION * 2));
  });

  it("should reject withdrawal with an unknown root", () => {
    // Setup: deposit first
    simnet.callPublicFn(
      "sbtc-token",
      "mint",
      [Cl.uint(MINT_AMOUNT), Cl.standardPrincipal(depositor)],
      deployer,
    );
    simnet.callPublicFn(
      "sbtc-token",
      "approve",
      [
        Cl.contractPrincipal(deployer, "pool-v1"),
        Cl.uint(POOL_DENOMINATION),
      ],
      depositor,
    );
    simnet.callPublicFn(
      "pool-v1",
      "deposit",
      [
        Cl.bufferFromHex(COMMITMENT_1),
        Cl.standardPrincipal(depositor),
      ],
      depositor,
    );

    // Authorize
    simnet.callPublicFn(
      "nullifier-registry",
      "set-authorized-contract",
      [Cl.contractPrincipal(deployer, "pool-v1")],
      deployer,
    );

    // Try to withdraw with a fabricated root
    const fakeRoot =
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    const fakeProof = buildValidProof(NULLIFIER_1, fakeRoot, recipient, 0);
    const withdrawResult = simnet.callPublicFn(
      "pool-v1",
      "withdraw",
      [
        Cl.bufferFromHex(fakeProof),
        Cl.bufferFromHex(NULLIFIER_1),
        Cl.bufferFromHex(fakeRoot),
        Cl.standardPrincipal(recipient),
        Cl.bufferFromHex(EPHEMERAL_PUBKEY),
        Cl.uint(0),
      ],
      relayer,
    );
    expect(withdrawResult.result).toBeErr(Cl.uint(1005));
  });

  it("should correctly split funds between recipient and relayer", () => {
    // Setup
    simnet.callPublicFn(
      "sbtc-token",
      "mint",
      [Cl.uint(MINT_AMOUNT), Cl.standardPrincipal(depositor)],
      deployer,
    );
    simnet.callPublicFn(
      "sbtc-token",
      "approve",
      [
        Cl.contractPrincipal(deployer, "pool-v1"),
        Cl.uint(POOL_DENOMINATION),
      ],
      depositor,
    );
    simnet.callPublicFn(
      "pool-v1",
      "deposit",
      [
        Cl.bufferFromHex(COMMITMENT_1),
        Cl.standardPrincipal(depositor),
      ],
      depositor,
    );

    const root = getCurrentRootHex();

    simnet.callPublicFn(
      "nullifier-registry",
      "set-authorized-contract",
      [Cl.contractPrincipal(deployer, "pool-v1")],
      deployer,
    );

    const relayerFee = 1_000_000; // 10% fee
    const expectedRecipientAmount = POOL_DENOMINATION - relayerFee;

    const recipientBefore = getBalance(recipient);
    const relayerBefore = getBalance(relayer);

    const feeProof = buildValidProof(NULLIFIER_1, root, recipient, relayerFee);
    simnet.callPublicFn(
      "pool-v1",
      "withdraw",
      [
        Cl.bufferFromHex(feeProof),
        Cl.bufferFromHex(NULLIFIER_1),
        Cl.bufferFromHex(root),
        Cl.standardPrincipal(recipient),
        Cl.bufferFromHex(EPHEMERAL_PUBKEY),
        Cl.uint(relayerFee),
      ],
      relayer,
    );

    const recipientAfter = getBalance(recipient);
    const relayerAfter = getBalance(relayer);

    // Verify exact amounts
    expect(recipientAfter - recipientBefore).toBe(
      BigInt(expectedRecipientAmount),
    );
    expect(relayerAfter - relayerBefore).toBe(BigInt(relayerFee));

    // Total distributed should equal the pool denomination
    const totalDistributed =
      (recipientAfter - recipientBefore) + (relayerAfter - relayerBefore);
    expect(totalDistributed).toBe(BigInt(POOL_DENOMINATION));
  });

  it("should handle full cycle: deposit -> withdraw -> re-deposit -> withdraw", () => {
    // Authorize pool on nullifier registry upfront
    simnet.callPublicFn(
      "nullifier-registry",
      "set-authorized-contract",
      [Cl.contractPrincipal(deployer, "pool-v1")],
      deployer,
    );

    // Mint enough for two deposits
    simnet.callPublicFn(
      "sbtc-token",
      "mint",
      [Cl.uint(MINT_AMOUNT), Cl.standardPrincipal(depositor)],
      deployer,
    );
    simnet.callPublicFn(
      "sbtc-token",
      "approve",
      [
        Cl.contractPrincipal(deployer, "pool-v1"),
        Cl.uint(POOL_DENOMINATION * 2),
      ],
      depositor,
    );

    // --- Cycle 1: Deposit + Withdraw ---
    simnet.callPublicFn(
      "pool-v1",
      "deposit",
      [
        Cl.bufferFromHex(COMMITMENT_1),
        Cl.standardPrincipal(depositor),
      ],
      depositor,
    );
    const root1 = getCurrentRootHex();

    const cycleProof1 = buildValidProof(NULLIFIER_1, root1, recipient, 0);
    const withdraw1 = simnet.callPublicFn(
      "pool-v1",
      "withdraw",
      [
        Cl.bufferFromHex(cycleProof1),
        Cl.bufferFromHex(NULLIFIER_1),
        Cl.bufferFromHex(root1),
        Cl.standardPrincipal(recipient),
        Cl.bufferFromHex(EPHEMERAL_PUBKEY),
        Cl.uint(0),
      ],
      relayer,
    );
    expect(withdraw1.result).toHaveClarityType(ClarityType.ResponseOk);

    // Pool empty after first cycle
    expect(getContractBalance(deployer, "pool-v1")).toBe(0n);

    // --- Cycle 2: Re-deposit + Withdraw ---
    simnet.callPublicFn(
      "pool-v1",
      "deposit",
      [
        Cl.bufferFromHex(COMMITMENT_2),
        Cl.standardPrincipal(depositor),
      ],
      depositor,
    );
    const root2 = getCurrentRootHex();

    const cycleProof2 = buildValidProof(NULLIFIER_2, root2, recipient, 0);
    const withdraw2 = simnet.callPublicFn(
      "pool-v1",
      "withdraw",
      [
        Cl.bufferFromHex(cycleProof2),
        Cl.bufferFromHex(NULLIFIER_2),
        Cl.bufferFromHex(root2),
        Cl.standardPrincipal(recipient),
        Cl.bufferFromHex(EPHEMERAL_PUBKEY),
        Cl.uint(0),
      ],
      relayer,
    );
    expect(withdraw2.result).toHaveClarityType(ClarityType.ResponseOk);

    // Pool empty after second cycle
    expect(getContractBalance(deployer, "pool-v1")).toBe(0n);

    // Both nullifiers used
    const used1 = simnet.callReadOnlyFn(
      "pool-v1",
      "is-nullifier-used",
      [Cl.bufferFromHex(NULLIFIER_1)],
      deployer,
    );
    expect(used1.result).toBeOk(Cl.bool(true));

    const used2 = simnet.callReadOnlyFn(
      "pool-v1",
      "is-nullifier-used",
      [Cl.bufferFromHex(NULLIFIER_2)],
      deployer,
    );
    expect(used2.result).toBeOk(Cl.bool(true));

    // Recipient received 2x denomination total
    const recipientBalance = getBalance(recipient);
    expect(recipientBalance).toBe(BigInt(POOL_DENOMINATION * 2));
  });
});
