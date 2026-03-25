/**
 * Tests for the notification subsystem.
 */

import { describe, it, expect, vi } from 'vitest';

import {
  InMemoryNotifier,
  ConsoleNotifier,
  CompositeNotifier,
  type NotificationHandler,
} from '../src/notification.js';
import type { DetectedPayment } from '../src/stealth-detector.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePayment(overrides?: Partial<DetectedPayment>): DetectedPayment {
  return {
    txId: overrides?.txId ?? '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    stealthAddress: overrides?.stealthAddress ?? 'ST1STEALTH123',
    stealthPubKey: overrides?.stealthPubKey ?? new Uint8Array(33).fill(0x02),
    sharedSecretHash: overrides?.sharedSecretHash ?? new Uint8Array(32).fill(0xab),
    ephemeralPubKey: overrides?.ephemeralPubKey ?? new Uint8Array(33).fill(0x03),
    amount: overrides?.amount ?? 9_900_000n,
    blockHeight: overrides?.blockHeight ?? 100,
    detectedAt: overrides?.detectedAt ?? Date.now(),
  };
}

// ---------------------------------------------------------------------------
// InMemoryNotifier tests
// ---------------------------------------------------------------------------

describe('InMemoryNotifier', () => {
  it('should store detected payments', async () => {
    const notifier = new InMemoryNotifier();
    const payment = makePayment();

    await notifier.onPaymentDetected(payment);

    expect(notifier.size).toBe(1);
    expect(notifier.getPayments()).toHaveLength(1);
    expect(notifier.getPayments()[0]!.txId).toBe(payment.txId);
  });

  it('should store multiple payments', async () => {
    const notifier = new InMemoryNotifier();

    await notifier.onPaymentDetected(makePayment({ txId: '0x1111' + '0'.repeat(60) }));
    await notifier.onPaymentDetected(makePayment({ txId: '0x2222' + '0'.repeat(60) }));
    await notifier.onPaymentDetected(makePayment({ txId: '0x3333' + '0'.repeat(60) }));

    expect(notifier.size).toBe(3);
    expect(notifier.getPayments()).toHaveLength(3);
  });

  it('should track unacknowledged payments', async () => {
    const notifier = new InMemoryNotifier();
    const tx1 = '0x1111' + '0'.repeat(60);
    const tx2 = '0x2222' + '0'.repeat(60);

    await notifier.onPaymentDetected(makePayment({ txId: tx1 }));
    await notifier.onPaymentDetected(makePayment({ txId: tx2 }));

    expect(notifier.getUnacknowledged()).toHaveLength(2);

    // Acknowledge one
    const acked = notifier.acknowledge(tx1);
    expect(acked).toBe(true);

    expect(notifier.getUnacknowledged()).toHaveLength(1);
    expect(notifier.getUnacknowledged()[0]!.txId).toBe(tx2);
  });

  it('should return false when acknowledging unknown txId', () => {
    const notifier = new InMemoryNotifier();
    expect(notifier.acknowledge('0xunknown')).toBe(false);
  });

  it('should report acknowledgment status correctly', async () => {
    const notifier = new InMemoryNotifier();
    const txId = '0xtest' + '0'.repeat(59);

    await notifier.onPaymentDetected(makePayment({ txId }));

    expect(notifier.isAcknowledged(txId)).toBe(false);
    notifier.acknowledge(txId);
    expect(notifier.isAcknowledged(txId)).toBe(true);
  });

  it('should report false for unknown txId acknowledgment check', () => {
    const notifier = new InMemoryNotifier();
    expect(notifier.isAcknowledged('0xnone')).toBe(false);
  });

  it('should clear all payments', async () => {
    const notifier = new InMemoryNotifier();

    await notifier.onPaymentDetected(makePayment({ txId: '0xa' + '0'.repeat(63) }));
    await notifier.onPaymentDetected(makePayment({ txId: '0xb' + '0'.repeat(63) }));

    expect(notifier.size).toBe(2);
    notifier.clear();
    expect(notifier.size).toBe(0);
    expect(notifier.getPayments()).toHaveLength(0);
  });

  it('should handle duplicate txId by overwriting', async () => {
    const notifier = new InMemoryNotifier();
    const txId = '0xdup' + '0'.repeat(60);

    await notifier.onPaymentDetected(makePayment({ txId, blockHeight: 100 }));
    await notifier.onPaymentDetected(makePayment({ txId, blockHeight: 200 }));

    // Map overwrites, so size is still 1
    expect(notifier.size).toBe(1);
    expect(notifier.getPayments()[0]!.blockHeight).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// ConsoleNotifier tests
// ---------------------------------------------------------------------------

describe('ConsoleNotifier', () => {
  it('should call the logger on payment detection', async () => {
    const logged: Array<{ msg: string; data?: Record<string, unknown> }> = [];
    const mockLogger = {
      info: (msg: string, data?: Record<string, unknown>) => {
        logged.push({ msg, data });
      },
    };

    const notifier = new ConsoleNotifier(mockLogger);
    const payment = makePayment();

    await notifier.onPaymentDetected(payment);

    expect(logged).toHaveLength(1);
    expect(logged[0]!.msg).toContain('Stealth payment detected');
    expect(logged[0]!.data?.txId).toBe(payment.txId);
  });

  it('should use console.log when no logger is provided', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const notifier = new ConsoleNotifier();
    await notifier.onPaymentDetected(makePayment());

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// CompositeNotifier tests
// ---------------------------------------------------------------------------

describe('CompositeNotifier', () => {
  it('should dispatch to all handlers', async () => {
    const handler1 = new InMemoryNotifier();
    const handler2 = new InMemoryNotifier();
    const composite = new CompositeNotifier([handler1, handler2]);

    const payment = makePayment();
    await composite.onPaymentDetected(payment);

    expect(handler1.size).toBe(1);
    expect(handler2.size).toBe(1);
  });

  it('should not fail if one handler throws', async () => {
    const failingHandler: NotificationHandler = {
      async onPaymentDetected(): Promise<void> {
        throw new Error('Handler failure');
      },
    };

    const successHandler = new InMemoryNotifier();
    const composite = new CompositeNotifier([failingHandler, successHandler]);

    const payment = makePayment();
    // Should not throw
    await composite.onPaymentDetected(payment);

    // The successful handler should still receive the payment
    expect(successHandler.size).toBe(1);
  });

  it('should handle empty handler list', async () => {
    const composite = new CompositeNotifier([]);
    // Should not throw
    await composite.onPaymentDetected(makePayment());
  });
});
