/**
 * @satsu/relay — Configuration
 *
 * All relayer configuration is derived from environment variables with sane
 * defaults for local devnet usage.  The config object is created once at
 * startup and threaded through the rest of the application.
 */
export interface FeeConfig {
    /** Minimum fee in micro-sBTC (satoshis). */
    baseFee: bigint;
    /** Fee as a fraction of the pool denomination (e.g. 0.01 = 1%). */
    feePercentage: number;
    /** Maximum fee cap in micro-sBTC. */
    maxFee: bigint;
}
export interface RelayerConfig {
    /** HTTP port the relayer listens on. */
    port: number;
    /** Stacks node / API URL (e.g. http://localhost:3999). */
    stacksApiUrl: string;
    /** Hex-encoded private key the relayer uses to sign withdrawal txs. */
    relayerPrivateKey: string;
    /** Fully qualified pool contract identifier (addr.contract-name). */
    poolContract: string;
    /** Fully qualified sBTC token contract identifier. */
    sbtcContract: string;
    /** Target network. */
    network: 'devnet' | 'testnet' | 'mainnet';
    /** Fee schedule. */
    feeConfig: FeeConfig;
    /** Minimum delay (ms) between successive transaction broadcasts. */
    batchDelayMs: number;
    /** File path used to persist the in-memory queue for crash recovery. */
    queuePersistPath: string;
}
export declare function loadConfig(env?: Record<string, string | undefined>): RelayerConfig;
