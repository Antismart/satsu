"use client";

import { useWallet } from "@/hooks/useWallet";

export function WalletConnect() {
  const { address, isConnected, connect, disconnect } = useWallet();

  if (isConnected && address) {
    const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white border border-[#CDCDCD] shadow-[0_5px_20px_rgba(0,0,0,0.08)]">
          <span className="relative h-2 w-2 rounded-full bg-[#028901] pulse-dot" />
          <span className="text-sm font-semibold text-[#191919] tracking-tight">
            {truncated}
          </span>
        </div>
        <button
          onClick={disconnect}
          className="px-4 py-2 rounded-full text-sm font-semibold text-[#6B7280] hover:text-[#191919] hover:bg-[#F9F9F9] transition-all duration-300"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      className="h-10 px-6 rounded-full bg-[#0057FF] text-white text-sm font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-all duration-300 hover:bg-[#006ACB]"
    >
      Connect Wallet
    </button>
  );
}
