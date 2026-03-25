/**
 * Encrypted note storage for the Satsu privacy system.
 *
 * The NoteStore manages an in-memory collection of encrypted deposit
 * notes. Each note is encrypted individually with AES-256-GCM before
 * being stored. The store supports:
 *
 *   - Save / load / list operations for individual notes
 *   - Marking notes as spent (after withdrawal)
 *   - Encrypted export/import for backup and migration
 *
 * SECURITY: Notes are the ONLY way to access deposited funds. If a
 * user loses their notes AND their backup, their funds are permanently
 * locked in the pool. The SDK should prominently warn users about this.
 *
 * This implementation uses an in-memory Map as the storage backend.
 * Production integrations should layer IndexedDB (browser) or filesystem
 * (Node.js) persistence on top of this, calling export()/import() to
 * handle serialization.
 */

import {
  bytesToHex,
  hexToBytes,
  concatBytes,
  randomBytes,
} from '../utils/crypto.js';
import {
  encryptNote,
  decryptNote,
} from './encryption.js';
import {
  serializeNote,
  deserializeNote,
  SERIALIZED_NOTE_LENGTH,
  type DecryptedNote,
} from './note.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StoredNote {
  /** Unique note identifier (hex-encoded random bytes). */
  id: string;
  /** AES-256-GCM encrypted serialized note. */
  ciphertext: Uint8Array;
  /** 12-byte IV used for this note's encryption. */
  iv: Uint8Array;
  /** 16-byte GCM authentication tag. */
  tag: Uint8Array;
  /** Whether this note has been withdrawn (spent). */
  spent: boolean;
  /** Timestamp when the note was stored (milliseconds since epoch). */
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Backup format
// ---------------------------------------------------------------------------
//
// The backup is itself encrypted with the store's encryption key.
// Inner format (plaintext before encryption):
//
//   Bytes 0..3:    magic bytes "STNT" (0x53 0x54 0x4E 0x54)
//   Bytes 4..5:    version (uint16 BE) = 1
//   Bytes 6..9:    note count (uint32 BE)
//   For each note:
//     Bytes 0..31:   id (16 bytes as raw, then hex-decoded — but we use 16 raw bytes)
//     Byte  32:      spent flag (0x00 or 0x01)
//     Bytes 33..40:  createdAt (uint64 BE, ms since epoch)
//     Bytes 41..52:  iv (12 bytes)
//     Bytes 53..68:  tag (16 bytes)
//     Bytes 69..72:  ciphertext length (uint32 BE)
//     Bytes 73..N:   ciphertext
//
// The entire plaintext blob is then encrypted with AES-256-GCM using
// the store's key, and the output is: iv (12) || tag (16) || ciphertext.

const BACKUP_MAGIC = new Uint8Array([0x53, 0x54, 0x4e, 0x54]); // "STNT"
const BACKUP_VERSION = 1;
const NOTE_ID_BYTES = 16;

// ---------------------------------------------------------------------------
// NoteStore
// ---------------------------------------------------------------------------

export class NoteStore {
  private readonly encryptionKey: Uint8Array;
  private readonly notes: Map<string, StoredNote> = new Map();

  /**
   * Create a new NoteStore with the given encryption key.
   *
   * @param encryptionKey - 32-byte AES-256 key (derived from password or wallet key)
   */
  constructor(encryptionKey: Uint8Array) {
    if (encryptionKey.length !== 32) {
      throw new Error(
        `Encryption key must be 32 bytes, got ${encryptionKey.length}`,
      );
    }
    this.encryptionKey = Uint8Array.from(encryptionKey);
  }

  /**
   * Save a note to the store.
   *
   * The note is serialized, encrypted with AES-256-GCM, and stored
   * in memory. Returns a unique note ID that can be used for later
   * retrieval.
   *
   * @param note - The decrypted note to save
   * @returns Unique note identifier (hex string)
   */
  async save(note: DecryptedNote): Promise<string> {
    const id = bytesToHex(randomBytes(NOTE_ID_BYTES));
    const serialized = serializeNote(note);
    const { ciphertext, iv, tag } = await encryptNote(
      serialized,
      this.encryptionKey,
    );

    this.notes.set(id, {
      id,
      ciphertext,
      iv,
      tag,
      spent: false,
      createdAt: Date.now(),
    });

    return id;
  }

  /**
   * Load and decrypt a note by its ID.
   *
   * @param id - Note identifier returned by save()
   * @returns Decrypted note
   * @throws {Error} If the note is not found or decryption fails
   */
  async load(id: string): Promise<DecryptedNote> {
    const stored = this.notes.get(id);
    if (!stored) {
      throw new Error(`Note not found: ${id}`);
    }

    const plaintext = await decryptNote(
      stored.ciphertext,
      stored.iv,
      stored.tag,
      this.encryptionKey,
    );

    return deserializeNote(plaintext);
  }

  /**
   * List all unspent notes in the store.
   *
   * Returns decrypted copies of all notes that have not been marked
   * as spent. This is used to show the user their available balance
   * and to select notes for withdrawal.
   *
   * @returns Array of unspent decrypted notes
   */
  async listUnspent(): Promise<DecryptedNote[]> {
    const unspent: DecryptedNote[] = [];

    for (const stored of this.notes.values()) {
      if (!stored.spent) {
        const plaintext = await decryptNote(
          stored.ciphertext,
          stored.iv,
          stored.tag,
          this.encryptionKey,
        );
        unspent.push(deserializeNote(plaintext));
      }
    }

    return unspent;
  }

  /**
   * Mark a note as spent (withdrawn).
   *
   * This does NOT delete the note — it remains in the store for
   * record-keeping. The note will no longer appear in listUnspent().
   *
   * @param id - Note identifier
   * @throws {Error} If the note is not found
   */
  async markSpent(id: string): Promise<void> {
    const stored = this.notes.get(id);
    if (!stored) {
      throw new Error(`Note not found: ${id}`);
    }
    stored.spent = true;
  }

  /**
   * Export all notes as an encrypted backup blob.
   *
   * The backup contains all notes (both spent and unspent) encrypted
   * under the store's encryption key. The format includes magic bytes,
   * a version number, and per-note metadata.
   *
   * The entire serialized backup is then encrypted with AES-256-GCM
   * to produce the final output.
   *
   * @returns Encrypted backup blob (Uint8Array)
   */
  async export(): Promise<Uint8Array> {
    // Build the plaintext backup
    const noteEntries = Array.from(this.notes.values());
    const chunks: Uint8Array[] = [];

    // Header: magic (4) + version (2) + count (4) = 10 bytes
    const header = new Uint8Array(10);
    header.set(BACKUP_MAGIC, 0);
    const headerView = new DataView(header.buffer);
    headerView.setUint16(4, BACKUP_VERSION, false);
    headerView.setUint32(6, noteEntries.length, false);
    chunks.push(header);

    // Each note entry
    for (const stored of noteEntries) {
      const idBytes = hexToRawBytes(stored.id, NOTE_ID_BYTES);

      // Metadata: id (16) + spent (1) + createdAt (8) + iv (12) + tag (16) + ctLen (4) = 57
      const meta = new Uint8Array(57);
      meta.set(idBytes, 0);
      meta[16] = stored.spent ? 1 : 0;
      const metaView = new DataView(meta.buffer);
      // Store createdAt as two 32-bit values (JS numbers > 2^32 for timestamps)
      const ts = BigInt(stored.createdAt);
      metaView.setUint32(17, Number(ts >> 32n), false);
      metaView.setUint32(21, Number(ts & 0xffffffffn), false);
      meta.set(stored.iv, 25);
      meta.set(stored.tag, 37);
      metaView.setUint32(53, stored.ciphertext.length, false);
      chunks.push(meta);

      // Ciphertext
      chunks.push(stored.ciphertext);
    }

    const plaintext = concatBytes(...chunks);

    // Encrypt the entire backup
    const { ciphertext, iv, tag } = await encryptNote(
      plaintext,
      this.encryptionKey,
    );

    // Output format: iv (12) || tag (16) || ciphertext
    return concatBytes(iv, tag, ciphertext);
  }

  /**
   * Import notes from an encrypted backup blob.
   *
   * Decrypts the backup, validates the format, and adds all notes
   * to the store. Notes that already exist (same ID) are skipped.
   *
   * @param backup - Encrypted backup blob (from export())
   * @returns Number of notes imported
   * @throws {Error} If decryption fails or the backup format is invalid
   */
  async import(backup: Uint8Array): Promise<number> {
    if (backup.length < 12 + 16) {
      throw new Error('Backup too short to contain encryption metadata');
    }

    // Parse outer encryption: iv (12) || tag (16) || ciphertext
    const iv = backup.slice(0, 12);
    const tag = backup.slice(12, 28);
    const ciphertext = backup.slice(28);

    const plaintext = await decryptNote(
      ciphertext,
      iv,
      tag,
      this.encryptionKey,
    );

    // Parse header
    if (plaintext.length < 10) {
      throw new Error('Invalid backup: too short for header');
    }

    // Check magic
    for (let i = 0; i < 4; i++) {
      if (plaintext[i] !== BACKUP_MAGIC[i]) {
        throw new Error('Invalid backup: bad magic bytes');
      }
    }

    const headerView = new DataView(
      plaintext.buffer,
      plaintext.byteOffset,
      plaintext.byteLength,
    );
    const version = headerView.getUint16(4, false);
    if (version !== BACKUP_VERSION) {
      throw new Error(`Unsupported backup version: ${version}`);
    }

    const noteCount = headerView.getUint32(6, false);
    let offset = 10;
    let imported = 0;

    for (let i = 0; i < noteCount; i++) {
      if (offset + 57 > plaintext.length) {
        throw new Error(`Invalid backup: truncated at note ${i}`);
      }

      const idBytes = plaintext.slice(offset, offset + NOTE_ID_BYTES);
      const id = bytesToHex(idBytes);
      const spent = plaintext[offset + 16] === 1;

      const noteView = new DataView(
        plaintext.buffer,
        plaintext.byteOffset + offset,
        plaintext.byteLength - offset,
      );
      const tsHigh = BigInt(noteView.getUint32(17, false));
      const tsLow = BigInt(noteView.getUint32(21, false));
      const createdAt = Number((tsHigh << 32n) | tsLow);

      const noteIv = plaintext.slice(offset + 25, offset + 37);
      const noteTag = plaintext.slice(offset + 37, offset + 53);
      const ctLen = noteView.getUint32(53, false);
      offset += 57;

      if (offset + ctLen > plaintext.length) {
        throw new Error(`Invalid backup: truncated ciphertext at note ${i}`);
      }

      const noteCiphertext = plaintext.slice(offset, offset + ctLen);
      offset += ctLen;

      // Skip if already exists
      if (this.notes.has(id)) {
        continue;
      }

      this.notes.set(id, {
        id,
        ciphertext: noteCiphertext,
        iv: noteIv,
        tag: noteTag,
        spent,
        createdAt,
      });

      imported++;
    }

    return imported;
  }

  /**
   * Get the total number of notes in the store (both spent and unspent).
   */
  get size(): number {
    return this.notes.size;
  }

  /**
   * Check if a note exists in the store.
   */
  has(id: string): boolean {
    return this.notes.has(id);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a hex string to raw bytes with a fixed expected length.
 * Pads with leading zeros or truncates to match the expected length.
 */
function hexToRawBytes(hex: string, expectedLength: number): Uint8Array {
  const result = new Uint8Array(expectedLength);
  const bytes = hexToBytes(hex);
  // Copy from the end to preserve the least-significant bytes
  const copyLen = Math.min(bytes.length, expectedLength);
  result.set(bytes.slice(bytes.length - copyLen), expectedLength - copyLen);
  return result;
}
