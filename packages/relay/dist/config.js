/**
 * @satsu/relay — Configuration
 *
 * All relayer configuration is derived from environment variables with sane
 * defaults for local devnet usage.  The config object is created once at
 * startup and threaded through the rest of the application.
 */
import { z } from 'zod';
// ---------------------------------------------------------------------------
// Zod schema for raw env vars
// ---------------------------------------------------------------------------
const envSchema = z.object({
    PORT: z.coerce.number().int().positive().default(3100),
    STACKS_API_URL: z.string().url().default('http://localhost:3999'),
    RELAYER_PRIVATE_KEY: z
        .string()
        .regex(/^[0-9a-fA-F]{64}$/, 'Must be a 64-char hex private key'),
    POOL_CONTRACT: z
        .string()
        .regex(/^[A-Z0-9]+\.[a-z0-9-]+$/i, 'Expected addr.contract-name')
        .default('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.pool-v1'),
    SBTC_CONTRACT: z
        .string()
        .regex(/^[A-Z0-9]+\.[a-z0-9-]+$/i, 'Expected addr.contract-name')
        .default('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sbtc-token'),
    NETWORK: z.enum(['devnet', 'testnet', 'mainnet']).default('devnet'),
    BASE_FEE: z.coerce.bigint().default(BigInt(10_000)),
    FEE_PERCENTAGE: z.coerce.number().min(0).max(1).default(0.01),
    MAX_FEE: z.coerce.bigint().default(BigInt(500_000)),
    BATCH_DELAY_MS: z.coerce.number().int().nonnegative().default(15_000),
    QUEUE_PERSIST_PATH: z.string().default('./data/queue.json'),
});
// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------
export function loadConfig(env = process.env) {
    const parsed = envSchema.parse(env);
    return {
        port: parsed.PORT,
        stacksApiUrl: parsed.STACKS_API_URL,
        relayerPrivateKey: parsed.RELAYER_PRIVATE_KEY,
        poolContract: parsed.POOL_CONTRACT,
        sbtcContract: parsed.SBTC_CONTRACT,
        network: parsed.NETWORK,
        feeConfig: {
            baseFee: parsed.BASE_FEE,
            feePercentage: parsed.FEE_PERCENTAGE,
            maxFee: parsed.MAX_FEE,
        },
        batchDelayMs: parsed.BATCH_DELAY_MS,
        queuePersistPath: parsed.QUEUE_PERSIST_PATH,
    };
}
