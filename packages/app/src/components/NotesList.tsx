"use client";

import { useState } from "react";
import { useSatsu } from "@/hooks/useSatsu";
import { BackupModal } from "./BackupModal";

export interface NoteDisplay {
  id: string;
  amount: number;
  createdAt: string;
  status: "unspent" | "spent" | "pending";
}

export function NotesList() {
  const { notes, hasBackedUp } = useSatsu();
  const [showBackup, setShowBackup] = useState(false);

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Your Notes</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBackup(true)}
            className="px-3 py-1.5 rounded-lg border border-card-border text-sm text-muted hover:text-foreground hover:border-muted transition-colors"
          >
            Backup Notes
          </button>
          <button
            onClick={() => setShowBackup(true)}
            className="px-3 py-1.5 rounded-lg border border-card-border text-sm text-muted hover:text-foreground hover:border-muted transition-colors"
          >
            Restore Notes
          </button>
        </div>
      </div>

      {!hasBackedUp && notes.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-accent-amber/10 border border-accent-amber/30">
          <p className="text-sm text-accent-amber font-medium">
            Warning: Your notes have not been backed up. If you lose access to
            this browser, your funds cannot be recovered.
          </p>
        </div>
      )}

      {notes.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted text-sm">No notes yet.</p>
          <p className="text-muted/60 text-xs mt-1">
            Make a deposit to create your first private note.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="flex items-center justify-between px-4 py-3 rounded-lg bg-background/50 border border-card-border/50"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`h-2 w-2 rounded-full ${
                    note.status === "unspent"
                      ? "bg-accent-green"
                      : note.status === "pending"
                        ? "bg-accent-amber"
                        : "bg-muted"
                  }`}
                />
                <span className="text-sm font-mono">
                  {note.amount} sBTC
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted">{note.createdAt}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    note.status === "unspent"
                      ? "bg-accent-green/10 text-accent-green"
                      : note.status === "pending"
                        ? "bg-accent-amber/10 text-accent-amber"
                        : "bg-muted/10 text-muted"
                  }`}
                >
                  {note.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showBackup && <BackupModal onClose={() => setShowBackup(false)} />}
    </div>
  );
}
