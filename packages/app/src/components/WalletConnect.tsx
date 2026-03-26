"use client";

import { useWallet } from "@/hooks/useWallet";

export function WalletConnect() {
  const { address, isConnected, connect, disconnect } = useWallet();

  if (isConnected && address) {
    const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full glass-card">
          <span className="relative h-2 w-2 rounded-full bg-[#4ADE80] pulse-dot" />
          <span className="text-sm font-semibold text-white tracking-tight">
            {truncated}
          </span>
        </div>
        <button
          onClick={disconnect}
          className="px-4 py-2 rounded-full text-sm font-semibold text-white/50 hover:text-white hover:bg-white/[0.06] transition-all duration-300"
        >
          Disconnect
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
