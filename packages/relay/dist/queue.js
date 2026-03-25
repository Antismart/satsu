/**
 * @satsu/relay — Transaction batching queue
 *
 * In-memory queue with disk persistence for crash recovery.  The queue holds
 * signed deposit transactions and withdrawal proof bundles, and feeds them to
 * the submitter one at a time with a configurable inter-submission delay so
 * that deposits land in separate blocks (breaks timing correlation).
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
// ---------------------------------------------------------------------------
// Serialisation helpers (bigint-safe JSON)
// ---------------------------------------------------------------------------
function serialise(queue) {
    return JSON.stringify(queue, (_key, value) => typeof value === 'bigint' ? value.toString() : value);
}
function deserialise(raw) {
    return JSON.parse(raw);
}
// ---------------------------------------------------------------------------
// TransactionQueue
// ---------------------------------------------------------------------------
export class TransactionQueue {
    items = [];
    persistPath;
    logger;
    constructor(persistPath, logger) {
        this.persistPath = persistPath;
        this.logger = logger.child({ component: 'queue' });
        this.restore();
    }
    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------
    /** Add a transaction to the queue.  Returns the queue item id. */
    enqueue(type, payload) {
        const id = randomUUID();
        const item = {
            id,
            type,
            payload,
            status: 'pending',
            createdAt: Date.now(),
        };
        this.items.push(item);
        this.persist();
        this.logger.info({ id, type }, 'transaction enqueued');
        return id;
    }
    /** Return the next pending item without removing it, or undefined. */
    peekNext() {
        return this.items.find((i) => i.status === 'pending');
    }
    /** Mark a queued item as submitted with the on-chain txId. */
    markSubmitted(id, txId) {
        const item = this.items.find((i) => i.id === id);
        if (!item)
            return;
        item.status = 'submitted';
        item.submittedAt = Date.now();
        item.txId = txId;
        this.persist();
        this.logger.info({ id, txId }, 'transaction submitted');
    }
    /** Mark a queued item as confirmed. */
    markConfirmed(id) {
        const item = this.items.find((i) => i.id === id);
        if (!item)
            return;
        item.status = 'confirmed';
        this.persist();
        this.logger.info({ id }, 'transaction confirmed');
    }
    /** Mark a queued item as failed with an error message. */
    markFailed(id, error) {
        const item = this.items.find((i) => i.id === id);
        if (!item)
            return;
        item.status = 'failed';
        item.error = error;
        this.persist();
        this.logger.warn({ id, error }, 'transaction failed');
    }
    /** Retrieve a single item by id. */
    getStatus(id) {
        return this.items.find((i) => i.id === id);
    }
    /** Count pending items by type. */
    getPendingCount() {
        let deposits = 0;
        let withdrawals = 0;
        for (const item of this.items) {
            if (item.status !== 'pending')
                continue;
            if (item.type === 'deposit')
                deposits++;
            else
                withdrawals++;
        }
        return { deposits, withdrawals };
    }
    /** Total number of items in the queue (all statuses). */
    get size() {
        return this.items.length;
    }
    /** Timestamp of the most recent submission, or undefined. */
    get lastSubmissionTime() {
        let latest;
        for (const item of this.items) {
            if (item.submittedAt !== undefined) {
                if (latest === undefined || item.submittedAt > latest) {
                    latest = item.submittedAt;
                }
            }
        }
        return latest;
    }
    // -----------------------------------------------------------------------
    // Persistence
    // -----------------------------------------------------------------------
    persist() {
        try {
            const dir = path.dirname(this.persistPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.persistPath, serialise(this.items), 'utf-8');
        }
        catch (err) {
            this.logger.error({ err }, 'failed to persist queue');
        }
    }
    restore() {
        try {
            if (fs.existsSync(this.persistPath)) {
                const raw = fs.readFileSync(this.persistPath, 'utf-8');
                this.items = deserialise(raw);
                this.logger.info({ count: this.items.length }, 'queue restored from disk');
            }
        }
        catch (err) {
            this.logger.error({ err }, 'failed to restore queue, starting empty');
            this.items = [];
        }
    }
}
