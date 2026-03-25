/**
 * Tests for TransactionQueue
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import pino from 'pino';
import { TransactionQueue } from '../src/queue.js';
import type { DepositPayload, WithdrawalPayload } from '../src/queue.js';

// Silent logger for tests
const logger = pino({ level: 'silent' });

function tmpPath(): string {
  return path.join(os.tmpdir(), `satsu-queue-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

const depositPayload: DepositPayload = {
  signedTx: 'aabb',
  commitment: 'cc00',
  source: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
};

const withdrawalPayload: WithdrawalPayload = {
  proof: 'ff00',
  nullifier: 'dd00',
  root: 'ee00',
  recipient: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
  ephemeralPubKey: 'aa11',
  relayerFee: '10000',
};

describe('TransactionQueue', () => {
  let persistPath: string;
  let queue: TransactionQueue;

  beforeEach(() => {
    persistPath = tmpPath();
    queue = new TransactionQueue(persistPath, logger);
  });

  afterEach(() => {
    try {
      fs.unlinkSync(persistPath);
    } catch {
      // file may not exist — that is fine
    }
  });

  // -----------------------------------------------------------------------
  // enqueue
  // -----------------------------------------------------------------------

  it('enqueue returns a unique id', () => {
    const id1 = queue.enqueue('deposit', depositPayload);
    const id2 = queue.enqueue('deposit', depositPayload);
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });

  it('enqueued items start with status pending', () => {
    const id = queue.enqueue('deposit', depositPayload);
    const item = queue.getStatus(id);
    expect(item).toBeDefined();
    expect(item!.status).toBe('pending');
    expect(item!.type).toBe('deposit');
    expect(item!.createdAt).toBeGreaterThan(0);
  });

  it('enqueue persists to disk', () => {
    queue.enqueue('deposit', depositPayload);
    expect(fs.existsSync(persistPath)).toBe(true);
    const raw = fs.readFileSync(persistPath, 'utf-8');
    const data = JSON.parse(raw);
    expect(data).toHaveLength(1);
  });

  // -----------------------------------------------------------------------
  // peekNext
  // -----------------------------------------------------------------------

  it('peekNext returns the first pending item', () => {
    const id1 = queue.enqueue('deposit', depositPayload);
    queue.enqueue('withdrawal', withdrawalPayload);
    const next = queue.peekNext();
    expect(next).toBeDefined();
    expect(next!.id).toBe(id1);
  });

  it('peekNext returns undefined when queue is empty', () => {
    expect(queue.peekNext()).toBeUndefined();
  });

  it('peekNext skips non-pending items', () => {
    const id1 = queue.enqueue('deposit', depositPayload);
    const id2 = queue.enqueue('withdrawal', withdrawalPayload);
    queue.markSubmitted(id1, '0xabc');
    const next = queue.peekNext();
    expect(next).toBeDefined();
    expect(next!.id).toBe(id2);
  });

  // -----------------------------------------------------------------------
  // Status transitions
  // -----------------------------------------------------------------------

  it('markSubmitted updates status and records txId', () => {
    const id = queue.enqueue('deposit', depositPayload);
    queue.markSubmitted(id, '0xdeadbeef');
    const item = queue.getStatus(id);
    expect(item!.status).toBe('submitted');
    expect(item!.txId).toBe('0xdeadbeef');
    expect(item!.submittedAt).toBeGreaterThan(0);
  });

  it('markConfirmed updates status', () => {
    const id = queue.enqueue('deposit', depositPayload);
    queue.markSubmitted(id, '0xabc');
    queue.markConfirmed(id);
    const item = queue.getStatus(id);
    expect(item!.status).toBe('confirmed');
  });

  it('markFailed updates status and records error', () => {
    const id = queue.enqueue('withdrawal', withdrawalPayload);
    queue.markFailed(id, 'broadcast rejected');
    const item = queue.getStatus(id);
    expect(item!.status).toBe('failed');
    expect(item!.error).toBe('broadcast rejected');
  });

  // -----------------------------------------------------------------------
  // getPendingCount
  // -----------------------------------------------------------------------

  it('getPendingCount counts only pending items by type', () => {
    queue.enqueue('deposit', depositPayload);
    queue.enqueue('deposit', depositPayload);
    const wId = queue.enqueue('withdrawal', withdrawalPayload);
    queue.enqueue('withdrawal', withdrawalPayload);

    // Mark one withdrawal as submitted — it should not be counted
    queue.markSubmitted(wId, '0x123');

    const counts = queue.getPendingCount();
    expect(counts.deposits).toBe(2);
    expect(counts.withdrawals).toBe(1);
  });

  it('getPendingCount returns zeros on empty queue', () => {
    const counts = queue.getPendingCount();
    expect(counts.deposits).toBe(0);
    expect(counts.withdrawals).toBe(0);
  });

  // -----------------------------------------------------------------------
  // size / lastSubmissionTime
  // -----------------------------------------------------------------------

  it('size reflects total items regardless of status', () => {
    queue.enqueue('deposit', depositPayload);
    const id2 = queue.enqueue('withdrawal', withdrawalPayload);
    queue.markFailed(id2, 'oops');
    expect(queue.size).toBe(2);
  });

  it('lastSubmissionTime tracks the most recent submission', () => {
    expect(queue.lastSubmissionTime).toBeUndefined();
    const id = queue.enqueue('deposit', depositPayload);
    queue.markSubmitted(id, '0x1');
    expect(queue.lastSubmissionTime).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // Crash recovery (persistence & restore)
  // -----------------------------------------------------------------------

  it('restores queue from disk on construction', () => {
    const id = queue.enqueue('deposit', depositPayload);
    queue.enqueue('withdrawal', withdrawalPayload);

    // Create a new queue instance pointing at the same file
    const restored = new TransactionQueue(persistPath, logger);
    expect(restored.size).toBe(2);

    const item = restored.getStatus(id);
    expect(item).toBeDefined();
    expect(item!.type).toBe('deposit');
    expect(item!.status).toBe('pending');
  });

  it('getStatus returns undefined for unknown id', () => {
    expect(queue.getStatus('nonexistent')).toBeUndefined();
  });
});
