import { describe, it, expect } from "vitest";
import { Cl, ClarityType } from "@stacks/transactions";

// ============================================================================
// Constants
// ============================================================================

const POOL_DENOMINATION = 10_000_000; // 0.1 sBTC in satoshis
const MIN_BOND = 100_000; // 0.001 sBTC minimum bond
const CHALLENGE_PERIOD = 144; // blocks (~24 hours)
const MINT_AMOUNT = 100_000_000; // 1 sBTC - enough for multiple operations

// Test commitments (32-byte buffers)
const COMMITMENT_1 =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const COMMITMENT_2 =
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

// Test nullifiers (32-byte buffers)
const NULLIFIER_1 =
  "1111111111111111111111111111111111111111111111111111111111111111";
const NULLIFIER_2 =
  "2222222222222222222222222222222222222222222222222222222222222222";

// Proof hash (sha256 of a hypothetical off-chain proof)
const PROOF_HASH_1 =
  "aabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccdd";
const PROOF_HASH_2 =
  "1122334411223344112233441122334411223344112233441122334411223344";

// Ephemeral pubkey (33 bytes, starts with 0x02)
const EPHEMERAL_PUBKEY =
  "020000000000000000000000000000000000000000000000000000000000000001";

// ============================================================================
// Account setup
// ============================================================================

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;
const wallet4 = accounts.get("wallet_4")!;

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

/** Approve a contract to spend sBTC on behalf of the owner */
function approveContract(
  owner: string,
  contractName: string,
  amount: number,
) {
  return simnet.callPublicFn(
    "sbtc-token",
    "approve",
    [Cl.contractPrincipal(deployer, contractName), Cl.uint(amount)],
    owner,
  );
}

/** Make a deposit into pool-v1 */
function deposit(commitment: string, source: string) {
  return simnet.callPublicFn(
    "pool-v1",
    "deposit",
    [Cl.bufferFromHex(commitment), Cl.standardPrincipal(source)],
    source,
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

/** Get sBTC balance of a standard principal */
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

/** Get sBTC balance of a contract principal */
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

/** Extract hex string from a BufferCV */
function bufferCvToHex(cv: any): string {
  if (cv && cv.type === ClarityType.Buffer) {
    return cv.value as string;
  }
  return "";
}

/** Authorize pool-v1 on the merkle tree (required for deposits) */
function authorizeMerkleTree() {
  return simnet.callPublicFn(
    "merkle-tree",
    "set-authorized-caller",
    [Cl.contractPrincipal(deployer, "pool-v1"), Cl.bool(true)],
    deployer,
  );
}

/** Authorize withdrawal-escrow as the authorized contract on the nullifier registry */
function authorizeEscrow() {
  return simnet.callPublicFn(
    "nullifier-registry",
    "set-authorized-contract",
    [Cl.contractPrincipal(deployer, "withdrawal-escrow")],
    deployer,
  );
}

/** Submit a withdrawal to the escrow */
function submitWithdrawal(
  proofHash: string,
  nullifier: string,
  root: string,
  recipient: string,
  ephemeralPubkey: string,
  relayerFee: number,
  bond: number,
  caller: string,
) {
  return simnet.callPublicFn(
    "withdrawal-escrow",
    "submit-withdrawal",
    [
      Cl.bufferFromHex(proofHash),
      Cl.bufferFromHex(nullifier),
      Cl.bufferFromHex(root),
      Cl.standardPrincipal(recipient),
      Cl.bufferFromHex(ephemeralPubkey),
      Cl.uint(relayerFee),
      Cl.uint(bond),
    ],
    caller,
  );
}

/** Finalize a withdrawal after the challenge period */
function finalizeWithdrawal(withdrawalId: number, caller: string) {
  return simnet.callPublicFn(
    "withdrawal-escrow",
    "finalize-withdrawal",
    [Cl.uint(withdrawalId)],
    caller,
  );
}

/** Challenge a pending withdrawal */
function challengeWithdrawal(
  withdrawalId: number,
  challengerBond: number,
  caller: string,
) {
  return simnet.callPublicFn(
    "withdrawal-escrow",
    "challenge-withdrawal",
    [Cl.uint(withdrawalId), Cl.uint(challengerBond)],
    caller,
  );
}

/** Resolve a challenge (only deployer/owner) */
function resolveChallenge(
  withdrawalId: number,
  upheld: boolean,
  caller: string,
) {
  return simnet.callPublicFn(
    "withdrawal-escrow",
    "resolve-challenge",
    [Cl.uint(withdrawalId), Cl.bool(upheld)],
    caller,
  );
}

/**
 * Complete setup for an optimistic withdrawal test:
 * 1. Authorize pool-v1 on the merkle tree
 * 2. Deposit into pool (funds pool-v1 with POOL_DENOMINATION)
 * 3. Authorize escrow on nullifier registry
 * 4. Fund the escrow with POOL_DENOMINATION (simulates pool-v1 transfer)
 * 5. Mint bond to relayer and approve escrow to take it
 *
 * Uses deployer to mint the escrow's pool denomination directly, simulating
 * what pool-v1.withdraw-optimistic would do in the integrated flow.
 */
function setupOptimisticWithdrawal(params: {
  commitment: string;
  depositor: string;
  relayer: string;
  bond: number;
}): { root: string } {
  const { commitment, depositor, relayer, bond } = params;

  // 1. Authorize pool-v1 on the merkle tree for deposits
  authorizeMerkleTree();

  // 2. Deposit into pool
  mintSbtc(MINT_AMOUNT, depositor);
  approveContract(depositor, "pool-v1", POOL_DENOMINATION);
  const depositResult = deposit(commitment, depositor);
  expect(depositResult.result).toHaveClarityType(ClarityType.ResponseOk);
  const root = getCurrentRootHex();

  // 3. Authorize escrow for nullifier registry
  authorizeEscrow();

  // 4. Fund escrow with POOL_DENOMINATION.
  //    In production, pool-v1.withdraw-optimistic transfers this.
  //    For testing, we mint to deployer, then transfer to escrow.
  mintSbtc(POOL_DENOMINATION, deployer);
  simnet.callPublicFn(
    "sbtc-token",
    "transfer",
    [
      Cl.uint(POOL_DENOMINATION),
      Cl.standardPrincipal(deployer),
      Cl.contractPrincipal(deployer, "withdrawal-escrow"),
      Cl.none(),
    ],
    deployer,
  );

  // 5. Mint bond to relayer and approve escrow to take it
  mintSbtc(bond, relayer);
  approveContract(relayer, "withdrawal-escrow", bond);

  return { root };
}

// ============================================================================
// Tests
// ============================================================================

describe("withdrawal-escrow contract", () => {
  // =========================================================================
  // Submit withdrawal tests
  // =========================================================================

  describe("submit-withdrawal", () => {
    it("should accept a valid withdrawal submission", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      const result = submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      expect(result.result).toHaveClarityType(ClarityType.ResponseOk);
    });

    it("should reserve the nullifier on submission", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      const reserved = simnet.callReadOnlyFn(
        "withdrawal-escrow",
        "is-nullifier-reserved",
        [Cl.bufferFromHex(NULLIFIER_1)],
        deployer,
      );
      expect(reserved.result).toBeBool(true);
    });

    it("should lock the bond in the escrow", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      const relayerBalanceBefore = getBalance(wallet3);

      submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      const relayerBalanceAfter = getBalance(wallet3);
      expect(relayerBalanceBefore - relayerBalanceAfter).toBe(
        BigInt(MIN_BOND),
      );
    });

    it("should reject duplicate nullifier reservation (err u7007)", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      // First submission succeeds
      const result1 = submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );
      expect(result1.result).toHaveClarityType(ClarityType.ResponseOk);

      // Mint more bond for second attempt
      mintSbtc(MIN_BOND, wallet3);
      approveContract(wallet3, "withdrawal-escrow", MIN_BOND);

      // Second submission with same nullifier fails
      const result2 = submitWithdrawal(
        PROOF_HASH_2,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );
      expect(result2.result).toBeErr(Cl.uint(7007));
    });

    it("should reject insufficient bond (err u7008)", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      const insufficientBond = MIN_BOND - 1;

      const result = submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        insufficientBond,
        wallet3,
      );
      expect(result.result).toBeErr(Cl.uint(7008));
    });

    it("should reject unknown root (err u7002)", () => {
      authorizeEscrow();
      mintSbtc(MINT_AMOUNT, wallet3);
      approveContract(wallet3, "withdrawal-escrow", MIN_BOND);

      const fakeRoot =
        "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

      const result = submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        fakeRoot,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );
      expect(result.result).toBeErr(Cl.uint(7002));
    });

    it("should emit a submission print event", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      const result = submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      const printEvent = result.events.find(
        (e: any) => e.event === "print_event",
      );
      expect(printEvent).toBeDefined();
    });
  });

  // =========================================================================
  // Finalize withdrawal tests
  // =========================================================================

  describe("finalize-withdrawal", () => {
    it("should finalize after challenge period expires", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      // Advance past the challenge period
      simnet.mineEmptyBlocks(CHALLENGE_PERIOD + 1);

      const recipientBefore = getBalance(wallet2);
      const relayerBefore = getBalance(wallet3);

      const result = finalizeWithdrawal(0, deployer);
      expect(result.result).toBeOk(Cl.bool(true));

      // Recipient should receive POOL_DENOMINATION (no relayer fee)
      const recipientAfter = getBalance(wallet2);
      expect(recipientAfter - recipientBefore).toBe(
        BigInt(POOL_DENOMINATION),
      );

      // Relayer should get bond back
      const relayerAfter = getBalance(wallet3);
      expect(relayerAfter - relayerBefore).toBe(BigInt(MIN_BOND));
    });

    it("should transfer relayer fee on finalization", () => {
      const relayerFee = 50_000;
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        relayerFee,
        MIN_BOND,
        wallet3,
      );

      simnet.mineEmptyBlocks(CHALLENGE_PERIOD + 1);

      const recipientBefore = getBalance(wallet2);
      const relayerBefore = getBalance(wallet3);

      finalizeWithdrawal(0, deployer);

      const recipientAfter = getBalance(wallet2);
      const relayerAfter = getBalance(wallet3);

      // Recipient gets denomination minus fee
      expect(recipientAfter - recipientBefore).toBe(
        BigInt(POOL_DENOMINATION - relayerFee),
      );

      // Relayer gets fee + bond back
      expect(relayerAfter - relayerBefore).toBe(
        BigInt(relayerFee + MIN_BOND),
      );
    });

    it("should reject early finalization (err u7004)", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      // Do NOT advance enough blocks
      simnet.mineEmptyBlocks(CHALLENGE_PERIOD - 10);

      const result = finalizeWithdrawal(0, deployer);
      expect(result.result).toBeErr(Cl.uint(7004));
    });

    it("should reject finalization of non-existent withdrawal (err u7006)", () => {
      const result = finalizeWithdrawal(999, deployer);
      expect(result.result).toBeErr(Cl.uint(7006));
    });

    it("should reject double finalization (err u7009)", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      simnet.mineEmptyBlocks(CHALLENGE_PERIOD + 1);

      // First finalization succeeds
      const result1 = finalizeWithdrawal(0, deployer);
      expect(result1.result).toBeOk(Cl.bool(true));

      // Second finalization fails
      const result2 = finalizeWithdrawal(0, deployer);
      expect(result2.result).toBeErr(Cl.uint(7009));
    });

    it("should mark nullifier as used after finalization", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      // Nullifier should not be "used" yet (only reserved)
      const beforeResult = simnet.callReadOnlyFn(
        "nullifier-registry",
        "is-nullifier-used",
        [Cl.bufferFromHex(NULLIFIER_1)],
        deployer,
      );
      expect(beforeResult.result).toBeBool(false);

      simnet.mineEmptyBlocks(CHALLENGE_PERIOD + 1);
      finalizeWithdrawal(0, deployer);

      // Now it should be marked as used
      const afterResult = simnet.callReadOnlyFn(
        "nullifier-registry",
        "is-nullifier-used",
        [Cl.bufferFromHex(NULLIFIER_1)],
        deployer,
      );
      expect(afterResult.result).toBeBool(true);
    });

    it("should emit a finalization print event", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      simnet.mineEmptyBlocks(CHALLENGE_PERIOD + 1);

      const result = finalizeWithdrawal(0, deployer);
      const printEvent = result.events.find(
        (e: any) => e.event === "print_event",
      );
      expect(printEvent).toBeDefined();
    });
  });

  // =========================================================================
  // Challenge withdrawal tests
  // =========================================================================

  describe("challenge-withdrawal", () => {
    it("should accept a valid challenge during the period", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      // Challenger funds
      mintSbtc(MIN_BOND, wallet4);
      approveContract(wallet4, "withdrawal-escrow", MIN_BOND);

      const result = challengeWithdrawal(0, MIN_BOND, wallet4);
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("should lock challenger bond in the escrow", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      mintSbtc(MIN_BOND, wallet4);
      approveContract(wallet4, "withdrawal-escrow", MIN_BOND);

      const challengerBefore = getBalance(wallet4);
      challengeWithdrawal(0, MIN_BOND, wallet4);
      const challengerAfter = getBalance(wallet4);

      expect(challengerBefore - challengerAfter).toBe(BigInt(MIN_BOND));
    });

    it("should update withdrawal status to challenged", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      mintSbtc(MIN_BOND, wallet4);
      approveContract(wallet4, "withdrawal-escrow", MIN_BOND);
      challengeWithdrawal(0, MIN_BOND, wallet4);

      // Read withdrawal - should exist
      const withdrawal = simnet.callReadOnlyFn(
        "withdrawal-escrow",
        "get-withdrawal",
        [Cl.uint(0)],
        deployer,
      );
      expect(withdrawal.result).toHaveClarityType(ClarityType.OptionalSome);
    });

    it("should reject challenge after period expires (err u7005)", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      // Advance past the challenge period
      simnet.mineEmptyBlocks(CHALLENGE_PERIOD + 1);

      mintSbtc(MIN_BOND, wallet4);
      approveContract(wallet4, "withdrawal-escrow", MIN_BOND);

      const result = challengeWithdrawal(0, MIN_BOND, wallet4);
      expect(result.result).toBeErr(Cl.uint(7005));
    });

    it("should reject double challenge (err u7003)", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      // First challenge
      mintSbtc(MIN_BOND * 2, wallet4);
      approveContract(wallet4, "withdrawal-escrow", MIN_BOND * 2);

      const result1 = challengeWithdrawal(0, MIN_BOND, wallet4);
      expect(result1.result).toBeOk(Cl.bool(true));

      // Second challenge fails
      const result2 = challengeWithdrawal(0, MIN_BOND, wallet4);
      expect(result2.result).toBeErr(Cl.uint(7003));
    });

    it("should reject challenge with insufficient bond (err u7008)", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      mintSbtc(MIN_BOND, wallet4);
      approveContract(wallet4, "withdrawal-escrow", MIN_BOND);

      const result = challengeWithdrawal(0, MIN_BOND - 1, wallet4);
      expect(result.result).toBeErr(Cl.uint(7008));
    });

    it("should reject challenge of non-existent withdrawal (err u7006)", () => {
      mintSbtc(MIN_BOND, wallet4);
      approveContract(wallet4, "withdrawal-escrow", MIN_BOND);

      const result = challengeWithdrawal(999, MIN_BOND, wallet4);
      expect(result.result).toBeErr(Cl.uint(7006));
    });

    it("should emit a challenge print event", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      mintSbtc(MIN_BOND, wallet4);
      approveContract(wallet4, "withdrawal-escrow", MIN_BOND);

      const result = challengeWithdrawal(0, MIN_BOND, wallet4);
      const printEvent = result.events.find(
        (e: any) => e.event === "print_event",
      );
      expect(printEvent).toBeDefined();
    });
  });

  // =========================================================================
  // Resolve challenge tests
  // =========================================================================

  describe("resolve-challenge", () => {
    it("should slash submitter when challenge is upheld (proof invalid)", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      // Challenge
      mintSbtc(MIN_BOND, wallet4);
      approveContract(wallet4, "withdrawal-escrow", MIN_BOND);
      challengeWithdrawal(0, MIN_BOND, wallet4);

      const challengerBefore = getBalance(wallet4);
      const relayerBefore = getBalance(wallet3);

      // Resolve: challenge upheld (proof was invalid)
      const result = resolveChallenge(0, true, deployer);
      expect(result.result).toBeOk(Cl.bool(true));

      const challengerAfter = getBalance(wallet4);
      const relayerAfter = getBalance(wallet3);

      // Challenger receives: their bond back + submitter's bond
      expect(challengerAfter - challengerBefore).toBe(
        BigInt(MIN_BOND + MIN_BOND),
      );

      // Relayer (submitter) should not receive anything (bond was slashed)
      expect(relayerAfter).toBe(relayerBefore);
    });

    it("should release nullifier reservation when challenge is upheld", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      // Nullifier should be reserved
      const reservedBefore = simnet.callReadOnlyFn(
        "withdrawal-escrow",
        "is-nullifier-reserved",
        [Cl.bufferFromHex(NULLIFIER_1)],
        deployer,
      );
      expect(reservedBefore.result).toBeBool(true);

      // Challenge and resolve upheld
      mintSbtc(MIN_BOND, wallet4);
      approveContract(wallet4, "withdrawal-escrow", MIN_BOND);
      challengeWithdrawal(0, MIN_BOND, wallet4);
      resolveChallenge(0, true, deployer);

      // Nullifier should no longer be reserved
      const reservedAfter = simnet.callReadOnlyFn(
        "withdrawal-escrow",
        "is-nullifier-reserved",
        [Cl.bufferFromHex(NULLIFIER_1)],
        deployer,
      );
      expect(reservedAfter.result).toBeBool(false);
    });

    it("should slash challenger when challenge is rejected (proof valid)", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      // Challenge
      mintSbtc(MIN_BOND, wallet4);
      approveContract(wallet4, "withdrawal-escrow", MIN_BOND);
      challengeWithdrawal(0, MIN_BOND, wallet4);

      const challengerBefore = getBalance(wallet4);
      const relayerBefore = getBalance(wallet3);

      // Resolve: challenge rejected (proof was valid)
      const result = resolveChallenge(0, false, deployer);
      expect(result.result).toBeOk(Cl.bool(true));

      const challengerAfter = getBalance(wallet4);
      const relayerAfter = getBalance(wallet3);

      // Challenger loses their bond (no refund)
      expect(challengerAfter).toBe(challengerBefore);

      // Relayer gets: challenger's bond + their own bond back
      expect(relayerAfter - relayerBefore).toBe(
        BigInt(MIN_BOND + MIN_BOND),
      );
    });

    it("should restart challenge period when challenge is rejected", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      // Challenge and resolve as rejected
      mintSbtc(MIN_BOND, wallet4);
      approveContract(wallet4, "withdrawal-escrow", MIN_BOND);
      challengeWithdrawal(0, MIN_BOND, wallet4);
      resolveChallenge(0, false, deployer);

      // Withdrawal is back to "pending" with a new submit-block.
      // Trying to finalize immediately should fail since the challenge
      // period restarted from the resolution block.
      const result = finalizeWithdrawal(0, deployer);
      expect(result.result).toBeErr(Cl.uint(7004));
    });

    it("should reject resolve from non-owner (err u7001)", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      mintSbtc(MIN_BOND, wallet4);
      approveContract(wallet4, "withdrawal-escrow", MIN_BOND);
      challengeWithdrawal(0, MIN_BOND, wallet4);

      // Non-owner tries to resolve
      const result = resolveChallenge(0, true, wallet1);
      expect(result.result).toBeErr(Cl.uint(7001));
    });

    it("should reject resolve of unchallenged withdrawal (err u7006)", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      // Try to resolve without a challenge (no challenge record exists)
      const result = resolveChallenge(0, true, deployer);
      expect(result.result).toBeErr(Cl.uint(7006));
    });
  });

  // =========================================================================
  // Read-only function tests
  // =========================================================================

  describe("read-only functions", () => {
    it("get-withdrawal should return none for non-existent withdrawal", () => {
      const result = simnet.callReadOnlyFn(
        "withdrawal-escrow",
        "get-withdrawal",
        [Cl.uint(999)],
        deployer,
      );
      expect(result.result).toBeNone();
    });

    it("get-withdrawal should return withdrawal data after submission", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      const result = simnet.callReadOnlyFn(
        "withdrawal-escrow",
        "get-withdrawal",
        [Cl.uint(0)],
        deployer,
      );
      expect(result.result).toHaveClarityType(ClarityType.OptionalSome);
    });

    it("get-challenge should return none when no challenge exists", () => {
      const result = simnet.callReadOnlyFn(
        "withdrawal-escrow",
        "get-challenge",
        [Cl.uint(0)],
        deployer,
      );
      expect(result.result).toBeNone();
    });

    it("get-challenge should return challenge data after challenge", () => {
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      mintSbtc(MIN_BOND, wallet4);
      approveContract(wallet4, "withdrawal-escrow", MIN_BOND);
      challengeWithdrawal(0, MIN_BOND, wallet4);

      const result = simnet.callReadOnlyFn(
        "withdrawal-escrow",
        "get-challenge",
        [Cl.uint(0)],
        deployer,
      );
      expect(result.result).toHaveClarityType(ClarityType.OptionalSome);
    });

    it("is-nullifier-reserved should return false for unreserved nullifier", () => {
      const result = simnet.callReadOnlyFn(
        "withdrawal-escrow",
        "is-nullifier-reserved",
        [Cl.bufferFromHex(NULLIFIER_1)],
        deployer,
      );
      expect(result.result).toBeBool(false);
    });

    it("get-next-withdrawal-id should increment after submission", () => {
      const before = simnet.callReadOnlyFn(
        "withdrawal-escrow",
        "get-next-withdrawal-id",
        [],
        deployer,
      );
      expect(before.result).toBeUint(0);

      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      const after = simnet.callReadOnlyFn(
        "withdrawal-escrow",
        "get-next-withdrawal-id",
        [],
        deployer,
      );
      expect(after.result).toBeUint(1);
    });
  });

  // =========================================================================
  // Full E2E tests
  // =========================================================================

  describe("end-to-end flow", () => {
    it("full E2E: submit -> wait -> finalize", () => {
      // 1. Setup
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      const recipientInitial = getBalance(wallet2);
      const relayerInitial = getBalance(wallet3);

      // 2. Submit
      const submitResult = submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );
      expect(submitResult.result).toHaveClarityType(ClarityType.ResponseOk);

      // Verify nullifier is reserved
      const reserved = simnet.callReadOnlyFn(
        "withdrawal-escrow",
        "is-nullifier-reserved",
        [Cl.bufferFromHex(NULLIFIER_1)],
        deployer,
      );
      expect(reserved.result).toBeBool(true);

      // Verify bond was deducted
      const relayerAfterSubmit = getBalance(wallet3);
      expect(relayerInitial - relayerAfterSubmit).toBe(BigInt(MIN_BOND));

      // 3. Wait for challenge period
      simnet.mineEmptyBlocks(CHALLENGE_PERIOD + 1);

      // 4. Finalize
      const finalizeResult = finalizeWithdrawal(0, wallet2);
      expect(finalizeResult.result).toBeOk(Cl.bool(true));

      // 5. Verify final state
      const recipientFinal = getBalance(wallet2);
      expect(recipientFinal - recipientInitial).toBe(
        BigInt(POOL_DENOMINATION),
      );

      // Relayer got bond back (net zero change from initial)
      const relayerFinal = getBalance(wallet3);
      expect(relayerFinal - relayerInitial).toBe(0n);

      // Nullifier is permanently used
      const nullifierUsed = simnet.callReadOnlyFn(
        "nullifier-registry",
        "is-nullifier-used",
        [Cl.bufferFromHex(NULLIFIER_1)],
        deployer,
      );
      expect(nullifierUsed.result).toBeBool(true);
    });

    it("full E2E: submit -> challenge -> resolve upheld (slash submitter)", () => {
      // 1. Setup
      const { root } = setupOptimisticWithdrawal({
        commitment: COMMITMENT_1,
        depositor: wallet1,
        relayer: wallet3,
        bond: MIN_BOND,
      });

      // 2. Submit
      submitWithdrawal(
        PROOF_HASH_1,
        NULLIFIER_1,
        root,
        wallet2,
        EPHEMERAL_PUBKEY,
        0,
        MIN_BOND,
        wallet3,
      );

      // 3. Challenge
      mintSbtc(MIN_BOND, wallet4);
      approveContract(wallet4, "withdrawal-escrow", MIN_BOND);
      const challengeResult = challengeWithdrawal(0, MIN_BOND, wallet4);
      expect(challengeResult.result).toBeOk(Cl.bool(true));

      // Cannot finalize while challenged
      simnet.mineEmptyBlocks(CHALLENGE_PERIOD + 1);
      const finalizeAttempt = finalizeWithdrawal(0, deployer);
      expect(finalizeAttempt.result).toBeErr(Cl.uint(7009));

      // 4. Resolve: upheld (invalid proof)
      const challengerBefore = getBalance(wallet4);
      const resolveResult = resolveChallenge(0, true, deployer);
      expect(resolveResult.result).toBeOk(Cl.bool(true));

      // 5. Challenger gets both bonds
      const challengerAfter = getBalance(wallet4);
      expect(challengerAfter - challengerBefore).toBe(
        BigInt(MIN_BOND * 2),
      );

      // Nullifier was released (not used)
      const nullifierUsed = simnet.callReadOnlyFn(
        "nullifier-registry",
        "is-nullifier-used",
        [Cl.bufferFromHex(NULLIFIER_1)],
        deployer,
      );
      expect(nullifierUsed.result).toBeBool(false);

      // Withdrawal status is "slashed"
      const withdrawal = simnet.callReadOnlyFn(
        "withdrawal-escrow",
        "get-withdrawal",
        [Cl.uint(0)],
        deployer,
      );
      expect(withdrawal.result).toHaveClarityType(ClarityType.OptionalSome);
    });
  });
});
