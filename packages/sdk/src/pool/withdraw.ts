/**
 * Withdrawal transaction builder for the Satsu privacy pool.
 *
 * A withdrawal calls `pool-v1.withdraw(proof, nullifier, root, recipient,
 * ephemeral-pubkey, relayer-fee)` which verifies the ZK-STARK proof on-chain,
 * marks the nullifier as spent, and transfers sBTC to the recipient minus
 * the relayer fee.
 *
 * Withdrawals are typically submitted by a relayer on behalf of the user,
 * so the senderKey here belongs to the relayer.
 */

import {
  makeContractCall,
  broadcastTransaction,
  Cl,
  PostConditionMode,
  type StacksTransactionWire,
} from '@stacks/transactions';
import type { StacksNetwork } from '@stacks/network';

import {
  POOL_DENOMINATION,
  HASH_LENGTH,
  COMPRESSED_PUBKEY_LENGTH,
  MAX_PROOF_BYTES,
} from '../utils/constants.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WithdrawParams {
  /** Serialised STARK proof (up to 2048 bytes) */
  proof: Uint8Array;
  /** 32-byte nullifier hash */
  nullifier: Uint8Array;
  /** 32-byte Merkle root the proof was generated against */
  root: Uint8Array;
  /** Stacks address of the recipient (stealth address) */
  recipient: string;
  /** 33-byte compressed ephemeral public key R (for stealth detection) */
  ephemeralPubKey: Uint8Array;
  /** Relayer fee in satoshis (deducted from POOL_DENOMINATION) */
  relayerFee: bigint;
  /** Hex-encoded private key of the relayer (or self if no relayer) */
  senderKey: string;
  /** Pool contract identifier, e.g. "SP1234….pool-v1" */
  poolContract: string;
  /** Stacks network configuration */
  network: StacksNetwork;
  /** Optional nonce override */
  nonce?: bigint;
  /** Optional fee override (STX gas fee, not relayer sBTC fee) */
  fee?: bigint;
}

export interface WithdrawResult {
  /** Transaction id of the withdrawal transaction */
  txId: string;
  /** The nullifier that was consumed */
  nullifier: Uint8Array;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
// Builder
// ---------------------------------------------------------------------------

/**
 * Build the pool withdrawal transaction.
 *
 * Validates all input lengths and ensures the relayer fee does not exceed the
 * pool denomination before constructing the contract call.
 */
export async function buildWithdrawTx(
  params: WithdrawParams,
): Promise<StacksTransactionWire> {
  // ---- Input validation ----
  if (params.proof.length === 0 || params.proof.length > MAX_PROOF_BYTES) {
    throw new Error(
      `Proof must be between 1 and ${MAX_PROOF_BYTES} bytes, got ${params.proof.length}`,
    );
  }
  if (params.nullifier.length !== HASH_LENGTH) {
    throw new Error(
      `Nullifier must be ${HASH_LENGTH} bytes, got ${params.nullifier.length}`,
    );
  }
  if (params.root.length !== HASH_LENGTH) {
    throw new Error(
      `Root must be ${HASH_LENGTH} bytes, got ${params.root.length}`,
    );
  }
  if (params.ephemeralPubKey.length !== COMPRESSED_PUBKEY_LENGTH) {
    throw new Error(
      `Ephemeral public key must be ${COMPRESSED_PUBKEY_LENGTH} bytes, got ${params.ephemeralPubKey.length}`,
    );
  }
  if (params.relayerFee < 0n) {
    throw new Error('Relayer fee must be non-negative');
  }
  if (params.relayerFee > POOL_DENOMINATION) {
    throw new Error(
      `Relayer fee (${params.relayerFee}) exceeds pool denomination (${POOL_DENOMINATION})`,
    );
  }

  const { contractAddress, contractName } = splitContractId(
    params.poolContract,
  );

  const tx = await makeContractCall({
    contractAddress,
    contractName,
    functionName: 'withdraw',
    functionArgs: [
      // proof: (buff 2048)
      Cl.buffer(params.proof),
      // nullifier: (buff 32)
      Cl.buffer(params.nullifier),
      // root: (buff 32)
      Cl.buffer(params.root),
      // recipient: principal
      Cl.principal(params.recipient),
      // ephemeral-pubkey: (buff 33)
      Cl.buffer(params.ephemeralPubKey),
      // relayer-fee: uint
      Cl.uint(params.relayerFee),
    ],
    senderKey: params.senderKey,
    network: params.network,
    // Allow mode because the contract transfers from its own balance
    // (as-contract), so user post-conditions don't apply to the pool's
    // internal transfers.
    postConditionMode: PostConditionMode.Allow,
    postConditions: [],
    ...(params.nonce !== undefined ? { nonce: params.nonce } : {}),
    ...(params.fee !== undefined ? { fee: params.fee } : {}),
  });

  return tx;
}

/**
 * Build, sign, and broadcast a withdrawal transaction.
 */
export async function submitWithdrawal(
  params: WithdrawParams,
): Promise<WithdrawResult> {
  const tx = await buildWithdrawTx(params);

  const result = await broadcastTransaction({
    transaction: tx,
    network: params.network,
  });

  if ('error' in result) {
    throw new Error(
      `Withdrawal broadcast failed: ${(result as { error: string }).error}`,
    );
  }

  return {
    txId: (result as { txid: string }).txid,
    nullifier: params.nullifier,
  };
}
