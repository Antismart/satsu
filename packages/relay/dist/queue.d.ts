/**
 * @satsu/relay — Transaction batching queue
 *
 * In-memory queue with disk persistence for crash recovery.  The queue holds
 * signed deposit transactions and withdrawal proof bundles, and feeds them to
 * the submitter one at a time with a configurable inter-submission delay so
 * that deposits land in separate blocks (breaks timing correlation).
 */
import type { Logger } from 'pino';
export interface DepositPayload {
    /** Hex-encoded signed Stacks transaction. */
    signedTx: string;
    /** 32-byte Pedersen commitment, hex. */
    commitment: string;
    /** Stacks address of the depositor (source of sBTC). */
    source: string;
}
export interface WithdrawalPayload {
    /** Hex-encoded STARK proof (up to 2048 bytes serialised). */
    proof: string;
    /** 32-byte nullifier hash, hex. */
    nullifier: string;
    /** 32-byte Merkle root the proof was generated against, hex. */
    root: string;
    /** Stacks address of the recipient (stealth address). */
    recipient: string;
    /** 33-byte compressed ephemeral public key R, hex. */
    ephemeralPubKey: string;
    /** Relayer fee in micro-sBTC, serialised as a decimal string. */
    relayerFee: string;
}
export type QueuedTransactionStatus = 'pending' | 'submitted' | 'confirmed' | 'failed';
export interface QueuedTransaction {
    id: string;
    type: 'deposit' | 'withdrawal';
    payload: DepositPayload | WithdrawalPayload;
    status: QueuedTransactionStatus;
    createdAt: number;
    submittedAt?: number;
    txId?: string;
    error?: string;
}
export declare class TransactionQueue {
    private items;
    private readonly persistPath;
    private readonly logger;
    constructor(persistPath: string, logger: Logger);
    /** Add a transaction to the queue.  Returns the queue item id. */
    enqueue(type: 'deposit' | 'withdrawal', payload: DepositPayload | WithdrawalPayload): string;
    /** Return the next pending item without removing it, or undefined. */
    peekNext(): QueuedTransaction | undefined;
    /** Mark a queued item as submitted with the on-chain txId. */
    markSubmitted(id: string, txId: string): void;
    /** Mark a queued item as confirmed. */
    markConfirmed(id: string): void;
    /** Mark a queued item as failed with an error message. */
    markFailed(id: string, error: string): void;
    /** Retrieve a single item by id. */
    getStatus(id: string): QueuedTransaction | undefined;
    /** Count pending items by type. */
    getPendingCount(): {
        deposits: number;
        withdrawals: number;
    };
    /** Total number of items in the queue (all statuses). */
    get size(): number;
    /** Timestamp of the most recent submission, or undefined. */
    get lastSubmissionTime(): number | undefined;
    private persist;
    private restore;
}
