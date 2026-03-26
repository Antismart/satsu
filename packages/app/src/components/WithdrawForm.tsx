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
    navigator.clipboard
      .readText()
      .then((text) => {
        setRecipient(text);
      })
      .catch(() => {
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
      color: "text-[#0057FF]",
    },
    submitting: {
      label: "Submitting withdrawal via relayer...",
      color: "text-[#0057FF]",
    },
    success: {
      label: "Withdrawal submitted. Funds will arrive shortly.",
      color: "text-[#028901]",
    },
    error: {
      label: errorMsg || "Withdrawal failed",
      color: "text-[#D00D00]",
    },
  };

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-[0_5px_20px_rgba(0,0,0,0.08)] transition-all duration-300 hover:shadow-[0_5px_30px_rgba(0,0,0,0.12)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-full bg-[#0057FF]/[0.1] flex items-center justify-center">
          <svg
            className="h-5 w-5 text-[#0057FF]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 11l5-5m0 0l5 5m-5-5v12"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#191919]">
            Withdraw sBTC
          </h2>
          <p className="text-xs text-[#9CA3AF]">Privately via relayer</p>
        </div>
      </div>

      <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">
        Withdraw funds to any address. A zero-knowledge proof is generated
        locally in your browser to preserve your privacy.
      </p>

      {/* Recipient input */}
      <div className="mb-6">
        <label
          htmlFor="recipient"
          className="block text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-3"
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
            className="w-full h-12 px-4 pr-20 rounded-xl bg-white border border-[#CDCDCD] text-[#191919] text-sm placeholder:text-[#CDCDCD] focus:border-[#0057FF] focus:ring-1 focus:ring-[#0057FF] focus:outline-none transition-all duration-300"
          />
          <button
            onClick={handlePaste}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-4 rounded-full bg-[#F9F9F9] border border-[#E8E8E8] text-xs font-semibold text-[#6B7280] hover:text-[#191919] hover:border-[#0057FF] transition-all duration-300"
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
        className="w-full h-12 rounded-full bg-[#0057FF] disabled:bg-[#0057FF]/30 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-all duration-300 hover:bg-[#006ACB]"
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
        <p className="text-xs text-[#9CA3AF] mt-4 text-center">
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
