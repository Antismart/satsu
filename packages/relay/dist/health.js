/**
 * @satsu/relay — Health check
 *
 * Returns a structured health status object that summarises relayer
 * availability, queue depth, and connectivity to the Stacks API.
 */
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const VERSION = '0.1.0';
const startTime = Date.now();
/** Queue depth above which the relayer is considered degraded. */
const DEGRADED_QUEUE_THRESHOLD = 50;
/** If last submission was more than this many ms ago, flag degraded. */
const STALE_SUBMISSION_MS = 5 * 60 * 1000; // 5 minutes
// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------
async function isApiReachable(apiUrl) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5_000);
        const res = await fetch(`${apiUrl}/v2/info`, {
            signal: controller.signal,
        });
        clearTimeout(timeout);
        return res.ok;
    }
    catch {
        return false;
    }
}
export async function getHealthStatus(queue, config) {
    const pending = queue.getPendingCount();
    const totalPending = pending.deposits + pending.withdrawals;
    const lastSubmission = queue.lastSubmissionTime;
    const apiReachable = await isApiReachable(config.stacksApiUrl);
    // Determine aggregate status
    let status = 'healthy';
    if (!apiReachable) {
        status = 'unhealthy';
    }
    else if (totalPending > DEGRADED_QUEUE_THRESHOLD) {
        status = 'degraded';
    }
    else if (lastSubmission !== undefined &&
        Date.now() - lastSubmission > STALE_SUBMISSION_MS &&
        totalPending > 0) {
        status = 'degraded';
    }
    return {
        status,
        uptime: Date.now() - startTime,
        queue: pending,
        lastSubmission,
        stacksApiReachable: apiReachable,
        version: VERSION,
    };
}
