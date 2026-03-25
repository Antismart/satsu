/**
 * Deposit transaction builder for the Satsu privacy pool.
 *
 * A deposit requires TWO on-chain transactions:
 *   1. **Approve** – grant the pool contract an sBTC allowance
 *      (`sbtc-token.approve(pool-contract, POOL_DENOMINATION)`)
 *   2. **Deposit** – call `pool-v1.deposit(commitment, source)`
 *
 * This module exposes granular builders (`buildApprovalTx`, `buildDepositTx`)
 * as well as a convenience `submitDeposit` that signs and broadcasts both.
 */

import {
  makeContractCall,
  broadcastTransaction,
  Pc,
  Cl,
  PostConditionMode,
  type StacksTransactionWire,
} from '@stacks/transactions';
import type { StacksNetwork } from '@stacks/network';

import { POOL_DENOMINATION, HASH_LENGTH } from '../utils/constants.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DepositParams {
  /** 32-byte Pedersen commitment hash */
  commitment: Uint8Array;
  /** Stacks address that currently holds the sBTC (the "source") */
  sourceAddress: string;
  /** Pool contract identifier, e.g. "SP1234….pool-v1" */
  poolContract: string;
  /** sBTC token contract identifier, e.g. "SP1234….sbtc-token" */
  sbtcContract: string;
  /** Deposit amount — must equal POOL_DENOMINATION */
  amount: bigint;
  /** Hex-encoded private key used to sign the transaction */
  senderKey: string;
  /** Stacks network configuration object */
  network: StacksNetwork;
  /** Optional nonce override */
  nonce?: bigint;
  /** Optional fee override */
  fee?: bigint;
}

export interface DepositResult {
  /** Transaction id of the deposit transaction */
  txId: string;
  /** The commitment that was deposited */
  commitment: Uint8Array;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Split a fully-qualified contract identifier ("address.contract-name")
 * into its two components.
 */
function splitContractId(contractId: string): {
  contractAddress: string;
  contractName: string;
} {
  const dotIndex = contractId.indexOf('.');
  if (dotIndex === -1) {
    throw new Error(
      `Invalid contract identifier "${contractId}": expected "address.contract-name"`,
    );
  }
  return {
    contractAddress: contractId.substring(0, dotIndex),
    contractName: contractId.substring(dotIndex + 1),
  };
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/**
 * Build the sBTC approval transaction.
 *
 * Calls `sbtc-token.approve(spender, amount)` so the pool contract can
 * transfer sBTC on behalf of the source address during the deposit step.
 */
export async function buildApprovalTx(
  params: DepositParams,
): Promise<StacksTransactionWire> {
  const { contractAddress, contractName } = splitContractId(
    params.sbtcContract,
  );
  const { contractAddress: poolAddress, contractName: poolName } =
    splitContractId(params.poolContract);

  const tx = await makeContractCall({
    contractAddress,
    contractName,
    functionName: 'approve',
    functionArgs: [
      // spender: the pool contract principal
      Cl.contractPrincipal(poolAddress, poolName),
      // amount
      Cl.uint(params.amount),
    ],
    senderKey: params.senderKey,
    network: params.network,
    postConditionMode: PostConditionMode.Deny,
    postConditions: [],
    ...(params.nonce !== undefined ? { nonce: params.nonce } : {}),
    ...(params.fee !== undefined ? { fee: params.fee } : {}),
  });

  return tx;
}

/**
 * Build the pool deposit transaction.
 *
 * Calls `pool-v1.deposit(commitment, source)` which transfers
 * POOL_DENOMINATION sBTC from the source into the pool and appends the
 * commitment to the on-chain Merkle tree.
 *
 * Includes a fungible token post-condition that ensures exactly
 * POOL_DENOMINATION sBTC leaves the source address.
 */
export async function buildDepositTx(
  params: DepositParams,
): Promise<StacksTransactionWire> {
  if (params.commitment.length !== HASH_LENGTH) {
    throw new Error(
      `Commitment must be ${HASH_LENGTH} bytes, got ${params.commitment.length}`,
    );
  }

  if (params.amount !== POOL_DENOMINATION) {
    throw new Error(
      `Deposit amount must equal POOL_DENOMINATION (${POOL_DENOMINATION}), got ${params.amount}`,
    );
  }

  const { contractAddress, contractName } = splitContractId(
    params.poolContract,
  );

  // Post-condition: source sends exactly POOL_DENOMINATION of the sBTC
  // fungible token.
  const postCondition = Pc.principal(params.sourceAddress)
    .willSendEq(params.amount)
    .ft(params.sbtcContract as `${string}.${string}`, 'sbtc');

  const tx = await makeContractCall({
    contractAddress,
    contractName,
    functionName: 'deposit',
    functionArgs: [
      // commitment: (buff 32)
      Cl.buffer(params.commitment),
      // source: principal
      Cl.principal(params.sourceAddress),
    ],
    senderKey: params.senderKey,
    network: params.network,
    postConditionMode: PostConditionMode.Deny,
    postConditions: [postCondition],
    ...(params.nonce !== undefined ? { nonce: params.nonce } : {}),
    ...(params.fee !== undefined ? { fee: params.fee } : {}),
  });

  return tx;
}

/**
 * Build, sign, and broadcast both the approval and deposit transactions.
 *
 * Returns the deposit transaction id and the commitment that was deposited
 * once both transactions have been successfully broadcast.
 */
export async function submitDeposit(
  params: DepositParams,
): Promise<DepositResult> {
  // 1. Build and broadcast the approval transaction
  const approvalTx = await buildApprovalTx(params);
  const approvalResult = await broadcastTransaction({
    transaction: approvalTx,
    network: params.network,
  });

  if ('error' in approvalResult) {
    throw new Error(
      `Approval broadcast failed: ${(approvalResult as { error: string }).error}`,
    );
  }

  // 2. Build and broadcast the deposit transaction
  //    In production the caller should wait for the approval tx to be
  //    confirmed (or at least anchored in a microblock) before submitting
  //    the deposit.  For simplicity we broadcast immediately; the mempool
  //    will order them correctly given sequential nonces.
  const depositNonce =
    params.nonce !== undefined ? params.nonce + 1n : undefined;

  const depositTx = await buildDepositTx({
    ...params,
    nonce: depositNonce,
  });

  const depositResult = await broadcastTransaction({
    transaction: depositTx,
    network: params.network,
  });

  if ('error' in depositResult) {
    throw new Error(
      `Deposit broadcast failed: ${(depositResult as { error: string }).error}`,
    );
  }

  return {
    txId: (depositResult as { txid: string }).txid,
    commitment: params.commitment,
  };
}
