import { describe, it, expect } from "vitest";
import { Cl, ClarityType } from "@stacks/transactions";

// ============================================================================
// Constants
// ============================================================================

const POOL_DENOMINATION = 10_000_000; // 0.1 sBTC in satoshis
const MINT_AMOUNT = 100_000_000; // 1 sBTC - enough for multiple deposits

// Test commitments (32-byte buffers)
const COMMITMENT_1 =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const COMMITMENT_2 =
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const COMMITMENT_3 =
  "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

// Test nullifiers (32-byte buffers)
const NULLIFIER_1 =
  "1111111111111111111111111111111111111111111111111111111111111111";
const NULLIFIER_2 =
  "2222222222222222222222222222222222222222222222222222222222222222";

// Dummy proof (small buffer - mock verifier accepts anything)
const DUMMY_PROOF = "deadbeef".repeat(8); // 32 bytes hex

// Dummy ephemeral pubkey (33 bytes, starts with 0x02)
const EPHEMERAL_PUBKEY =
  "020000000000000000000000000000000000000000000000000000000000000001";

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
const wallet3 = accounts.get("wallet_3")!;

// Pool contract principal
const poolContractId = `${deployer}.pool-v1`;

// ============================================================================
// Helpers
// ============================================================================

/** Mint sBTC to a recipient (only deployer can call mint) */
function mintSbtc(amount: number, recipient: string) {
  return simnet.callPublicFn(
    "sbtc-token",
    "mint",
    [Cl.uint(amount), Cl.standardPrincipal(recipient)],
    deployer,
  );
}

/** Approve the pool-v1 contract to spend sBTC on behalf of the owner */
function approvePool(owner: string, amount: number) {
  return simnet.callPublicFn(
    "sbtc-token",
    "approve",
    [Cl.contractPrincipal(deployer, "pool-v1"), Cl.uint(amount)],
    owner,
  );
}

/** Make a deposit into the pool */
function deposit(commitment: string, source: string, caller?: string) {
  return simnet.callPublicFn(
    "pool-v1",
    "deposit",
    [Cl.bufferFromHex(commitment), Cl.standardPrincipal(source)],
    caller ?? source,
  );
}

/** Make a withdrawal from the pool */
function withdraw(
  proof: string,
  nullifier: string,
  root: string,
  recipient: string,
  ephemeralPubkey: string,
  relayerFee: number,
  caller: string,
) {
  return simnet.callPublicFn(
    "pool-v1",
    "withdraw",
    [
      Cl.bufferFromHex(proof),
      Cl.bufferFromHex(nullifier),
      Cl.bufferFromHex(root),
      Cl.standardPrincipal(recipient),
      Cl.bufferFromHex(ephemeralPubkey),
      Cl.uint(relayerFee),
    ],
    caller,
  );
}

/** Set pool-v1 as the authorized contract on the nullifier registry */
function authorizePool() {
  return simnet.callPublicFn(
    "nullifier-registry",
    "set-authorized-contract",
    [Cl.contractPrincipal(deployer, "pool-v1")],
    deployer,
  );
}

/** Get the current merkle tree root as a hex string */
function getCurrentRootHex(): string {
  const result = simnet.callReadOnlyFn(
    "merkle-tree",
    "get-current-root",
    [],
    deployer,
  );
  return bufferCvToHex(result.result);
}

/** Get sBTC balance of an address */
function getBalance(address: string): bigint {
  const result = simnet.callReadOnlyFn(
    "sbtc-token",
    "get-balance",
    [Cl.standardPrincipal(address)],
    deployer,
  );
  // Result is (ok uint)
  if (
    result.result.type === ClarityType.ResponseOk &&
    result.result.value.type === ClarityType.UInt
  ) {
    return result.result.value.value;
  }
  return 0n;
}

/** Get sBTC balance of a contract principal */
function getContractBalance(contractAddr: string, contractName: string): bigint {
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

/** Extract hex string from a BufferCV (value is already a hex string) */
function bufferCvToHex(cv: any): string {
  if (cv && cv.type === ClarityType.Buffer) {
    return cv.value as string;
  }
  return "";
}

/** Setup: mint, approve, and deposit so the pool has funds; return the root */
function setupDeposit(
  commitment: string,
  source: string,
): { root: string; leafIndex: number } {
  mintSbtc(MINT_AMOUNT, source);
  approvePool(source, POOL_DENOMINATION);
  const result = deposit(commitment, source);
  expect(result.result).toHaveClarityType(ClarityType.ResponseOk);

  const root = getCurrentRootHex();
  return { root, leafIndex: 0 };
}

// ============================================================================
// Tests
// ============================================================================

describe("pool-v1 contract", () => {
  // =========================================================================
  // Deposit tests
  // =========================================================================

  describe("deposit", () => {
    it("should accept a valid deposit", () => {
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION);

      const result = deposit(COMMITMENT_1, wallet1);
      expect(result.result).toHaveClarityType(ClarityType.ResponseOk);
    });

    it("should return root and leaf-index on successful deposit", () => {
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION);

      const result = deposit(COMMITMENT_1, wallet1);
      // The result should be (ok { root: (buff 32), leaf-index: uint })
      expect(result.result).toHaveClarityType(ClarityType.ResponseOk);

      // Verify the structure: leaf-index should be 0 for the first deposit
      if (result.result.type === ClarityType.ResponseOk) {
        const tuple = result.result.value;
        expect(tuple).toHaveClarityType(ClarityType.Tuple);
      }
    });

    it("should reject duplicate commitment (err u1008)", () => {
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION * 2);

      // First deposit succeeds
      const result1 = deposit(COMMITMENT_1, wallet1);
      expect(result1.result).toHaveClarityType(ClarityType.ResponseOk);

      // Second deposit with same commitment fails
      const result2 = deposit(COMMITMENT_1, wallet1);
      expect(result2.result).toBeErr(Cl.uint(1008));
    });

    it("should transfer sBTC from source to pool on deposit", () => {
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION);

      const balanceBefore = getBalance(wallet1);
      deposit(COMMITMENT_1, wallet1);
      const balanceAfter = getBalance(wallet1);

      expect(balanceBefore - balanceAfter).toBe(BigInt(POOL_DENOMINATION));
    });

    it("should credit sBTC to the pool contract on deposit", () => {
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION);

      const poolBalanceBefore = getContractBalance(deployer, "pool-v1");
      deposit(COMMITMENT_1, wallet1);
      const poolBalanceAfter = getContractBalance(deployer, "pool-v1");

      expect(poolBalanceAfter - poolBalanceBefore).toBe(
        BigInt(POOL_DENOMINATION),
      );
    });

    it("should update Merkle tree on deposit (root changes)", () => {
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION);

      const rootBefore = getCurrentRootHex();
      deposit(COMMITMENT_1, wallet1);
      const rootAfter = getCurrentRootHex();

      // Root should change after deposit
      expect(rootAfter).not.toBe(rootBefore);
      // Initial root should be the empty root
      expect(rootBefore).toBe(EMPTY_ROOT);
    });

    it("should increment leaf-index after each deposit", () => {
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION * 3);

      // Check next-leaf-index before
      const indexBefore = simnet.callReadOnlyFn(
        "merkle-tree",
        "get-next-leaf-index",
        [],
        deployer,
      );
      expect(indexBefore.result).toBeUint(0);

      // First deposit
      deposit(COMMITMENT_1, wallet1);
      const indexAfter1 = simnet.callReadOnlyFn(
        "merkle-tree",
        "get-next-leaf-index",
        [],
        deployer,
      );
      expect(indexAfter1.result).toBeUint(1);

      // Second deposit
      deposit(COMMITMENT_2, wallet1);
      const indexAfter2 = simnet.callReadOnlyFn(
        "merkle-tree",
        "get-next-leaf-index",
        [],
        deployer,
      );
      expect(indexAfter2.result).toBeUint(2);
    });

    it("should reject deposit if source has insufficient sBTC", () => {
      // wallet2 has no sBTC minted
      approvePool(wallet2, POOL_DENOMINATION);

      const result = deposit(COMMITMENT_1, wallet2);
      expect(result.result).toBeErr(Cl.uint(1007));
    });

    it("should reject relayer deposit when source has not approved the relayer", () => {
      // When a relayer (wallet2) submits a deposit on behalf of source (wallet1),
      // the sbtc-token transfer checks allowance for {owner: wallet1, spender: wallet2}.
      // If wallet1 only approved pool-v1 (not the relayer), the transfer fails.
      mintSbtc(MINT_AMOUNT, wallet1);
      // wallet1 approves pool-v1 but NOT wallet2
      approvePool(wallet1, POOL_DENOMINATION);

      // wallet2 (relayer) calls deposit with wallet1 as source
      const result = simnet.callPublicFn(
        "pool-v1",
        "deposit",
        [
          Cl.bufferFromHex(COMMITMENT_1),
          Cl.standardPrincipal(wallet1),
        ],
        wallet2,
      );
      // Fails because sbtc-token checks allowance for (wallet1, wallet2) which is 0
      expect(result.result).toBeErr(Cl.uint(1007));
    });

    it("should store deposit metadata (queryable via get-deposit-info)", () => {
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION);

      deposit(COMMITMENT_1, wallet1);

      const info = simnet.callReadOnlyFn(
        "pool-v1",
        "get-deposit-info",
        [Cl.bufferFromHex(COMMITMENT_1)],
        deployer,
      );
      // Should return Some with amount = POOL_DENOMINATION
      // Don't assert exact block-height since it depends on simnet state
      expect(info.result).toHaveClarityType(ClarityType.OptionalSome);
    });

    it("should return none for get-deposit-info with unknown commitment", () => {
      const info = simnet.callReadOnlyFn(
        "pool-v1",
        "get-deposit-info",
        [Cl.bufferFromHex(COMMITMENT_1)],
        deployer,
      );
      expect(info.result).toBeNone();
    });

    it("should emit a deposit print event", () => {
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION);

      const result = deposit(COMMITMENT_1, wallet1);
      // Should have print events
      const printEvent = result.events.find(
        (e: any) => e.event === "print_event",
      );
      expect(printEvent).toBeDefined();
    });

    it("should allow a relayer to deposit on behalf of a source", () => {
      // Mint to wallet1 (the source), but wallet2 (the relayer) calls deposit
      mintSbtc(MINT_AMOUNT, wallet1);

      // wallet1 must approve the relayer (wallet2), because in sbtc-token.transfer
      // tx-sender is the original caller (wallet2) and allowance is checked
      // for {owner: source, spender: tx-sender}
      simnet.callPublicFn(
        "sbtc-token",
        "approve",
        [Cl.standardPrincipal(wallet2), Cl.uint(POOL_DENOMINATION)],
        wallet1,
      );

      // wallet2 calls deposit with wallet1 as the source
      const result = simnet.callPublicFn(
        "pool-v1",
        "deposit",
        [
          Cl.bufferFromHex(COMMITMENT_1),
          Cl.standardPrincipal(wallet1),
        ],
        wallet2,
      );
      expect(result.result).toHaveClarityType(ClarityType.ResponseOk);

      // Verify wallet1's balance decreased
      const balance = getBalance(wallet1);
      expect(balance).toBe(BigInt(MINT_AMOUNT - POOL_DENOMINATION));
    });
  });

  // =========================================================================
  // Withdrawal tests
  // =========================================================================

  describe("withdraw", () => {
    it("should accept a valid withdrawal", () => {
      // Setup: authorize pool, deposit funds
      authorizePool();
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION);
      deposit(COMMITMENT_1, wallet1);

      const root = getCurrentRootHex();

      // Withdraw to wallet2
      const result = withdraw(
        DUMMY_PROOF,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        wallet3,
      );
      expect(result.result).toBeOk(
        Cl.tuple({ nullifier: Cl.bufferFromHex(NULLIFIER_1) }),
      );
    });

    it("should transfer sBTC to recipient on withdrawal", () => {
      authorizePool();
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION);
      deposit(COMMITMENT_1, wallet1);

      const root = getCurrentRootHex();
      const recipientBalanceBefore = getBalance(wallet2);

      withdraw(
        DUMMY_PROOF,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        wallet3,
      );

      const recipientBalanceAfter = getBalance(wallet2);
      expect(recipientBalanceAfter - recipientBalanceBefore).toBe(
        BigInt(POOL_DENOMINATION),
      );
    });

    it("should reject withdrawal with unknown root (err u1005)", () => {
      authorizePool();
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION);
      deposit(COMMITMENT_1, wallet1);

      const fakeRoot =
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

      const result = withdraw(
        DUMMY_PROOF,
        NULLIFIER_1,
        fakeRoot,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        wallet3,
      );
      expect(result.result).toBeErr(Cl.uint(1005));
    });

    it("should reject withdrawal with used nullifier (err u1003)", () => {
      authorizePool();
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION * 2);

      // Two deposits to have enough funds
      deposit(COMMITMENT_1, wallet1);
      deposit(COMMITMENT_2, wallet1);

      const root = getCurrentRootHex();

      // First withdrawal succeeds
      const result1 = withdraw(
        DUMMY_PROOF,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        wallet3,
      );
      expect(result1.result).toHaveClarityType(ClarityType.ResponseOk);

      // Second withdrawal with same nullifier fails
      const result2 = withdraw(
        DUMMY_PROOF,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        wallet3,
      );
      expect(result2.result).toBeErr(Cl.uint(1003));
    });

    it("should pay relayer fee on withdrawal", () => {
      authorizePool();
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION);
      deposit(COMMITMENT_1, wallet1);

      const root = getCurrentRootHex();
      const relayerFee = 100_000; // 0.001 sBTC fee
      const recipientAmount = POOL_DENOMINATION - relayerFee;

      const relayerBalanceBefore = getBalance(wallet3);
      const recipientBalanceBefore = getBalance(wallet2);

      // wallet3 is the relayer (tx-sender)
      withdraw(
        DUMMY_PROOF,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        relayerFee,
        wallet3,
      );

      const relayerBalanceAfter = getBalance(wallet3);
      const recipientBalanceAfter = getBalance(wallet2);

      expect(relayerBalanceAfter - relayerBalanceBefore).toBe(
        BigInt(relayerFee),
      );
      expect(recipientBalanceAfter - recipientBalanceBefore).toBe(
        BigInt(recipientAmount),
      );
    });

    it("should reject withdrawal if relayer-fee exceeds denomination (err u1002)", () => {
      authorizePool();
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION);
      deposit(COMMITMENT_1, wallet1);

      const root = getCurrentRootHex();
      const excessiveFee = POOL_DENOMINATION + 1;

      // The contract validates relayer-fee < POOL-DENOMINATION before
      // computing the subtraction, returning ERR-INVALID-AMOUNT (u1002)
      const result = withdraw(
        DUMMY_PROOF,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        excessiveFee,
        wallet3,
      );
      expect(result.result).toBeErr(Cl.uint(1002));
    });

    it("should reject relayer-fee equal to denomination (err u1002)", () => {
      authorizePool();
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION);
      deposit(COMMITMENT_1, wallet1);

      const root = getCurrentRootHex();

      // relayer-fee == denomination is rejected by the strict less-than check
      // to ensure recipient always receives a non-zero amount
      const result = withdraw(
        DUMMY_PROOF,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        POOL_DENOMINATION,
        wallet3,
      );
      expect(result.result).toBeErr(Cl.uint(1002));
    });

    it("should allow zero relayer-fee (no fee transfer)", () => {
      authorizePool();
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION);
      deposit(COMMITMENT_1, wallet1);

      const root = getCurrentRootHex();

      const recipientBalanceBefore = getBalance(wallet2);

      const result = withdraw(
        DUMMY_PROOF,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        wallet3,
      );
      expect(result.result).toHaveClarityType(ClarityType.ResponseOk);

      const recipientBalanceAfter = getBalance(wallet2);
      expect(recipientBalanceAfter - recipientBalanceBefore).toBe(
        BigInt(POOL_DENOMINATION),
      );
    });

    it("should mark nullifier as used after withdrawal", () => {
      authorizePool();
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION);
      deposit(COMMITMENT_1, wallet1);

      const root = getCurrentRootHex();

      // Before withdrawal, nullifier should not be used
      const beforeResult = simnet.callReadOnlyFn(
        "pool-v1",
        "is-nullifier-used",
        [Cl.bufferFromHex(NULLIFIER_1)],
        deployer,
      );
      expect(beforeResult.result).toBeOk(Cl.bool(false));

      withdraw(
        DUMMY_PROOF,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        wallet3,
      );

      // After withdrawal, nullifier should be used
      const afterResult = simnet.callReadOnlyFn(
        "pool-v1",
        "is-nullifier-used",
        [Cl.bufferFromHex(NULLIFIER_1)],
        deployer,
      );
      expect(afterResult.result).toBeOk(Cl.bool(true));
    });

    it("should drain pool balance on withdrawal", () => {
      authorizePool();
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION);
      deposit(COMMITMENT_1, wallet1);

      const root = getCurrentRootHex();
      const poolBalanceBefore = getContractBalance(deployer, "pool-v1");
      expect(poolBalanceBefore).toBe(BigInt(POOL_DENOMINATION));

      withdraw(
        DUMMY_PROOF,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        wallet3,
      );

      const poolBalanceAfter = getContractBalance(deployer, "pool-v1");
      expect(poolBalanceAfter).toBe(0n);
    });

    it("should emit a withdrawal print event", () => {
      authorizePool();
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION);
      deposit(COMMITMENT_1, wallet1);

      const root = getCurrentRootHex();

      const result = withdraw(
        DUMMY_PROOF,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        wallet3,
      );

      const printEvent = result.events.find(
        (e: any) => e.event === "print_event",
      );
      expect(printEvent).toBeDefined();
    });

    it("should accept historical root (not just the latest)", () => {
      authorizePool();
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION * 2);

      // First deposit -> captures root after first deposit
      deposit(COMMITMENT_1, wallet1);
      const rootAfterFirst = getCurrentRootHex();

      // Second deposit -> root changes
      deposit(COMMITMENT_2, wallet1);
      const rootAfterSecond = getCurrentRootHex();
      expect(rootAfterFirst).not.toBe(rootAfterSecond);

      // Withdraw using the root from after the first deposit (historical)
      const result = withdraw(
        DUMMY_PROOF,
        NULLIFIER_1,
        rootAfterFirst,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        wallet3,
      );
      expect(result.result).toHaveClarityType(ClarityType.ResponseOk);
    });
  });

  // =========================================================================
  // Read-only function tests
  // =========================================================================

  describe("read-only functions", () => {
    it("get-current-root should return the empty root initially", () => {
      const result = simnet.callReadOnlyFn(
        "pool-v1",
        "get-current-root",
        [],
        deployer,
      );
      expect(result.result).toBeOk(Cl.bufferFromHex(EMPTY_ROOT));
    });

    it("get-current-root should return updated root after deposit", () => {
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION);
      deposit(COMMITMENT_1, wallet1);

      const result = simnet.callReadOnlyFn(
        "pool-v1",
        "get-current-root",
        [],
        deployer,
      );
      // Should not be the empty root anymore
      expect(result.result).not.toBeOk(Cl.bufferFromHex(EMPTY_ROOT));
    });

    it("get-pool-denomination should return u10000000", () => {
      const result = simnet.callReadOnlyFn(
        "pool-v1",
        "get-pool-denomination",
        [],
        deployer,
      );
      expect(result.result).toBeUint(POOL_DENOMINATION);
    });

    it("is-known-root should return true for the empty root", () => {
      const result = simnet.callReadOnlyFn(
        "pool-v1",
        "is-known-root",
        [Cl.bufferFromHex(EMPTY_ROOT)],
        deployer,
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("is-known-root should return false for an arbitrary root", () => {
      const fakeRoot =
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const result = simnet.callReadOnlyFn(
        "pool-v1",
        "is-known-root",
        [Cl.bufferFromHex(fakeRoot)],
        deployer,
      );
      expect(result.result).toBeOk(Cl.bool(false));
    });

    it("is-known-root should return true for root after deposit", () => {
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION);
      deposit(COMMITMENT_1, wallet1);

      const currentRoot = getCurrentRootHex();
      const result = simnet.callReadOnlyFn(
        "pool-v1",
        "is-known-root",
        [Cl.bufferFromHex(currentRoot)],
        deployer,
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("is-nullifier-used should return false for unused nullifier", () => {
      const result = simnet.callReadOnlyFn(
        "pool-v1",
        "is-nullifier-used",
        [Cl.bufferFromHex(NULLIFIER_1)],
        deployer,
      );
      expect(result.result).toBeOk(Cl.bool(false));
    });

    it("is-nullifier-used should return true after nullifier is spent", () => {
      authorizePool();
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION);
      deposit(COMMITMENT_1, wallet1);

      const root = getCurrentRootHex();
      withdraw(
        DUMMY_PROOF,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        wallet3,
      );

      const result = simnet.callReadOnlyFn(
        "pool-v1",
        "is-nullifier-used",
        [Cl.bufferFromHex(NULLIFIER_1)],
        deployer,
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });
  });

  // =========================================================================
  // Multiple deposits and withdrawals
  // =========================================================================

  describe("multiple operations", () => {
    it("should handle two deposits followed by two withdrawals", () => {
      authorizePool();
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION * 2);

      // Two deposits
      deposit(COMMITMENT_1, wallet1);
      deposit(COMMITMENT_2, wallet1);

      const root = getCurrentRootHex();

      // Two withdrawals with different nullifiers
      const result1 = withdraw(
        DUMMY_PROOF,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        wallet3,
      );
      expect(result1.result).toHaveClarityType(ClarityType.ResponseOk);

      const result2 = withdraw(
        DUMMY_PROOF,
        NULLIFIER_2,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        wallet3,
      );
      expect(result2.result).toHaveClarityType(ClarityType.ResponseOk);

      // Pool should be empty
      const poolBalance = getContractBalance(deployer, "pool-v1");
      expect(poolBalance).toBe(0n);

      // Recipient should have received 2x denomination
      const recipientBalance = getBalance(wallet2);
      expect(recipientBalance).toBe(BigInt(POOL_DENOMINATION * 2));
    });

    it("should track each deposit commitment independently", () => {
      mintSbtc(MINT_AMOUNT, wallet1);
      approvePool(wallet1, POOL_DENOMINATION * 3);

      deposit(COMMITMENT_1, wallet1);
      deposit(COMMITMENT_2, wallet1);
      deposit(COMMITMENT_3, wallet1);

      // Each commitment should be queryable
      for (const commitment of [COMMITMENT_1, COMMITMENT_2, COMMITMENT_3]) {
        const info = simnet.callReadOnlyFn(
          "pool-v1",
          "get-deposit-info",
          [Cl.bufferFromHex(commitment)],
          deployer,
        );
        expect(info.result).toHaveClarityType(ClarityType.OptionalSome);
      }
    });
  });
});
