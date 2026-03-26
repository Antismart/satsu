"use client";

import { DepositForm } from "@/components/DepositForm";
import { WithdrawForm } from "@/components/WithdrawForm";
import { NotesList } from "@/components/NotesList";
import { PrivacyMeter } from "@/components/PrivacyMeter";
import { useWallet } from "@/hooks/useWallet";
import { useRelayer } from "@/hooks/useRelayer";

export default function DashboardPage() {
  const { isConnected, connect } = useWallet();
  const { status: relayerStatus } = useRelayer();

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
          <p className="text-muted mb-8">
            Connect your Stacks wallet to deposit, withdraw, and manage your
            private notes.
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
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              relayerStatus.isOnline ? "bg-accent-green" : "bg-red-400"
            }`}
          />
          <span className="text-xs text-muted">
            Relayer {relayerStatus.isOnline ? "online" : "offline"}
            {relayerStatus.latency !== null &&
              ` (${relayerStatus.latency}ms)`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <DepositForm />
        <WithdrawForm />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <NotesList />
        </div>
        <div>
          <PrivacyMeter anonymitySetSize={892} />
        </div>
      </div>
    </div>
  );
}
