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
    approving: { label: "Approving token transfer...", color: "text-[#F97C00]" },
    depositing: {
      label: "Submitting deposit to pool...",
      color: "text-[#F97C00]",
    },
    success: {
      label: "Deposit successful. Note saved locally.",
      color: "text-[#4ADE80]",
    },
    error: { label: errorMsg || "Deposit failed", color: "text-[#EF4444]" },
  };

  return (
    <div className="glass-card p-6 sm:p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-full bg-[#4ADE80]/10 flex items-center justify-center">
          <svg
            className="h-5 w-5 text-[#4ADE80]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white">
            Deposit sBTC
          </h2>
          <p className="text-xs text-white/35">Into the shielded pool</p>
        </div>
      </div>

      <p className="text-sm text-white/50 mb-6 leading-relaxed">
        Select a fixed denomination to deposit. Your funds become part of the
        anonymity set, indistinguishable from all other deposits.
      </p>

      {/* Denomination selector */}
      <div className="mb-6">
        <label className="block text-[10px] font-semibold text-white/35 uppercase tracking-widest mb-3">
          Amount
        </label>
        <div className="flex gap-4">
          {DENOMINATIONS.map((amount) => (
            <button
              key={amount}
              onClick={() => setSelectedAmount(amount)}
              className={`flex-1 h-12 rounded-full text-sm font-semibold border transition-all duration-300 ${
                selectedAmount === amount
                  ? "border-[#F97C00] bg-[#F97C00]/10 text-[#F97C00] shadow-[0_0_12px_rgba(249,124,0,0.15)]"
                  : "border-white/[0.1] bg-white/[0.04] text-white/60 hover:border-[#F97C00]/50 hover:text-white"
              }`}
            >
              <span className="tabular-nums">{amount}</span>
              <span className="ml-1 text-xs opacity-70">sBTC</span>
            </button>
          ))}
        </div>
      </div>

      {/* Deposit button */}
      <button
        onClick={handleDeposit}
        disabled={
          !isConnected || status === "depositing" || status === "approving"
        }
        className="w-full h-12 btn-accent text-sm"
      >
        {status === "approving" || status === "depositing" ? (
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
            Processing...
          </span>
        ) : (
          `Deposit ${selectedAmount} sBTC`
        )}
      </button>

      {/* Not connected notice */}
      {!isConnected && (
        <p className="text-xs text-white/35 mt-4 text-center">
          Connect your wallet to make a deposit.
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
