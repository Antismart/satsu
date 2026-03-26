"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useSatsu } from "@/hooks/useSatsu";

type WithdrawStatus = "idle" | "generating-proof" | "submitting" | "success" | "error";

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
    error: { label: errorMsg || "Withdrawal failed", color: "text-red-400" },
  };

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-6">
      <h2 className="text-lg font-semibold mb-4">Withdraw sBTC</h2>

      <p className="text-sm text-muted mb-4">
        Withdraw funds to a recipient address. A zero-knowledge proof is
        generated locally to preserve your privacy.
      </p>

      <div className="mb-4">
        <label
          htmlFor="recipient"
          className="block text-sm font-medium text-muted mb-2"
        >
          Recipient Address
        </label>
        <input
          id="recipient"
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="SP... or ST..."
          className="w-full px-4 py-3 rounded-lg bg-background border border-card-border text-foreground text-sm font-mono placeholder:text-muted/50 focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      <button
        onClick={handleWithdraw}
        disabled={
          !isConnected ||
          !recipient.trim() ||
          status === "generating-proof" ||
          status === "submitting"
        }
        className="w-full py-3 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
      >
        {status === "generating-proof" || status === "submitting"
          ? "Processing..."
          : "Withdraw"}
      </button>

      {!isConnected && (
        <p className="text-xs text-muted mt-3">
          Connect your wallet to withdraw.
        </p>
      )}

      {statusConfig[status] && (
        <div className={`mt-4 text-sm ${statusConfig[status]!.color}`}>
          {statusConfig[status]!.label}
        </div>
      )}
    </div>
  );
}
