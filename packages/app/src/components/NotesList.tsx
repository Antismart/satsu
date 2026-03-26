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
      dot: "bg-[#22c55e]",
      badge:
        "bg-[#22c55e]/[0.08] text-[#22c55e] border border-[#22c55e]/20",
      label: "Active",
    },
    pending: {
      dot: "bg-[#f59e0b]",
      badge:
        "bg-[#f59e0b]/[0.08] text-[#f59e0b] border border-[#f59e0b]/20",
      label: "Pending",
    },
    spent: {
      dot: "bg-[#9ca3af]",
      badge: "bg-[#f9f9f9] text-[#9ca3af] border border-[#e8e8e8]",
      label: "Spent",
    },
  };

  return (
    <div className="bg-white rounded-2xl border border-[#e8e8e8] p-6 sm:p-8 shadow-sm transition-all duration-300 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#0057ff]/[0.08] flex items-center justify-center">
            <svg
              className="h-5 w-5 text-[#0057ff]"
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
            <h2 className="text-lg font-semibold tracking-tight text-[#191919]">
              Your Notes
            </h2>
            <p className="text-xs text-[#9ca3af]">
              {notes.length} note{notes.length !== 1 ? "s" : ""} total
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBackup(true)}
            className="px-5 py-2 rounded-full bg-white border border-[#e8e8e8] text-xs font-semibold text-[#191919] hover:brightness-95 transition-all duration-300"
          >
            Backup
          </button>
          <button
            onClick={() => setShowBackup(true)}
            className="px-5 py-2 rounded-full bg-white border border-[#e8e8e8] text-xs font-semibold text-[#191919] hover:brightness-95 transition-all duration-300"
          >
            Restore
          </button>
        </div>
      </div>

      {/* Backup warning */}
      {!hasBackedUp && notes.length > 0 && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-2xl bg-[#f59e0b]/[0.06] border border-[#f59e0b]/20">
          <svg
            className="h-5 w-5 text-[#f59e0b] flex-shrink-0 mt-0.5"
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
            <p className="text-sm text-[#f59e0b] font-medium">
              Notes not backed up
            </p>
            <p className="text-xs text-[#f59e0b]/70 mt-0.5">
              If you lose access to this browser, your funds cannot be
              recovered.
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {notes.length === 0 ? (
        <div className="py-16 text-center">
          <div className="h-12 w-12 rounded-full bg-[#f9f9f9] border border-[#e8e8e8] flex items-center justify-center mx-auto mb-4">
            <svg
              className="h-6 w-6 text-[#9ca3af]"
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
          <p className="text-[#6b7280] text-sm font-medium">No notes yet</p>
          <p className="text-[#9ca3af] text-xs mt-1">
            Make a deposit to create your first private note.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note, i) => {
            const style = statusStyles[note.status];
            return (
              <div
                key={note.id}
                className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border border-[#e8e8e8] transition-all duration-300 hover:shadow-sm ${
                  i % 2 === 0 ? "bg-white" : "bg-[#f9f9f9]"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                  <span className="text-sm font-mono font-semibold tabular-nums text-[#191919]">
                    {note.amount} sBTC
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-[#9ca3af] font-mono tabular-nums">
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
