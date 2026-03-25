/**
 * Tests for the backup bundle system and NoteStore backup UX.
 *
 * Verifies that:
 *   - createBackupBundle / parseBackupBundle round-trip correctly
 *   - validateBackupIntegrity catches corruption
 *   - BackupMetadata includes correct counts and fields
 *   - Version mismatch produces warnings during importWithValidation
 *   - NoteStore.getBackupWarning fires appropriately
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createBackupBundle,
  parseBackupBundle,
  validateBackupIntegrity,
  computeBackupChecksum,
  getBackupSdkVersion,
  type BackupMetadata,
} from '../src/notes/backup.js';
import { NoteStore } from '../src/notes/store.js';
import { randomBytes } from '../src/utils/crypto.js';
import type { DecryptedNote } from '../src/notes/note.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a valid test note with random secrets. */
function makeTestNote(amount = 10_000_000n): DecryptedNote {
  return {
    secret: randomBytes(32),
    nullifier: randomBytes(32),
    amount,
    commitment: randomBytes(32),
    leafIndex: Math.floor(Math.random() * 100_000),
    stealthPrivKey: randomBytes(32),
  };
}

/** Shared 32-byte encryption key for tests. */
const TEST_KEY = randomBytes(32);

// ---------------------------------------------------------------------------
// createBackupBundle / parseBackupBundle round-trip
// ---------------------------------------------------------------------------

describe('createBackupBundle / parseBackupBundle', () => {
  it('should round-trip encrypted data and metadata', () => {
    const encrypted = randomBytes(256);
    const checksum = computeBackupChecksum(encrypted);

    const metadata: BackupMetadata = {
      version: '0.1.0',
      createdAt: Date.now(),
      noteCount: 3,
      unspentCount: 2,
      poolContracts: ['SP1234.pool-v1'],
      checksum,
    };

    const bundle = createBackupBundle(encrypted, metadata);
    const parsed = parseBackupBundle(bundle);

    // Encrypted payload matches
    expect(parsed.encrypted).toEqual(encrypted);

    // Metadata matches
    expect(parsed.metadata.version).toBe(metadata.version);
    expect(parsed.metadata.createdAt).toBe(metadata.createdAt);
    expect(parsed.metadata.noteCount).toBe(3);
    expect(parsed.metadata.unspentCount).toBe(2);
    expect(parsed.metadata.poolContracts).toEqual(['SP1234.pool-v1']);
    expect(parsed.metadata.checksum).toBe(checksum);
  });

  it('should handle empty encrypted payload', () => {
    const encrypted = new Uint8Array(0);
    const checksum = computeBackupChecksum(encrypted);

    const metadata: BackupMetadata = {
      version: '0.1.0',
      createdAt: Date.now(),
      noteCount: 0,
      unspentCount: 0,
      poolContracts: [],
      checksum,
    };

    const bundle = createBackupBundle(encrypted, metadata);
    const parsed = parseBackupBundle(bundle);
    expect(parsed.encrypted.length).toBe(0);
    expect(parsed.metadata.noteCount).toBe(0);
  });

  it('should handle large payloads', () => {
    // noble's randomBytes caps at 65536, so build a larger buffer by
    // concatenating multiple chunks.
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < 4; i++) {
      chunks.push(randomBytes(16_000));
    }
    const encrypted = new Uint8Array(64_000);
    let offset = 0;
    for (const chunk of chunks) {
      encrypted.set(chunk, offset);
      offset += chunk.length;
    }

    const checksum = computeBackupChecksum(encrypted);

    const metadata: BackupMetadata = {
      version: '0.1.0',
      createdAt: Date.now(),
      noteCount: 500,
      unspentCount: 200,
      poolContracts: ['SP1234.pool-v1', 'SP5678.pool-v2'],
      checksum,
    };

    const bundle = createBackupBundle(encrypted, metadata);
    const parsed = parseBackupBundle(bundle);
    expect(parsed.encrypted).toEqual(encrypted);
    expect(parsed.metadata.noteCount).toBe(500);
  });

  it('should reject bundles with wrong magic bytes', () => {
    const bundle = randomBytes(100);
    bundle[0] = 0xff; // Wrong magic
    expect(() => parseBackupBundle(bundle)).toThrow('wrong magic bytes');
  });

  it('should reject bundles that are too short', () => {
    const bundle = new Uint8Array(5);
    expect(() => parseBackupBundle(bundle)).toThrow('too short');
  });

  it('should reject bundles with truncated metadata', () => {
    const encrypted = randomBytes(32);
    const checksum = computeBackupChecksum(encrypted);

    const metadata: BackupMetadata = {
      version: '0.1.0',
      createdAt: Date.now(),
      noteCount: 1,
      unspentCount: 1,
      poolContracts: [],
      checksum,
    };

    const bundle = createBackupBundle(encrypted, metadata);
    // Truncate the bundle to cut off part of the metadata
    const truncated = bundle.slice(0, 12);
    expect(() => parseBackupBundle(truncated)).toThrow('truncated');
  });
});

// ---------------------------------------------------------------------------
// validateBackupIntegrity
// ---------------------------------------------------------------------------

describe('validateBackupIntegrity', () => {
  it('should validate a well-formed bundle', () => {
    const encrypted = randomBytes(128);
    const checksum = computeBackupChecksum(encrypted);

    const metadata: BackupMetadata = {
      version: '0.1.0',
      createdAt: Date.now(),
      noteCount: 2,
      unspentCount: 1,
      poolContracts: ['SP1234.pool-v1'],
      checksum,
    };

    const bundle = createBackupBundle(encrypted, metadata);
    const result = validateBackupIntegrity(bundle);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect corrupted payload (checksum mismatch)', () => {
    const encrypted = randomBytes(128);
    const checksum = computeBackupChecksum(encrypted);

    const metadata: BackupMetadata = {
      version: '0.1.0',
      createdAt: Date.now(),
      noteCount: 2,
      unspentCount: 1,
      poolContracts: [],
      checksum,
    };

    const bundle = createBackupBundle(encrypted, metadata);

    // Corrupt the last byte of the encrypted payload
    const corrupted = new Uint8Array(bundle);
    corrupted[corrupted.length - 1] ^= 0xff;

    const result = validateBackupIntegrity(corrupted);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Checksum mismatch'))).toBe(true);
  });

  it('should detect wrong magic bytes', () => {
    const bundle = new Uint8Array(20);
    bundle[0] = 0xff;
    const result = validateBackupIntegrity(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('magic'))).toBe(true);
  });

  it('should detect bundles that are too short', () => {
    const result = validateBackupIntegrity(new Uint8Array(5));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('too short'))).toBe(true);
  });

  it('should detect missing metadata fields', () => {
    // Create a bundle with incomplete metadata
    const encrypted = randomBytes(32);
    const incompleteMetadata = { version: '0.1.0' }; // Missing most fields
    const metadataJson = JSON.stringify(incompleteMetadata);
    const metadataBytes = new TextEncoder().encode(metadataJson);

    const header = new Uint8Array(10);
    header.set(new Uint8Array([0x53, 0x54, 0x42, 0x4b]), 0); // "STBK"
    const headerView = new DataView(header.buffer);
    headerView.setUint16(4, 1, false);
    headerView.setUint32(6, metadataBytes.length, false);

    const bundle = new Uint8Array(10 + metadataBytes.length + encrypted.length);
    bundle.set(header, 0);
    bundle.set(metadataBytes, 10);
    bundle.set(encrypted, 10 + metadataBytes.length);

    const result = validateBackupIntegrity(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// computeBackupChecksum
// ---------------------------------------------------------------------------

describe('computeBackupChecksum', () => {
  it('should produce a 64-character hex string', () => {
    const checksum = computeBackupChecksum(randomBytes(100));
    expect(checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should be deterministic for the same input', () => {
    const data = randomBytes(100);
    const a = computeBackupChecksum(data);
    const b = computeBackupChecksum(data);
    expect(a).toBe(b);
  });

  it('should differ for different inputs', () => {
    const a = computeBackupChecksum(randomBytes(100));
    const b = computeBackupChecksum(randomBytes(100));
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// NoteStore.exportWithMetadata / importWithValidation
// ---------------------------------------------------------------------------

describe('NoteStore enhanced backup', () => {
  let store: NoteStore;

  beforeEach(() => {
    store = new NoteStore(TEST_KEY);
  });

  it('should export with metadata and round-trip via importWithValidation', async () => {
    await store.save(makeTestNote());
    await store.save(makeTestNote());
    const noteId3 = await store.save(makeTestNote());
    await store.markSpent(noteId3);

    const { backup, metadata } = await store.exportWithMetadata([
      'SP1234.pool-v1',
    ]);

    expect(metadata.noteCount).toBe(3);
    expect(metadata.unspentCount).toBe(2);
    expect(metadata.version).toBe(getBackupSdkVersion());
    expect(metadata.poolContracts).toEqual(['SP1234.pool-v1']);
    expect(metadata.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(metadata.createdAt).toBeGreaterThan(0);

    // Import into a new store
    const { store: restored, metadata: restoredMeta, warnings } =
      await NoteStore.importWithValidation(backup, TEST_KEY);

    expect(restored.size).toBe(3);
    expect(restoredMeta.noteCount).toBe(3);
    expect(warnings).toHaveLength(0);

    // Verify unspent notes can be listed
    const unspent = await restored.listUnspent();
    expect(unspent).toHaveLength(2);
  });

  it('should produce warnings for version mismatch', async () => {
    await store.save(makeTestNote());
    const { backup } = await store.exportWithMetadata();

    // Parse the bundle, modify the version, and rebuild
    const parsed = parseBackupBundle(backup);
    const modifiedMetadata: BackupMetadata = {
      ...parsed.metadata,
      version: '99.0.0',
    };
    const modifiedBundle = createBackupBundle(parsed.encrypted, modifiedMetadata);

    const { warnings } = await NoteStore.importWithValidation(
      modifiedBundle,
      TEST_KEY,
    );
    expect(warnings.some((w) => w.includes('version'))).toBe(true);
  });

  it('should throw on corrupted backup during importWithValidation', async () => {
    await store.save(makeTestNote());
    const { backup } = await store.exportWithMetadata();

    // Corrupt the encrypted payload
    const corrupted = new Uint8Array(backup);
    corrupted[corrupted.length - 1] ^= 0xff;

    await expect(
      NoteStore.importWithValidation(corrupted, TEST_KEY),
    ).rejects.toThrow();
  });

  it('should export empty store successfully', async () => {
    const { backup, metadata } = await store.exportWithMetadata();
    expect(metadata.noteCount).toBe(0);
    expect(metadata.unspentCount).toBe(0);

    const { store: restored } = await NoteStore.importWithValidation(
      backup,
      TEST_KEY,
    );
    expect(restored.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// NoteStore.getBackupWarning
// ---------------------------------------------------------------------------

describe('NoteStore.getBackupWarning', () => {
  let store: NoteStore;

  beforeEach(() => {
    store = new NoteStore(TEST_KEY);
  });

  it('should return null when there are no notes', () => {
    expect(store.getBackupWarning()).toBeNull();
  });

  it('should warn when there are unspent notes with no backup', async () => {
    await store.save(makeTestNote());
    const warning = store.getBackupWarning();
    expect(warning).not.toBeNull();
    expect(warning).toContain('NO backup');
    expect(warning).toContain('1 unspent note(s)');
  });

  it('should return null after creating a backup (when notes are older)', async () => {
    await store.save(makeTestNote());

    // Creating a backup with exportWithMetadata updates lastBackupAt
    await store.exportWithMetadata();

    // Immediately after backup, no warning since backup is fresh
    // and notes predate the backup
    const warning = store.getBackupWarning();
    // The warning should be null since the backup is fresh and
    // there are no notes newer than the backup
    expect(warning).toBeNull();
  });

  it('should warn about new notes added after backup', async () => {
    await store.save(makeTestNote());
    await store.exportWithMetadata();

    // Ensure Date.now() advances past the backup timestamp.
    // The backup and the new note can land on the same millisecond,
    // so we busy-wait for the clock to tick at least 1ms.
    const before = Date.now();
    while (Date.now() <= before) {
      // spin
    }

    // Add a new note after backup
    await store.save(makeTestNote());

    const warning = store.getBackupWarning();
    expect(warning).not.toBeNull();
    expect(warning!).toContain('new notes');
  });

  it('should not warn when all notes are spent', async () => {
    const id = await store.save(makeTestNote());
    await store.markSpent(id);
    expect(store.getBackupWarning()).toBeNull();
  });
});
