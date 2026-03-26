"use client";

import { DepositForm } from "@/components/DepositForm";
import { WithdrawForm } from "@/components/WithdrawForm";
import { NotesList } from "@/components/NotesList";
import { PrivacyMeter } from "@/components/PrivacyMeter";
import { useWallet } from "@/hooks/useWallet";
import { useRelayer } from "@/hooks/useRelayer";

const dashboardStats = [
  { label: "Anonymity Set", value: "892", trend: "+12%" },
  { label: "Total Deposits", value: "1,247", trend: "+8%" },
  { label: "Your Notes", value: "3", trend: null },
  { label: "Privacy Score", value: "89%", trend: "+3%" },
];

export default function DashboardPage() {
  const { isConnected, address, connect } = useWallet();
  const { status: relayerStatus } = useRelayer();

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 py-28">
        <div className="max-w-md mx-auto text-center">
          <div className="h-16 w-16 rounded-2xl bg-[#0057FF]/[0.08] flex items-center justify-center mx-auto mb-6">
            <svg
              className="h-8 w-8 text-[#0057FF]"
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
          <p className="text-[#6B7280] mb-8 leading-relaxed">
            Connect your Stacks wallet to deposit, withdraw, and manage your
            private notes.
          </p>
          <button
            onClick={connect}
            className="h-12 px-8 rounded-full bg-[#0057FF] text-white font-semibold text-sm shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-all duration-300 hover:bg-[#006ACB]"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  const truncatedAddr = address
    ? `${address.slice(0, 8)}...${address.slice(-6)}`
    : "";

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8 sm:py-10">
      {/* ================================================================
          BALANCE CARD - Big blue gradient card at top
          ================================================================ */}
      <div className="bg-gradient-to-br from-[#0057FF] to-[#002F9A] rounded-2xl p-8 sm:p-10 mb-6 shadow-[0_5px_30px_rgba(0,87,255,0.25)]">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-white/50 mb-2">
              Pool Balance
            </p>
            <p className="text-4xl sm:text-5xl font-black text-white tracking-tight">
              42.8 <span className="text-2xl font-bold text-white/70">sBTC</span>
            </p>
            <p className="text-sm text-white/50 mt-3 font-mono">
              {truncatedAddr}
            </p>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.1] border border-white/[0.1]">
            <span
              className={`relative h-2 w-2 rounded-full ${
                relayerStatus.isOnline ? "bg-[#028901] pulse-dot" : "bg-[#D00D00]"
              }`}
            />
            <span className="text-xs text-white/70 font-semibold">
              Relayer {relayerStatus.isOnline ? "online" : "offline"}
              {relayerStatus.latency !== null &&
                ` (${relayerStatus.latency}ms)`}
            </span>
          </div>
        </div>
      </div>

      {/* ================================================================
          STATS STRIP - Row of 4 small white stat cards
          ================================================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {dashboardStats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl p-5 shadow-[0_5px_20px_rgba(0,0,0,0.08)] transition-all duration-300 hover:shadow-[0_5px_30px_rgba(0,0,0,0.12)]"
          >
            <p className="text-2xl font-bold text-[#191919] tracking-tight">
              {stat.value}
            </p>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-[#9CA3AF] uppercase tracking-wider font-semibold">
                {stat.label}
              </p>
              {stat.trend && (
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#028901]">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                  {stat.trend}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ================================================================
          MAIN GRID - Deposit + Withdraw side by side
          ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <DepositForm />
        <WithdrawForm />
      </div>

      {/* ================================================================
          NOTES + PRIVACY METER
          ================================================================ */}
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
