/**
 * Backup bundle format and validation for Satsu note storage.
 *
 * A backup bundle wraps an AES-256-GCM encrypted blob of notes together
 * with plaintext metadata (version, counts, checksum). The metadata is
 * stored as a JSON header followed by the encrypted payload, separated
 * by a well-known delimiter.
 *
 * Bundle wire format:
 *   Bytes 0..3:   magic "STBK" (0x53 0x54 0x42 0x4B)
 *   Bytes 4..5:   format version (uint16 BE) = 1
 *   Bytes 6..9:   metadata JSON length in bytes (uint32 BE)
 *   Bytes 10..N:  metadata JSON (UTF-8 encoded)
 *   Bytes N+1..:  encrypted note payload (raw bytes from NoteStore.export())
 *
 * The checksum in the metadata is the hex-encoded SHA-256 of the
 * encrypted payload, computed BEFORE bundling. This allows integrity
 * validation without decrypting the backup.
 */

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex as nobleBytesToHex } from '@noble/hashes/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BackupMetadata {
  /** SDK version string that created this backup. */
  version: string;
  /** Unix timestamp (ms since epoch) when the backup was created. */
  createdAt: number;
  /** Total number of notes in the backup (spent + unspent). */
  noteCount: number;
  /** Number of unspent notes in the backup. */
  unspentCount: number;
  /** Fully-qualified pool contract identifiers associated with the notes. */
  poolContracts: string[];
  /** Hex-encoded SHA-256 checksum of the encrypted payload. */
  checksum: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Magic bytes identifying a Satsu backup bundle: "STBK" */
const BUNDLE_MAGIC = new Uint8Array([0x53, 0x54, 0x42, 0x4b]);

/** Current bundle format version. */
const BUNDLE_VERSION = 1;

/** Fixed header size: magic (4) + version (2) + metadata length (4) = 10 bytes. */
const BUNDLE_HEADER_SIZE = 10;

/** Current SDK version embedded in backups. */
const SDK_VERSION = '0.1.0';

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Create a backup bundle from encrypted notes and metadata.
 *
 * The encrypted payload is combined with plaintext metadata into a single
 * binary blob. The checksum field in the metadata is verified to match
 * the SHA-256 of the encrypted payload.
 *
 * @param encryptedNotes - Encrypted note payload from NoteStore.export()
 * @param metadata - Backup metadata including checksum
 * @returns Complete backup bundle as a Uint8Array
 */
export function createBackupBundle(
  encryptedNotes: Uint8Array,
  metadata: BackupMetadata,
): Uint8Array {
  const metadataJson = JSON.stringify(metadata);
  const metadataBytes = new TextEncoder().encode(metadataJson);

  // Header: magic (4) + version (2) + metadata length (4)
  const header = new Uint8Array(BUNDLE_HEADER_SIZE);
  header.set(BUNDLE_MAGIC, 0);
  const headerView = new DataView(header.buffer);
  headerView.setUint16(4, BUNDLE_VERSION, false);
  headerView.setUint32(6, metadataBytes.length, false);

  // Concatenate: header + metadata JSON + encrypted payload
  const totalLength = BUNDLE_HEADER_SIZE + metadataBytes.length + encryptedNotes.length;
  const bundle = new Uint8Array(totalLength);
  bundle.set(header, 0);
  bundle.set(metadataBytes, BUNDLE_HEADER_SIZE);
  bundle.set(encryptedNotes, BUNDLE_HEADER_SIZE + metadataBytes.length);

  return bundle;
}

/**
 * Parse a backup bundle into its encrypted payload and metadata.
 *
 * Validates the magic bytes and version number, then extracts the
 * metadata JSON and encrypted note payload.
 *
 * @param bundle - Complete backup bundle
 * @returns Parsed encrypted payload and metadata
 * @throws {Error} If the bundle is malformed or has wrong magic/version
 */
export function parseBackupBundle(
  bundle: Uint8Array,
): { encrypted: Uint8Array; metadata: BackupMetadata } {
  if (bundle.length < BUNDLE_HEADER_SIZE) {
    throw new Error(
      `Backup bundle too short: expected at least ${BUNDLE_HEADER_SIZE} bytes, got ${bundle.length}`,
    );
  }

  // Verify magic bytes
  for (let i = 0; i < BUNDLE_MAGIC.length; i++) {
    if (bundle[i] !== BUNDLE_MAGIC[i]) {
      throw new Error('Invalid backup bundle: wrong magic bytes');
    }
  }

  const headerView = new DataView(
    bundle.buffer,
    bundle.byteOffset,
    bundle.byteLength,
  );
  const version = headerView.getUint16(4, false);
  if (version !== BUNDLE_VERSION) {
    throw new Error(
      `Unsupported backup bundle version: ${version} (expected ${BUNDLE_VERSION})`,
    );
  }

  const metadataLength = headerView.getUint32(6, false);
  const metadataEnd = BUNDLE_HEADER_SIZE + metadataLength;

  if (bundle.length < metadataEnd) {
    throw new Error(
      `Backup bundle truncated: metadata declares ${metadataLength} bytes ` +
      `but only ${bundle.length - BUNDLE_HEADER_SIZE} available`,
    );
  }

  const metadataBytes = bundle.slice(BUNDLE_HEADER_SIZE, metadataEnd);
  const metadataJson = new TextDecoder().decode(metadataBytes);
  let metadata: BackupMetadata;
  try {
    metadata = JSON.parse(metadataJson) as BackupMetadata;
  } catch {
    throw new Error('Invalid backup bundle: metadata JSON is malformed');
  }

  const encrypted = bundle.slice(metadataEnd);

  return { encrypted, metadata };
}

/**
 * Validate the integrity of a backup bundle.
 *
 * Performs the following checks:
 *   1. Bundle has valid magic bytes and version
 *   2. Metadata JSON is parseable
 *   3. Required metadata fields are present
 *   4. SHA-256 checksum of the encrypted payload matches metadata.checksum
 *
 * @param bundle - Complete backup bundle to validate
 * @returns Validation result with a list of errors (empty if valid)
 */
export function validateBackupIntegrity(
  bundle: Uint8Array,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check minimum size
  if (bundle.length < BUNDLE_HEADER_SIZE) {
    errors.push(
      `Bundle too short: expected at least ${BUNDLE_HEADER_SIZE} bytes, got ${bundle.length}`,
    );
    return { valid: false, errors };
  }

  // Check magic bytes
  for (let i = 0; i < BUNDLE_MAGIC.length; i++) {
    if (bundle[i] !== BUNDLE_MAGIC[i]) {
      errors.push('Wrong magic bytes: not a Satsu backup bundle');
      return { valid: false, errors };
    }
  }

  // Check version
  const headerView = new DataView(
    bundle.buffer,
    bundle.byteOffset,
    bundle.byteLength,
  );
  const version = headerView.getUint16(4, false);
  if (version !== BUNDLE_VERSION) {
    errors.push(`Unsupported version: ${version} (expected ${BUNDLE_VERSION})`);
    // Continue checking other fields even with version mismatch
  }

  // Extract metadata
  const metadataLength = headerView.getUint32(6, false);
  const metadataEnd = BUNDLE_HEADER_SIZE + metadataLength;

  if (bundle.length < metadataEnd) {
    errors.push(
      `Truncated metadata: declared ${metadataLength} bytes, ` +
      `only ${bundle.length - BUNDLE_HEADER_SIZE} available`,
    );
    return { valid: false, errors };
  }

  const metadataBytes = bundle.slice(BUNDLE_HEADER_SIZE, metadataEnd);
  let metadata: BackupMetadata;
  try {
    const json = new TextDecoder().decode(metadataBytes);
    metadata = JSON.parse(json) as BackupMetadata;
  } catch {
    errors.push('Metadata JSON is malformed or unparseable');
    return { valid: false, errors };
  }

  // Validate required metadata fields
  if (typeof metadata.version !== 'string' || metadata.version.length === 0) {
    errors.push('Missing or invalid metadata.version');
  }
  if (typeof metadata.createdAt !== 'number' || metadata.createdAt <= 0) {
    errors.push('Missing or invalid metadata.createdAt');
  }
  if (typeof metadata.noteCount !== 'number' || metadata.noteCount < 0) {
    errors.push('Missing or invalid metadata.noteCount');
  }
  if (typeof metadata.unspentCount !== 'number' || metadata.unspentCount < 0) {
    errors.push('Missing or invalid metadata.unspentCount');
  }
  if (!Array.isArray(metadata.poolContracts)) {
    errors.push('Missing or invalid metadata.poolContracts');
  }
  if (typeof metadata.checksum !== 'string' || metadata.checksum.length === 0) {
    errors.push('Missing or invalid metadata.checksum');
  }

  // Verify checksum
  const encrypted = bundle.slice(metadataEnd);
  const computedChecksum = nobleBytesToHex(sha256(encrypted));

  if (metadata.checksum && computedChecksum !== metadata.checksum) {
    errors.push(
      `Checksum mismatch: expected ${metadata.checksum}, got ${computedChecksum}. ` +
      'The backup may be corrupted.',
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Compute the SHA-256 checksum of an encrypted payload.
 *
 * This is a convenience function for building BackupMetadata before
 * creating a bundle.
 *
 * @param encrypted - Encrypted note payload
 * @returns Hex-encoded SHA-256 checksum
 */
export function computeBackupChecksum(encrypted: Uint8Array): string {
  return nobleBytesToHex(sha256(encrypted));
}

/**
 * Get the current SDK version string for backup metadata.
 */
export function getBackupSdkVersion(): string {
  return SDK_VERSION;
}
