"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";

type RegistrationStep = "generate" | "register" | "link-bns" | "done";

const STEP_LABELS = ["Generate Keys", "Register", "Link BNS", "Complete"];

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
      // TODO: integrate with @satsu/sdk generateStealthKeys() + encodeMetaAddress()
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
      // TODO: integrate with @satsu/sdk to register meta-address on-chain
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
      // TODO: integrate with BNS name linking
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
          <div className="h-16 w-16 rounded-2xl bg-[#0057ff]/[0.08] flex items-center justify-center mx-auto mb-6">
            <svg
              className="h-8 w-8 text-[#0057ff]"
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
          <h1 className="text-3xl font-bold tracking-tight mb-3 text-[#191919]">Register</h1>
          <p className="text-[#6b7280] mb-8 leading-relaxed">
            Connect your wallet to generate stealth keys and register your
            meta-address for receiving private payments.
          </p>
          <button
            onClick={connect}
            className="px-8 py-3 rounded-full bg-[#0057ff] text-white font-semibold text-sm shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-all duration-300 hover:bg-[#0046cc] hover:brightness-110"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  const steps: RegistrationStep[] = ["generate", "register", "link-bns", "done"];
  const currentIdx = steps.indexOf(step);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10 sm:py-16">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 text-[#191919]">
          Register Stealth Address
        </h1>
        <p className="text-[#6b7280] leading-relaxed">
          Generate your stealth keys and register your meta-address on-chain so
          others can send you private payments.
        </p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-0 mb-12">
        {steps.map((s, i) => {
          const isCompleted = i < currentIdx;
          const isCurrent = i === currentIdx;

          return (
            <div key={s} className="flex items-center flex-1 last:flex-initial">
              <div className="flex flex-col items-center">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                    isCompleted
                      ? "bg-[#22c55e]/[0.1] text-[#22c55e] border border-[#22c55e]/20"
                      : isCurrent
                        ? "bg-[#0057ff] text-white shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
                        : "bg-[#f9f9f9] border border-[#e8e8e8] text-[#9ca3af]"
                  }`}
                >
                  {isCompleted ? (
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
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium mt-2 whitespace-nowrap ${
                    isCurrent ? "text-[#191919]" : "text-[#9ca3af]"
                  }`}
                >
                  {STEP_LABELS[i]}
                </span>
              </div>
              {i < 3 && (
                <div
                  className={`h-px flex-1 mx-3 mt-[-18px] transition-colors duration-300 ${
                    isCompleted ? "bg-[#22c55e]/40" : "bg-[#e8e8e8]"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-2xl bg-[#ef4444]/[0.06] border border-[#ef4444]/20">
          <svg
            className="h-5 w-5 text-[#ef4444] flex-shrink-0 mt-0.5"
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
          <p className="text-sm text-[#ef4444]">{error}</p>
        </div>
      )}

      {/* Step: Generate stealth keys */}
      {step === "generate" && (
        <div className="bg-white rounded-2xl border border-[#e8e8e8] p-8 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight mb-3 text-[#191919]">
            Generate Stealth Keys
          </h2>
          <p className="text-sm text-[#6b7280] mb-8 leading-relaxed">
            This will generate a spend key and a view key. The spend key
            controls your funds. The view key lets you detect incoming payments
            without exposing your spend key.
          </p>
          <button
            onClick={handleGenerate}
            disabled={isProcessing}
            className="w-full py-3 rounded-full bg-[#0057ff] disabled:bg-[#0057ff]/30 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-all duration-300 hover:bg-[#0046cc] hover:brightness-110 disabled:hover:shadow-none disabled:hover:brightness-100"
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
        <div className="bg-white rounded-2xl border border-[#e8e8e8] p-8 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight mb-3 text-[#191919]">
            Register On-Chain
          </h2>
          <p className="text-sm text-[#6b7280] mb-6 leading-relaxed">
            Your stealth meta-address will be published on-chain so others can
            derive one-time addresses to send you private payments.
          </p>

          {/* Meta address display */}
          <div className="mb-8">
            <label className="block text-xs font-medium text-[#9ca3af] uppercase tracking-wider mb-3">
              Your Stealth Meta-Address
            </label>
            <div className="flex gap-2">
              <div className="flex-1 px-4 py-3 rounded-2xl bg-[#f9f9f9] border border-[#e8e8e8] overflow-hidden">
                <p className="text-xs font-mono text-[#6b7280] truncate">
                  {metaAddress}
                </p>
              </div>
              <button
                onClick={copyToClipboard}
                className="px-5 py-2 rounded-full bg-white border border-[#e8e8e8] text-sm font-semibold text-[#191919] hover:brightness-95 transition-all duration-300 flex-shrink-0"
              >
                Copy
              </button>
            </div>
          </div>

          <button
            onClick={handleRegister}
            disabled={isProcessing}
            className="w-full py-3 rounded-full bg-[#0057ff] disabled:bg-[#0057ff]/30 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-all duration-300 hover:bg-[#0046cc] hover:brightness-110 disabled:hover:shadow-none disabled:hover:brightness-100"
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
        <div className="bg-white rounded-2xl border border-[#e8e8e8] p-8 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight mb-3 text-[#191919]">
            Link BNS Name
          </h2>
          <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#f9f9f9] border border-[#e8e8e8] mb-4">
            <span className="text-xs text-[#9ca3af] font-medium">Optional</span>
          </div>
          <p className="text-sm text-[#6b7280] mb-6 leading-relaxed">
            Link a BNS name to your stealth meta-address. This lets others look
            up your address by name instead of the full key.
          </p>

          <div className="mb-8">
            <label
              htmlFor="bns-name"
              className="block text-xs font-medium text-[#9ca3af] uppercase tracking-wider mb-3"
            >
              BNS Name
            </label>
            <input
              id="bns-name"
              type="text"
              value={bnsName}
              onChange={(e) => setBnsName(e.target.value)}
              placeholder="yourname.btc"
              className="w-full px-4 py-3 rounded-2xl bg-white border border-[#e8e8e8] text-[#191919] text-sm font-mono placeholder:text-[#9ca3af] focus:outline-1 focus:outline-[#0057ff] focus:outline-offset-2 transition-all duration-300"
            />
          </div>

          <button
            onClick={handleLinkBns}
            disabled={isProcessing}
            className="w-full py-3 rounded-full bg-[#0057ff] disabled:bg-[#0057ff]/30 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-all duration-300 hover:bg-[#0046cc] hover:brightness-110 disabled:hover:shadow-none disabled:hover:brightness-100"
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
        <div className="bg-white rounded-2xl border border-[#e8e8e8] p-8 shadow-sm">
          <div className="text-center mb-8">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#22c55e]/[0.1] border border-[#22c55e]/20 mb-5">
              <svg
                className="h-7 w-7 text-[#22c55e]"
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
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-[#191919]">
              Registration Complete
            </h2>
            <p className="text-sm text-[#6b7280] mt-2">
              Your stealth meta-address has been registered on-chain.
            </p>
          </div>

          {/* Address display */}
          <div className="mb-6">
            <label className="block text-xs font-medium text-[#9ca3af] uppercase tracking-wider mb-3">
              Share this address to receive private payments
            </label>
            <div className="flex gap-2">
              <div className="flex-1 px-4 py-3 rounded-2xl bg-[#f9f9f9] border border-[#e8e8e8] overflow-hidden">
                <p className="text-xs font-mono text-[#6b7280] truncate">
                  {metaAddress}
                </p>
              </div>
              <button
                onClick={copyToClipboard}
                className="px-5 py-2 rounded-full bg-white border border-[#e8e8e8] text-sm font-semibold text-[#191919] hover:brightness-95 transition-all duration-300 flex-shrink-0"
              >
                Copy
              </button>
            </div>
          </div>

          {bnsName && (
            <div className="text-center py-3 rounded-2xl bg-[#f9f9f9] border border-[#e8e8e8]">
              <p className="text-sm text-[#6b7280]">
                Linked to:{" "}
                <span className="text-[#191919] font-mono font-medium">
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
