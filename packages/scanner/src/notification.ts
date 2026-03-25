/**
 * Payment notification handlers.
 *
 * When the scanner detects a stealth payment addressed to the user,
 * it dispatches a notification through one or more handlers. This module
 * provides three implementations:
 *
 * - ConsoleNotifier: Logs payments to stdout (useful for development)
 * - WebhookNotifier: POSTs payment details to an external URL
 * - InMemoryNotifier: Stores payments in memory with acknowledgment tracking
 *
 * @module
 */

import type { DetectedPayment } from './stealth-detector.js';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Handler interface for payment notifications.
 */
export interface NotificationHandler {
  onPaymentDetected(payment: DetectedPayment): Promise<void>;
}

// ---------------------------------------------------------------------------
// Console notifier
// ---------------------------------------------------------------------------

/**
 * Logs detected payments to the console via the provided logger.
 * Defaults to console.log if no logger is supplied.
 */
export class ConsoleNotifier implements NotificationHandler {
  private readonly log: (msg: string, data?: Record<string, unknown>) => void;

  constructor(logger?: { info: (msg: string, data?: Record<string, unknown>) => void }) {
    this.log = logger
      ? (msg, data) => logger.info(msg, data)
      : (msg, data) => console.log(msg, data ?? '');
  }

  async onPaymentDetected(payment: DetectedPayment): Promise<void> {
    this.log('Stealth payment detected', {
      txId: payment.txId,
      stealthAddress: payment.stealthAddress,
      amount: payment.amount.toString(),
      blockHeight: payment.blockHeight,
    });
  }
}

// ---------------------------------------------------------------------------
// Webhook notifier
// ---------------------------------------------------------------------------

/**
 * POSTs detected payment details to an external webhook URL.
 *
 * The payload is JSON with hex-encoded byte fields and string bigints.
 * Retries once on network failure with a short backoff.
 */
export class WebhookNotifier implements NotificationHandler {
  private readonly webhookUrl: string;
  private readonly authHeader?: string;

  constructor(webhookUrl: string, authHeader?: string) {
    this.webhookUrl = webhookUrl;
    this.authHeader = authHeader;
  }

  async onPaymentDetected(payment: DetectedPayment): Promise<void> {
    const body = JSON.stringify({
      txId: payment.txId,
      stealthAddress: payment.stealthAddress,
      stealthPubKey: bytesToHex(payment.stealthPubKey),
      sharedSecretHash: bytesToHex(payment.sharedSecretHash),
      ephemeralPubKey: bytesToHex(payment.ephemeralPubKey),
      amount: payment.amount.toString(),
      blockHeight: payment.blockHeight,
      detectedAt: payment.detectedAt,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authHeader) {
      headers['Authorization'] = this.authHeader;
    }

    let lastError: unknown;

    // Attempt delivery with one retry
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const resp = await fetch(this.webhookUrl, {
          method: 'POST',
          headers,
          body,
        });

        if (resp.ok) {
          return;
        }

        lastError = new Error(
          `Webhook returned ${resp.status}: ${await resp.text().catch(() => '(no body)')}`,
        );
      } catch (err) {
        lastError = err;
      }

      // Brief backoff before retry
      if (attempt === 0) {
        await sleep(1000);
      }
    }

    // Log the failure but don't throw - notifications are best-effort
    console.error('Failed to deliver webhook notification:', lastError);
  }
}

// ---------------------------------------------------------------------------
// In-memory notifier
// ---------------------------------------------------------------------------

interface StoredPayment {
  payment: DetectedPayment;
  acknowledged: boolean;
}

/**
 * Stores detected payments in memory with acknowledgment tracking.
 *
 * Useful for testing, embedded scanning, or short-lived processes
 * where persistence is not required. Payments can be retrieved
 * and acknowledged by transaction ID.
 */
export class InMemoryNotifier implements NotificationHandler {
  private readonly store = new Map<string, StoredPayment>();

  async onPaymentDetected(payment: DetectedPayment): Promise<void> {
    this.store.set(payment.txId, {
      payment,
      acknowledged: false,
    });
  }

  /**
   * Get all detected payments.
   */
  getPayments(): DetectedPayment[] {
    return Array.from(this.store.values()).map((s) => s.payment);
  }

  /**
   * Get payments that have not been acknowledged.
   */
  getUnacknowledged(): DetectedPayment[] {
    return Array.from(this.store.values())
      .filter((s) => !s.acknowledged)
      .map((s) => s.payment);
  }

  /**
   * Mark a payment as acknowledged by transaction ID.
   *
   * @returns true if the payment was found and acknowledged
   */
  acknowledge(txId: string): boolean {
    const entry = this.store.get(txId);
    if (!entry) return false;
    entry.acknowledged = true;
    return true;
  }

  /**
   * Check if a specific payment has been acknowledged.
   */
  isAcknowledged(txId: string): boolean {
    return this.store.get(txId)?.acknowledged ?? false;
  }

  /**
   * Get the total number of stored payments.
   */
  get size(): number {
    return this.store.size;
  }

  /**
   * Clear all stored payments.
   */
  clear(): void {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// Composite notifier
// ---------------------------------------------------------------------------

/**
 * Dispatches to multiple notification handlers in parallel.
 */
export class CompositeNotifier implements NotificationHandler {
  private readonly handlers: NotificationHandler[];

  constructor(handlers: NotificationHandler[]) {
    this.handlers = handlers;
  }

  async onPaymentDetected(payment: DetectedPayment): Promise<void> {
    await Promise.allSettled(
      this.handlers.map((h) => h.onPaymentDetected(payment)),
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
