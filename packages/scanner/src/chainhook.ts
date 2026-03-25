/**
 * Chainhook event subscription and webhook handling.
 *
 * Chainhooks (Hiro's blockchain event indexer) push real-time events
 * to a webhook endpoint when a matching on-chain transaction is observed.
 * This module handles:
 *
 * 1. Parsing incoming Chainhook webhook payloads
 * 2. Extracting withdrawal events from contract print events
 * 3. Generating Chainhook predicate JSON for registration
 * 4. A polling fallback for when Chainhooks are unavailable
 *
 * @module
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Raw Chainhook webhook payload structure.
 *
 * Chainhooks send an `apply` array containing blocks, each with
 * transactions that matched the predicate. We extract print events
 * from the transaction receipts.
 */
export interface ChainhookEvent {
  apply: Array<{
    block_identifier: {
      index: number;
      hash: string;
    };
    transactions: Array<{
      metadata: {
        receipt: {
          events: Array<{
            type: string;
            data: Record<string, unknown>;
          }>;
        };
      };
      transaction_identifier: { hash: string };
    }>;
  }>;
}

/**
 * Parsed withdrawal event extracted from on-chain data.
 */
export interface WithdrawalEvent {
  /** Transaction hash (0x-prefixed). */
  txId: string;
  /** 32-byte nullifier hash (prevents double-spend). */
  nullifier: Uint8Array;
  /** Stacks address of the payment recipient. */
  recipient: string;
  /** 33-byte compressed ephemeral public key R. */
  ephemeralPubKey: Uint8Array;
  /** Relayer fee in satoshis. */
  relayerFee: bigint;
  /** Block height at which the withdrawal was confirmed. */
  blockHeight: number;
}

// ---------------------------------------------------------------------------
// Zod schemas for validation
// ---------------------------------------------------------------------------

const hexBuffSchema = (expectedLen: number) =>
  z.string().refine(
    (s) => {
      const cleaned = s.startsWith('0x') ? s.slice(2) : s;
      return cleaned.length === expectedLen * 2 && /^[0-9a-fA-F]+$/.test(cleaned);
    },
    { message: `Expected ${expectedLen}-byte hex string` },
  );

/**
 * Schema for a Clarity print event value that represents a withdrawal.
 *
 * The pool-v1 contract emits:
 * ```clarity
 * (print {
 *   event: "withdrawal",
 *   nullifier: (buff 32),
 *   recipient: principal,
 *   ephemeral-pubkey: (buff 33),
 *   relayer: principal,
 *   relayer-fee: uint,
 *   amount: uint
 * })
 * ```
 *
 * In the Chainhook/API JSON representation, Clarity values are
 * encoded with type tags. We handle both raw and tagged formats.
 */
const withdrawalPrintSchema = z.object({
  event: z.literal('withdrawal'),
  nullifier: z.string(),
  recipient: z.string(),
  'ephemeral-pubkey': z.string(),
  'relayer-fee': z.union([z.string(), z.number()]),
  amount: z.union([z.string(), z.number()]).optional(),
});

// ---------------------------------------------------------------------------
// Payload parsing
// ---------------------------------------------------------------------------

/**
 * Parse a Chainhook webhook payload and extract withdrawal events.
 *
 * Chainhook payloads contain blocks with transactions. Each transaction
 * has a receipt with events. We look for `print_event` or `smart_contract_log`
 * type events whose content matches the withdrawal event structure.
 *
 * @param payload - Raw Chainhook webhook JSON payload
 * @returns Array of parsed withdrawal events
 */
export function parseChainhookPayload(payload: unknown): WithdrawalEvent[] {
  const events: WithdrawalEvent[] = [];

  if (!isObject(payload) || !Array.isArray((payload as Record<string, unknown>).apply)) {
    return events;
  }

  const chainhookPayload = payload as unknown as ChainhookEvent;

  for (const block of chainhookPayload.apply) {
    const blockHeight = block.block_identifier?.index ?? 0;

    for (const tx of block.transactions) {
      const txId = tx.transaction_identifier.hash;
      const receiptEvents = tx.metadata?.receipt?.events ?? [];

      for (const ev of receiptEvents) {
        const withdrawal = tryParseWithdrawalEvent(ev, txId, blockHeight);
        if (withdrawal !== null) {
          events.push(withdrawal);
        }
      }
    }
  }

  return events;
}

/**
 * Try to parse a single receipt event as a withdrawal.
 */
function tryParseWithdrawalEvent(
  ev: { type: string; data: Record<string, unknown> },
  txId: string,
  blockHeight: number,
): WithdrawalEvent | null {
  // Chainhook event types for print events
  if (ev.type !== 'SmartContractEvent' && ev.type !== 'smart_contract_log' && ev.type !== 'print_event') {
    return null;
  }

  // The print value might be nested under data.value, data.raw_value, or data directly
  const printValue = extractPrintValue(ev.data);
  if (printValue === null) {
    return null;
  }

  const parsed = withdrawalPrintSchema.safeParse(printValue);
  if (!parsed.success) {
    return null;
  }

  const data = parsed.data;

  try {
    return {
      txId,
      nullifier: hexToBytes(cleanHex(data.nullifier)),
      recipient: data.recipient,
      ephemeralPubKey: hexToBytes(cleanHex(data['ephemeral-pubkey'])),
      relayerFee: BigInt(data['relayer-fee']),
      blockHeight,
    };
  } catch {
    return null;
  }
}

/**
 * Extract the print event value from various Chainhook payload formats.
 *
 * Chainhook payloads can nest the Clarity value in different ways:
 * - `data.value` (Chainhook v1)
 * - `data.raw_value` (parsed Clarity)
 * - Direct object with `event` field
 */
function extractPrintValue(data: Record<string, unknown>): Record<string, unknown> | null {
  if (data == null) return null;

  // Direct: data has `event` key
  if (typeof data.event === 'string') {
    return data;
  }

  // Nested: data.value is the actual print object
  if (isObject(data.value) && typeof (data.value as Record<string, unknown>).event === 'string') {
    return data.value as Record<string, unknown>;
  }

  // Nested: data.raw_value
  if (isObject(data.raw_value) && typeof (data.raw_value as Record<string, unknown>).event === 'string') {
    return data.raw_value as Record<string, unknown>;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Chainhook predicate generation
// ---------------------------------------------------------------------------

/**
 * Generate a Chainhook predicate JSON for subscribing to pool-v1
 * withdrawal events.
 *
 * This predicate tells Chainhook to watch for `withdraw` method calls
 * on the specified pool contract and POST matching events to the webhook.
 *
 * @param poolContract - Fully-qualified contract identifier
 * @param webhookUrl - URL to POST events to
 * @param authToken - Optional Bearer token for webhook authentication
 * @returns Chainhook predicate object ready for registration
 */
export function generateChainhookPredicate(
  poolContract: string,
  webhookUrl: string,
  authToken?: string,
): object {
  const httpPost: Record<string, string> = {
    url: webhookUrl,
  };

  if (authToken) {
    httpPost.authorization_header = `Bearer ${authToken}`;
  }

  return {
    chain: 'stacks',
    uuid: `satsu-scanner-${poolContract.replace(/\./g, '-')}`,
    version: 1,
    networks: {
      mainnet: {
        if_this: {
          scope: 'contract_call',
          contract_identifier: poolContract,
          method: 'withdraw',
        },
        then_that: {
          http_post: httpPost,
        },
      },
      testnet: {
        if_this: {
          scope: 'contract_call',
          contract_identifier: poolContract,
          method: 'withdraw',
        },
        then_that: {
          http_post: httpPost,
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Polling fallback
// ---------------------------------------------------------------------------

/**
 * Stacks API response structure for contract events.
 */
interface StacksApiEventResponse {
  results: Array<{
    event_type: string;
    tx_id: string;
    block_height: number;
    contract_log?: {
      contract_id: string;
      topic: string;
      value: {
        repr: string;
        hex: string;
      };
    };
  }>;
  total: number;
  limit: number;
  offset: number;
}

/**
 * Poll the Stacks API for recent withdrawal events.
 *
 * This is a fallback for environments where Chainhooks aren't
 * available (e.g. browser-based scanning). It queries the Stacks
 * API for contract events from a given block height.
 *
 * @param apiUrl - Stacks API base URL
 * @param poolContract - Fully-qualified pool contract identifier
 * @param fromBlock - Minimum block height to scan from
 * @returns Array of withdrawal events
 */
export async function pollWithdrawalEvents(
  apiUrl: string,
  poolContract: string,
  fromBlock: number,
): Promise<WithdrawalEvent[]> {
  const events: WithdrawalEvent[] = [];
  const baseUrl = apiUrl.replace(/\/+$/, '');

  // Query contract events from the Stacks API
  // The API endpoint for contract events:
  // GET /extended/v1/contract/{contract_id}/events
  const url = `${baseUrl}/extended/v1/contract/${poolContract}/events?limit=50&offset=0`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    // Network error - return empty, will retry on next poll
    return events;
  }

  if (!response.ok) {
    return events;
  }

  let data: StacksApiEventResponse;
  try {
    data = (await response.json()) as StacksApiEventResponse;
  } catch {
    return events;
  }

  for (const result of data.results ?? []) {
    // Skip events below our scan cursor
    if (result.block_height < fromBlock) {
      continue;
    }

    // Only process contract log events
    if (result.event_type !== 'smart_contract_log') {
      continue;
    }

    const logValue = result.contract_log?.value;
    if (!logValue) continue;

    // Try to parse the Clarity value representation
    const parsed = tryParseClarityRepr(logValue.repr);
    if (parsed === null || parsed.event !== 'withdrawal') {
      continue;
    }

    try {
      events.push({
        txId: result.tx_id,
        nullifier: hexToBytes(cleanHex(parsed.nullifier as string)),
        recipient: parsed.recipient as string,
        ephemeralPubKey: hexToBytes(cleanHex(parsed['ephemeral-pubkey'] as string)),
        relayerFee: BigInt(parsed['relayer-fee'] as string | number),
        blockHeight: result.block_height,
      });
    } catch {
      // Malformed event - skip
      continue;
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Clarity repr parser (simplified)
// ---------------------------------------------------------------------------

/**
 * Parse a simplified Clarity value representation string into a JS object.
 *
 * Handles the common tuple format emitted by the Stacks API:
 * `(tuple (event "withdrawal") (nullifier 0x...) ...)`
 *
 * This is a best-effort parser; production systems should use a proper
 * Clarity value decoder.
 */
function tryParseClarityRepr(repr: string): Record<string, unknown> | null {
  if (!repr.startsWith('(tuple')) {
    return null;
  }

  const result: Record<string, unknown> = {};

  // Match key-value pairs: (key value)
  const pairRegex = /\(([a-zA-Z][a-zA-Z0-9_-]*)\s+(.+?)\)/g;
  let match: RegExpExecArray | null;

  while ((match = pairRegex.exec(repr)) !== null) {
    const key = match[1]!;
    let value: unknown = match[2]!.trim();

    // Remove Clarity type wrappers
    if (typeof value === 'string') {
      // String values: "..."
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      // Uint: u123
      else if (/^u\d+$/.test(value)) {
        value = value.slice(1);
      }
      // Principal: 'SP... or SP...
      else if (value.startsWith("'")) {
        value = value.slice(1);
      }
    }

    result[key] = value;
  }

  return Object.keys(result).length > 0 ? result : null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function cleanHex(hex: string): string {
  return hex.startsWith('0x') ? hex.slice(2) : hex;
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Hex string must have even length');
  }
  if (!/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error('Invalid hex string');
  }
  const len = hex.length;
  const bytes = new Uint8Array(len / 2);
  for (let i = 0; i < len; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}
