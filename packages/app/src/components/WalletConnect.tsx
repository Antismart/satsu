"use client";

import { useWallet } from "@/hooks/useWallet";

export function WalletConnect() {
  const { address, isConnected, connect, disconnect } = useWallet();

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
    <button
      onClick={connect}
      className="btn-glass h-10 px-6 text-sm font-semibold"
    >
      Connect Wallet
    </button>
  );
}
