/**
 * Tests for the deposit transaction builder.
 *
 * These tests verify that:
 *  - buildApprovalTx produces a properly shaped Stacks contract call
 *  - buildDepositTx produces a contract call with correct arguments
 *  - Commitment buffer validation is enforced
 *  - Amount validation is enforced
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApprovalTx, buildDepositTx } from '../src/pool/deposit.js';
import { POOL_DENOMINATION } from '../src/utils/constants.js';
import { bytesToHex } from '../src/utils/crypto.js';
import { STACKS_DEVNET } from '@stacks/network';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * A deterministic 32-byte commitment for testing.
 */
function makeCommitment(): Uint8Array {
  const buf = new Uint8Array(32);
  for (let i = 0; i < 32; i++) buf[i] = i;
  return buf;
}

/**
 * A minimal set of deposit params for devnet.
 *
 * The senderKey is a well-known devnet key — never use on mainnet.
 * This is the default key Clarinet assigns to wallet_1.
 */
function makeParams(overrides: Record<string, unknown> = {}) {
  return {
    commitment: makeCommitment(),
    sourceAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    poolContract: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.pool-v1',
    sbtcContract: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sbtc-token',
    amount: POOL_DENOMINATION,
    senderKey:
      '753b7cc01a1a2e86221266a154af739463fce51219d97e4f856cd7200c3bd2a601',
    network: STACKS_DEVNET,
    // Provide fee and nonce so makeContractCall does not hit the network
    fee: 10000n,
    nonce: 0n,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: buildApprovalTx
// ---------------------------------------------------------------------------

describe('buildApprovalTx', () => {
  it('returns a signed transaction wire object', async () => {
    const tx = await buildApprovalTx(makeParams());
    // The transaction wire has a txid method and serialize method
    expect(typeof tx.txid).toBe('function');
    expect(typeof tx.serialize).toBe('function');
  });

  it('targets the sbtc-token contract', async () => {
    const tx = await buildApprovalTx(makeParams());
    const payload = tx.payload;
    // Contract call payload carries the contract address and name
    expect(payload).toHaveProperty('contractAddress');
    expect(payload).toHaveProperty('contractName');
    expect((payload as { contractName: { content: string } }).contractName.content).toBe(
      'sbtc-token',
    );
  });

  it('calls the "approve" function', async () => {
    const tx = await buildApprovalTx(makeParams());
    const payload = tx.payload as { functionName: { content: string } };
    expect(payload.functionName.content).toBe('approve');
  });

  it('passes two function arguments (spender, amount)', async () => {
    const tx = await buildApprovalTx(makeParams());
    const payload = tx.payload as { functionArgs: unknown[] };
    expect(payload.functionArgs).toHaveLength(2);
  });

  it('respects optional nonce override', async () => {
    const tx = await buildApprovalTx(makeParams({ nonce: 42n }));
    expect(tx.auth.spendingCondition.nonce).toBe(42n);
  });

  it('respects optional fee override', async () => {
    const tx = await buildApprovalTx(makeParams({ fee: 5000n }));
    expect(tx.auth.spendingCondition.fee).toBe(5000n);
  });
});

// ---------------------------------------------------------------------------
// Tests: buildDepositTx
// ---------------------------------------------------------------------------

describe('buildDepositTx', () => {
  it('returns a signed transaction wire object', async () => {
    const tx = await buildDepositTx(makeParams());
    expect(typeof tx.txid).toBe('function');
    expect(typeof tx.serialize).toBe('function');
  });

  it('targets the pool-v1 contract', async () => {
    const tx = await buildDepositTx(makeParams());
    const payload = tx.payload as { contractName: { content: string } };
    expect(payload.contractName.content).toBe('pool-v1');
  });

  it('calls the "deposit" function', async () => {
    const tx = await buildDepositTx(makeParams());
    const payload = tx.payload as { functionName: { content: string } };
    expect(payload.functionName.content).toBe('deposit');
  });

  it('passes commitment and source as function arguments', async () => {
    const tx = await buildDepositTx(makeParams());
    const payload = tx.payload as { functionArgs: unknown[] };
    expect(payload.functionArgs).toHaveLength(2);
  });

  it('encodes the commitment buffer correctly', async () => {
    const commitment = makeCommitment();
    const tx = await buildDepositTx(makeParams({ commitment }));
    const payload = tx.payload as { functionArgs: Array<{ type: string; value: string }> };
    const commitmentArg = payload.functionArgs[0];
    // In @stacks/transactions v7 wire format, buffer values are hex strings
    expect(commitmentArg.type).toBe('buffer');
    expect(commitmentArg.value).toBe(bytesToHex(commitment));
  });

  it('includes at least one post-condition', async () => {
    const tx = await buildDepositTx(makeParams());
    // v7 wire format wraps post-conditions in { type, lengthPrefixBytes, values }
    const pcWrapper = tx.postConditions as { values: unknown[] };
    expect(pcWrapper.values.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects commitment of wrong length', async () => {
    const badCommitment = new Uint8Array(16); // too short
    await expect(
      buildDepositTx(makeParams({ commitment: badCommitment })),
    ).rejects.toThrow('Commitment must be 32 bytes');
  });

  it('rejects amount that does not match pool denomination', async () => {
    await expect(
      buildDepositTx(makeParams({ amount: 1n })),
    ).rejects.toThrow('Deposit amount must equal POOL_DENOMINATION');
  });
});
