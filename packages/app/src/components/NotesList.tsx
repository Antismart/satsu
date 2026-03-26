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

  const statusStyles: Record<
    NoteDisplay["status"],
    { dot: string; badge: string; label: string }
  > = {
    unspent: {
      dot: "bg-accent-green",
      badge:
        "bg-accent-green/10 text-accent-green border border-accent-green/20",
      label: "unspent",
    },
    pending: {
      dot: "bg-accent-amber",
      badge:
        "bg-accent-amber/10 text-accent-amber border border-accent-amber/20",
      label: "pending",
    },
    spent: {
      dot: "bg-muted-dim",
      badge: "bg-white/[0.04] text-muted-dim border border-white/[0.06]",
      label: "spent",
    },
  };

  return (
    <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-6 sm:p-8 transition-all duration-300 hover:border-white/[0.1]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-secondary/10 flex items-center justify-center">
            <svg
              className="h-5 w-5 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Your Notes
            </h2>
            <p className="text-xs text-muted-dim">
              {notes.length} note{notes.length !== 1 ? "s" : ""} total
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBackup(true)}
            className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-medium text-muted hover:text-foreground hover:border-white/[0.12] transition-all duration-200"
          >
            Backup
          </button>
          <button
            onClick={() => setShowBackup(true)}
            className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-medium text-muted hover:text-foreground hover:border-white/[0.12] transition-all duration-200"
          >
            Restore
          </button>
        </div>
      </div>

      {/* Backup warning */}
      {!hasBackedUp && notes.length > 0 && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-accent-amber/[0.06] border border-accent-amber/20">
          <svg
            className="h-5 w-5 text-accent-amber flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <div>
            <p className="text-sm text-accent-amber font-medium">
              Notes not backed up
            </p>
            <p className="text-xs text-accent-amber/70 mt-0.5">
              If you lose access to this browser, your funds cannot be
              recovered.
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {notes.length === 0 ? (
        <div className="py-16 text-center">
          <div className="h-12 w-12 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
            <svg
              className="h-6 w-6 text-muted-dim"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          </div>
          <p className="text-muted text-sm font-medium">No notes yet</p>
          <p className="text-muted-dim text-xs mt-1">
            Make a deposit to create your first private note.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => {
            const style = statusStyles[note.status];
            return (
              <div
                key={note.id}
                className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-200"
              >
                <div className="flex items-center gap-3.5">
                  <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                  <span className="text-sm font-mono font-semibold tabular-nums">
                    {note.amount} sBTC
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-dim font-mono tabular-nums">
                    {note.createdAt}
                  </span>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${style.badge}`}
                  >
                    {style.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showBackup && <BackupModal onClose={() => setShowBackup(false)} />}
    </div>
  );
}
