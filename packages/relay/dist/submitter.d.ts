/**
 * @satsu/relay — Stacks transaction submitter
 *
 * Handles serialisation, contract-call construction, and broadcast of both
 * deposit and withdrawal transactions.  Deposit txs arrive pre-signed by the
 * user; the relayer merely broadcasts.  Withdrawal txs are constructed and
 * signed by the relayer, who then claims the on-chain relayer fee.
 */
import type { Logger } from 'pino';
import type { RelayerConfig } from './config.js';
import type { DepositPayload, WithdrawalPayload } from './queue.js';
/**
 * Broadcast a pre-signed deposit transaction.
 *
 * The user has already constructed and signed a contract-call to
 * `pool-v1.deposit`.  The relayer simply deserialises, validates the shape,
 * and broadcasts.
 */
export declare function submitDepositTx(payload: DepositPayload, config: RelayerConfig, logger: Logger): Promise<string>;
/**
 * Construct and broadcast a withdrawal contract call.
 *
 * The relayer is the tx-sender here — it pays the STX gas fee and in return
 * collects the on-chain relayer fee from the withdrawal amount.
 */
export declare function submitWithdrawalTx(payload: WithdrawalPayload, config: RelayerConfig, logger: Logger): Promise<string>;
/**
 * Query the Stacks API for the current status of a transaction.
 */
export declare function checkTxStatus(txId: string, apiUrl: string): Promise<'pending' | 'success' | 'failed'>;
