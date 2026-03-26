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
          <div className="h-16 w-16 rounded-2xl bg-[#F97C00]/10 flex items-center justify-center mx-auto mb-6">
            <svg
              className="h-8 w-8 text-[#F97C00]"
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
          <h1 className="text-3xl font-bold tracking-tight mb-3 text-white">
            Dashboard
          </h1>
          <p className="text-white/50 mb-8 leading-relaxed">
            Connect your Stacks wallet to deposit, withdraw, and manage your
            private notes.
          </p>
          <button
            onClick={connect}
            className="btn-accent h-12 px-8 text-sm"
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

  const poolBalance = 42.8;
  const spentAmount = 875.98;
  const leftBalance = 749.87;
  const spendRatio = leftBalance / (leftBalance + spentAmount);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8 sm:py-10">
      {/* ================================================================
          TOP HEADER - Statistics with back arrow and menu
          ================================================================ */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-white">Statistics</h1>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full glass-card">
          <span
            className={`relative h-2 w-2 rounded-full ${
              relayerStatus.isOnline ? "bg-[#4ADE80] pulse-dot" : "bg-[#EF4444]"
            }`}
          />
          <span className="text-xs text-white/60 font-semibold">
            Relayer {relayerStatus.isOnline ? "online" : "offline"}
            {relayerStatus.latency !== null &&
              ` (${relayerStatus.latency}ms)`}
          </span>
        </div>
      </div>

      {/* ================================================================
          BALANCE CARD + EXPENSES GAUGE - Side by side
          ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Statistics / Balance Card */}
        <div className="glass-card p-6 sm:p-8">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-white/50 uppercase tracking-wider font-semibold">
              Left balance
            </p>
            <p className="text-sm text-white/50 font-mono">
              {truncatedAddr}
            </p>
          </div>
          <p className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-1">
            ${leftBalance.toFixed(2)}
          </p>
          <p className="text-xs text-white/35 mb-6">
            Spent of <span className="text-[#4ADE80]">${spentAmount.toFixed(2)}</span>
          </p>

          {/* Orange-yellow progress bar */}
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${spendRatio * 100}%` }}
            />
          </div>

          {/* Pool balance below */}
          <div className="mt-6 pt-5 border-t border-white/[0.06]">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-semibold text-white/35 mb-1">
                  Pool Balance
                </p>
                <p className="text-2xl font-bold text-white tracking-tight">
                  {poolBalance} <span className="text-sm font-semibold text-white/50">sBTC</span>
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[#4ADE80] text-xs font-semibold">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
                +12.4%
              </div>
            </div>
          </div>
        </div>

        {/* Total Expenses - Semi-circular gauge */}
        <div className="glass-card p-6 sm:p-8">
          <h2 className="text-lg font-semibold tracking-tight text-white mb-1">
            Total Expenses
          </h2>
          <p className="text-xs text-white/35 mb-6">
            Tracks all your spending in detail
          </p>

          {/* Semi-circular gauge */}
          <div className="flex flex-col items-center">
            <div className="relative w-48 h-28 overflow-hidden">
              <svg className="w-48 h-48" viewBox="0 0 200 200" style={{ marginTop: "-4px" }}>
                {/* Background track */}
                <path
                  d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                {/* Gradient arc */}
                <defs>
                  <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#F97C00" />
                    <stop offset="50%" stopColor="#FACC15" />
                    <stop offset="100%" stopColor="#4ADE80" />
                  </linearGradient>
                </defs>
                <path
                  d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke="url(#gaugeGrad)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${spendRatio * 251.2} 251.2`}
                  style={{ transition: "stroke-dasharray 1s ease-out" }}
                />
              </svg>
            </div>
            {/* Center text below gauge */}
            <div className="text-center -mt-4">
              <p className="text-xs text-white/35 mb-1">Left balance</p>
              <p className="text-2xl font-bold text-white tracking-tight">${leftBalance.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================
          STATS STRIP - Row of 4 dark glass stat cards
          ================================================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {dashboardStats.map((stat) => (
          <div
            key={stat.label}
            className="glass-card p-5"
          >
            <p className="text-2xl font-bold text-white tracking-tight">
              {stat.value}
            </p>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-white/35 uppercase tracking-wider font-semibold">
                {stat.label}
              </p>
              {stat.trend && (
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#4ADE80]">
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
          VIEW MORE ACTIVITY BUTTON
          ================================================================ */}
      <button className="w-full mb-5 btn-glass h-12 rounded-[20px] flex items-center justify-center gap-2 text-sm font-semibold text-white/70 hover:text-white">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
        View More Activity
      </button>

      {/* ================================================================
          MAIN GRID - Deposit + Withdraw side by side
          ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <DepositForm />
        <WithdrawForm />
      </div>

      {/* ================================================================
          NOTES + PRIVACY METER
          ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
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
