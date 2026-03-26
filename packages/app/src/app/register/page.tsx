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
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-secondary/15 to-primary/10 flex items-center justify-center mx-auto mb-6">
            <svg
              className="h-8 w-8 text-secondary"
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
          <h1 className="text-3xl font-bold tracking-tight mb-3">Register</h1>
          <p className="text-muted mb-8 leading-relaxed">
            Connect your wallet to generate stealth keys and register your
            meta-address for receiving private payments.
          </p>
          <button
            onClick={connect}
            className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold text-sm transition-all duration-300 hover:shadow-[0_0_40px_rgba(59,130,246,0.25)] hover:brightness-110"
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
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
          Register Stealth Address
        </h1>
        <p className="text-muted leading-relaxed">
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
                  className={`h-10 w-10 rounded-xl flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                    isCompleted
                      ? "bg-accent-green/15 text-accent-green border border-accent-green/20"
                      : isCurrent
                        ? "bg-primary/15 text-primary border border-primary/30 shadow-[0_0_20px_rgba(59,130,246,0.15)]"
                        : "bg-white/[0.03] border border-white/[0.06] text-muted-dim"
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
                    isCurrent ? "text-foreground" : "text-muted-dim"
                  }`}
                >
                  {STEP_LABELS[i]}
                </span>
              </div>
              {i < 3 && (
                <div
                  className={`h-px flex-1 mx-3 mt-[-18px] transition-colors duration-300 ${
                    isCompleted ? "bg-accent-green/40" : "bg-white/[0.06]"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-accent-red/[0.06] border border-accent-red/20">
          <svg
            className="h-5 w-5 text-accent-red flex-shrink-0 mt-0.5"
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
          <p className="text-sm text-accent-red">{error}</p>
        </div>
      )}

      {/* Step: Generate stealth keys */}
      {step === "generate" && (
        <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-8">
          <h2 className="text-xl font-semibold tracking-tight mb-3">
            Generate Stealth Keys
          </h2>
          <p className="text-sm text-muted mb-8 leading-relaxed">
            This will generate a spend key and a view key. The spend key
            controls your funds. The view key lets you detect incoming payments
            without exposing your spend key.
          </p>
          <button
            onClick={handleGenerate}
            disabled={isProcessing}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-primary-hover disabled:from-primary/30 disabled:to-primary-hover/30 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)] hover:brightness-110 disabled:hover:shadow-none disabled:hover:brightness-100"
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
        <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-8">
          <h2 className="text-xl font-semibold tracking-tight mb-3">
            Register On-Chain
          </h2>
          <p className="text-sm text-muted mb-6 leading-relaxed">
            Your stealth meta-address will be published on-chain so others can
            derive one-time addresses to send you private payments.
          </p>

          {/* Meta address display */}
          <div className="mb-8">
            <label className="block text-xs font-medium text-muted-dim uppercase tracking-wider mb-3">
              Your Stealth Meta-Address
            </label>
            <div className="flex gap-2">
              <div className="flex-1 px-4 py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
                <p className="text-xs font-mono text-muted truncate">
                  {metaAddress}
                </p>
              </div>
              <button
                onClick={copyToClipboard}
                className="px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-muted hover:text-foreground hover:bg-white/[0.08] hover:border-white/[0.12] transition-all duration-200 flex-shrink-0"
              >
                Copy
              </button>
            </div>
          </div>

          <button
            onClick={handleRegister}
            disabled={isProcessing}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-primary-hover disabled:from-primary/30 disabled:to-primary-hover/30 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)] hover:brightness-110 disabled:hover:shadow-none disabled:hover:brightness-100"
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
        <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-8">
          <h2 className="text-xl font-semibold tracking-tight mb-3">
            Link BNS Name
          </h2>
          <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] mb-4">
            <span className="text-xs text-muted-dim font-medium">Optional</span>
          </div>
          <p className="text-sm text-muted mb-6 leading-relaxed">
            Link a BNS name to your stealth meta-address. This lets others look
            up your address by name instead of the full key.
          </p>

          <div className="mb-8">
            <label
              htmlFor="bns-name"
              className="block text-xs font-medium text-muted-dim uppercase tracking-wider mb-3"
            >
              BNS Name
            </label>
            <input
              id="bns-name"
              type="text"
              value={bnsName}
              onChange={(e) => setBnsName(e.target.value)}
              placeholder="yourname.btc"
              className="w-full px-4 py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-foreground text-sm font-mono placeholder:text-muted-dim/40 focus:outline-none focus:border-primary/50 focus:shadow-[0_0_20px_rgba(59,130,246,0.08)] transition-all duration-200"
            />
          </div>

          <button
            onClick={handleLinkBns}
            disabled={isProcessing}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-primary-hover disabled:from-primary/30 disabled:to-primary-hover/30 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)] hover:brightness-110 disabled:hover:shadow-none disabled:hover:brightness-100"
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
        <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-8">
          <div className="text-center mb-8">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-green/10 border border-accent-green/20 mb-5">
              <svg
                className="h-7 w-7 text-accent-green"
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
            <h2 className="text-xl font-semibold tracking-tight">
              Registration Complete
            </h2>
            <p className="text-sm text-muted mt-2">
              Your stealth meta-address has been registered on-chain.
            </p>
          </div>

          {/* Address display */}
          <div className="mb-6">
            <label className="block text-xs font-medium text-muted-dim uppercase tracking-wider mb-3">
              Share this address to receive private payments
            </label>
            <div className="flex gap-2">
              <div className="flex-1 px-4 py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
                <p className="text-xs font-mono text-muted truncate">
                  {metaAddress}
                </p>
              </div>
              <button
                onClick={copyToClipboard}
                className="px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-muted hover:text-foreground hover:bg-white/[0.08] hover:border-white/[0.12] transition-all duration-200 flex-shrink-0"
              >
                Copy
              </button>
            </div>
          </div>

          {bnsName && (
            <div className="text-center py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-sm text-muted">
                Linked to:{" "}
                <span className="text-foreground font-mono font-medium">
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
