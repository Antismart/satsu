"use client";

import { useWallet } from "@/hooks/useWallet";

export function WalletConnect() {
  const { address, isConnected, isConnecting, error, connect, disconnect, clearError } = useWallet();

  if (isConnected && address) {
    const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full glass-card">
          <span className="relative h-2 w-2 rounded-full bg-[#4ADE80] pulse-dot" />
          <span className="text-xs sm:text-sm font-semibold text-white tracking-tight">
            {truncated}
          </span>
        </div>
        <button
          onClick={disconnect}
          className="hidden sm:block px-4 py-2 rounded-full text-sm font-semibold text-white/50 hover:text-white hover:bg-white/[0.06] transition-all duration-300"
        >
          Disconnect
        </button>
        <button
          onClick={disconnect}
          className="sm:hidden p-2 rounded-full text-white/50 hover:text-white hover:bg-white/[0.06] transition-all duration-300"
          aria-label="Disconnect"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={connect}
        disabled={isConnecting}
        className="btn-glass h-10 px-6 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </button>
      {error && (
        <div
          role="alert"
          className="absolute right-0 top-12 z-50 w-72 rounded-xl border border-[#EF4444]/30 bg-[#0A0A0A] px-4 py-3 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#EF4444]">
              Connection failed
            </p>
            <button
              onClick={clearError}
              className="text-white/40 hover:text-white"
              aria-label="Dismiss"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mt-1 text-sm text-white/80">{error}</p>
        </div>
      )}
    </div>
  );
}
