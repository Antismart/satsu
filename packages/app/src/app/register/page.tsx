"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";

type RegistrationStep = "generate" | "register" | "link-bns" | "done";

const STEP_LABELS = ["Generate Stealth Keys", "Register Meta-Address", "Link BNS", "Complete"];

export default function RegisterPage() {
  const { isConnected, connect } = useWallet();
  const [step, setStep] = useState<RegistrationStep>("generate");
  const [metaAddress, setMetaAddress] = useState<string>("");
  const [bnsName, setBnsName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setIsProcessing(true);
    setError("");

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const mockMeta =
        "st:meta:02a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9002b1c2d3e4f50617283940a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f6";
      setMetaAddress(mockMeta);
      setStep("register");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate stealth keys"
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleRegister() {
    setIsProcessing(true);
    setError("");

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setStep("link-bns");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to register on-chain"
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleLinkBns() {
    if (!bnsName.trim()) {
      setStep("done");
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setStep("done");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to link BNS name"
      );
    } finally {
      setIsProcessing(false);
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(metaAddress).catch(() => {
      // Fallback: do nothing
    });
  }

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 py-28">
        <div className="max-w-md mx-auto text-center">
          <div className="h-16 w-16 rounded-2xl bg-[#F97C00]/10 flex items-center justify-center mx-auto mb-6">
            <svg
              className="h-8 w-8 text-[#F97C00]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3 text-white">
            Register
          </h1>
          <p className="text-white/50 mb-8 leading-relaxed">
            Connect your wallet to generate stealth keys and register your
            meta-address for receiving private payments.
          </p>
          <button
            onClick={connect}
            className="btn-accent h-12 px-8 text-sm"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  const steps: RegistrationStep[] = [
    "generate",
    "register",
    "link-bns",
    "done",
  ];
  const currentIdx = steps.indexOf(step);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10 sm:py-16">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2 text-white">
          Register Stealth Address
        </h1>
        <p className="text-base text-white/50 leading-relaxed">
          Generate your stealth keys and register your meta-address on-chain so
          others can send you private payments.
        </p>
      </div>

      {/* ================================================================
          STEP PROGRESS INDICATOR
          ================================================================ */}
      <div className="flex items-center gap-0 mb-12">
        {steps.map((s, i) => {
          const isCompleted = i < currentIdx;
          const isCurrent = i === currentIdx;

          return (
            <div
              key={s}
              className="flex items-center flex-1 last:flex-initial"
            >
              <div className="flex flex-col items-center">
                <div
                  className={`h-12 w-12 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                    isCompleted
                      ? "bg-[#4ADE80] text-white"
                      : isCurrent
                        ? "text-white shadow-[0_0_20px_rgba(249,124,0,0.35)] border-2 border-[#F97C00]/30"
                        : "border-2 border-white/[0.12] bg-white/[0.04] text-white/35"
                  }`}
                  style={isCurrent ? { background: "linear-gradient(135deg, #F97C00, #E84D00)" } : undefined}
                >
                  {isCompleted ? (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-[10px] font-semibold mt-2 whitespace-nowrap uppercase tracking-wider ${
                    isCurrent
                      ? "text-[#F97C00]"
                      : isCompleted
                        ? "text-[#4ADE80]"
                        : "text-white/25"
                  }`}
                >
                  {STEP_LABELS[i]}
                </span>
              </div>
              {i < 3 && (
                <div
                  className={`h-[1px] flex-1 mx-3 mt-[-18px] transition-colors duration-300 ${
                    isCompleted ? "bg-[#4ADE80]" : "bg-white/[0.08]"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-[#EF4444]/[0.06] border border-[#EF4444]/20">
          <svg
            className="h-5 w-5 text-[#EF4444] flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          <p className="text-sm text-[#EF4444]">{error}</p>
        </div>
      )}

      {/* Step: Generate stealth keys */}
      {step === "generate" && (
        <div className="glass-card p-8">
          <h2 className="text-xl font-semibold tracking-tight mb-3 text-white">
            Generate Stealth Keys
          </h2>
          <p className="text-sm text-white/50 mb-8 leading-relaxed">
            This will generate a spend key and a view key. The spend key
            controls your funds. The view key lets you detect incoming payments
            without exposing your spend key.
          </p>
          <button
            onClick={handleGenerate}
            disabled={isProcessing}
            className="w-full h-12 btn-accent text-sm"
          >
            {isProcessing ? (
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
                Generating...
              </span>
            ) : (
              "Generate Keys"
            )}
          </button>
        </div>
      )}

      {/* Step: Register on-chain */}
      {step === "register" && (
        <div className="glass-card p-8">
          <h2 className="text-xl font-semibold tracking-tight mb-3 text-white">
            Register On-Chain
          </h2>
          <p className="text-sm text-white/50 mb-6 leading-relaxed">
            Your stealth meta-address will be published on-chain so others can
            derive one-time addresses to send you private payments.
          </p>

          {/* Meta address display */}
          <div className="mb-8">
            <label className="block text-[10px] font-semibold text-white/35 uppercase tracking-widest mb-3">
              Your Stealth Meta-Address
            </label>
            <div className="flex gap-2">
              <div className="flex-1 h-12 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] overflow-hidden flex items-center">
                <p className="text-xs font-mono text-white/50 truncate">
                  {metaAddress}
                </p>
              </div>
              <button
                onClick={copyToClipboard}
                className="btn-glass h-12 px-6 text-sm font-semibold flex-shrink-0"
              >
                Copy
              </button>
            </div>
          </div>

          <button
            onClick={handleRegister}
            disabled={isProcessing}
            className="w-full h-12 btn-accent text-sm"
          >
            {isProcessing ? (
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
                Registering...
              </span>
            ) : (
              "Register Meta-Address"
            )}
          </button>
        </div>
      )}

      {/* Step: Link BNS */}
      {step === "link-bns" && (
        <div className="glass-card p-8">
          <h2 className="text-xl font-semibold tracking-tight mb-3 text-white">
            Link BNS Name
          </h2>
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-4">
            <span className="text-[10px] text-white/35 font-semibold uppercase tracking-widest">
              Optional
            </span>
          </div>
          <p className="text-sm text-white/50 mb-6 leading-relaxed">
            Link your .btc name so others can find your stealth address
            without needing the full meta-address key.
          </p>

          <div className="mb-8">
            <label
              htmlFor="bns-name"
              className="block text-[10px] font-semibold text-white/35 uppercase tracking-widest mb-3"
            >
              BNS Name
            </label>
            <input
              id="bns-name"
              type="text"
              value={bnsName}
              onChange={(e) => setBnsName(e.target.value)}
              placeholder="yourname.btc"
              className="w-full h-12 px-4 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white text-sm placeholder:text-white/25 focus:border-[#F97C00]/50 focus:ring-1 focus:ring-[#F97C00]/30 focus:outline-none transition-all duration-300"
            />
          </div>

          <button
            onClick={handleLinkBns}
            disabled={isProcessing}
            className="w-full h-12 btn-accent text-sm"
          >
            {isProcessing ? (
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
                Linking...
              </span>
            ) : bnsName.trim() ? (
              "Link BNS Name"
            ) : (
              "Skip"
            )}
          </button>
        </div>
      )}

      {/* Step: Done */}
      {step === "done" && (
        <div className="glass-card p-8">
          <div className="text-center mb-8">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#4ADE80] mb-5">
              <svg
                className="h-7 w-7 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-white">
              Registration Complete
            </h2>
            <p className="text-sm text-white/50 mt-2">
              Your stealth meta-address has been registered on-chain.
            </p>
          </div>

          {/* Address display */}
          <div className="mb-6">
            <label className="block text-[10px] font-semibold text-white/35 uppercase tracking-widest mb-3">
              Share this meta-address with anyone who wants to pay you privately
            </label>
            <div className="flex gap-2">
              <div className="flex-1 h-12 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] overflow-hidden flex items-center">
                <p className="text-xs font-mono text-white/50 truncate">
                  {metaAddress}
                </p>
              </div>
              <button
                onClick={copyToClipboard}
                className="btn-glass h-12 px-6 text-sm font-semibold flex-shrink-0"
              >
                Copy
              </button>
            </div>
          </div>

          {bnsName && (
            <div className="text-center py-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <p className="text-sm text-white/50">
                Linked to:{" "}
                <span className="text-white font-mono font-semibold">
                  {bnsName}
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
