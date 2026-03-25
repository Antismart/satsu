/**
 * Relayer API client for the Satsu privacy pool.
 *
 * The relayer is a permissionless service that accepts pre-signed deposit
 * transactions and withdrawal proofs from users and submits them to the
 * Stacks blockchain, paying the STX gas fee.  It can never steal funds or
 * censor users because anyone can run an alternative relayer.
 *
 * All responses from the relayer are validated with Zod schemas before
 * being returned to the caller.
 */

import { z } from 'zod';
import { bytesToHex, hexToBytes } from '../utils/crypto.js';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

/** Response from POST /api/v1/deposit */
const DepositResponseSchema = z.object({
  txId: z.string().min(1),
});

/** Response from POST /api/v1/withdraw */
const WithdrawResponseSchema = z.object({
  txId: z.string().min(1),
});

/** Response from GET /api/v1/status */
const RelayerStatusSchema = z.object({
  pendingDeposits: z.number().int().nonnegative(),
  pendingWithdrawals: z.number().int().nonnegative(),
  currentFee: z.string().min(1),
});

/** Response from GET /api/v1/health */
const HealthResponseSchema = z.object({
  ok: z.boolean(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DepositRequest {
  /** Pre-signed deposit transaction (raw bytes) */
  signedTx: Uint8Array;
  /** 32-byte commitment hash */
  commitment: Uint8Array;
  /** Stacks address that is the sBTC source */
  source: string;
}

export interface WithdrawRequest {
  /** Serialised STARK proof */
  proof: Uint8Array;
  /** 32-byte nullifier hash */
  nullifier: Uint8Array;
  /** 32-byte Merkle root */
  root: Uint8Array;
  /** Recipient stealth address */
  recipient: string;
  /** 33-byte compressed ephemeral public key R */
  ephemeralPubKey: Uint8Array;
  /** Relayer fee in satoshis */
  relayerFee: bigint;
}

export interface RelayerStatus {
  pendingDeposits: number;
  pendingWithdrawals: number;
  currentFee: bigint;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * Type-safe HTTP client for the Satsu relayer REST API.
 *
 * Usage:
 * ```ts
 * const client = new RelayerClient('https://relay.satsu.xyz');
 * const { txId } = await client.submitDeposit({ signedTx, commitment, source });
 * ```
 */
export class RelayerClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    // Strip trailing slash for consistent URL construction
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }

  // -----------------------------------------------------------------------
  // Deposit
  // -----------------------------------------------------------------------

  /**
   * Submit a pre-signed deposit transaction to the relayer.
   *
   * The relayer will broadcast the transaction to the Stacks network on
   * behalf of the depositor and return the resulting transaction id.
   */
  async submitDeposit(
    params: DepositRequest,
  ): Promise<{ txId: string }> {
    const body = {
      signedTx: bytesToHex(params.signedTx),
      commitment: bytesToHex(params.commitment),
      source: params.source,
    };

    const response = await this.post('/api/v1/deposit', body);
    return DepositResponseSchema.parse(response);
  }

  // -----------------------------------------------------------------------
  // Withdraw
  // -----------------------------------------------------------------------

  /**
   * Submit a withdrawal proof to the relayer.
   *
   * The relayer constructs and broadcasts the withdrawal transaction,
   * collecting the specified relayer fee from the pool denomination.
   */
  async submitWithdrawal(
    params: WithdrawRequest,
  ): Promise<{ txId: string }> {
    const body = {
      proof: bytesToHex(params.proof),
      nullifier: bytesToHex(params.nullifier),
      root: bytesToHex(params.root),
      recipient: params.recipient,
      ephemeralPubKey: bytesToHex(params.ephemeralPubKey),
      relayerFee: params.relayerFee.toString(),
    };

    const response = await this.post('/api/v1/withdraw', body);
    return WithdrawResponseSchema.parse(response);
  }

  // -----------------------------------------------------------------------
  // Status
  // -----------------------------------------------------------------------

  /**
   * Query the relayer's current operational status: queue depths and fee.
   */
  async getStatus(): Promise<RelayerStatus> {
    const response = await this.get('/api/v1/status');
    const parsed = RelayerStatusSchema.parse(response);
    return {
      pendingDeposits: parsed.pendingDeposits,
      pendingWithdrawals: parsed.pendingWithdrawals,
      currentFee: BigInt(parsed.currentFee),
    };
  }

  // -----------------------------------------------------------------------
  // Health
  // -----------------------------------------------------------------------

  /**
   * Returns `true` if the relayer is healthy, `false` otherwise.
   *
   * This never throws — network errors and unexpected responses are
   * caught and mapped to `false`.
   */
  async getHealth(): Promise<boolean> {
    try {
      const response = await this.get('/api/v1/health');
      const parsed = HealthResponseSchema.parse(response);
      return parsed.ok;
    } catch {
      return false;
    }
  }

  // -----------------------------------------------------------------------
  // Internal HTTP helpers
  // -----------------------------------------------------------------------

  private async post(path: string, body: unknown): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    let res: Response;

    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new RelayerError(
        `Network error contacting relayer at ${url}`,
        { cause: err },
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new RelayerError(
        `Relayer returned HTTP ${res.status}: ${text}`,
      );
    }

    return res.json();
  }

  private async get(path: string): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    let res: Response;

    try {
      res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
    } catch (err) {
      throw new RelayerError(
        `Network error contacting relayer at ${url}`,
        { cause: err },
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new RelayerError(
        `Relayer returned HTTP ${res.status}: ${text}`,
      );
    }

    return res.json();
  }
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Error originating from the relayer client (network, HTTP, or validation).
 */
export class RelayerError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RelayerError';
  }
}
