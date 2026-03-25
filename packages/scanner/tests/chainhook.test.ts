/**
 * Tests for Chainhook payload parsing and predicate generation.
 */

import { describe, it, expect } from 'vitest';

import {
  parseChainhookPayload,
  generateChainhookPredicate,
  type WithdrawalEvent,
} from '../src/chainhook.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Build a valid Chainhook-style payload with one withdrawal event. */
function buildChainhookPayload(overrides?: {
  nullifier?: string;
  recipient?: string;
  ephemeralPubKey?: string;
  relayerFee?: number | string;
  blockHeight?: number;
  txId?: string;
}): object {
  const nullifier = overrides?.nullifier ?? '0x' + 'ab'.repeat(32);
  const recipient = overrides?.recipient ?? 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
  const ephemeralPubKey = overrides?.ephemeralPubKey ?? '0x02' + 'cd'.repeat(32);
  const relayerFee = overrides?.relayerFee ?? 100000;
  const blockHeight = overrides?.blockHeight ?? 42;
  const txId = overrides?.txId ?? '0xdeadbeef' + '00'.repeat(28);

  return {
    apply: [
      {
        block_identifier: {
          index: blockHeight,
          hash: '0x' + '00'.repeat(32),
        },
        transactions: [
          {
            transaction_identifier: { hash: txId },
            metadata: {
              receipt: {
                events: [
                  {
                    type: 'SmartContractEvent',
                    data: {
                      event: 'withdrawal',
                      nullifier,
                      recipient,
                      'ephemeral-pubkey': ephemeralPubKey,
                      'relayer-fee': relayerFee,
                      amount: 10000000,
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseChainhookPayload', () => {
  it('should parse a valid withdrawal event from a Chainhook payload', () => {
    const payload = buildChainhookPayload();
    const events = parseChainhookPayload(payload);

    expect(events).toHaveLength(1);
    const event = events[0]!;
    expect(event.recipient).toBe('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
    expect(event.nullifier).toHaveLength(32);
    expect(event.ephemeralPubKey).toHaveLength(33);
    expect(event.relayerFee).toBe(100000n);
    expect(event.blockHeight).toBe(42);
  });

  it('should parse multiple events from multiple blocks', () => {
    const payload = {
      apply: [
        {
          block_identifier: { index: 10, hash: '0x' + '00'.repeat(32) },
          transactions: [
            {
              transaction_identifier: { hash: '0x' + 'aa'.repeat(32) },
              metadata: {
                receipt: {
                  events: [
                    {
                      type: 'SmartContractEvent',
                      data: {
                        event: 'withdrawal',
                        nullifier: '0x' + '11'.repeat(32),
                        recipient: 'ST1ADDR1',
                        'ephemeral-pubkey': '0x02' + '11'.repeat(32),
                        'relayer-fee': 0,
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
        {
          block_identifier: { index: 11, hash: '0x' + '01'.repeat(32) },
          transactions: [
            {
              transaction_identifier: { hash: '0x' + 'bb'.repeat(32) },
              metadata: {
                receipt: {
                  events: [
                    {
                      type: 'SmartContractEvent',
                      data: {
                        event: 'withdrawal',
                        nullifier: '0x' + '22'.repeat(32),
                        recipient: 'ST1ADDR2',
                        'ephemeral-pubkey': '0x03' + '22'.repeat(32),
                        'relayer-fee': 50000,
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    };

    const events = parseChainhookPayload(payload);
    expect(events).toHaveLength(2);
    expect(events[0]!.blockHeight).toBe(10);
    expect(events[1]!.blockHeight).toBe(11);
    expect(events[0]!.recipient).toBe('ST1ADDR1');
    expect(events[1]!.recipient).toBe('ST1ADDR2');
  });

  it('should skip non-withdrawal print events', () => {
    const payload = {
      apply: [
        {
          block_identifier: { index: 5, hash: '0x' + '00'.repeat(32) },
          transactions: [
            {
              transaction_identifier: { hash: '0x' + 'cc'.repeat(32) },
              metadata: {
                receipt: {
                  events: [
                    {
                      type: 'SmartContractEvent',
                      data: {
                        event: 'deposit',
                        commitment: '0x' + 'ff'.repeat(32),
                        root: '0x' + 'ee'.repeat(32),
                        'leaf-index': 0,
                        amount: 10000000,
                        source: 'ST1DEPOSITOR',
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    };

    const events = parseChainhookPayload(payload);
    expect(events).toHaveLength(0);
  });

  it('should handle nested data.value format', () => {
    const payload = {
      apply: [
        {
          block_identifier: { index: 20, hash: '0x' + '00'.repeat(32) },
          transactions: [
            {
              transaction_identifier: { hash: '0x' + 'dd'.repeat(32) },
              metadata: {
                receipt: {
                  events: [
                    {
                      type: 'SmartContractEvent',
                      data: {
                        value: {
                          event: 'withdrawal',
                          nullifier: '0x' + 'ab'.repeat(32),
                          recipient: 'ST1NESTED',
                          'ephemeral-pubkey': '0x02' + 'cd'.repeat(32),
                          'relayer-fee': '200000',
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    };

    const events = parseChainhookPayload(payload);
    expect(events).toHaveLength(1);
    expect(events[0]!.recipient).toBe('ST1NESTED');
    expect(events[0]!.relayerFee).toBe(200000n);
  });

  it('should return empty array for null/undefined input', () => {
    expect(parseChainhookPayload(null)).toEqual([]);
    expect(parseChainhookPayload(undefined)).toEqual([]);
    expect(parseChainhookPayload({})).toEqual([]);
    expect(parseChainhookPayload('string')).toEqual([]);
  });

  it('should return empty array for payload with empty apply array', () => {
    expect(parseChainhookPayload({ apply: [] })).toEqual([]);
  });

  it('should handle payload with no receipt events', () => {
    const payload = {
      apply: [
        {
          block_identifier: { index: 1, hash: '0x00' },
          transactions: [
            {
              transaction_identifier: { hash: '0xabc' },
              metadata: {
                receipt: {
                  events: [],
                },
              },
            },
          ],
        },
      ],
    };

    expect(parseChainhookPayload(payload)).toEqual([]);
  });

  it('should handle relayer-fee as string', () => {
    const payload = buildChainhookPayload({ relayerFee: '500000' });
    const events = parseChainhookPayload(payload);

    expect(events).toHaveLength(1);
    expect(events[0]!.relayerFee).toBe(500000n);
  });

  it('should skip events with malformed hex data', () => {
    const payload = {
      apply: [
        {
          block_identifier: { index: 1, hash: '0x00' },
          transactions: [
            {
              transaction_identifier: { hash: '0xabc' },
              metadata: {
                receipt: {
                  events: [
                    {
                      type: 'SmartContractEvent',
                      data: {
                        event: 'withdrawal',
                        nullifier: 'not-hex!',
                        recipient: 'ST1ADDR',
                        'ephemeral-pubkey': 'also-not-hex',
                        'relayer-fee': 0,
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    };

    // Should not throw; returns empty because hex parsing fails
    const events = parseChainhookPayload(payload);
    expect(events).toHaveLength(0);
  });
});

describe('generateChainhookPredicate', () => {
  it('should generate a valid predicate with webhook URL', () => {
    const predicate = generateChainhookPredicate(
      'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.pool-v1',
      'http://localhost:3100/api/events/withdrawal',
    ) as Record<string, unknown>;

    expect(predicate.chain).toBe('stacks');
    expect(predicate.version).toBe(1);

    const networks = predicate.networks as Record<string, Record<string, unknown>>;
    const mainnet = networks.mainnet;

    const ifThis = mainnet.if_this as Record<string, string>;
    expect(ifThis.scope).toBe('contract_call');
    expect(ifThis.contract_identifier).toBe('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.pool-v1');
    expect(ifThis.method).toBe('withdraw');

    const thenThat = mainnet.then_that as Record<string, Record<string, string>>;
    expect(thenThat.http_post.url).toBe('http://localhost:3100/api/events/withdrawal');
  });

  it('should include authorization header when provided', () => {
    const predicate = generateChainhookPredicate(
      'SP123.pool-v1',
      'https://example.com/hook',
      'my-secret-token',
    ) as Record<string, unknown>;

    const networks = predicate.networks as Record<string, Record<string, unknown>>;
    const testnet = networks.testnet;
    const thenThat = testnet.then_that as Record<string, Record<string, string>>;

    expect(thenThat.http_post.authorization_header).toBe('Bearer my-secret-token');
  });

  it('should not include authorization header when not provided', () => {
    const predicate = generateChainhookPredicate(
      'SP123.pool-v1',
      'https://example.com/hook',
    ) as Record<string, unknown>;

    const networks = predicate.networks as Record<string, Record<string, unknown>>;
    const mainnet = networks.mainnet;
    const thenThat = mainnet.then_that as Record<string, Record<string, string>>;

    expect(thenThat.http_post.authorization_header).toBeUndefined();
  });

  it('should generate a deterministic UUID from the contract identifier', () => {
    const predicate = generateChainhookPredicate(
      'SP123.pool-v1',
      'http://localhost:3100/hook',
    ) as Record<string, string>;

    expect(predicate.uuid).toBe('satsu-scanner-SP123-pool-v1');
  });
});
