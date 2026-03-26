import { describe, it, expect, beforeEach } from "vitest";
import { Cl, ClarityType } from "@stacks/transactions";

// ============================================================================
// Constants
// ============================================================================

const POOL_DENOMINATION = 10_000_000; // 0.1 sBTC
const MINT_AMOUNT = 100_000_000; // 1 sBTC

// Test commitments (32-byte Pedersen commitment hashes)
const COMMITMENT_1 =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const COMMITMENT_2 =
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

// Stealth meta-address keys (33-byte compressed secp256k1 pubkeys)
const SPEND_PUBKEY =
  "021111111111111111111111111111111111111111111111111111111111111111";
const VIEW_PUBKEY =
  "031111111111111111111111111111111111111111111111111111111111111111";

// The initial empty merkle tree root
const EMPTY_ROOT =
  "799881750019ca39515941a00231729514ca4029498a0c675e9d66a0f4340103";

// ============================================================================
// Account setup
// ============================================================================

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

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

// ============================================================================
// Integration test: End-to-end deposit flow
// ============================================================================

describe("integration: deposit flow", () => {
  // Authorize pool-v1 to call merkle-tree.append-leaf (security audit added access control)
  beforeEach(() => {
    authorizePoolOnMerkleTree();
  });
  it("should complete a full deposit: mint -> register meta-address -> approve -> deposit -> verify", () => {
    // -----------------------------------------------------------------------
    // Step 1: Setup - mint sBTC to the depositor
    // -----------------------------------------------------------------------
    const mintResult = simnet.callPublicFn(
      "sbtc-token",
      "mint",
      [Cl.uint(MINT_AMOUNT), Cl.standardPrincipal(wallet1)],
      deployer,
    );
    expect(mintResult.result).toHaveClarityType(ClarityType.ResponseOk);

    const balanceAfterMint = getBalance(wallet1);
    expect(balanceAfterMint).toBe(BigInt(MINT_AMOUNT));

    // -----------------------------------------------------------------------
    // Step 2: Register stealth meta-address for the depositor
    // -----------------------------------------------------------------------
    const registerResult = simnet.callPublicFn(
      "stealth-v1",
      "register-meta-address",
      [Cl.bufferFromHex(SPEND_PUBKEY), Cl.bufferFromHex(VIEW_PUBKEY)],
      wallet1,
    );
    expect(registerResult.result).toBeOk(Cl.bool(true));

    // Verify meta-address is stored
    const metaAddr = simnet.callReadOnlyFn(
      "stealth-v1",
      "get-meta-address",
      [Cl.standardPrincipal(wallet1)],
      deployer,
    );
    expect(metaAddr.result).toBeSome(
      Cl.tuple({
        "spend-pubkey": Cl.bufferFromHex(SPEND_PUBKEY),
        "view-pubkey": Cl.bufferFromHex(VIEW_PUBKEY),
      }),
    );

    // -----------------------------------------------------------------------
    // Step 3: Approve pool contract for sBTC transfer
    // -----------------------------------------------------------------------
    const approveResult = simnet.callPublicFn(
      "sbtc-token",
      "approve",
      [
        Cl.contractPrincipal(deployer, "pool-v1"),
        Cl.uint(POOL_DENOMINATION),
      ],
      wallet1,
    );
    expect(approveResult.result).toBeOk(Cl.bool(true));

    // Verify allowance
    const allowance = simnet.callReadOnlyFn(
      "sbtc-token",
      "get-allowance-of",
      [
        Cl.standardPrincipal(wallet1),
        Cl.contractPrincipal(deployer, "pool-v1"),
      ],
      deployer,
    );
    expect(allowance.result).toBeOk(Cl.uint(POOL_DENOMINATION));

    // -----------------------------------------------------------------------
    // Step 4: Record initial state before deposit
    // -----------------------------------------------------------------------
    const rootBefore = simnet.callReadOnlyFn(
      "merkle-tree",
      "get-current-root",
      [],
      deployer,
    );
    expect(rootBefore.result).toBeBuff(EMPTY_ROOT);

    const leafIndexBefore = simnet.callReadOnlyFn(
      "merkle-tree",
      "get-next-leaf-index",
      [],
      deployer,
    );
    expect(leafIndexBefore.result).toBeUint(0);

    const poolBalanceBefore = getContractBalance(deployer, "pool-v1");
    expect(poolBalanceBefore).toBe(0n);

    // -----------------------------------------------------------------------
    // Step 5: Submit deposit with commitment
    // -----------------------------------------------------------------------
    const depositResult = simnet.callPublicFn(
      "pool-v1",
      "deposit",
      [
        Cl.bufferFromHex(COMMITMENT_1),
        Cl.standardPrincipal(wallet1),
      ],
      wallet1,
    );
    expect(depositResult.result).toHaveClarityType(ClarityType.ResponseOk);

    // -----------------------------------------------------------------------
    // Step 6: Verify - Merkle tree updated
    // -----------------------------------------------------------------------
    const rootAfter = simnet.callReadOnlyFn(
      "merkle-tree",
      "get-current-root",
      [],
      deployer,
    );
    // Root must have changed from empty
    expect(rootAfter.result).not.toBeBuff(EMPTY_ROOT);

    const leafIndexAfter = simnet.callReadOnlyFn(
      "merkle-tree",
      "get-next-leaf-index",
      [],
      deployer,
    );
    expect(leafIndexAfter.result).toBeUint(1);

    // New root should be recognized as a known root
    const newRootHex = bufferCvToHex(rootAfter.result);
    const isKnown = simnet.callReadOnlyFn(
      "pool-v1",
      "is-known-root",
      [Cl.bufferFromHex(newRootHex)],
      deployer,
    );
    expect(isKnown.result).toBeOk(Cl.bool(true));

    // -----------------------------------------------------------------------
    // Step 7: Verify - sBTC transferred from depositor to pool
    // -----------------------------------------------------------------------
    const balanceAfterDeposit = getBalance(wallet1);
    expect(balanceAfterDeposit).toBe(
      BigInt(MINT_AMOUNT - POOL_DENOMINATION),
    );

    const poolBalanceAfter = getContractBalance(deployer, "pool-v1");
    expect(poolBalanceAfter).toBe(BigInt(POOL_DENOMINATION));

    // -----------------------------------------------------------------------
    // Step 8: Verify - commitment recorded and queryable
    // -----------------------------------------------------------------------
    const depositInfo = simnet.callReadOnlyFn(
      "pool-v1",
      "get-deposit-info",
      [Cl.bufferFromHex(COMMITMENT_1)],
      deployer,
    );
    expect(depositInfo.result).toHaveClarityType(ClarityType.OptionalSome);
  });

  it("should handle multiple sequential deposits from different users", () => {
    // Mint to both wallets
    simnet.callPublicFn(
      "sbtc-token",
      "mint",
      [Cl.uint(MINT_AMOUNT), Cl.standardPrincipal(wallet1)],
      deployer,
    );
    simnet.callPublicFn(
      "sbtc-token",
      "mint",
      [Cl.uint(MINT_AMOUNT), Cl.standardPrincipal(wallet2)],
      deployer,
    );

    // Both approve the pool
    simnet.callPublicFn(
      "sbtc-token",
      "approve",
      [Cl.contractPrincipal(deployer, "pool-v1"), Cl.uint(POOL_DENOMINATION)],
      wallet1,
    );
    simnet.callPublicFn(
      "sbtc-token",
      "approve",
      [Cl.contractPrincipal(deployer, "pool-v1"), Cl.uint(POOL_DENOMINATION)],
      wallet2,
    );

    // First deposit from wallet1
    const deposit1 = simnet.callPublicFn(
      "pool-v1",
      "deposit",
      [
        Cl.bufferFromHex(COMMITMENT_1),
        Cl.standardPrincipal(wallet1),
      ],
      wallet1,
    );
    expect(deposit1.result).toHaveClarityType(ClarityType.ResponseOk);

    const rootAfterFirst = bufferCvToHex(
      simnet.callReadOnlyFn("merkle-tree", "get-current-root", [], deployer)
        .result,
    );

    // Second deposit from wallet2
    const deposit2 = simnet.callPublicFn(
      "pool-v1",
      "deposit",
      [
        Cl.bufferFromHex(COMMITMENT_2),
        Cl.standardPrincipal(wallet2),
      ],
      wallet2,
    );
    expect(deposit2.result).toHaveClarityType(ClarityType.ResponseOk);

    const rootAfterSecond = bufferCvToHex(
      simnet.callReadOnlyFn("merkle-tree", "get-current-root", [], deployer)
        .result,
    );

    // Roots should differ after each deposit
    expect(rootAfterFirst).not.toBe(rootAfterSecond);

    // Both historical roots should be known
    const isKnown1 = simnet.callReadOnlyFn(
      "pool-v1",
      "is-known-root",
      [Cl.bufferFromHex(rootAfterFirst)],
      deployer,
    );
    expect(isKnown1.result).toBeOk(Cl.bool(true));

    const isKnown2 = simnet.callReadOnlyFn(
      "pool-v1",
      "is-known-root",
      [Cl.bufferFromHex(rootAfterSecond)],
      deployer,
    );
    expect(isKnown2.result).toBeOk(Cl.bool(true));

    // Pool should have 2x denomination
    const poolBalance = getContractBalance(deployer, "pool-v1");
    expect(poolBalance).toBe(BigInt(POOL_DENOMINATION * 2));

    // leaf-index should be 2
    const leafIndex = simnet.callReadOnlyFn(
      "merkle-tree",
      "get-next-leaf-index",
      [],
      deployer,
    );
    expect(leafIndex.result).toBeUint(2);

    // Both commitments should be stored
    const info1 = simnet.callReadOnlyFn(
      "pool-v1",
      "get-deposit-info",
      [Cl.bufferFromHex(COMMITMENT_1)],
      deployer,
    );
    expect(info1.result).toHaveClarityType(ClarityType.OptionalSome);

    const info2 = simnet.callReadOnlyFn(
      "pool-v1",
      "get-deposit-info",
      [Cl.bufferFromHex(COMMITMENT_2)],
      deployer,
    );
    expect(info2.result).toHaveClarityType(ClarityType.OptionalSome);
  });

  it("should reject a deposit flow when sBTC mint is skipped", () => {
    // Approve without having minted (wallet has no sBTC)
    simnet.callPublicFn(
      "sbtc-token",
      "approve",
      [Cl.contractPrincipal(deployer, "pool-v1"), Cl.uint(POOL_DENOMINATION)],
      wallet1,
    );

    const depositResult = simnet.callPublicFn(
      "pool-v1",
      "deposit",
      [
        Cl.bufferFromHex(COMMITMENT_1),
        Cl.standardPrincipal(wallet1),
      ],
      wallet1,
    );
    // Should fail with transfer error
    expect(depositResult.result).toBeErr(Cl.uint(1007));
  });

  it("should reject relayer deposit when source has not approved the relayer", () => {
    // Mint to wallet1 but don't set allowance for wallet2 (the relayer)
    simnet.callPublicFn(
      "sbtc-token",
      "mint",
      [Cl.uint(MINT_AMOUNT), Cl.standardPrincipal(wallet1)],
      deployer,
    );

    // wallet2 attempts to deposit on behalf of wallet1 without approval
    const depositResult = simnet.callPublicFn(
      "pool-v1",
      "deposit",
      [
        Cl.bufferFromHex(COMMITMENT_1),
        Cl.standardPrincipal(wallet1),
      ],
      wallet2,
    );
    // Fails because sbtc-token checks allowance for (wallet1, wallet2) which is 0
    expect(depositResult.result).toBeErr(Cl.uint(1007));
  });

  it("should reject a deposit flow with duplicate commitment after successful deposit", () => {
    simnet.callPublicFn(
      "sbtc-token",
      "mint",
      [Cl.uint(MINT_AMOUNT), Cl.standardPrincipal(wallet1)],
      deployer,
    );
    simnet.callPublicFn(
      "sbtc-token",
      "approve",
      [
        Cl.contractPrincipal(deployer, "pool-v1"),
        Cl.uint(POOL_DENOMINATION * 2),
      ],
      wallet1,
    );

    // First deposit succeeds
    const first = simnet.callPublicFn(
      "pool-v1",
      "deposit",
      [
        Cl.bufferFromHex(COMMITMENT_1),
        Cl.standardPrincipal(wallet1),
      ],
      wallet1,
    );
    expect(first.result).toHaveClarityType(ClarityType.ResponseOk);

    // Second deposit with same commitment fails
    const second = simnet.callPublicFn(
      "pool-v1",
      "deposit",
      [
        Cl.bufferFromHex(COMMITMENT_1),
        Cl.standardPrincipal(wallet1),
      ],
      wallet1,
    );
    expect(second.result).toBeErr(Cl.uint(1008));

    // Only one denomination should have left the wallet
    const balance = getBalance(wallet1);
    expect(balance).toBe(BigInt(MINT_AMOUNT - POOL_DENOMINATION));
  });
});
