/**
 * @satsu/relay — Health check
 *
 * Returns a structured health status object that summarises relayer
 * availability, queue depth, and connectivity to the Stacks API.
 */
import type { RelayerConfig } from './config.js';
import type { TransactionQueue } from './queue.js';
export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    queue: {
        deposits: number;
        withdrawals: number;
    };
    lastSubmission?: number;
    stacksApiReachable: boolean;
    version: string;
}
export declare function getHealthStatus(queue: TransactionQueue, config: RelayerConfig): Promise<HealthStatus>;
