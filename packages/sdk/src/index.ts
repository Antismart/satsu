/**
 * @satsu/sdk — Public API
 *
 * Re-exports every module that constitutes the Satsu privacy payment SDK.
 */

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

export {
  generateStealthKeys,
  deriveViewKeyFromSpend,
} from './wallet/stealth-keys.js';
export type { StealthKeypair, ViewKeypair } from './wallet/stealth-keys.js';

export {
  deriveStealthAddress,
  deriveSelfStealth,
  checkStealthPayment,
  verifyStealthPayment,
} from './wallet/stealth-address.js';
export type {
  StealthMetaAddress,
  StealthAddressResult,
  StealthPaymentCheck,
} from './wallet/stealth-address.js';

export {
  encodeMetaAddress,
  decodeMetaAddress,
  validateMetaAddress,
} from './wallet/meta-address.js';

// ---------------------------------------------------------------------------
// Pool — commitment & Merkle
// ---------------------------------------------------------------------------

export {
  createCommitment,
  computeCommitmentHash,
  computeNullifierHash,
} from './pool/commitment.js';
export type { Commitment } from './pool/commitment.js';

export { IncrementalMerkleTree, verifyMerkleProof } from './pool/merkle.js';
export type { MerkleProof } from './pool/merkle.js';

// ---------------------------------------------------------------------------
// Pool — transaction builders
// ---------------------------------------------------------------------------

export {
  buildApprovalTx,
  buildDepositTx,
  submitDeposit,
} from './pool/deposit.js';
export type { DepositParams, DepositResult } from './pool/deposit.js';

export { buildWithdrawTx, submitWithdrawal } from './pool/withdraw.js';
export type { WithdrawParams, WithdrawResult } from './pool/withdraw.js';

// ---------------------------------------------------------------------------
// Pool — timing delay
// ---------------------------------------------------------------------------

export {
  calculateDepositDelay,
  shouldDeposit,
  addJitter,
  DEFAULT_TIMING_CONFIG,
} from './pool/timing.js';
export type {
  TimingConfig,
  DepositDelayResult,
  DepositReadinessResult,
} from './pool/timing.js';

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export {
  createNote,
  serializeNote,
  deserializeNote,
} from './notes/note.js';
export type { DecryptedNote } from './notes/note.js';

export {
  encryptNote,
  decryptNote,
  deriveEncryptionKey,
  generateSalt,
} from './notes/encryption.js';

export { NoteStore } from './notes/store.js';

export {
  createBackupBundle,
  parseBackupBundle,
  validateBackupIntegrity,
  computeBackupChecksum,
  getBackupSdkVersion,
} from './notes/backup.js';
export type { BackupMetadata } from './notes/backup.js';

// ---------------------------------------------------------------------------
// Relayer
// ---------------------------------------------------------------------------

export { RelayerClient, RelayerError } from './relayer/client.js';
export type {
  DepositRequest,
  WithdrawRequest,
  RelayerStatus,
} from './relayer/client.js';

// ---------------------------------------------------------------------------
// Proof — circuit, witness, prover
// ---------------------------------------------------------------------------

export {
  validatePublicInputs,
  validatePrivateInputs,
  CIRCUIT_CONSTRAINTS,
  CIRCUIT_INFO,
} from './proof/circuit.js';
export type { PublicInputs, PrivateInputs, CircuitConstraint } from './proof/circuit.js';

export { generateWitness } from './proof/witness.js';
export type { Witness } from './proof/witness.js';

export {
  generateWithdrawalProof,
  serializeProof,
  deserializeProof,
  verifyProofLocally,
  computeChallenge,
} from './proof/prover.js';
export type { StarkProof, ProofData } from './proof/prover.js';

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

export {
  hash,
  bytesToHex,
  hexToBytes,
  constantTimeEqual,
  uint8ArrayEquals,
  randomBytes,
  concatBytes,
  bigintToUint128BE,
  uint128BEToBigint,
} from './utils/crypto.js';

export {
  POOL_DENOMINATION,
  MERKLE_TREE_DEPTH,
  TREE_DEPTH,
  MAX_LEAVES,
  MAX_PROOF_BYTES,
  COMPRESSED_PUBKEY_LENGTH,
  HASH_LENGTH,
  ZERO_HASHES_HEX,
  EMPTY_ROOT_HEX,
  NETWORKS,
  getZeroHashes,
  getEmptyRoot,
} from './utils/constants.js';
export type { SatsuNetwork, NetworkConfig } from './utils/constants.js';
