"use client";

import { useState, useRef } from "react";
import { useSatsu } from "@/hooks/useSatsu";

interface BackupModalProps {
  onClose: () => void;
}

export function BackupModal({ onClose }: BackupModalProps) {
  const { exportBackup, importBackup } = useSatsu();
  const [tab, setTab] = useState<"backup" | "restore">("backup");
  const [restoreData, setRestoreData] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleBackup() {
    try {
      const data = await exportBackup();
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `satsu-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("success");
      setMessage("Backup downloaded successfully.");
    } catch {
      setStatus("error");
      setMessage("Failed to create backup.");
    }
  }

  async function handleRestore() {
    if (!restoreData.trim()) return;
    try {
      await importBackup(restoreData);
      setStatus("success");
      setMessage("Notes restored successfully.");
    } catch {
      setStatus("error");
      setMessage("Failed to restore notes. Check your backup file.");
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRestoreData(reader.result as string);
    };
    reader.readAsText(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl bg-card-solid/95 backdrop-blur-2xl border border-white/[0.08] p-8 shadow-[0_0_60px_rgba(0,0,0,0.5)]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 h-8 w-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-muted-dim hover:text-foreground hover:bg-white/[0.08] transition-all duration-200"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-8">
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
                d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold tracking-tight">
            Note Backup
          </h3>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.04] mb-8">
          <button
            onClick={() => {
              setTab("backup");
              setStatus("idle");
            }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              tab === "backup"
                ? "bg-white/[0.06] text-foreground shadow-sm"
                : "text-muted-dim hover:text-foreground"
            }`}
          >
            Backup
          </button>
          <button
            onClick={() => {
              setTab("restore");
              setStatus("idle");
            }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              tab === "restore"
                ? "bg-white/[0.06] text-foreground shadow-sm"
                : "text-muted-dim hover:text-foreground"
            }`}
          >
            Restore
          </button>
        </div>

        {/* Content */}
        {tab === "backup" ? (
          <div>
            <p className="text-sm text-muted mb-6 leading-relaxed">
              Download an encrypted backup of your notes. Store this file
              securely -- it is required to recover your funds.
            </p>
            <button
              onClick={handleBackup}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-semibold text-sm transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)] hover:brightness-110"
            >
              Download Backup
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted mb-6 leading-relaxed">
              Restore notes from a backup file. This will merge with any
              existing notes.
            </p>

            {/* File upload */}
            <div className="mb-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] text-sm text-muted hover:border-primary/30 hover:text-foreground hover:bg-white/[0.04] transition-all duration-200"
              >
                {restoreData ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="h-4 w-4 text-accent-green"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    File loaded
                  </span>
                ) : (
                  "Select backup file"
                )}
              </button>
            </div>

            {/* Textarea */}
            <textarea
              value={restoreData}
              onChange={(e) => setRestoreData(e.target.value)}
              placeholder="Or paste backup JSON here..."
              rows={4}
              className="w-full px-4 py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-foreground text-sm font-mono placeholder:text-muted-dim/40 focus:outline-none focus:border-primary/50 focus:shadow-[0_0_20px_rgba(59,130,246,0.08)] transition-all duration-200 resize-none mb-4"
            />

            {/* Restore button */}
            <button
              onClick={handleRestore}
              disabled={!restoreData.trim()}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-primary-hover disabled:from-primary/30 disabled:to-primary-hover/30 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)] hover:brightness-110 disabled:hover:shadow-none disabled:hover:brightness-100"
            >
              Restore Notes
            </button>
          </div>
        )}

        {/* Status */}
        {status !== "idle" && (
          <div
            className={`mt-5 flex items-center gap-2 text-sm ${
              status === "success" ? "text-accent-green" : "text-accent-red"
            }`}
          >
            {status === "success" ? (
              <svg
                className="h-4 w-4 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="h-4 w-4 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z"
                />
              </svg>
            )}
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
