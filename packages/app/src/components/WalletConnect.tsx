"use client";

import { useWallet } from "@/hooks/useWallet";

export function WalletConnect() {
  const { address, isConnected, connect, disconnect } = useWallet();

  if (isConnected && address) {
    const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card-bg border border-card-border">
          <span className="h-2 w-2 rounded-full bg-accent-green" />
          <span className="text-sm font-mono text-muted">{truncated}</span>
        </div>
        <button
          onClick={disconnect}
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
    >
      Connect Wallet
    </button>
  );
}
