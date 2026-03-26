/**
 * Testnet configuration for the Satsu SDK.
 *
 * All contract identifiers use the deployer address as a prefix.
 * Update TESTNET_DEPLOYER after your first testnet deployment, then
 * the rest of the identifiers are derived automatically.
 *
 * The sBTC contract address points to the real sBTC token deployed
 * by the sBTC signer set on Stacks testnet.
 */

// ---------------------------------------------------------------------------
// Deployer & sBTC addresses (update after deployment)
// ---------------------------------------------------------------------------

/** The STX address that deployed the Satsu contracts on testnet. */
const TESTNET_DEPLOYER = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'; // TODO: replace after deploy

/**
 * Real sBTC contract on Stacks testnet.
 * Deployed by the sBTC signer set. Verify at:
 *   https://api.testnet.hiro.so/v2/contracts/interface/SN3R84XZYA63QS28932XQF3G1J8R9PC3W8AKR0EP/sbtc-token
 */
const SBTC_TESTNET_CONTRACT =
  'SN3R84XZYA63QS28932XQF3G1J8R9PC3W8AKR0EP.sbtc-token';

// ---------------------------------------------------------------------------
// Exported configuration
// ---------------------------------------------------------------------------

export interface TestnetConfig {
  network: 'testnet';
  stacksApiUrl: string;
  explorerUrl: string;
  /** Full contract identifier: <deployer>.<contract-name> */
  poolContract: string;
  stealthContract: string;
  merkleTreeContract: string;
  nullifierRegistryContract: string;
  proofVerifierContract: string;
  sip010TraitContract: string;
  /** Real sBTC on Stacks testnet */
  sbtcContract: string;
  /** Pool denomination in micro-sBTC (0.1 sBTC = 10_000_000) */
  poolDenomination: bigint;
  /** Faucet URL for obtaining testnet STX */
  stxFaucetUrl: string;
  /** sBTC testnet bridge / faucet URL */
  sbtcBridgeUrl: string;
}

export const TESTNET_CONFIG: TestnetConfig = {
  network: 'testnet',
  stacksApiUrl: 'https://api.testnet.hiro.so',
  explorerUrl: 'https://explorer.hiro.so/?chain=testnet',

  // Satsu contracts (derived from deployer)
  poolContract: `${TESTNET_DEPLOYER}.pool-v1`,
  stealthContract: `${TESTNET_DEPLOYER}.stealth-v1`,
  merkleTreeContract: `${TESTNET_DEPLOYER}.merkle-tree`,
  nullifierRegistryContract: `${TESTNET_DEPLOYER}.nullifier-registry`,
  proofVerifierContract: `${TESTNET_DEPLOYER}.proof-verifier`,
  sip010TraitContract: `${TESTNET_DEPLOYER}.sip010-trait`,

  // sBTC
  sbtcContract: SBTC_TESTNET_CONTRACT,
  poolDenomination: 10_000_000n, // 0.1 sBTC

  // External resources
  stxFaucetUrl: 'https://explorer.hiro.so/sandbox/faucet?chain=testnet',
  sbtcBridgeUrl: 'https://bridge.sbtc.tech',
};

/**
 * Helper to build a fully-qualified contract call identifier.
 * @example contractId('pool-v1') => 'ST1PQ...M.pool-v1'
 */
export function contractId(name: string): string {
  return `${TESTNET_DEPLOYER}.${name}`;
}
