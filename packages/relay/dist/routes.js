/**
 * @satsu/relay — Express route handlers
 *
 * All user-facing REST endpoints.  Input is validated with Zod; errors are
 * returned as structured JSON with appropriate HTTP status codes.
 */
import { Router } from 'express';
import { z } from 'zod';
import { getHealthStatus } from './health.js';
// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------
const hexString = z
    .string()
    .regex(/^(0x)?[0-9a-fA-F]+$/, 'Invalid hex string')
    .refine((val) => {
    const hex = val.startsWith('0x') ? val.slice(2) : val;
    return hex.length > 0 && hex.length % 2 === 0;
}, 'Hex string must have even length');
const depositSchema = z.object({
    signedTx: hexString,
    commitment: hexString,
    source: z.string().min(1, 'source address required'),
});
const withdrawSchema = z.object({
    proof: hexString,
    nullifier: hexString,
    root: hexString,
    recipient: z.string().min(1, 'recipient address required'),
    ephemeralPubKey: hexString,
    relayerFee: z.string().regex(/^\d+$/, 'relayerFee must be a non-negative integer string'),
});
export function createRouter(deps) {
    const { queue, feeManager, config, logger } = deps;
    const router = Router();
    // -----------------------------------------------------------------------
    // POST /api/v1/deposit
    // -----------------------------------------------------------------------
    router.post('/api/v1/deposit', (req, res) => {
        const parsed = depositSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                error: 'validation_error',
                details: parsed.error.flatten().fieldErrors,
            });
            return;
        }
        const { signedTx, commitment, source } = parsed.data;
        try {
            const id = queue.enqueue('deposit', { signedTx, commitment, source });
            logger.info({ id }, 'deposit queued');
            res.status(202).json({ id });
        }
        catch (err) {
            logger.error({ err }, 'failed to enqueue deposit');
            res.status(500).json({ error: 'internal_error' });
        }
    });
    // -----------------------------------------------------------------------
    // POST /api/v1/withdraw
    // -----------------------------------------------------------------------
    router.post('/api/v1/withdraw', (req, res) => {
        const parsed = withdrawSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                error: 'validation_error',
                details: parsed.error.flatten().fieldErrors,
            });
            return;
        }
        const { proof, nullifier, root, recipient, ephemeralPubKey, relayerFee } = parsed.data;
        // Validate that the submitted fee meets the current minimum
        const feeBig = BigInt(relayerFee);
        if (!feeManager.validateFee(feeBig)) {
            const currentFee = feeManager.getCurrentFee();
            res.status(400).json({
                error: 'fee_too_low',
                minimumFee: currentFee.toString(),
                submittedFee: relayerFee,
            });
            return;
        }
        try {
            const id = queue.enqueue('withdrawal', {
                proof,
                nullifier,
                root,
                recipient,
                ephemeralPubKey,
                relayerFee,
            });
            logger.info({ id }, 'withdrawal queued');
            res.status(202).json({ id });
        }
        catch (err) {
            logger.error({ err }, 'failed to enqueue withdrawal');
            res.status(500).json({ error: 'internal_error' });
        }
    });
    // -----------------------------------------------------------------------
    // GET /api/v1/status
    // -----------------------------------------------------------------------
    router.get('/api/v1/status', (_req, res) => {
        const pending = queue.getPendingCount();
        res.json({
            pendingDeposits: pending.deposits,
            pendingWithdrawals: pending.withdrawals,
            currentFee: feeManager.getCurrentFee().toString(),
        });
    });
    // -----------------------------------------------------------------------
    // GET /api/v1/tx/:id
    // -----------------------------------------------------------------------
    router.get('/api/v1/tx/:id', (req, res) => {
        const id = typeof req.params.id === 'string' ? req.params.id : String(req.params.id);
        const item = queue.getStatus(id);
        if (!item) {
            res.status(404).json({ error: 'not_found' });
            return;
        }
        res.json(item);
    });
    // -----------------------------------------------------------------------
    // GET /api/v1/info
    // -----------------------------------------------------------------------
    router.get('/api/v1/info', (_req, res) => {
        const currentFee = feeManager.getCurrentFee();
        res.json({
            name: config.relayerName ?? `satsu-relayer-${config.network}`,
            version: '0.1.0',
            fee: currentFee.toString(),
            network: config.network,
            supportedPools: [config.poolContract],
        });
    });
    // -----------------------------------------------------------------------
    // GET /api/v1/health
    // -----------------------------------------------------------------------
    router.get('/api/v1/health', async (_req, res) => {
        try {
            const health = await getHealthStatus(queue, config);
            const httpStatus = health.status === 'unhealthy' ? 503 : 200;
            res.status(httpStatus).json(health);
        }
        catch (err) {
            logger.error({ err }, 'health check failed');
            res.status(503).json({ status: 'unhealthy', error: 'health_check_error' });
        }
    });
    return router;
}
