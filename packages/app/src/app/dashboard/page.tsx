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

const recentTransactions = [
  { icon: "shield", title: "Shielded Transfer", subtitle: "AVG spend $24 a week", amount: "-0.05 sBTC", time: "2m ago" },
  { icon: "deposit", title: "Pool Deposit", subtitle: "AVG spend $18 a week", amount: "+0.10 sBTC", time: "1h ago" },
  { icon: "withdraw", title: "Private Withdrawal", subtitle: "AVG spend $32 a week", amount: "-0.01 sBTC", time: "3h ago" },
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

  // Calculate indicator position for the gauge triangle
  const gaugeAngle = Math.PI - spendRatio * Math.PI;
  const indicatorX = 100 + 80 * Math.cos(gaugeAngle);
  const indicatorY = 100 - 80 * Math.sin(gaugeAngle);
  const indicatorRotation = -(spendRatio * 180);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8 sm:py-10">
      {/* ================================================================
          TOP HEADER
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
          BALANCE CARD + EXPENSES GAUGE
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

          {/* Orange-yellow progress bar with triangle indicator */}
          <div className="relative">
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${spendRatio * 100}%` }}
              />
            </div>
            {/* Triangle indicator */}
            <div
              className="absolute -top-2.5 w-0 h-0"
              style={{
                left: `${spendRatio * 100}%`,
                transform: "translateX(-50%)",
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderTop: "6px solid #FACC15"
              }}
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

        {/* Total Expenses - Semi-circular gauge (Behance style) */}
        <div className="glass-card p-6 sm:p-8">
          <h2 className="text-lg font-semibold tracking-tight text-white mb-1">
            Total Expenses
          </h2>
          <p className="text-xs text-white/35 mb-6">
            Tracks all your spending in detail
          </p>

          {/* Semi-circular gauge - thicker arc, vibrant gradient, triangle indicator */}
          <div className="flex flex-col items-center">
            <div className="relative w-52 h-30 overflow-hidden">
              <svg className="w-52 h-52" viewBox="0 0 200 200" style={{ marginTop: "-4px" }}>
                {/* Background track - thicker */}
                <path
                  d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                {/* Gradient arc - thicker, more vibrant */}
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
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeDasharray={`${spendRatio * 251.2} 251.2`}
                  style={{ transition: "stroke-dasharray 1s ease-out" }}
                />
                {/* Triangle indicator at current position */}
                <g transform={`translate(${indicatorX}, ${indicatorY}) rotate(${indicatorRotation})`}>
                  <polygon
                    points="0,-7 6,5 -6,5"
                    fill="#FACC15"
                    stroke="none"
                  />
                </g>
              </svg>
            </div>
            {/* Center text below gauge - larger */}
            <div className="text-center -mt-4">
              <p className="text-xs text-white/35 mb-1">Left balance</p>
              <p className="text-3xl font-bold text-white tracking-tight">${leftBalance.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================
          STATS STRIP
          ================================================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {dashboardStats.map((stat) => (
          <div
            key={stat.label}
            className="glass-card p-5 hover-lift"
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
          VIEW MORE ACTIVITY BUTTON - btn-dark style (rounded-xl)
          ================================================================ */}
      <button className="w-full mb-5 btn-dark h-12 flex items-center justify-center gap-2.5 text-sm font-semibold text-white/70 hover:text-white transition-colors">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
        View More Activity
      </button>

      {/* ================================================================
          TRANSACTION LIST (Behance-style)
          ================================================================ */}
      <div className="glass-card p-6 sm:p-8 mb-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold tracking-tight text-white">Transaction</h2>
          <button className="text-xs text-white/40 hover:text-white transition-colors font-medium">See All</button>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {recentTransactions.map((tx, i) => (
            <div key={i} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3.5">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  tx.icon === "deposit" ? "bg-[#4ADE80]/10 text-[#4ADE80]" :
                  tx.icon === "shield" ? "bg-[#F97C00]/10 text-[#F97C00]" :
                  "bg-white/[0.06] text-white/50"
                }`}>
                  {tx.icon === "shield" && (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  )}
                  {tx.icon === "deposit" && (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  )}
                  {tx.icon === "withdraw" && (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                    </svg>
                  )}
                </div>
                <div>
                  <span className="text-sm font-semibold text-white">{tx.title}</span>
                  <p className="text-[10px] text-white/25 mt-0.5">{tx.subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className={`text-sm font-semibold tabular-nums ${tx.amount.startsWith("+") ? "text-[#4ADE80]" : "text-white/70"}`}>
                    {tx.amount}
                  </span>
                  <p className="text-[10px] text-white/25 mt-0.5">{tx.time}</p>
                </div>
                {/* Three-dot menu */}
                <button className="text-white/25 hover:text-white/60 transition-colors p-1 rounded-lg hover:bg-white/[0.06]">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

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
