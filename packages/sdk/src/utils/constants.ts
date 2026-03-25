/**
 * Network constants, contract addresses, and pre-computed Merkle tree
 * zero hashes for the Satsu privacy pool system.
 *
 * CRITICAL: The ZERO_HASHES and EMPTY_ROOT values are copied verbatim from
 * contracts/merkle-tree.clar. Any mismatch will cause client-side Merkle
 * proofs to be rejected by the on-chain verifier. If the contract constants
 * ever change, these must be updated in lockstep.
 */

import { hexToBytes } from './crypto.js';

// ---------------------------------------------------------------------------
// Tree parameters
// ---------------------------------------------------------------------------

/** Depth of the incremental Merkle tree (supports 2^20 = 1,048,576 leaves). */
export const TREE_DEPTH = 20;

/** Alias used by transaction builder modules. */
export const MERKLE_TREE_DEPTH = TREE_DEPTH;

/** Maximum number of leaves the tree can hold. */
export const MAX_LEAVES = 1_048_576; // 2^20

/** Standard pool denomination: 0.1 sBTC = 10,000,000 micro-sBTC. */
export const POOL_DENOMINATION = 10_000_000n;

/** Maximum serialised STARK proof length accepted by pool-v1 */
export const MAX_PROOF_BYTES = 2048;

/** Compressed secp256k1 public key length */
export const COMPRESSED_PUBKEY_LENGTH = 33;

/** Commitment / nullifier / root hash length */
export const HASH_LENGTH = 32;

// ---------------------------------------------------------------------------
// Network configuration
// ---------------------------------------------------------------------------

export type SatsuNetwork = 'devnet' | 'testnet' | 'mainnet';

export interface NetworkConfig {
  /** Deployer address that owns the contracts. */
  deployer: string;
  /** Contract name for the privacy pool. */
  poolContract: string;
  /** Contract name for the Merkle tree library. */
  merkleContract: string;
  /** Stacks network name for @stacks/transactions. */
  stacksNetwork: 'devnet' | 'testnet' | 'mainnet';
}

export const NETWORKS: Record<SatsuNetwork, NetworkConfig> = {
  devnet: {
    deployer: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    poolContract: 'pool-v1',
    merkleContract: 'merkle-tree',
    stacksNetwork: 'devnet',
  },
  testnet: {
    deployer: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    poolContract: 'pool-v1',
    merkleContract: 'merkle-tree',
    stacksNetwork: 'testnet',
  },
  mainnet: {
    deployer: 'SP000000000000000000002Q6VF78', // Placeholder - TBD at launch
    poolContract: 'pool-v1',
    merkleContract: 'merkle-tree',
    stacksNetwork: 'mainnet',
  },
};

// ---------------------------------------------------------------------------
// Pre-computed zero hashes (MUST match merkle-tree.clar exactly)
// ---------------------------------------------------------------------------
//
// Construction:
//   ZERO_VALUE = 0x0000...0000 (32 zero bytes)
//   ZERO_HASHES[0] = sha256(ZERO_VALUE)
//   ZERO_HASHES[n] = sha256(ZERO_HASHES[n-1] || ZERO_HASHES[n-1])
//
// These represent the hash of a completely empty subtree at each level.
// Level 0 is the leaf level; level 19 is just below the root.

export const ZERO_HASHES_HEX: readonly string[] = [
  /* 0  */ '66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925',
  /* 1  */ '2eeb74a6177f588d80c0c752b99556902ddf9682d0b906f5aa2adbaf8466a4e9',
  /* 2  */ '1223349a40d2ee10bd1bebb5889ef8018c8bc13359ed94b387810af96c6e4268',
  /* 3  */ '5b82b695a7ac2668e188b75f7d4fa79faa504117d1fdfcbe8a46915c1a8a5191',
  /* 4  */ '0c211f9b5384c68848a209ac1f93905330128cb710ae583779c07127ef88ff5c',
  /* 5  */ '56460a80e1171e24ac1dcdc0d3f10a4f33bf31766260ab0ade1c7eb0dcbc5d70',
  /* 6  */ '2dea2fc40d00e5b0af8bec53643e2bb68614f530bd0c6b927d3e5ed97173417b',
  /* 7  */ 'ee935dcf025e3016579ec39fcfdea5688ab4ca5f3b54726ac395771a658d2ea1',
  /* 8  */ '10a411babd72a3bf9c9f82793e7371f78539c1b80a2bc13791bdc8d8b85e3793',
  /* 9  */ 'a15c4a922d99997278612794a7c740469f7b45def6bef262e2eec2703d1872e7',
  /* 10 */ '86e76e201c2ead88b8bded0b23912e431a1babc89ef151e505438622350bd991',
  /* 11 */ 'c7fe09c567bf12d179ffcf8653a64e1d0dcf11938fd444399fd54620a2edf7f9',
  /* 12 */ '07ef7659ff16d14b61578319e7d9405ec9cbc5c470d987cfb426eed515a5fa50',
  /* 13 */ 'b7c2fa725e389b5179a99bc659c561b4c7881cca943d449122cdb56217385b0d',
  /* 14 */ 'd536d02ae6a0a727a6e907b2fafc71577544d256e4db5f2f22d5bedf73c0cd7c',
  /* 15 */ 'aa4c42f09ecb58a7667e1a27b644b2d4bc9fb4213cf83cce6e59350bbe477b9d',
  /* 16 */ '2ed4373149a1dd68868e1d77da082a79caad470b6cb80f99f4a97730c327ad6f',
  /* 17 */ 'ae733b66f70e8a852ed75b8d137ffdc011b233278b2f372679c25b5382b477f5',
  /* 18 */ 'f2fc7517a99d580bc0a970ebf98969b533d4d5929c10e0db91d7ef5aa724de0b',
  /* 19 */ '4847eb8f74aa407babb518db4a37cef8363dfd1e1679d72893b74af39738e0ab',
] as const;

/**
 * Pre-computed zero hashes as Uint8Array values.
 * Lazily initialized on first access to avoid startup cost.
 */
let _zeroHashes: Uint8Array[] | null = null;

export function getZeroHashes(): Uint8Array[] {
  if (_zeroHashes === null) {
    _zeroHashes = ZERO_HASHES_HEX.map((h) => hexToBytes(h));
  }
  return _zeroHashes;
}

/**
 * The root hash of a completely empty tree.
 * EMPTY_ROOT = sha256(ZERO_HASHES[19] || ZERO_HASHES[19])
 *
 * This is the initial value of `current-root` in merkle-tree.clar.
 */
export const EMPTY_ROOT_HEX =
  '799881750019ca39515941a00231729514ca4029498a0c675e9d66a0f4340103';

let _emptyRoot: Uint8Array | null = null;

export function getEmptyRoot(): Uint8Array {
  if (_emptyRoot === null) {
    _emptyRoot = hexToBytes(EMPTY_ROOT_HEX);
  }
  return _emptyRoot;
}
