"use client";

import { useWallet } from "@/hooks/useWallet";

export function WalletConnect() {
  const { address, isConnected, connect, disconnect } = useWallet();

  if (isConnected && address) {
    const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white border border-[#e8e8e8] shadow-sm">
          <span className="relative h-2 w-2 rounded-full bg-[#22c55e] pulse-dot" />
          <span className="text-sm font-mono text-[#6b7280] tracking-tight">
            {truncated}
          </span>
        </div>
        <button
          onClick={disconnect}
          className="px-3 py-2 rounded-full text-sm text-[#6b7280] hover:text-[#191919] hover:bg-[#f9f9f9] transition-all duration-300"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      className="px-5 py-2.5 rounded-full bg-[#0057ff] text-white text-sm font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-all duration-300 hover:bg-[#0046cc] hover:brightness-110"
    >
      Connect Wallet
    </button>
  );
}
