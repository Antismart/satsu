/**
 * Scanner configuration module.
 *
 * Parses and validates environment variables into a typed configuration
 * object. The scanner needs the user's view private key (for detecting
 * incoming stealth payments) and spend public key (for deriving stealth
 * addresses), but never the spend private key.
 *
 * @module
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScannerConfig {
  /** HTTP port for the Chainhook webhook receiver. */
  port: number;
  /** Stacks API base URL (e.g. https://api.hiro.so). */
  stacksApiUrl: string;
  /** 32-byte view private key (hex-encoded in env, decoded here). */
  viewPrivKey: Uint8Array;
  /** 33-byte compressed spend public key (hex). */
  spendPubKey: Uint8Array;
  /** Fully-qualified pool contract identifier (e.g. SP123.pool-v1). */
  poolContract: string;
  /** Stacks network environment. */
  network: 'devnet' | 'testnet' | 'mainnet';
  /** Whether to use Chainhook webhooks or poll the Stacks API. */
  mode: 'chainhook' | 'polling';
  /** Polling interval in milliseconds (only used in polling mode). */
  pollingIntervalMs: number;
  /** Optional webhook URL to POST detected payments to. */
  notificationWebhookUrl?: string;
}

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const hexBytes = (expectedLen: number) =>
  z
    .string()
    .regex(/^[0-9a-fA-F]+$/, 'Must be a hex string')
    .transform((hex) => {
      const bytes = hexToBytes(hex);
      if (bytes.length !== expectedLen) {
        throw new Error(`Expected ${expectedLen} bytes, got ${bytes.length}`);
      }
      return bytes;
    });

const envSchema = z.object({
  PORT: z
    .string()
    .default('3100')
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive()),
  STACKS_API_URL: z.string().url().default('http://localhost:3999'),
  VIEW_PRIVATE_KEY: hexBytes(32),
  SPEND_PUBLIC_KEY: hexBytes(33),
  POOL_CONTRACT: z
    .string()
    .regex(
      /^S[A-Z0-9]+\.[a-zA-Z][a-zA-Z0-9_-]*$/,
      'Must be a fully-qualified contract identifier (e.g. SP123.pool-v1)',
    ),
  NETWORK: z
    .enum(['devnet', 'testnet', 'mainnet'])
    .default('devnet'),
  MODE: z.enum(['chainhook', 'polling']).default('chainhook'),
  POLLING_INTERVAL_MS: z
    .string()
    .default('15000')
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive()),
  NOTIFICATION_WEBHOOK_URL: z.string().url().optional(),
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse scanner configuration from environment variables.
 *
 * @throws {z.ZodError} if required variables are missing or malformed
 */
export function parseConfig(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): ScannerConfig {
  const parsed = envSchema.parse(env);

  return {
    port: parsed.PORT,
    stacksApiUrl: parsed.STACKS_API_URL,
    viewPrivKey: parsed.VIEW_PRIVATE_KEY,
    spendPubKey: parsed.SPEND_PUBLIC_KEY,
    poolContract: parsed.POOL_CONTRACT,
    network: parsed.NETWORK,
    mode: parsed.MODE,
    pollingIntervalMs: parsed.POLLING_INTERVAL_MS,
    notificationWebhookUrl: parsed.NOTIFICATION_WEBHOOK_URL,
  };
}

/**
 * Build a ScannerConfig from explicit values (useful for testing and
 * programmatic usage without environment variables).
 */
export function buildConfig(partial: Partial<ScannerConfig> & {
  viewPrivKey: Uint8Array;
  spendPubKey: Uint8Array;
  poolContract: string;
}): ScannerConfig {
  return {
    port: partial.port ?? 3100,
    stacksApiUrl: partial.stacksApiUrl ?? 'http://localhost:3999',
    viewPrivKey: partial.viewPrivKey,
    spendPubKey: partial.spendPubKey,
    poolContract: partial.poolContract,
    network: partial.network ?? 'devnet',
    mode: partial.mode ?? 'chainhook',
    pollingIntervalMs: partial.pollingIntervalMs ?? 15_000,
    notificationWebhookUrl: partial.notificationWebhookUrl,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToBytes(hex: string): Uint8Array {
  const len = hex.length;
  const bytes = new Uint8Array(len / 2);
  for (let i = 0; i < len; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}
