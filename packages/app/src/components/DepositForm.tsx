"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useSatsu } from "@/hooks/useSatsu";

const DENOMINATIONS = [0.01, 0.1, 1.0];

type DepositStatus = "idle" | "approving" | "depositing" | "success" | "error";

export function DepositForm() {
  const { isConnected } = useWallet();
  const { deposit } = useSatsu();
  const [selectedAmount, setSelectedAmount] = useState<number>(
    DENOMINATIONS[0]
  );
  const [status, setStatus] = useState<DepositStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  async function handleDeposit() {
    if (!isConnected) return;
    setStatus("approving");
    setErrorMsg("");

    try {
      setStatus("depositing");
      await deposit(selectedAmount);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Deposit failed");
    }
  }

  const statusConfig: Record<
    DepositStatus,
    { label: string; color: string } | null
  > = {
    idle: null,
    approving: { label: "Approving token transfer...", color: "text-primary" },
    depositing: {
      label: "Submitting deposit to pool...",
      color: "text-primary",
    },
    success: {
      label: "Deposit successful. Note saved locally.",
      color: "text-accent-green",
    },
    error: { label: errorMsg || "Deposit failed", color: "text-red-400" },
  };

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-6">
      <h2 className="text-lg font-semibold mb-4">Deposit sBTC</h2>

      <p className="text-sm text-muted mb-4">
        Select a fixed denomination to deposit into the privacy pool. Your funds
        become part of the anonymity set.
      </p>

      <div className="flex gap-3 mb-6">
        {DENOMINATIONS.map((amount) => (
          <button
            key={amount}
            onClick={() => setSelectedAmount(amount)}
            className={`flex-1 py-3 rounded-lg text-sm font-medium border transition-colors ${
              selectedAmount === amount
                ? "border-primary bg-primary/10 text-primary"
                : "border-card-border text-muted hover:border-muted hover:text-foreground"
            }`}
          >
            {amount} sBTC
          </button>
        ))}
      </div>

      <button
        onClick={handleDeposit}
        disabled={!isConnected || status === "depositing" || status === "approving"}
        className="w-full py-3 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
      >
        {status === "approving" || status === "depositing"
          ? "Processing..."
          : `Deposit ${selectedAmount} sBTC`}
      </button>

      {!isConnected && (
        <p className="text-xs text-muted mt-3">
          Connect your wallet to make a deposit.
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
