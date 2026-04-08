/**
 * @satsu/relay — Stacks transaction submitter
 *
 * Handles serialisation, contract-call construction, and broadcast of both
 * deposit and withdrawal transactions.  Deposit txs arrive pre-signed by the
 * user; the relayer merely broadcasts.  Withdrawal txs are constructed and
 * signed by the relayer, who then claims the on-chain relayer fee.
 */

import {
  broadcastTransaction,
  makeContractCall,
  deserializeTransaction,
  Cl,
  type TxBroadcastResult,
  type TxBroadcastResultOk,
} from '@stacks/transactions';
import {
  STACKS_DEVNET,
  STACKS_TESTNET,
  STACKS_MAINNET,
  type StacksNetwork,
} from '@stacks/network';
import type { Logger } from 'pino';
import type { RelayerConfig } from './config.js';
import type { DepositPayload, WithdrawalPayload } from './queue.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function networkFor(config: RelayerConfig): StacksNetwork {
  const base = (() => {
    switch (config.network) {
      case 'mainnet':
        return { ...STACKS_MAINNET };
      case 'testnet':
        return { ...STACKS_TESTNET };
      case 'devnet':
      default:
        return { ...STACKS_DEVNET };
    }
  })();

  // Override the client baseUrl so the SDK talks to the configured API node.
  return {
    ...base,
    client: { baseUrl: config.stacksApiUrl },
  };
}

function isBroadcastOk(result: TxBroadcastResult): result is TxBroadcastResultOk {
  return !('error' in result);
}

function broadcastErrorReason(result: TxBroadcastResult): string {
  if ('reason' in result && typeof (result as Record<string, unknown>).reason === 'string') {
    return (result as Record<string, unknown>).reason as string;
  }
  return 'unknown';
}

function splitContract(fqn: string): { contractAddress: string; contractName: string } {
  const [contractAddress, contractName] = fqn.split('.');
  if (!contractAddress || !contractName) {
    throw new Error(`Invalid contract identifier: ${fqn}`);
  }
  return { contractAddress, contractName };
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length === 0 || clean.length % 2 !== 0) {
    throw new Error(`Invalid hex string: must have even length, got ${clean.length}`);
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Deposit submission
// ---------------------------------------------------------------------------

/**
 * Broadcast a pre-signed deposit transaction.
 *
 * The user has already constructed and signed a contract-call to
 * `pool-v1.deposit`.  The relayer simply deserialises, validates the shape,
 * and broadcasts.
 */
export async function submitDepositTx(
  payload: DepositPayload,
  config: RelayerConfig,
  logger: Logger,
): Promise<string> {
  const network = networkFor(config);
  const tx = deserializeTransaction(payload.signedTx);

  logger.info({ txid: tx.txid() }, 'broadcasting deposit transaction');

  const result = await broadcastTransaction({
    transaction: tx,
    network,
  });

  if (!isBroadcastOk(result)) {
    throw new Error(`Deposit broadcast rejected: ${broadcastErrorReason(result)}`);
  }

  return result.txid;
}

// ---------------------------------------------------------------------------
// Withdrawal submission
// ---------------------------------------------------------------------------

/**
 * Construct and broadcast a withdrawal contract call.
 *
 * The relayer is the tx-sender here — it pays the STX gas fee and in return
 * collects the on-chain relayer fee from the withdrawal amount.
 */
export async function submitWithdrawalTx(
  payload: WithdrawalPayload,
  config: RelayerConfig,
  logger: Logger,
): Promise<string> {
  const network = networkFor(config);
  const { contractAddress, contractName } = splitContract(config.poolContract);

  const tx = await makeContractCall({
    contractAddress,
    contractName,
    functionName: 'withdraw',
    functionArgs: [
      Cl.buffer(hexToBytes(payload.proof)),
      Cl.buffer(hexToBytes(payload.nullifier)),
      Cl.buffer(hexToBytes(payload.root)),
      Cl.principal(payload.recipient),
      Cl.buffer(hexToBytes(payload.ephemeralPubKey)),
      Cl.uint(BigInt(payload.relayerFee)),
    ],
    senderKey: config.relayerPrivateKey,
    network,
    postConditionMode: 'allow' as const,
  });

  logger.info({ txid: tx.txid() }, 'broadcasting withdrawal transaction');

  const result = await broadcastTransaction({
    transaction: tx,
    network,
  });

  if (!isBroadcastOk(result)) {
    throw new Error(`Withdrawal broadcast rejected: ${broadcastErrorReason(result)}`);
  }

  return result.txid;
}

// ---------------------------------------------------------------------------
// Transaction status check
// ---------------------------------------------------------------------------

/**
 * Query the Stacks API for the current status of a transaction.
 */
export async function checkTxStatus(
  txId: string,
  apiUrl: string,
): Promise<'pending' | 'success' | 'failed'> {
  const url = `${apiUrl}/extended/v1/tx/${txId}`;

  const response = await fetch(url);
  if (!response.ok) {
    // If the API returns 404, the tx may not have been indexed yet.
    if (response.status === 404) return 'pending';
    throw new Error(`Stacks API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { tx_status: string };

  switch (data.tx_status) {
    case 'success':
      return 'success';
    case 'abort_by_response':
    case 'abort_by_post_condition':
      return 'failed';
    default:
      // pending, processing, etc.
      return 'pending';
  }
}
