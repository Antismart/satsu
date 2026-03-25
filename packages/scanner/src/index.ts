/**
 * @satsu/scanner - Stealth payment detection service.
 *
 * Monitors the Stacks blockchain for stealth payments addressed to the
 * user by performing view-key trial decryption on withdrawal events
 * from the satsu privacy pool.
 *
 * Runs in two modes:
 * - **chainhook**: Real-time via Hiro Chainhook webhooks (server-side)
 * - **polling**: Periodic Stacks API queries (browser or serverless)
 *
 * Environment variables:
 *   PORT                     - HTTP port (default: 3100)
 *   STACKS_API_URL           - Stacks API base URL
 *   VIEW_PRIVATE_KEY         - 32-byte hex view private key
 *   SPEND_PUBLIC_KEY         - 33-byte hex compressed spend public key
 *   POOL_CONTRACT            - e.g. ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.pool-v1
 *   NETWORK                  - devnet | testnet | mainnet
 *   MODE                     - chainhook | polling
 *   POLLING_INTERVAL_MS      - Polling interval in ms (default: 15000)
 *   NOTIFICATION_WEBHOOK_URL - Optional external webhook for notifications
 *
 * @module
 */

import express from 'express';
import pino from 'pino';

import { parseConfig, type ScannerConfig } from './config.js';
import { parseChainhookPayload, pollWithdrawalEvents, type WithdrawalEvent } from './chainhook.js';
import { scanEvents, tryDecryptPayment, type DetectedPayment, type ScannerKeys } from './stealth-detector.js';
import {
  ConsoleNotifier,
  WebhookNotifier,
  InMemoryNotifier,
  CompositeNotifier,
  type NotificationHandler,
} from './notification.js';

// ---------------------------------------------------------------------------
// Re-exports for programmatic usage
// ---------------------------------------------------------------------------

export { parseConfig, buildConfig, type ScannerConfig } from './config.js';
export {
  parseChainhookPayload,
  pollWithdrawalEvents,
  generateChainhookPredicate,
  type ChainhookEvent,
  type WithdrawalEvent,
} from './chainhook.js';
export {
  tryDecryptPayment,
  scanEvents,
  publicKeyToStacksAddress,
  type DetectedPayment,
  type ScannerKeys,
} from './stealth-detector.js';
export {
  ConsoleNotifier,
  WebhookNotifier,
  InMemoryNotifier,
  CompositeNotifier,
  type NotificationHandler,
} from './notification.js';

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const logger = pino({
  name: 'satsu-scanner',
  level: process.env.LOG_LEVEL ?? 'info',
});

// ---------------------------------------------------------------------------
// Scanner service
// ---------------------------------------------------------------------------

/**
 * Main scanner service. Manages the Express server (for chainhook mode)
 * or the polling loop, and dispatches detected payments to notification
 * handlers.
 */
export class Scanner {
  private readonly config: ScannerConfig;
  private readonly keys: ScannerKeys;
  private readonly notifier: NotificationHandler;
  private readonly log: pino.Logger;

  private server: ReturnType<typeof express> | null = null;
  private httpServer: import('http').Server | null = null;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private lastScannedBlock = 0;
  private running = false;

  constructor(
    config: ScannerConfig,
    notifier?: NotificationHandler,
    log?: pino.Logger,
  ) {
    this.config = config;
    this.keys = {
      viewPrivKey: config.viewPrivKey,
      spendPubKey: config.spendPubKey,
    };
    this.log = log ?? logger;

    // Build notification pipeline
    const handlers: NotificationHandler[] = [
      new ConsoleNotifier({ info: (msg, data) => this.log.info(data ?? {}, msg) }),
    ];

    if (config.notificationWebhookUrl) {
      handlers.push(new WebhookNotifier(config.notificationWebhookUrl));
    }

    if (notifier) {
      handlers.push(notifier);
    }

    this.notifier = handlers.length === 1 ? handlers[0]! : new CompositeNotifier(handlers);
  }

  /**
   * Start the scanner in the configured mode.
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    this.log.info(
      { mode: this.config.mode, network: this.config.network, pool: this.config.poolContract },
      'Starting satsu scanner',
    );

    if (this.config.mode === 'chainhook') {
      await this.startChainhookMode();
    } else {
      this.startPollingMode();
    }
  }

  /**
   * Gracefully stop the scanner.
   */
  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    this.log.info('Stopping satsu scanner');

    // Stop polling
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    // Stop HTTP server
    if (this.httpServer) {
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.httpServer = null;
    }
  }

  /**
   * Process a batch of withdrawal events and notify on matches.
   * Public for testing and programmatic use.
   */
  async processEvents(events: WithdrawalEvent[]): Promise<DetectedPayment[]> {
    const detected = scanEvents(events, this.keys, this.config.network);

    for (const payment of detected) {
      await this.notifier.onPaymentDetected(payment);
    }

    return detected;
  }

  // -------------------------------------------------------------------------
  // Chainhook mode
  // -------------------------------------------------------------------------

  private async startChainhookMode(): Promise<void> {
    const app = express();
    app.use(express.json({ limit: '5mb' }));

    // Health check
    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', mode: 'chainhook', network: this.config.network });
    });

    // Chainhook webhook endpoint
    app.post('/api/events/withdrawal', async (req, res) => {
      try {
        const events = parseChainhookPayload(req.body);

        this.log.info({ count: events.length }, 'Received Chainhook payload');

        if (events.length > 0) {
          const detected = await this.processEvents(events);
          this.log.info(
            { scanned: events.length, detected: detected.length },
            'Processed withdrawal events',
          );
        }

        res.json({ ok: true, processed: events.length });
      } catch (err) {
        this.log.error({ err }, 'Error processing Chainhook payload');
        res.status(500).json({ ok: false, error: 'Internal error' });
      }
    });

    this.server = app;

    await new Promise<void>((resolve) => {
      this.httpServer = app.listen(this.config.port, () => {
        this.log.info(
          { port: this.config.port },
          'Chainhook webhook receiver listening',
        );
        resolve();
      });
    });
  }

  // -------------------------------------------------------------------------
  // Polling mode
  // -------------------------------------------------------------------------

  private startPollingMode(): void {
    this.log.info(
      { intervalMs: this.config.pollingIntervalMs },
      'Starting polling mode',
    );

    // Immediate first poll
    void this.poll();

    this.pollingTimer = setInterval(() => {
      void this.poll();
    }, this.config.pollingIntervalMs);
  }

  private async poll(): Promise<void> {
    try {
      const events = await pollWithdrawalEvents(
        this.config.stacksApiUrl,
        this.config.poolContract,
        this.lastScannedBlock,
      );

      if (events.length > 0) {
        const detected = await this.processEvents(events);

        // Advance the scan cursor past the highest block we've seen
        const maxBlock = events.reduce((max, e) => Math.max(max, e.blockHeight), 0);
        if (maxBlock > this.lastScannedBlock) {
          this.lastScannedBlock = maxBlock + 1;
        }

        this.log.info(
          { scanned: events.length, detected: detected.length, cursor: this.lastScannedBlock },
          'Poll cycle complete',
        );
      }
    } catch (err) {
      this.log.error({ err }, 'Polling error');
    }
  }
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

/**
 * Start the scanner from environment variables.
 * Called when this module is executed directly.
 */
async function main(): Promise<void> {
  let config: ScannerConfig;

  try {
    config = parseConfig();
  } catch (err) {
    logger.fatal({ err }, 'Invalid configuration');
    process.exit(1);
  }

  const scanner = new Scanner(config);

  // Graceful shutdown on SIGINT/SIGTERM
  const shutdown = async () => {
    logger.info('Shutdown signal received');
    await scanner.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  await scanner.start();
}

// Detect if running as main module (ESM)
const isMainModule =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('/scanner/src/index.ts') ||
   process.argv[1].endsWith('/scanner/dist/index.js'));

if (isMainModule) {
  main().catch((err) => {
    logger.fatal({ err }, 'Unhandled error');
    process.exit(1);
  });
}
