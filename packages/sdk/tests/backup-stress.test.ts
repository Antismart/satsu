/**
 * Stress / edge-case tests for the Satsu note backup system.
 *
 * Covers:
 *   1.  Export/import with 0 notes
 *   2.  Export/import with 1000 notes
 *   3.  Import a backup from a "future" version
 *   4.  Import a backup with corrupted middle bytes
 *   5.  Import with wrong encryption key
 *   6.  Concurrent save + export (race condition)
 *   7.  markSpent during export
 *   8.  Import duplicates (same note ID)
 *   9.  Export after all notes spent
 *   10. Backup size growth (linear with notes)
 *   11. getBackupWarning with various staleness scenarios
 *   12. Round-trip through multiple export/import cycles
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

/** A different 32-byte key, guaranteed distinct from TEST_KEY. */
const WRONG_KEY = randomBytes(32);

/**
 * Busy-wait until Date.now() is strictly greater than the given timestamp.
 * Necessary when tests rely on timestamp ordering within a fast test.
 */
function waitForClockAdvance(referenceMs: number): void {
  while (Date.now() <= referenceMs) {
    // spin
  }
}

// ---------------------------------------------------------------------------
// 1. Export/import with 0 notes
// ---------------------------------------------------------------------------

describe('Edge case: empty store', () => {
  it('should export and re-import an empty backup via raw export()/import()', async () => {
    const store = new NoteStore(TEST_KEY);
    expect(store.size).toBe(0);

    const blob = await store.export();
    expect(blob.length).toBeGreaterThan(0); // encrypted header still has content

    const store2 = new NoteStore(TEST_KEY);
    const imported = await store2.import(blob);
    expect(imported).toBe(0);
    expect(store2.size).toBe(0);
  });

  it('should export and re-import an empty backup via exportWithMetadata/importWithValidation', async () => {
    const store = new NoteStore(TEST_KEY);
    const { backup, metadata } = await store.exportWithMetadata();

    expect(metadata.noteCount).toBe(0);
    expect(metadata.unspentCount).toBe(0);

    const { store: restored, warnings } =
      await NoteStore.importWithValidation(backup, TEST_KEY);
    expect(restored.size).toBe(0);
    expect(warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Export/import with 1000 notes
// ---------------------------------------------------------------------------

describe('Edge case: large store (1000 notes)', () => {
  it('should round-trip 1000 notes without data loss', async () => {
    const store = new NoteStore(TEST_KEY);
    const savedIds: string[] = [];

    for (let i = 0; i < 1_000; i++) {
      const id = await store.save(makeTestNote(BigInt(i + 1)));
      savedIds.push(id);
    }
    expect(store.size).toBe(1_000);

    // Mark every 3rd note as spent
    for (let i = 0; i < savedIds.length; i += 3) {
      await store.markSpent(savedIds[i]!);
    }

    const { backup, metadata } = await store.exportWithMetadata();
    expect(metadata.noteCount).toBe(1_000);

    // The number of spent notes: indices 0,3,6,...,999 => ceil(1000/3) = 334
    const expectedSpent = Math.ceil(1_000 / 3);
    expect(metadata.unspentCount).toBe(1_000 - expectedSpent);

    // Import into a fresh store
    const { store: restored, warnings } =
      await NoteStore.importWithValidation(backup, TEST_KEY);
    expect(restored.size).toBe(1_000);
    expect(warnings).toHaveLength(0);

    // Verify unspent count matches
    const unspent = await restored.listUnspent();
    expect(unspent).toHaveLength(1_000 - expectedSpent);
  }, 30_000); // generous timeout for 1000 encrypt/decrypt cycles
});

// ---------------------------------------------------------------------------
// 3. Import a backup from a "future" version
// ---------------------------------------------------------------------------

describe('Edge case: future version backup', () => {
  it('should produce a version warning but still import if payload is compatible', async () => {
    const store = new NoteStore(TEST_KEY);
    await store.save(makeTestNote());
    const { backup } = await store.exportWithMetadata();

    // Rewrite the metadata version to a future value
    const parsed = parseBackupBundle(backup);
    const futureMetadata: BackupMetadata = {
      ...parsed.metadata,
      version: '99.0.0',
    };
    const modified = createBackupBundle(parsed.encrypted, futureMetadata);

    const { store: restored, warnings } =
      await NoteStore.importWithValidation(modified, TEST_KEY);
    expect(restored.size).toBe(1);
    expect(warnings.some((w) => w.includes('version'))).toBe(true);
  });

  it('should reject a bundle whose format version (not SDK version) is unsupported', () => {
    // Build a raw bundle with bundle format version = 99
    const encrypted = randomBytes(64);
    const checksum = computeBackupChecksum(encrypted);
    const meta: BackupMetadata = {
      version: getBackupSdkVersion(),
      createdAt: Date.now(),
      noteCount: 0,
      unspentCount: 0,
      poolContracts: [],
      checksum,
    };
    const metaJson = new TextEncoder().encode(JSON.stringify(meta));
    const header = new Uint8Array(10);
    header.set(new Uint8Array([0x53, 0x54, 0x42, 0x4b]), 0); // "STBK" magic
    const hv = new DataView(header.buffer);
    hv.setUint16(4, 99, false); // unsupported format version
    hv.setUint32(6, metaJson.length, false);

    const bundle = new Uint8Array(10 + metaJson.length + encrypted.length);
    bundle.set(header, 0);
    bundle.set(metaJson, 10);
    bundle.set(encrypted, 10 + metaJson.length);

    expect(() => parseBackupBundle(bundle)).toThrow('Unsupported backup bundle version');
  });
});

// ---------------------------------------------------------------------------
// 4. Import a backup with corrupted middle bytes
// ---------------------------------------------------------------------------

describe('Edge case: corrupted middle bytes', () => {
  it('should fail integrity validation when middle bytes of the encrypted payload are flipped', async () => {
    const store = new NoteStore(TEST_KEY);
    for (let i = 0; i < 5; i++) await store.save(makeTestNote());

    const { backup } = await store.exportWithMetadata();
    const corrupted = new Uint8Array(backup);

    // Corrupt bytes in the middle of the encrypted payload region
    const mid = Math.floor(corrupted.length / 2);
    corrupted[mid] ^= 0xff;
    corrupted[mid + 1] ^= 0xaa;
    corrupted[mid + 2] ^= 0x55;

    const validation = validateBackupIntegrity(corrupted);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('Checksum mismatch'))).toBe(true);
  });

  it('should throw during importWithValidation with corrupted payload', async () => {
    const store = new NoteStore(TEST_KEY);
    for (let i = 0; i < 5; i++) await store.save(makeTestNote());

    const { backup } = await store.exportWithMetadata();
    const corrupted = new Uint8Array(backup);

    // Corrupt deep inside
    const target = Math.floor(corrupted.length * 0.75);
    for (let i = 0; i < 8; i++) {
      corrupted[target + i] ^= 0xff;
    }

    await expect(
      NoteStore.importWithValidation(corrupted, TEST_KEY),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 5. Import with wrong encryption key
// ---------------------------------------------------------------------------

describe('Edge case: wrong encryption key', () => {
  it('should fail decryption on raw import()', async () => {
    const store = new NoteStore(TEST_KEY);
    await store.save(makeTestNote());

    const blob = await store.export();

    const wrongStore = new NoteStore(WRONG_KEY);
    await expect(wrongStore.import(blob)).rejects.toThrow(/[Dd]ecryption/);
  });

  it('should fail during importWithValidation with wrong key', async () => {
    const store = new NoteStore(TEST_KEY);
    await store.save(makeTestNote());

    const { backup } = await store.exportWithMetadata();

    // The bundle integrity check passes (checksum is on encrypted blob),
    // but the inner decryption must fail.
    await expect(
      NoteStore.importWithValidation(backup, WRONG_KEY),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 6. Concurrent save + export (race condition)
// ---------------------------------------------------------------------------

describe('Edge case: concurrent save and export', () => {
  it('should not corrupt data when save and export race', async () => {
    const store = new NoteStore(TEST_KEY);

    // Pre-populate with some notes
    for (let i = 0; i < 10; i++) {
      await store.save(makeTestNote());
    }

    // Fire save and export concurrently
    const [saveResult, exportResult] = await Promise.all([
      store.save(makeTestNote()),
      store.export(),
    ]);

    // Save should succeed and return a valid ID
    expect(typeof saveResult).toBe('string');
    expect(saveResult.length).toBeGreaterThan(0);

    // Export should produce a valid blob
    expect(exportResult.length).toBeGreaterThan(0);

    // The export might or might not include the concurrently-saved note.
    // What matters is that the import does not throw.
    const store2 = new NoteStore(TEST_KEY);
    const imported = await store2.import(exportResult);
    expect(imported).toBeGreaterThanOrEqual(10);
    expect(imported).toBeLessThanOrEqual(11);
  });

  it('should handle multiple concurrent exports safely', async () => {
    const store = new NoteStore(TEST_KEY);
    for (let i = 0; i < 20; i++) await store.save(makeTestNote());

    const results = await Promise.all([
      store.export(),
      store.export(),
      store.export(),
    ]);

    // All three exports should be valid and importable
    for (const blob of results) {
      const importStore = new NoteStore(TEST_KEY);
      const imported = await importStore.import(blob);
      expect(imported).toBe(20);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. markSpent during export
// ---------------------------------------------------------------------------

describe('Edge case: markSpent during export', () => {
  it('should not crash when markSpent races with export', async () => {
    const store = new NoteStore(TEST_KEY);
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      ids.push(await store.save(makeTestNote()));
    }

    // Race: mark notes spent while exporting
    const [, exportBlob] = await Promise.all([
      (async () => {
        for (const id of ids.slice(0, 5)) {
          await store.markSpent(id);
        }
      })(),
      store.export(),
    ]);

    // Import should succeed regardless of which spent states were captured
    const store2 = new NoteStore(TEST_KEY);
    const imported = await store2.import(exportBlob);
    expect(imported).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// 8. Import duplicates (same note ID)
// ---------------------------------------------------------------------------

describe('Edge case: duplicate note IDs', () => {
  it('should skip notes that already exist on import', async () => {
    const store = new NoteStore(TEST_KEY);
    for (let i = 0; i < 5; i++) await store.save(makeTestNote());

    const blob = await store.export();

    // Import the same blob twice into the same store
    const first = await store.import(blob);
    // All 5 already exist, so 0 new imports
    expect(first).toBe(0);
    expect(store.size).toBe(5);
  });

  it('should merge new notes from a second backup without duplicating existing ones', async () => {
    const store1 = new NoteStore(TEST_KEY);
    for (let i = 0; i < 3; i++) await store1.save(makeTestNote());
    const backup1 = await store1.export();

    // Add more notes, take a second backup
    for (let i = 0; i < 2; i++) await store1.save(makeTestNote());
    const backup2 = await store1.export();

    // Fresh store: import backup1 then backup2
    const fresh = new NoteStore(TEST_KEY);
    const imported1 = await fresh.import(backup1);
    expect(imported1).toBe(3);

    const imported2 = await fresh.import(backup2);
    // Only the 2 new notes should be imported, the 3 existing are skipped
    expect(imported2).toBe(2);
    expect(fresh.size).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 9. Export after all notes spent
// ---------------------------------------------------------------------------

describe('Edge case: export after all notes spent', () => {
  it('should export and import a store where every note is spent', async () => {
    const store = new NoteStore(TEST_KEY);
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      ids.push(await store.save(makeTestNote()));
    }

    for (const id of ids) await store.markSpent(id);

    const { backup, metadata } = await store.exportWithMetadata();
    expect(metadata.noteCount).toBe(5);
    expect(metadata.unspentCount).toBe(0);

    const { store: restored } =
      await NoteStore.importWithValidation(backup, TEST_KEY);
    expect(restored.size).toBe(5);
    const unspent = await restored.listUnspent();
    expect(unspent).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 10. Backup size growth (linear with notes)
// ---------------------------------------------------------------------------

describe('Edge case: backup size growth', () => {
  it('should grow approximately linearly with the number of notes', async () => {
    const sizes: number[] = [];
    const counts = [1, 10, 50, 100];

    for (const count of counts) {
      const store = new NoteStore(TEST_KEY);
      for (let i = 0; i < count; i++) {
        await store.save(makeTestNote());
      }
      const blob = await store.export();
      sizes.push(blob.length);
    }

    // Compute bytes-per-note between the 10-note and 100-note runs
    const bpn10 = (sizes[1]! - sizes[0]!) / (counts[1]! - counts[0]!);
    const bpn100 = (sizes[3]! - sizes[2]!) / (counts[3]! - counts[2]!);

    // The per-note overhead should be roughly the same (within 2x).
    // This confirms O(n) growth, not quadratic or exponential.
    expect(bpn100).toBeGreaterThan(0);
    expect(bpn10 / bpn100).toBeGreaterThan(0.3);
    expect(bpn10 / bpn100).toBeLessThan(3.0);
  }, 15_000);
});

// ---------------------------------------------------------------------------
// 11. getBackupWarning with various staleness scenarios
// ---------------------------------------------------------------------------

describe('Edge case: getBackupWarning staleness', () => {
  it('should return null for empty store', () => {
    const store = new NoteStore(TEST_KEY);
    expect(store.getBackupWarning()).toBeNull();
  });

  it('should return "NO backup" when unspent notes exist and no export has occurred', async () => {
    const store = new NoteStore(TEST_KEY);
    await store.save(makeTestNote());
    await store.save(makeTestNote());

    const warning = store.getBackupWarning();
    expect(warning).not.toBeNull();
    expect(warning).toContain('NO backup');
    expect(warning).toContain('2 unspent note(s)');
  });

  it('should return null immediately after a fresh backup with no new notes', async () => {
    const store = new NoteStore(TEST_KEY);
    await store.save(makeTestNote());
    await store.exportWithMetadata();

    expect(store.getBackupWarning()).toBeNull();
  });

  it('should warn about new notes added after backup', async () => {
    const store = new NoteStore(TEST_KEY);
    await store.save(makeTestNote());
    await store.exportWithMetadata();

    waitForClockAdvance(Date.now());
    await store.save(makeTestNote());

    const warning = store.getBackupWarning();
    expect(warning).not.toBeNull();
    expect(warning!).toContain('new notes');
  });

  it('should detect staleness with a very short threshold', async () => {
    const store = new NoteStore(TEST_KEY);
    await store.save(makeTestNote());
    await store.exportWithMetadata();

    // Wait until Date.now() has advanced by at least 2ms past the backup
    // so that backupAge (Date.now() - lastBackupAt) strictly exceeds the
    // staleness threshold of 1ms.
    const afterBackup = Date.now();
    waitForClockAdvance(afterBackup);
    waitForClockAdvance(Date.now());

    const warning = store.getBackupWarning(1); // 1ms staleness
    expect(warning).not.toBeNull();
    expect(warning!).toContain('hour(s) ago');
  });

  it('should not warn after all unspent notes are spent', async () => {
    const store = new NoteStore(TEST_KEY);
    const id1 = await store.save(makeTestNote());
    const id2 = await store.save(makeTestNote());

    // No backup, but we spend everything
    await store.markSpent(id1);
    await store.markSpent(id2);

    expect(store.getBackupWarning()).toBeNull();
  });

  it('should warn correctly with a mix of spent and unspent after partial backup', async () => {
    const store = new NoteStore(TEST_KEY);
    const id1 = await store.save(makeTestNote());
    await store.save(makeTestNote()); // unspent
    await store.markSpent(id1);

    // No backup created yet
    const warning = store.getBackupWarning();
    expect(warning).not.toBeNull();
    expect(warning).toContain('1 unspent note(s)');
    expect(warning).toContain('NO backup');
  });
});

// ---------------------------------------------------------------------------
// 12. Round-trip through multiple export/import cycles
// ---------------------------------------------------------------------------

describe('Edge case: multiple round-trip cycles', () => {
  it('should survive 5 export/import cycles without data loss or corruption', async () => {
    let store = new NoteStore(TEST_KEY);

    // Populate initial notes
    for (let i = 0; i < 10; i++) {
      await store.save(makeTestNote(BigInt((i + 1) * 1_000_000)));
    }

    for (let cycle = 0; cycle < 5; cycle++) {
      const { backup, metadata } = await store.exportWithMetadata();
      expect(metadata.noteCount).toBe(10);

      const { store: restored, warnings } =
        await NoteStore.importWithValidation(backup, TEST_KEY);
      expect(warnings).toHaveLength(0);
      expect(restored.size).toBe(10);

      // Verify that all notes are decryptable
      const unspent = await restored.listUnspent();
      expect(unspent).toHaveLength(10);

      // Use the restored store as the input for the next cycle
      store = restored;
    }

    // Final verification: amounts should still match
    const finalNotes = await store.listUnspent();
    expect(finalNotes).toHaveLength(10);
    const amounts = finalNotes.map((n) => n.amount).sort((a, b) => Number(a - b));
    for (let i = 0; i < 10; i++) {
      expect(amounts[i]).toBe(BigInt((i + 1) * 1_000_000));
    }
  }, 30_000);

  it('should survive cycles with notes added and spent between cycles', async () => {
    let store = new NoteStore(TEST_KEY);

    // Cycle 1: add 5 notes, export
    const ids1: string[] = [];
    for (let i = 0; i < 5; i++) {
      ids1.push(await store.save(makeTestNote()));
    }
    let { backup } = await store.exportWithMetadata();
    let { store: restored } = await NoteStore.importWithValidation(backup, TEST_KEY);

    // Cycle 2: spend 2, add 3, export
    await restored.markSpent(ids1[0]!);
    await restored.markSpent(ids1[1]!);
    for (let i = 0; i < 3; i++) {
      await restored.save(makeTestNote());
    }
    expect(restored.size).toBe(8); // 5 original + 3 new

    ({ backup } = await restored.exportWithMetadata());
    ({ store: restored } = await NoteStore.importWithValidation(backup, TEST_KEY));

    expect(restored.size).toBe(8);
    const unspent = await restored.listUnspent();
    expect(unspent).toHaveLength(6); // 3 original unspent + 3 new
  });
});
