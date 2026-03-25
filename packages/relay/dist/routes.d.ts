/**
 * @satsu/relay — Express route handlers
 *
 * All user-facing REST endpoints.  Input is validated with Zod; errors are
 * returned as structured JSON with appropriate HTTP status codes.
 */
import { Router } from 'express';
import type { Logger } from 'pino';
import type { TransactionQueue } from './queue.js';
import type { FeeManager } from './fee-manager.js';
import type { RelayerConfig } from './config.js';
export interface RouteDeps {
    queue: TransactionQueue;
    feeManager: FeeManager;
    config: RelayerConfig;
    logger: Logger;
}
export declare function createRouter(deps: RouteDeps): Router;
