/**
 * @satsu/relay — Relayer daemon entrypoint
 *
 * A permissionless relayer that accepts pre-signed deposit txs and withdrawal
 * proof bundles from users, batches them with a configurable delay, and
 * submits them to the Stacks network.  The relayer never has custody of user
 * funds and cannot censor — users can always switch to another relayer.
 */
import express from 'express';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import { loadConfig } from './config.js';
import { TransactionQueue } from './queue.js';
import { FeeManager } from './fee-manager.js';
import { createRouter } from './routes.js';
import { submitDepositTx, submitWithdrawalTx } from './submitter.js';
// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------
const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino/file', options: { destination: 1 } }
        : undefined,
});
// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
let config;
try {
    config = loadConfig();
}
catch (err) {
    logger.fatal({ err }, 'Invalid configuration — exiting');
    process.exit(1);
}
// ---------------------------------------------------------------------------
// Core components
// ---------------------------------------------------------------------------
const queue = new TransactionQueue(config.queuePersistPath, logger);
const feeManager = new FeeManager(config.feeConfig, () => {
    const { deposits, withdrawals } = queue.getPendingCount();
    return deposits + withdrawals;
});
// ---------------------------------------------------------------------------
// Express application
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());
// Rate limiting — prevent DoS and queue flooding
const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute window
    limit: 100, // max 100 requests per window per IP
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'too_many_requests', retryAfterMs: 60_000 },
    skip: (req) => req.path === '/api/v1/health',
});
app.use('/api/v1/', apiLimiter);
// Mount API routes
const router = createRouter({ queue, feeManager, config, logger });
app.use(router);
// ---------------------------------------------------------------------------
// Queue processor
// ---------------------------------------------------------------------------
let processing = false;
let processorTimer;
async function processNext() {
    if (processing)
        return;
    const item = queue.peekNext();
    if (!item)
        return;
    processing = true;
    try {
        let txId;
        if (item.type === 'deposit') {
            txId = await submitDepositTx(item.payload, config, logger);
        }
        else {
            txId = await submitWithdrawalTx(item.payload, config, logger);
        }
        queue.markSubmitted(item.id, txId);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        queue.markFailed(item.id, message);
        logger.error({ id: item.id, err: message }, 'submission failed');
    }
    finally {
        processing = false;
    }
}
function startProcessor() {
    async function tick() {
        await processNext();
        processorTimer = setTimeout(tick, config.batchDelayMs);
    }
    // Initial kick — use setImmediate-like via setTimeout(0) so the server
    // is already listening when the first tick fires.
    processorTimer = setTimeout(tick, 0);
}
// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const server = app.listen(config.port, () => {
    logger.info({ port: config.port, network: config.network }, 'relayer started');
    startProcessor();
});
// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
function shutdown(signal) {
    logger.info({ signal }, 'shutting down');
    if (processorTimer !== undefined) {
        clearTimeout(processorTimer);
    }
    server.close(() => {
        logger.info('server closed');
        process.exit(0);
    });
    // Force exit after 10 seconds if server hasn't closed
    setTimeout(() => {
        logger.warn('forceful shutdown after timeout');
        process.exit(1);
    }, 10_000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
// ---------------------------------------------------------------------------
// Exports (useful for testing)
// ---------------------------------------------------------------------------
export { app, queue, feeManager, config };
