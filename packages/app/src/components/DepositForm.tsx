"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useSatsu } from "@/hooks/useSatsu";

type DepositStatus = "idle" | "approving" | "depositing" | "success" | "error";

export function DepositForm() {
  const { isConnected } = useWallet();
  const { deposit } = useSatsu();
  const [amount, setAmount] = useState<string>("");
  const [status, setStatus] = useState<DepositStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const parsedAmount = parseFloat(amount);
  const isValidAmount = !isNaN(parsedAmount) && parsedAmount > 0;

  async function handleDeposit() {
    if (!isConnected || !isValidAmount) return;
    setStatus("approving");
    setErrorMsg("");

    try {
      setStatus("depositing");
      await deposit(parsedAmount);
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
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
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
          <h2 className="text-lg font-semibold tracking-tight text-white">
            Deposit sBTC
          </h2>
          <p className="text-xs text-white/35">Into the shielded pool</p>
        </div>
      </div>

      <p className="text-sm text-white/50 mb-5 leading-relaxed">
        Enter the amount of sBTC to deposit. Your funds join the anonymity set,
        indistinguishable from all other deposits.
      </p>

      {/* Amount input */}
      <div className="mb-6">
        <label
          htmlFor="deposit-amount"
          className="block text-[10px] font-semibold text-white/35 uppercase tracking-widest mb-3"
        >
          Amount (sBTC)
        </label>
        <div className="relative">
          <input
            id="deposit-amount"
            type="number"
            step="0.001"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full h-14 px-5 pr-20 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white text-2xl font-bold tabular-nums placeholder:text-white/15 focus:border-[#F97C00]/50 focus:ring-1 focus:ring-[#F97C00]/30 focus:outline-none transition-all duration-300"
          />
          <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-semibold text-white/30">
            sBTC
          </span>
        </div>
        {/* Quick amount buttons */}
        <div className="flex gap-2 mt-3">
          {[0.01, 0.05, 0.1, 0.5, 1.0].map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(String(preset))}
              className={`flex-1 h-8 rounded-full text-xs font-semibold border transition-all duration-300 ${
                amount === String(preset)
                  ? "border-[#F97C00]/50 bg-[#F97C00]/10 text-[#F97C00]"
                  : "border-white/[0.08] bg-white/[0.02] text-white/40 hover:border-white/15 hover:text-white/60"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Deposit button */}
      <button
        onClick={handleDeposit}
        disabled={
          !isConnected || !isValidAmount || status === "depositing" || status === "approving"
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
          `Deposit${isValidAmount ? ` ${parsedAmount} sBTC` : ""}`
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
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {status === "error" && (
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
            </svg>
          )}
          {statusConfig[status]!.label}
        </div>
      )}
    </div>
  );
}
