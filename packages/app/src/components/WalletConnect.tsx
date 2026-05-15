"use client";

import dynamic from "next/dynamic";

const WalletConnectClient = dynamic(
  () => import("./WalletConnect.client").then((m) => m.WalletConnect),
  {
    ssr: false,
    loading: () => (
      <button
        disabled
        className="btn-glass h-10 px-6 text-sm font-semibold opacity-60"
      >
        Connect Wallet
      </button>
    ),
  }
);

export function WalletConnect() {
  return <WalletConnectClient />;
}
