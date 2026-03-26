"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useSatsu } from "@/hooks/useSatsu";

type WithdrawStatus =
  | "idle"
  | "generating-proof"
  | "submitting"
  | "success"
  | "error";

export function WithdrawForm() {
  const { isConnected } = useWallet();
  const { withdraw } = useSatsu();
  const [recipient, setRecipient] = useState("");
  const [status, setStatus] = useState<WithdrawStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleWithdraw() {
    if (!isConnected || !recipient.trim()) return;
    setStatus("generating-proof");
    setErrorMsg("");

    try {
      setStatus("submitting");
      await withdraw(recipient);
      setStatus("success");
      setRecipient("");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Withdrawal failed");
    }
  }

  function handlePaste() {
    navigator.clipboard.readText().then((text) => {
      setRecipient(text);
    }).catch(() => {
      // clipboard access denied
    });
  }

  const statusConfig: Record<
    WithdrawStatus,
    { label: string; color: string } | null
  > = {
    idle: null,
    "generating-proof": {
      label: "Generating zero-knowledge proof...",
      color: "text-primary",
    },
    submitting: {
      label: "Submitting withdrawal via relayer...",
      color: "text-primary",
    },
    success: {
      label: "Withdrawal submitted. Funds will arrive shortly.",
      color: "text-accent-green",
    },
    error: { label: errorMsg || "Withdrawal failed", color: "text-accent-red" },
  };

  return (
    <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-6 sm:p-8 transition-all duration-300 hover:border-white/[0.1]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-secondary/20 to-secondary/5 flex items-center justify-center">
          <svg
            className="h-5 w-5 text-secondary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 11l5-5m0 0l5 5m-5-5v12"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Withdraw sBTC
          </h2>
          <p className="text-xs text-muted-dim">Privately via relayer</p>
        </div>
      </div>

      <p className="text-sm text-muted mb-6 leading-relaxed">
        Withdraw funds to any address. A zero-knowledge proof is generated
        locally in your browser to preserve your privacy.
      </p>

      {/* Recipient input */}
      <div className="mb-6">
        <label
          htmlFor="recipient"
          className="block text-xs font-medium text-muted-dim uppercase tracking-wider mb-3"
        >
          Recipient Address
        </label>
        <div className="relative">
          <input
            id="recipient"
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="SP... or ST..."
            className="w-full px-4 py-3.5 pr-20 rounded-xl bg-white/[0.03] border border-white/[0.06] text-foreground text-sm font-mono placeholder:text-muted-dim/40 focus:outline-none focus:border-primary/50 focus:shadow-[0_0_20px_rgba(59,130,246,0.08)] transition-all duration-200"
          />
          <button
            onClick={handlePaste}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.06] text-xs text-muted hover:text-foreground hover:bg-white/[0.08] transition-all duration-200"
          >
            Paste
          </button>
        </div>
      </div>

      {/* Withdraw button */}
      <button
        onClick={handleWithdraw}
        disabled={
          !isConnected ||
          !recipient.trim() ||
          status === "generating-proof" ||
          status === "submitting"
        }
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-secondary to-primary disabled:from-secondary/30 disabled:to-primary/30 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all duration-300 hover:shadow-[0_0_30px_rgba(99,102,241,0.2)] hover:brightness-110 disabled:hover:shadow-none disabled:hover:brightness-100"
      >
        {status === "generating-proof" || status === "submitting" ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            {status === "generating-proof"
              ? "Generating Proof..."
              : "Submitting..."}
          </span>
        ) : (
          "Withdraw"
        )}
      </button>

      {/* Not connected notice */}
      {!isConnected && (
        <p className="text-xs text-muted-dim mt-4 text-center">
          Connect your wallet to withdraw.
        </p>
      )}

      {/* Status messages */}
      {statusConfig[status] && (
        <div
          className={`mt-4 flex items-center gap-2 text-sm ${statusConfig[status]!.color}`}
        >
          {status === "success" && (
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
          )}
          {status === "error" && (
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
          {statusConfig[status]!.label}
        </div>
      )}
    </div>
  );
}
