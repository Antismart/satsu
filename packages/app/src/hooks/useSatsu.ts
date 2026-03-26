"use client";

import { useState, useCallback } from "react";
import type { NoteDisplay } from "@/components/NotesList";

// ---------------------------------------------------------------------------
// Placeholder SDK integration
//
// Once the SDK is built and published we will import from "@satsu/sdk".
// For now the hook provides the correct interface with mock implementations
// so the UI compiles and runs immediately.
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

// Placeholder notes for demo / development
const PLACEHOLDER_NOTES: NoteDisplay[] = [
  {
    id: "note-001",
    amount: 0.1,
    createdAt: "2026-03-24",
    status: "unspent",
  },
  {
    id: "note-002",
    amount: 0.01,
    createdAt: "2026-03-22",
    status: "unspent",
  },
  {
    id: "note-003",
    amount: 1.0,
    createdAt: "2026-03-20",
    status: "spent",
  },
];

export function useSatsu(): SatsuHook {
  const [notes, setNotes] = useState<NoteDisplay[]>(PLACEHOLDER_NOTES);
  const [hasBackedUp, setHasBackedUp] = useState(false);

  const deposit = useCallback(
    async (amount: number) => {
      // TODO: integrate with @satsu/sdk submitDeposit()
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const newNote: NoteDisplay = {
        id: `note-${Date.now()}`,
        amount,
        createdAt: new Date().toISOString().split("T")[0],
        status: "unspent",
      };
      setNotes((prev) => [newNote, ...prev]);
      setHasBackedUp(false);
    },
    []
  );

  const withdraw = useCallback(
    async (_recipient: string) => {
      // TODO: integrate with @satsu/sdk submitWithdrawal()
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Mark the first unspent note as spent
      setNotes((prev) => {
        const idx = prev.findIndex((n) => n.status === "unspent");
        if (idx === -1) throw new Error("No unspent notes available");
        const updated = [...prev];
        updated[idx] = { ...updated[idx], status: "spent" };
        return updated;
      });
    },
    []
  );

  const exportBackup = useCallback(async () => {
    // TODO: integrate with @satsu/sdk createBackupBundle()
    const bundle = {
      version: "1.0.0",
      timestamp: Date.now(),
      notes: notes.filter((n) => n.status === "unspent"),
    };
    setHasBackedUp(true);
    return JSON.stringify(bundle, null, 2);
  }, [notes]);

  const importBackup = useCallback(async (data: string) => {
    // TODO: integrate with @satsu/sdk parseBackupBundle()
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
