/**
 * Tests for Express route handlers
 *
 * These tests exercise Zod validation, queue interactions, fee validation,
 * and HTTP status codes without touching a real Stacks network.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import express, { type Express } from 'express';
import pino from 'pino';
import { TransactionQueue } from '../src/queue.js';
import { FeeManager } from '../src/fee-manager.js';
import { createRouter } from '../src/routes.js';
import type { RelayerConfig, FeeConfig } from '../src/config.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const logger = pino({ level: 'silent' });

function tmpPath(): string {
  return path.join(
    os.tmpdir(),
    `satsu-route-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
  );
}

const feeConfig: FeeConfig = {
  baseFee: 10_000n,
  feePercentage: 0.01,
  maxFee: 500_000n,
};

const config: RelayerConfig = {
  port: 0,
  stacksApiUrl: 'http://localhost:3999',
  relayerPrivateKey: 'a'.repeat(64),
  poolContract: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.pool-v1',
  sbtcContract: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sbtc-token',
  network: 'devnet',
  feeConfig,
  batchDelayMs: 15_000,
  queuePersistPath: tmpPath(),
};

/** Minimal fetch-like helper that uses the Express app directly. */
async function request(
  app: Express,
  method: 'GET' | 'POST',
  urlPath: string,
  body?: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        reject(new Error('could not bind'));
        return;
      }
      const url = `http://127.0.0.1:${addr.port}${urlPath}`;
      const opts: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (body !== undefined) {
        opts.body = JSON.stringify(body);
      }
      fetch(url, opts)
        .then(async (res) => {
          const json = await res.json();
          server.close();
          resolve({ status: res.status, body: json as Record<string, unknown> });
        })
        .catch((err) => {
          server.close();
          reject(err);
        });
    });
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Routes', () => {
  let persistPath: string;
  let queue: TransactionQueue;
  let feeManager: FeeManager;
  let app: Express;

  beforeEach(() => {
    persistPath = tmpPath();
    queue = new TransactionQueue(persistPath, logger);
    feeManager = new FeeManager(config.feeConfig, () => {
      const c = queue.getPendingCount();
      return c.deposits + c.withdrawals;
    });
    app = express();
    app.use(express.json());
    app.use(createRouter({ queue, feeManager, config: { ...config, queuePersistPath: persistPath }, logger }));
  });

  afterEach(() => {
    try { fs.unlinkSync(persistPath); } catch { /* noop */ }
  });

  // -----------------------------------------------------------------------
  // POST /api/v1/deposit
  // -----------------------------------------------------------------------

  describe('POST /api/v1/deposit', () => {
    const validDeposit = {
      signedTx: 'aabbccdd',
      commitment: '00ff',
      source: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    };

    it('accepts a valid deposit and returns 202', async () => {
      const res = await request(app, 'POST', '/api/v1/deposit', validDeposit);
      expect(res.status).toBe(202);
      expect(res.body).toHaveProperty('id');
      expect(typeof res.body.id).toBe('string');
    });

    it('rejects deposit with missing signedTx', async () => {
      const res = await request(app, 'POST', '/api/v1/deposit', {
        commitment: '00ff',
        source: 'ST1',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('rejects deposit with invalid hex in commitment', async () => {
      const res = await request(app, 'POST', '/api/v1/deposit', {
        signedTx: 'aabb',
        commitment: 'ZZZZ', // not hex
        source: 'ST1',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('rejects deposit with empty source', async () => {
      const res = await request(app, 'POST', '/api/v1/deposit', {
        signedTx: 'aabb',
        commitment: '00ff',
        source: '',
      });
      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/v1/withdraw
  // -----------------------------------------------------------------------

  describe('POST /api/v1/withdraw', () => {
    const validWithdrawal = {
      proof: 'aabbccdd',
      nullifier: '00ff',
      root: '11ee',
      recipient: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
      ephemeralPubKey: '02aabb',
      relayerFee: '100000', // meets minimum
    };

    it('accepts a valid withdrawal and returns 202', async () => {
      const res = await request(app, 'POST', '/api/v1/withdraw', validWithdrawal);
      expect(res.status).toBe(202);
      expect(res.body).toHaveProperty('id');
    });

    it('rejects withdrawal with fee too low', async () => {
      const res = await request(app, 'POST', '/api/v1/withdraw', {
        ...validWithdrawal,
        relayerFee: '1', // way below minimum
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('fee_too_low');
      expect(res.body).toHaveProperty('minimumFee');
    });

    it('rejects withdrawal with missing nullifier', async () => {
      const { nullifier, ...rest } = validWithdrawal;
      const res = await request(app, 'POST', '/api/v1/withdraw', rest);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('rejects withdrawal with non-numeric relayerFee', async () => {
      const res = await request(app, 'POST', '/api/v1/withdraw', {
        ...validWithdrawal,
        relayerFee: 'notanumber',
      });
      expect(res.status).toBe(400);
    });

    it('rejects withdrawal with empty recipient', async () => {
      const res = await request(app, 'POST', '/api/v1/withdraw', {
        ...validWithdrawal,
        recipient: '',
      });
      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/v1/status
  // -----------------------------------------------------------------------

  describe('GET /api/v1/status', () => {
    it('returns pending counts and current fee', async () => {
      queue.enqueue('deposit', {
        signedTx: 'aa',
        commitment: 'bb',
        source: 'ST1',
      });

      const res = await request(app, 'GET', '/api/v1/status');
      expect(res.status).toBe(200);
      expect(res.body.pendingDeposits).toBe(1);
      expect(res.body.pendingWithdrawals).toBe(0);
      expect(typeof res.body.currentFee).toBe('string');
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/v1/tx/:id
  // -----------------------------------------------------------------------

  describe('GET /api/v1/tx/:id', () => {
    it('returns a queued item by id', async () => {
      const id = queue.enqueue('deposit', {
        signedTx: 'aa',
        commitment: 'bb',
        source: 'ST1',
      });

      const res = await request(app, 'GET', `/api/v1/tx/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
      expect(res.body.status).toBe('pending');
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app, 'GET', '/api/v1/tx/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/v1/info
  // -----------------------------------------------------------------------

  describe('GET /api/v1/info', () => {
    it('returns relayer metadata', async () => {
      const res = await request(app, 'GET', '/api/v1/info');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('version');
      expect(res.body).toHaveProperty('fee');
      expect(res.body).toHaveProperty('network');
      expect(res.body).toHaveProperty('supportedPools');
      expect(typeof res.body.name).toBe('string');
      expect(typeof res.body.version).toBe('string');
      expect(typeof res.body.fee).toBe('string');
      expect(res.body.network).toBe('devnet');
      expect(Array.isArray(res.body.supportedPools)).toBe(true);
    });

    it('returns the current fee as a string', async () => {
      const res = await request(app, 'GET', '/api/v1/info');
      expect(res.body.fee).toMatch(/^\d+$/);
    });

    it('includes the pool contract in supportedPools', async () => {
      const res = await request(app, 'GET', '/api/v1/info');
      expect(res.body.supportedPools).toContain(config.poolContract);
    });

    it('uses relayerName from config when set', async () => {
      // Rebuild the app with a custom relayer name
      const namedConfig = {
        ...config,
        relayerName: 'my-custom-relayer',
        queuePersistPath: tmpPath(),
      };
      const namedQueue = new TransactionQueue(namedConfig.queuePersistPath, logger);
      const namedFeeManager = new FeeManager(namedConfig.feeConfig, () => {
        const c = namedQueue.getPendingCount();
        return c.deposits + c.withdrawals;
      });
      const namedApp = express();
      namedApp.use(express.json());
      namedApp.use(createRouter({
        queue: namedQueue,
        feeManager: namedFeeManager,
        config: namedConfig,
        logger,
      }));

      const res = await request(namedApp, 'GET', '/api/v1/info');
      expect(res.body.name).toBe('my-custom-relayer');
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/v1/health
  // -----------------------------------------------------------------------

  describe('GET /api/v1/health', () => {
    it('returns health status', async () => {
      const res = await request(app, 'GET', '/api/v1/health');
      // API is not reachable in tests, so it will be unhealthy
      expect([200, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('version');
    });
  });
});
