"use client";

import { DepositForm } from "@/components/DepositForm";
import { WithdrawForm } from "@/components/WithdrawForm";
import { NotesList } from "@/components/NotesList";
import { PrivacyMeter } from "@/components/PrivacyMeter";
import { useWallet } from "@/hooks/useWallet";
import { useRelayer } from "@/hooks/useRelayer";

const poolStats = [
  { label: "Pool Value", value: "42.8 sBTC", accent: false },
  { label: "Anonymity Set", value: "892", accent: true },
  { label: "Your Balance", value: "1.11 sBTC", accent: false },
  { label: "Pending", value: "0", accent: false },
];

export default function DashboardPage() {
  const { isConnected, connect } = useWallet();
  const { status: relayerStatus } = useRelayer();

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 py-28">
        <div className="max-w-md mx-auto text-center">
          <div className="h-16 w-16 rounded-2xl bg-[#0057ff]/[0.08] flex items-center justify-center mx-auto mb-6">
            <svg
              className="h-8 w-8 text-[#0057ff]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3 text-[#191919]">
            Dashboard
          </h1>
          <p className="text-[#6b7280] mb-8 leading-relaxed">
            Connect your Stacks wallet to deposit, withdraw, and manage your
            private notes.
          </p>
          <button
            onClick={connect}
            className="px-8 py-3 rounded-full bg-[#0057ff] text-white font-semibold text-sm shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-all duration-300 hover:bg-[#0046cc] hover:brightness-110"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8 sm:py-10">
      {/* Dashboard header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#191919]">
            Dashboard
          </h1>
          <p className="text-sm text-[#6b7280] mt-1">
            Manage your private deposits and withdrawals
          </p>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white border border-[#e8e8e8] shadow-sm">
          <span
            className={`relative h-2 w-2 rounded-full ${
              relayerStatus.isOnline ? "bg-[#22c55e] pulse-dot" : "bg-[#ef4444]"
            }`}
          />
          <span className="text-xs text-[#6b7280] font-medium">
            Relayer {relayerStatus.isOnline ? "online" : "offline"}
            {relayerStatus.latency !== null &&
              ` (${relayerStatus.latency}ms)`}
          </span>
        </div>
      </div>

      {/* Pool stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {poolStats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl border border-[#e8e8e8] p-5 shadow-sm transition-all duration-300 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
          >
            <p className="text-xs text-[#9ca3af] font-medium uppercase tracking-wider mb-2">
              {stat.label}
            </p>
            <p
              className={`text-xl font-bold font-mono tabular-nums tracking-tight ${
                stat.accent ? "text-[#0057ff]" : "text-[#191919]"
              }`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <DepositForm />
        <WithdrawForm />
      </div>

      {/* Notes and Privacy meter */}
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
