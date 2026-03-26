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
    approving: { label: "Approving token transfer...", color: "text-[#0057ff]" },
    depositing: {
      label: "Submitting deposit to pool...",
      color: "text-[#0057ff]",
    },
    success: {
      label: "Deposit successful. Note saved locally.",
      color: "text-[#22c55e]",
    },
    error: { label: errorMsg || "Deposit failed", color: "text-[#ef4444]" },
  };

  return (
    <div className="bg-white rounded-2xl border border-[#e8e8e8] p-6 sm:p-8 shadow-sm transition-all duration-300 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-full bg-[#22c55e]/[0.1] flex items-center justify-center">
          <svg
            className="h-5 w-5 text-[#22c55e]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[#191919]">Deposit sBTC</h2>
          <p className="text-xs text-[#9ca3af]">Into the privacy pool</p>
        </div>
      </div>

      <p className="text-sm text-[#6b7280] mb-6 leading-relaxed">
        Select a fixed denomination to deposit. Your funds become part of the
        anonymity set, indistinguishable from all other deposits.
      </p>

      {/* Denomination selector */}
      <div className="mb-6">
        <label className="block text-xs font-medium text-[#9ca3af] uppercase tracking-wider mb-3">
          Amount
        </label>
        <div className="flex gap-3">
          {DENOMINATIONS.map((amount) => (
            <button
              key={amount}
              onClick={() => setSelectedAmount(amount)}
              className={`flex-1 py-3 rounded-full text-sm font-semibold border transition-all duration-300 ${
                selectedAmount === amount
                  ? "border-[#0057ff] bg-[#0057ff]/[0.06] text-[#0057ff]"
                  : "border-[#e8e8e8] bg-white text-[#6b7280] hover:border-[#0057ff]/30 hover:text-[#191919]"
              }`}
            >
              <span className="font-mono tabular-nums">{amount}</span>
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
        className="w-full py-3 rounded-full bg-[#0057ff] disabled:bg-[#0057ff]/30 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-all duration-300 hover:bg-[#0046cc] hover:brightness-110 disabled:hover:shadow-none disabled:hover:brightness-100"
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
        <p className="text-xs text-[#9ca3af] mt-4 text-center">
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
