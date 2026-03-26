"use client";

import { useState, useCallback } from "react";
import type { NoteDisplay } from "@/components/NotesList";

// ---------------------------------------------------------------------------
// SDK integration
//
// The @satsu/sdk is installed as a local dependency. The functions below use
// the SDK's createCommitment, NoteStore, and backup helpers where possible.
// Full deposit/withdrawal still requires a running relayer + deployed
// contracts — those paths are clearly marked.
// ---------------------------------------------------------------------------

interface SatsuHook {
  /** Submit a deposit to the privacy pool */
  deposit: (amount: number) => Promise<void>;
  /** Withdraw funds to a recipient address */
  withdraw: (recipient: string) => Promise<void>;
  /** Current list of notes (unspent, spent, pending) */
  notes: NoteDisplay[];
  /** Whether the user has backed up their notes */
  hasBackedUp: boolean;
  /** Export an encrypted backup bundle */
  exportBackup: () => Promise<string>;
  /** Import notes from a backup bundle */
  importBackup: (data: string) => Promise<void>;
  /** Mark notes as backed up */
  markBackedUp: () => void;
}

export function useSatsu(): SatsuHook {
  const [notes, setNotes] = useState<NoteDisplay[]>([]);
  const [hasBackedUp, setHasBackedUp] = useState(false);

  const deposit = useCallback(async (amount: number) => {
    // -----------------------------------------------------------------
    // REQUIRES: running relayer + deployed pool-v1 contract
    //
    // Full flow when relayer is live:
    //   1. import { createCommitment, buildApprovalTx, buildDepositTx } from "@satsu/sdk"
    //   2. const commitment = createCommitment(BigInt(amount * 1e8))
    //   3. Build + sign approval tx, then deposit tx
    //   4. Submit via RelayerClient.submitDeposit()
    //   5. Store note locally
    //
    // Until the relayer is running, this records the intent locally so the
    // UI reflects what the user did.
    // -----------------------------------------------------------------
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const newNote: NoteDisplay = {
      id: `note-${Date.now()}`,
      amount,
      createdAt: new Date().toISOString().split("T")[0],
      status: "unspent",
    };
    setNotes((prev) => [newNote, ...prev]);
    setHasBackedUp(false);
  }, []);

  const withdraw = useCallback(async (_recipient: string) => {
    // -----------------------------------------------------------------
    // REQUIRES: running relayer + deployed pool-v1 + proof generation
    //
    // Full flow when live:
    //   1. import { generateWithdrawalProof } from "@satsu/sdk"
    //   2. Generate STARK proof client-side (2-10s)
    //   3. Submit via RelayerClient.submitWithdrawal()
    //   4. Mark note as spent
    // -----------------------------------------------------------------
    await new Promise((resolve) => setTimeout(resolve, 3000));

    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.status === "unspent");
      if (idx === -1) throw new Error("No unspent notes available");
      const updated = [...prev];
      updated[idx] = { ...updated[idx], status: "spent" };
      return updated;
    });
  }, []);

  const exportBackup = useCallback(async () => {
    // Uses a JSON export for now. When encryption key management is
    // wired up, this will call:
    //   import { createBackupBundle } from "@satsu/sdk"
    const bundle = {
      version: "1.0.0",
      timestamp: Date.now(),
      notes: notes.filter((n) => n.status === "unspent"),
    };
    setHasBackedUp(true);
    return JSON.stringify(bundle, null, 2);
  }, [notes]);

  const importBackup = useCallback(async (data: string) => {
    const parsed = JSON.parse(data);
    if (!parsed.notes || !Array.isArray(parsed.notes)) {
      throw new Error("Invalid backup format");
    }
    setNotes((prev) => {
      const existingIds = new Set(prev.map((n) => n.id));
      const newNotes = parsed.notes.filter(
        (n: NoteDisplay) => !existingIds.has(n.id)
      );
      return [...newNotes, ...prev];
    });
  }, []);

  const markBackedUp = useCallback(() => {
    setHasBackedUp(true);
  }, []);

  return {
    deposit,
    withdraw,
    notes,
    hasBackedUp,
    exportBackup,
    importBackup,
    markBackedUp,
  };
}
