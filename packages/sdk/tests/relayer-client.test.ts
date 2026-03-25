/**
 * Tests for the RelayerClient.
 *
 * These tests verify:
 *  - Zod schema validation for relayer responses
 *  - Hex encoding/decoding of request bodies
 *  - Error handling for failed requests
 *  - Health check resilience
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RelayerClient, RelayerError } from '../src/relayer/client.js';
import { bytesToHex } from '../src/utils/crypto.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RELAYER_URL = 'https://relay.satsu.test';

function makeCommitment(): Uint8Array {
  const buf = new Uint8Array(32);
  for (let i = 0; i < 32; i++) buf[i] = i;
  return buf;
}

function makeNullifier(): Uint8Array {
  const buf = new Uint8Array(32);
  for (let i = 0; i < 32; i++) buf[i] = 0xff - i;
  return buf;
}

function makeRoot(): Uint8Array {
  const buf = new Uint8Array(32);
  for (let i = 0; i < 32; i++) buf[i] = 0xab;
  return buf;
}

function makeProof(): Uint8Array {
  return new Uint8Array(128).fill(0xcc);
}

function makeEphemeralPubKey(): Uint8Array {
  const buf = new Uint8Array(33);
  buf[0] = 0x02;
  for (let i = 1; i < 33; i++) buf[i] = i;
  return buf;
}

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

let fetchMock: ReturnType<typeof vi.fn>;

function mockFetchResponse(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response);
}

function mockFetchNetworkError() {
  fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests: submitDeposit
// ---------------------------------------------------------------------------

describe('RelayerClient.submitDeposit', () => {
  it('sends hex-encoded fields and returns txId', async () => {
    const client = new RelayerClient(RELAYER_URL);
    const signedTx = new Uint8Array([0x01, 0x02, 0x03]);
    const commitment = makeCommitment();
    const source = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';

    mockFetchResponse({ txId: 'abc123' });

    const result = await client.submitDeposit({ signedTx, commitment, source });

    expect(result.txId).toBe('abc123');

    // Verify the request body was hex-encoded
    const call = fetchMock.mock.calls[0];
    const url = call[0] as string;
    const init = call[1] as RequestInit;
    expect(url).toBe(`${RELAYER_URL}/api/v1/deposit`);
    expect(init.method).toBe('POST');

    const body = JSON.parse(init.body as string);
    expect(body.signedTx).toBe(bytesToHex(signedTx));
    expect(body.commitment).toBe(bytesToHex(commitment));
    expect(body.source).toBe(source);
  });

  it('rejects if response is missing txId', async () => {
    const client = new RelayerClient(RELAYER_URL);
    mockFetchResponse({ wrongField: 'oops' });

    await expect(
      client.submitDeposit({
        signedTx: new Uint8Array(1),
        commitment: makeCommitment(),
        source: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      }),
    ).rejects.toThrow(); // Zod validation error
  });

  it('throws RelayerError on HTTP failure', async () => {
    const client = new RelayerClient(RELAYER_URL);
    mockFetchResponse({ error: 'Bad request' }, 400);

    await expect(
      client.submitDeposit({
        signedTx: new Uint8Array(1),
        commitment: makeCommitment(),
        source: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      }),
    ).rejects.toThrow(RelayerError);
  });

  it('throws RelayerError on network failure', async () => {
    const client = new RelayerClient(RELAYER_URL);
    mockFetchNetworkError();

    await expect(
      client.submitDeposit({
        signedTx: new Uint8Array(1),
        commitment: makeCommitment(),
        source: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      }),
    ).rejects.toThrow(RelayerError);
  });
});

// ---------------------------------------------------------------------------
// Tests: submitWithdrawal
// ---------------------------------------------------------------------------

describe('RelayerClient.submitWithdrawal', () => {
  it('sends hex-encoded fields and bigint fee as string', async () => {
    const client = new RelayerClient(RELAYER_URL);
    const proof = makeProof();
    const nullifier = makeNullifier();
    const root = makeRoot();
    const ephemeralPubKey = makeEphemeralPubKey();
    const recipient = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    const relayerFee = 50000n;

    mockFetchResponse({ txId: 'def456' });

    const result = await client.submitWithdrawal({
      proof,
      nullifier,
      root,
      recipient,
      ephemeralPubKey,
      relayerFee,
    });

    expect(result.txId).toBe('def456');

    const call = fetchMock.mock.calls[0];
    const url = call[0] as string;
    const init = call[1] as RequestInit;
    expect(url).toBe(`${RELAYER_URL}/api/v1/withdraw`);

    const body = JSON.parse(init.body as string);
    expect(body.proof).toBe(bytesToHex(proof));
    expect(body.nullifier).toBe(bytesToHex(nullifier));
    expect(body.root).toBe(bytesToHex(root));
    expect(body.ephemeralPubKey).toBe(bytesToHex(ephemeralPubKey));
    expect(body.relayerFee).toBe('50000');
    expect(body.recipient).toBe(recipient);
  });

  it('rejects malformed withdrawal response', async () => {
    const client = new RelayerClient(RELAYER_URL);
    mockFetchResponse({ id: 'not-txId' }); // wrong key

    await expect(
      client.submitWithdrawal({
        proof: makeProof(),
        nullifier: makeNullifier(),
        root: makeRoot(),
        recipient: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
        ephemeralPubKey: makeEphemeralPubKey(),
        relayerFee: 0n,
      }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tests: getStatus
// ---------------------------------------------------------------------------

describe('RelayerClient.getStatus', () => {
  it('parses status and converts fee string to bigint', async () => {
    const client = new RelayerClient(RELAYER_URL);
    mockFetchResponse({
      pendingDeposits: 3,
      pendingWithdrawals: 1,
      currentFee: '50000',
    });

    const status = await client.getStatus();
    expect(status.pendingDeposits).toBe(3);
    expect(status.pendingWithdrawals).toBe(1);
    expect(status.currentFee).toBe(50000n);
  });

  it('rejects status with negative pendingDeposits', async () => {
    const client = new RelayerClient(RELAYER_URL);
    mockFetchResponse({
      pendingDeposits: -1,
      pendingWithdrawals: 0,
      currentFee: '100',
    });

    await expect(client.getStatus()).rejects.toThrow();
  });

  it('rejects status with missing currentFee', async () => {
    const client = new RelayerClient(RELAYER_URL);
    mockFetchResponse({
      pendingDeposits: 0,
      pendingWithdrawals: 0,
    });

    await expect(client.getStatus()).rejects.toThrow();
  });

  it('rejects status with non-integer pendingDeposits', async () => {
    const client = new RelayerClient(RELAYER_URL);
    mockFetchResponse({
      pendingDeposits: 1.5,
      pendingWithdrawals: 0,
      currentFee: '100',
    });

    await expect(client.getStatus()).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tests: getHealth
// ---------------------------------------------------------------------------

describe('RelayerClient.getHealth', () => {
  it('returns true when relayer reports ok', async () => {
    const client = new RelayerClient(RELAYER_URL);
    mockFetchResponse({ ok: true });

    const healthy = await client.getHealth();
    expect(healthy).toBe(true);
  });

  it('returns false when relayer reports not ok', async () => {
    const client = new RelayerClient(RELAYER_URL);
    mockFetchResponse({ ok: false });

    const healthy = await client.getHealth();
    expect(healthy).toBe(false);
  });

  it('returns false on network error (never throws)', async () => {
    const client = new RelayerClient(RELAYER_URL);
    mockFetchNetworkError();

    const healthy = await client.getHealth();
    expect(healthy).toBe(false);
  });

  it('returns false on HTTP 500 (never throws)', async () => {
    const client = new RelayerClient(RELAYER_URL);
    mockFetchResponse({ error: 'Internal' }, 500);

    const healthy = await client.getHealth();
    expect(healthy).toBe(false);
  });

  it('returns false on malformed response (never throws)', async () => {
    const client = new RelayerClient(RELAYER_URL);
    mockFetchResponse({ healthy: true }); // wrong key

    const healthy = await client.getHealth();
    expect(healthy).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: URL handling
// ---------------------------------------------------------------------------

describe('RelayerClient URL handling', () => {
  it('strips trailing slash from base URL', async () => {
    const client = new RelayerClient('https://relay.satsu.test/');
    mockFetchResponse({ ok: true });

    await client.getHealth();

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe('https://relay.satsu.test/api/v1/health');
  });
});
