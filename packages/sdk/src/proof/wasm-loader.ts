/**
 * WASM module loader for the Satsu STARK prover.
 *
 * The Rust prover (built with wasm-pack in /prover/) compiles to a WASM
 * module that exposes two functions:
 *   - generate_proof: produces a raw STARK proof from witness data
 *   - verify_proof:   checks a STARK proof against public inputs
 *
 * This module handles:
 *   1. Loading the WASM binary in both browser and Node.js environments
 *   2. Caching the instantiated module for reuse
 *   3. Graceful fallback when WASM is not available
 *
 * The loader is intentionally non-throwing: if the WASM module cannot be
 * loaded (missing file, unsupported environment, compilation error), it
 * returns null and the SDK falls back to the hash-based prover.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Interface for the WASM prover module exported by wasm-pack.
 *
 * All byte arrays are passed as Uint8Array; bigints are serialized
 * to 16-byte big-endian buffers on the TypeScript side before crossing
 * the WASM boundary (the Rust side expects &[u8; 16]).
 */
export interface WasmProverModule {
  /**
   * Generate a STARK proof from the witness data.
   *
   * @param secret           - 32-byte commitment secret
   * @param nullifier        - 32-byte nullifier
   * @param amount           - Deposit amount as bigint
   * @param leafIndex        - Leaf position in the Merkle tree
   * @param merklePathFlat   - 19 * 32 = 608 bytes (concatenated siblings)
   * @param pathIndices      - 19 bytes (direction bits, one per level)
   * @param nullifierHash    - 32 bytes: sha256(nullifier)
   * @param root             - 32-byte Merkle root
   * @param recipient        - Stacks address string
   * @param relayerFee       - Fee as bigint
   * @returns Raw STARK proof bytes
   */
  generate_proof(
    secret: Uint8Array,
    nullifier: Uint8Array,
    amount: bigint,
    leafIndex: number,
    merklePathFlat: Uint8Array,
    pathIndices: Uint8Array,
    nullifierHash: Uint8Array,
    root: Uint8Array,
    recipient: string,
    relayerFee: bigint,
  ): Uint8Array;

  /**
   * Verify a STARK proof against its public inputs.
   *
   * @param proofBytes     - Raw STARK proof bytes
   * @param nullifierHash  - 32-byte nullifier hash
   * @param root           - 32-byte Merkle root
   * @param recipient      - Stacks address string
   * @param relayerFee     - Fee as bigint
   * @returns true if the proof is valid
   */
  verify_proof(
    proofBytes: Uint8Array,
    nullifierHash: Uint8Array,
    root: Uint8Array,
    recipient: string,
    relayerFee: bigint,
  ): boolean;
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** Cached WASM module instance (null if not yet loaded or unavailable). */
let wasmModule: WasmProverModule | null = null;

/** Whether a load attempt has been made (prevents redundant retries). */
let loadAttempted = false;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load the WASM prover module from the given path.
 *
 * Supports two environments:
 *   - **Node.js**: reads the `.wasm` file from disk via `fs.readFile`
 *   - **Browser**: fetches the `.wasm` file via the Fetch API
 *
 * The loaded module is cached; subsequent calls return the cached instance
 * without re-loading. If loading fails, the function returns null and
 * marks the load as attempted so future calls short-circuit immediately.
 *
 * @param wasmPath - Path or URL to the `.wasm` binary.
 *                   Defaults to `'./satsu_prover_bg.wasm'`.
 * @returns The WASM prover module, or null if loading failed.
 */
export async function loadWasmProver(
  wasmPath?: string,
): Promise<WasmProverModule | null> {
  // Return cached module if already loaded
  if (wasmModule !== null) {
    return wasmModule;
  }

  // Don't retry if a previous attempt already failed
  if (loadAttempted) {
    return null;
  }

  loadAttempted = true;

  const path = wasmPath ?? './satsu_prover_bg.wasm';

  try {
    let wasmBytes: ArrayBuffer | Uint8Array;

    if (isNodeEnvironment()) {
      // Node.js: read from filesystem
      const fs = await import('node:fs/promises');
      wasmBytes = await fs.readFile(path);
    } else {
      // Browser: fetch over network
      // Use globalThis.fetch to avoid requiring DOM lib types at compile time.
      const fetchFn = (globalThis as Record<string, unknown>)['fetch'] as
        | ((url: string) => Promise<{ ok: boolean; arrayBuffer(): Promise<ArrayBuffer> }>)
        | undefined;
      if (typeof fetchFn !== 'function') {
        return null;
      }
      const response = await fetchFn(path);
      if (!response.ok) {
        return null;
      }
      wasmBytes = await response.arrayBuffer();
    }

    // Access WebAssembly via globalThis to avoid requiring the WebAssembly
    // type declaration in tsconfig (which needs "lib": ["...","WebAssembly"]).
    const WA = (globalThis as Record<string, unknown>)['WebAssembly'] as
      | { instantiate(bytes: ArrayBuffer | Uint8Array): Promise<{ instance: { exports: Record<string, unknown> } }> }
      | undefined;
    if (typeof WA === 'undefined') {
      return null;
    }

    const wasmResult = await WA.instantiate(wasmBytes);
    const exports = wasmResult.instance.exports;

    // Validate that the expected functions are exported
    if (
      typeof exports['generate_proof'] !== 'function' ||
      typeof exports['verify_proof'] !== 'function'
    ) {
      return null;
    }

    wasmModule = exports as unknown as WasmProverModule;
    return wasmModule;
  } catch {
    // WASM loading failed -- this is expected when the prover has not
    // been compiled yet or the path is wrong. Fall back silently.
    return null;
  }
}

/**
 * Check whether the WASM prover module has been successfully loaded.
 *
 * @returns true if a previous `loadWasmProver()` call succeeded.
 */
export function isWasmAvailable(): boolean {
  return wasmModule !== null;
}

/**
 * Get the cached WASM prover module, or null if not loaded.
 *
 * This is a synchronous accessor. Call `loadWasmProver()` first to
 * trigger the async load.
 */
export function getWasmProver(): WasmProverModule | null {
  return wasmModule;
}

/**
 * Inject a pre-built WASM prover module (useful for testing or when
 * the module is loaded via a bundler plugin rather than dynamic import).
 *
 * @param module - The WASM prover module to use, or null to clear.
 */
export function setWasmProver(module: WasmProverModule | null): void {
  wasmModule = module;
  loadAttempted = module !== null;
}

/**
 * Reset the loader state so that `loadWasmProver()` can be retried.
 * Primarily intended for testing.
 */
export function resetWasmLoader(): void {
  wasmModule = null;
  loadAttempted = false;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Detect whether we are running in a Node.js-like environment.
 */
function isNodeEnvironment(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as Record<string, unknown>)['process'] === 'object' &&
    typeof ((globalThis as Record<string, unknown>)['process'] as Record<string, unknown>)?.['versions'] === 'object' &&
    typeof (((globalThis as Record<string, unknown>)['process'] as Record<string, unknown>)?.['versions'] as Record<string, unknown>)?.['node'] === 'string'
  );
}
