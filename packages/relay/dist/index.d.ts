/**
 * @satsu/relay — Relayer daemon entrypoint
 *
 * A permissionless relayer that accepts pre-signed deposit txs and withdrawal
 * proof bundles from users, batches them with a configurable delay, and
 * submits them to the Stacks network.  The relayer never has custody of user
 * funds and cannot censor — users can always switch to another relayer.
 */
import { TransactionQueue } from './queue.js';
import { FeeManager } from './fee-manager.js';
declare let config: any;
declare const queue: TransactionQueue;
declare const feeManager: FeeManager;
declare const app: import("express-serve-static-core").Express;
export { app, queue, feeManager, config };
