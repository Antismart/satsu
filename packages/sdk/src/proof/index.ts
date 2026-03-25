/**
 * Proof module barrel exports.
 *
 * Re-exports the circuit definition, witness generator, hash-based prover,
 * STARK prover wrapper, and WASM loader for clean consumption.
 */

// Circuit definition and validation
export {
  validatePublicInputs,
  validatePrivateInputs,
  CIRCUIT_CONSTRAINTS,
  CIRCUIT_INFO,
} from './circuit.js';
export type {
  PublicInputs,
  PrivateInputs,
  CircuitConstraint,
} from './circuit.js';

// Witness generation
export { generateWitness } from './witness.js';
export type { Witness } from './witness.js';

// Prover (supports both hash-based and STARK backends)
export {
  generateWithdrawalProof,
  serializeProof,
  deserializeProof,
  verifyProofLocally,
  computeChallenge,
  ProverBackend,
} from './prover.js';
export type { StarkProof, ProofData, ProverOptions } from './prover.js';

// STARK prover wrapper (WASM bridge)
export {
  generateStarkProof,
  verifyStarkProof,
  serializeForClarity,
  flattenMerklePath,
} from './stark-prover.js';
export type { StarkProofResult } from './stark-prover.js';

// WASM module loader
export {
  loadWasmProver,
  isWasmAvailable,
  getWasmProver,
  setWasmProver,
  resetWasmLoader,
} from './wasm-loader.js';
export type { WasmProverModule } from './wasm-loader.js';
