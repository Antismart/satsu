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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-xl border border-card-border bg-card-bg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Note Backup</h3>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground transition-colors text-lg leading-none"
          >
            x
          </button>
        </div>

        <div className="flex gap-1 p-1 rounded-lg bg-background mb-6">
          <button
            onClick={() => {
              setTab("backup");
              setStatus("idle");
            }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "backup"
                ? "bg-card-bg text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            Backup
          </button>
          <button
            onClick={() => {
              setTab("restore");
              setStatus("idle");
            }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "restore"
                ? "bg-card-bg text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            Restore
          </button>
        </div>

        {tab === "backup" ? (
          <div>
            <p className="text-sm text-muted mb-4">
              Download an encrypted backup of your notes. Store this file
              securely -- it is required to recover your funds.
            </p>
            <button
              onClick={handleBackup}
              className="w-full py-3 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-sm transition-colors"
            >
              Download Backup
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted mb-4">
              Restore notes from a backup file. This will merge with any
              existing notes.
            </p>

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
                className="w-full py-3 rounded-lg border border-dashed border-card-border text-sm text-muted hover:border-muted hover:text-foreground transition-colors"
              >
                {restoreData ? "File loaded" : "Select backup file"}
              </button>
            </div>

            <textarea
              value={restoreData}
              onChange={(e) => setRestoreData(e.target.value)}
              placeholder="Or paste backup JSON here..."
              rows={4}
              className="w-full px-4 py-3 rounded-lg bg-background border border-card-border text-foreground text-sm font-mono placeholder:text-muted/50 focus:outline-none focus:border-primary transition-colors resize-none mb-4"
            />

            <button
              onClick={handleRestore}
              disabled={!restoreData.trim()}
              className="w-full py-3 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
            >
              Restore Notes
            </button>
          </div>
        )}

        {status !== "idle" && (
          <div
            className={`mt-4 text-sm ${
              status === "success" ? "text-accent-green" : "text-red-400"
            }`}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
