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

const CATEGORY_LABELS: Record<string, string> = {
  "note-001": "Shielded Deposit",
  "note-002": "Shielded Deposit",
  "note-003": "Shielded Deposit",
};

export function NotesList() {
  const { notes, hasBackedUp } = useSatsu();
  const [showBackup, setShowBackup] = useState(false);

  const statusStyles: Record<
    NoteDisplay["status"],
    { badge: string; label: string }
  > = {
    unspent: {
      badge: "bg-[#4ADE80]/10 text-[#4ADE80] border border-[#4ADE80]/20",
      label: "Active",
    },
    pending: {
      badge: "bg-[#F97C00]/10 text-[#F97C00] border border-[#F97C00]/20",
      label: "Pending",
    },
    spent: {
      badge: "bg-white/[0.04] text-white/35 border border-white/[0.08]",
      label: "Spent",
    },
  };

  const iconColors: Record<NoteDisplay["status"], string> = {
    unspent: "bg-[#4ADE80]/10 text-[#4ADE80]",
    pending: "bg-[#F97C00]/10 text-[#F97C00]",
    spent: "bg-white/[0.04] text-white/35",
  };

  return (
    <div className="glass-card p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#F97C00]/10 flex items-center justify-center flex-shrink-0">
            <svg
              className="h-5 w-5 text-[#F97C00]"
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
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-white">
              Deposit Notes
            </h2>
            <p className="text-xs text-white/35">
              {notes.length} note{notes.length !== 1 ? "s" : ""} total
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBackup(true)}
            className="btn-glass h-8 px-4 sm:px-5 text-xs font-semibold"
          >
            Backup
          </button>
          <button
            onClick={() => setShowBackup(true)}
            className="btn-glass h-8 px-4 sm:px-5 text-xs font-semibold"
          >
            Restore
          </button>
        </div>
      </div>

      {/* Backup warning */}
      {!hasBackedUp && notes.length > 0 && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-[#F97C00]/[0.06] border border-[#F97C00]/20">
          <svg
            className="h-5 w-5 text-[#F97C00] flex-shrink-0 mt-0.5"
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
            <p className="text-sm text-[#F97C00] font-semibold">
              Notes not backed up
            </p>
            <p className="text-xs text-[#F97C00]/60 mt-0.5">
              If you lose access to this browser, your funds cannot be
              recovered.
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {notes.length === 0 ? (
        <div className="py-16 text-center">
          <div className="h-12 w-12 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-4">
            <svg
              className="h-6 w-6 text-white/25"
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
          <p className="text-white/50 text-sm font-semibold">No notes yet</p>
          <p className="text-white/25 text-xs mt-1">
            Make a deposit to create your first private note.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.06]">
          {notes.map((note) => {
            const style = statusStyles[note.status];
            const iconColor = iconColors[note.status];
            const category = CATEGORY_LABELS[note.id] || "Deposit Note";
            return (
              <div
                key={note.id}
                className="flex items-center justify-between py-4 first:pt-0 last:pb-0 group gap-2"
              >
                <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                  {/* Transaction icon circle */}
                  <div
                    className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconColor}`}
                  >
                    <svg
                      className="h-5 w-5"
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
                    <span className="text-sm font-semibold tabular-nums text-white">
                      {note.amount} sBTC
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-medium text-white/25 uppercase tracking-wider">
                        {category}
                      </span>
                      <span className="text-white/10">|</span>
                      <span className="text-[10px] text-white/25">
                        via relayer
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                  <span className="text-xs text-white/35 tabular-nums hidden sm:block">
                    {note.createdAt}
                  </span>
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-semibold ${style.badge}`}
                  >
                    {style.label}
                  </span>
                  {/* Three-dot menu - always visible */}
                  <button className="text-white/30 hover:text-white/70 transition-colors p-1 rounded-lg hover:bg-white/[0.06]">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
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
