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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - dark glass */}
      <div className="relative w-full sm:max-w-md glass-card p-5 sm:p-8 !rounded-t-2xl sm:!rounded-2xl max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 h-8 w-8 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-white/35 hover:text-white hover:border-white/[0.2] transition-all duration-300"
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
          <div className="h-10 w-10 rounded-full bg-[#F97C00]/10 flex items-center justify-center">
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
                d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold tracking-tight text-white">
            Note Backup
          </h3>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-8">
          <button
            onClick={() => {
              setTab("backup");
              setStatus("idle");
            }}
            className={`flex-1 h-10 rounded-full text-sm font-semibold transition-all duration-300 ${
              tab === "backup"
                ? "bg-white/[0.1] text-white border border-white/[0.1]"
                : "text-white/50 hover:text-white"
            }`}
          >
            Backup
          </button>
          <button
            onClick={() => {
              setTab("restore");
              setStatus("idle");
            }}
            className={`flex-1 h-10 rounded-full text-sm font-semibold transition-all duration-300 ${
              tab === "restore"
                ? "bg-white/[0.1] text-white border border-white/[0.1]"
                : "text-white/50 hover:text-white"
            }`}
          >
            Restore
          </button>
        </div>

        {/* Content */}
        {tab === "backup" ? (
          <div>
            <p className="text-sm text-white/50 mb-6 leading-relaxed">
              Download an encrypted backup of your notes. Store this file
              securely -- it is required to recover your funds.
            </p>
            <button
              onClick={handleBackup}
              className="w-full h-12 btn-accent text-sm"
            >
              Download Backup
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-white/50 mb-6 leading-relaxed">
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
                className="w-full h-14 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] text-sm text-white/50 hover:border-[#F97C00]/40 hover:text-white transition-all duration-300"
              >
                {restoreData ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="h-4 w-4 text-[#4ADE80]"
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
              className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white text-sm placeholder:text-white/25 focus:border-[#F97C00]/50 focus:ring-1 focus:ring-[#F97C00]/30 focus:outline-none transition-all duration-300 resize-none mb-4"
            />

            {/* Restore button */}
            <button
              onClick={handleRestore}
              disabled={!restoreData.trim()}
              className="w-full h-12 btn-accent text-sm"
            >
              Restore Notes
            </button>
          </div>
        )}

        {/* Status */}
        {status !== "idle" && (
          <div
            className={`mt-5 flex items-center gap-2 text-sm ${
              status === "success" ? "text-[#4ADE80]" : "text-[#EF4444]"
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
