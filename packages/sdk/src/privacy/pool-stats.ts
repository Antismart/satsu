/**
 * Pool statistics module for monitoring anonymity set health.
 *
 * Fetches on-chain pool state (deposit/withdrawal counts, balances)
 * and computes derived metrics used by the privacy scoring system.
 *
 * The module queries the Stacks blockchain via the standard API
 * (read-only contract calls) to obtain current pool state without
 * requiring any authentication or private keys.
 *
 * @module
 */

import { MAX_LEAVES, POOL_DENOMINATION } from '../utils/constants.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PoolStats {
  /** Total number of deposits ever made to the pool. */
  totalDeposits: number;
  /** Total number of withdrawals ever made from the pool. */
  totalWithdrawals: number;
  /** Current anonymity set size (totalDeposits - totalWithdrawals). */
  anonymitySetSize: number;
  /** Current pool balance in micro-sBTC. */
  poolBalance: bigint;
  /** Pool utilization ratio: anonymitySetSize / MAX_LEAVES. */
  utilization: number;
  /** Average age of deposits in blocks (approximate). */
  averageDepositAge: number;
  /** Block height of the most recent deposit (0 if no deposits). */
  lastDepositBlock: number;
  /** Block height of the most recent withdrawal (0 if no withdrawals). */
  lastWithdrawalBlock: number;
}

/**
 * Raw response from the Stacks read-only contract call API.
 * The shape varies by function; we parse defensively.
 */
interface ClarityValueResponse {
  okay: boolean;
  result?: string;
  cause?: string;
}

// ---------------------------------------------------------------------------
// Main fetch function
// ---------------------------------------------------------------------------

/**
 * Fetch current pool statistics from the blockchain.
 *
 * Makes read-only contract calls to the pool contract to obtain:
 *   - next-index (total deposits = next Merkle leaf index)
 *   - nullifier count (total withdrawals)
 *   - contract balance
 *   - recent event block heights
 *
 * @param apiUrl - Stacks node API base URL (e.g. "https://api.testnet.hiro.so")
 * @param poolContract - Fully qualified contract identifier (e.g. "ST1PQHQ.../pool-v1")
 * @returns Current pool statistics
 * @throws Error if the API is unreachable or returns invalid data
 */
export async function fetchPoolStats(
  apiUrl: string,
  poolContract: string,
): Promise<PoolStats> {
  // Parse contract identifier into deployer + name
  const [deployer, contractName] = parseContractId(poolContract);

  // Fetch all data in parallel
  const [
    nextIndex,
    nullifierCount,
    balanceResult,
    lastDepositBlock,
    lastWithdrawalBlock,
    currentBlock,
  ] = await Promise.all([
    readUint(apiUrl, deployer, contractName, 'get-next-index'),
    readUint(apiUrl, deployer, contractName, 'get-nullifier-count'),
    readUint(apiUrl, deployer, contractName, 'get-pool-balance'),
    readUint(apiUrl, deployer, contractName, 'get-last-deposit-block').catch(() => 0),
    readUint(apiUrl, deployer, contractName, 'get-last-withdrawal-block').catch(() => 0),
    fetchCurrentBlock(apiUrl),
  ]);

  const totalDeposits = nextIndex;
  const totalWithdrawals = nullifierCount;
  const anonymitySetSize = Math.max(0, totalDeposits - totalWithdrawals);
  const poolBalance = BigInt(balanceResult) * POOL_DENOMINATION;
  const utilization = MAX_LEAVES > 0 ? anonymitySetSize / MAX_LEAVES : 0;

  // Estimate average deposit age: midpoint between first and last deposit
  // This is a rough approximation; precise calculation would require
  // iterating all deposit events.
  const averageDepositAge = totalDeposits > 0 && lastDepositBlock > 0
    ? Math.max(0, currentBlock - Math.floor(lastDepositBlock / 2))
    : 0;

  return {
    totalDeposits,
    totalWithdrawals,
    anonymitySetSize,
    poolBalance,
    utilization,
    averageDepositAge,
    lastDepositBlock,
    lastWithdrawalBlock,
  };
}

// ---------------------------------------------------------------------------
// Convenience functions for privacy integration
// ---------------------------------------------------------------------------

/**
 * Compute the anonymity set size from deposit and withdrawal counts.
 *
 * This is a pure utility for cases where the raw counts are already
 * available (e.g. from cached data) and a full API call is unnecessary.
 *
 * @param totalDeposits - Total deposits ever made
 * @param totalWithdrawals - Total withdrawals ever made
 * @returns Non-negative anonymity set size
 */
export function computeAnonymitySetSize(
  totalDeposits: number,
  totalWithdrawals: number,
): number {
  return Math.max(0, totalDeposits - totalWithdrawals);
}

/**
 * Compute pool utilization as a ratio of anonymity set to max capacity.
 *
 * @param anonymitySetSize - Current number of unspent deposits
 * @returns Ratio in [0, 1]
 */
export function computeUtilization(anonymitySetSize: number): number {
  return MAX_LEAVES > 0 ? Math.max(0, anonymitySetSize) / MAX_LEAVES : 0;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/**
 * Parse a fully qualified contract ID into [deployer, contractName].
 */
function parseContractId(contractId: string): [string, string] {
  const parts = contractId.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(
      `Invalid contract ID "${contractId}". Expected format: "DEPLOYER.CONTRACT_NAME"`,
    );
  }
  return [parts[0], parts[1]];
}

/**
 * Call a read-only contract function that returns a uint.
 */
async function readUint(
  apiUrl: string,
  deployer: string,
  contractName: string,
  functionName: string,
): Promise<number> {
  const url =
    `${apiUrl}/v2/contracts/call-read/${deployer}/${contractName}/${functionName}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: deployer,
      arguments: [],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Contract call failed: ${functionName} returned ${response.status} ${response.statusText}`,
    );
  }

  const json = (await response.json()) as ClarityValueResponse;

  if (!json.okay || !json.result) {
    throw new Error(
      `Contract call ${functionName} returned error: ${json.cause ?? 'unknown'}`,
    );
  }

  // Parse Clarity uint response: "0x0000000000000000000000000000002a" -> 42
  return parseClarityUint(json.result);
}

/**
 * Parse a hex-encoded Clarity uint value.
 *
 * Clarity uint responses are encoded as:
 *   0x01 (type tag for uint) + 16 bytes big-endian uint128
 *
 * We only use the lower 8 bytes since our values fit in Number.
 */
function parseClarityUint(hex: string): number {
  // Strip "0x" prefix and the 1-byte type tag (01)
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;

  // Type tag for uint is 01, skip it
  const valueHex = clean.length > 2 ? clean.slice(2) : clean;

  // Parse as BigInt then convert to Number (safe for our pool sizes)
  const value = BigInt('0x' + valueHex);

  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`Clarity uint value ${value} exceeds Number.MAX_SAFE_INTEGER`);
  }

  return Number(value);
}

/**
 * Fetch the current block height from the Stacks node.
 */
async function fetchCurrentBlock(apiUrl: string): Promise<number> {
  const url = `${apiUrl}/v2/info`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch node info: ${response.status} ${response.statusText}`,
    );
  }

  const json = (await response.json()) as { stacks_tip_height?: number };

  if (typeof json.stacks_tip_height !== 'number') {
    throw new Error('Node info response missing stacks_tip_height');
  }

  return json.stacks_tip_height;
}
