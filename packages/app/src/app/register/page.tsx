"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";

type RegistrationStep = "generate" | "register" | "link-bns" | "done";

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

      // Placeholder meta-address
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
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Register</h1>
          <p className="text-muted mb-8">
            Connect your wallet to generate stealth keys and register your
            meta-address for receiving private payments.
          </p>
          <button
            onClick={connect}
            className="px-6 py-3 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-sm transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-bold mb-2">Register Stealth Address</h1>
      <p className="text-muted mb-8">
        Generate your stealth keys and register your meta-address on-chain so
        others can send you private payments.
      </p>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-10">
        {(["generate", "register", "link-bns", "done"] as const).map(
          (s, i) => {
            const steps: RegistrationStep[] = [
              "generate",
              "register",
              "link-bns",
              "done",
            ];
            const currentIdx = steps.indexOf(step);
            const isCompleted = i < currentIdx;
            const isCurrent = i === currentIdx;

            return (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                    isCompleted
                      ? "bg-accent-green text-white"
                      : isCurrent
                        ? "bg-primary text-white"
                        : "bg-card-bg border border-card-border text-muted"
                  }`}
                >
                  {isCompleted ? "ok" : i + 1}
                </div>
                {i < 3 && (
                  <div
                    className={`h-px flex-1 ${
                      isCompleted ? "bg-accent-green" : "bg-card-border"
                    }`}
                  />
                )}
              </div>
            );
          }
        )}
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-400/10 border border-red-400/30">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Step: Generate stealth keys */}
      {step === "generate" && (
        <div className="rounded-xl border border-card-border bg-card-bg p-6">
          <h2 className="text-lg font-semibold mb-2">
            Step 1: Generate Stealth Keys
          </h2>
          <p className="text-sm text-muted mb-6">
            This will generate a spend key and a view key. The spend key
            controls your funds. The view key lets you detect incoming payments
            without exposing your spend key.
          </p>
          <button
            onClick={handleGenerate}
            disabled={isProcessing}
            className="w-full py-3 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
          >
            {isProcessing ? "Generating..." : "Generate Keys"}
          </button>
        </div>
      )}

      {/* Step: Register on-chain */}
      {step === "register" && (
        <div className="rounded-xl border border-card-border bg-card-bg p-6">
          <h2 className="text-lg font-semibold mb-2">
            Step 2: Register On-Chain
          </h2>
          <p className="text-sm text-muted mb-4">
            Your stealth meta-address will be published on-chain so others can
            derive one-time addresses to send you private payments.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-muted mb-2">
              Your Stealth Meta-Address
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={metaAddress}
                className="flex-1 px-4 py-3 rounded-lg bg-background border border-card-border text-foreground text-xs font-mono focus:outline-none"
              />
              <button
                onClick={copyToClipboard}
                className="px-4 py-3 rounded-lg border border-card-border text-sm text-muted hover:text-foreground hover:border-muted transition-colors flex-shrink-0"
              >
                Copy
              </button>
            </div>
          </div>

          <button
            onClick={handleRegister}
            disabled={isProcessing}
            className="w-full py-3 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
          >
            {isProcessing ? "Registering..." : "Register Meta-Address"}
          </button>
        </div>
      )}

      {/* Step: Link BNS */}
      {step === "link-bns" && (
        <div className="rounded-xl border border-card-border bg-card-bg p-6">
          <h2 className="text-lg font-semibold mb-2">
            Step 3: Link BNS Name (Optional)
          </h2>
          <p className="text-sm text-muted mb-4">
            Optionally link a BNS name to your stealth meta-address. This lets
            others look up your address by name instead of the full key.
          </p>

          <div className="mb-6">
            <label
              htmlFor="bns-name"
              className="block text-sm font-medium text-muted mb-2"
            >
              BNS Name
            </label>
            <input
              id="bns-name"
              type="text"
              value={bnsName}
              onChange={(e) => setBnsName(e.target.value)}
              placeholder="yourname.btc"
              className="w-full px-4 py-3 rounded-lg bg-background border border-card-border text-foreground text-sm font-mono placeholder:text-muted/50 focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleLinkBns}
              disabled={isProcessing}
              className="flex-1 py-3 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
            >
              {isProcessing
                ? "Linking..."
                : bnsName.trim()
                  ? "Link BNS Name"
                  : "Skip"}
            </button>
          </div>
        </div>
      )}

      {/* Step: Done */}
      {step === "done" && (
        <div className="rounded-xl border border-card-border bg-card-bg p-6">
          <div className="text-center mb-6">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-green/10 mb-4">
              <span className="text-accent-green text-lg font-bold">ok</span>
            </div>
            <h2 className="text-lg font-semibold">Registration Complete</h2>
            <p className="text-sm text-muted mt-1">
              Your stealth meta-address has been registered on-chain.
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-muted mb-2">
              Share this address to receive private payments
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={metaAddress}
                className="flex-1 px-4 py-3 rounded-lg bg-background border border-card-border text-foreground text-xs font-mono focus:outline-none"
              />
              <button
                onClick={copyToClipboard}
                className="px-4 py-3 rounded-lg border border-card-border text-sm text-muted hover:text-foreground hover:border-muted transition-colors flex-shrink-0"
              >
                Copy
              </button>
            </div>
          </div>

          {bnsName && (
            <p className="text-sm text-muted text-center">
              Linked to: <span className="text-foreground">{bnsName}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
