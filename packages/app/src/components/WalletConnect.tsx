"use client";

import { useWallet } from "@/hooks/useWallet";

export function WalletConnect() {
  const { address, isConnected, connect, disconnect } = useWallet();

  if (isConnected && address) {
    const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm">
          <span className="relative h-2 w-2 rounded-full bg-accent-green pulse-dot" />
          <span className="text-sm font-mono text-muted tracking-tight">
            {truncated}
          </span>
        </div>
        <button
          onClick={disconnect}
          className="px-3 py-2 rounded-xl text-sm text-muted-dim hover:text-foreground hover:bg-white/[0.04] transition-all duration-200"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold transition-all duration-300 hover:shadow-[0_0_25px_rgba(59,130,246,0.25)] hover:brightness-110"
    >
      Connect Wallet
    </button>
  );
}
