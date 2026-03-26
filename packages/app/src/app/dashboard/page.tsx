"use client";

import { useState } from "react";
import { DepositForm } from "@/components/DepositForm";
import { WithdrawForm } from "@/components/WithdrawForm";
import { NotesList } from "@/components/NotesList";
import { PrivacyMeter } from "@/components/PrivacyMeter";
import { useWallet } from "@/hooks/useWallet";
import { useRelayer } from "@/hooks/useRelayer";
import { useSatsu } from "@/hooks/useSatsu";

const recentTransactions = [
  { icon: "shield", title: "Stealth Deposit", subtitle: "via relayer", amount: "-0.05 sBTC", time: "2m ago" },
  { icon: "deposit", title: "Shielded Withdrawal", subtitle: "to stealth address", amount: "+0.10 sBTC", time: "1h ago" },
  { icon: "withdraw", title: "Pool Contribution", subtitle: "0.1 sBTC denomination", amount: "-0.01 sBTC", time: "3h ago" },
];

export default function DashboardPage() {
  const { isConnected, address, connect } = useWallet();
  const { status: relayerStatus } = useRelayer();
  const { notes, hasBackedUp } = useSatsu();
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw" | "activity">("deposit");

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-16 sm:py-28">
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

  // Computed values for sidebar
  const activeNotes = notes.filter((n) => n.status === "unspent");
  const totalNoteValue = activeNotes.reduce((sum, n) => sum + n.amount, 0);

  // Stats data with icons and accents
  const dashboardStats = [
    {
      label: "Anonymity Set",
      value: "892",
      trend: "+12%",
      accent: "#F97C00",
      progress: 89,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      ),
    },
    {
      label: "Total Deposits",
      value: "1,247",
      trend: "+8%",
      accent: "#4ADE80",
      progress: 72,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
        </svg>
      ),
    },
    {
      label: "Your Notes",
      value: String(notes.length),
      trend: null,
      accent: "#FFFFFF",
      progress: (activeNotes.length / Math.max(notes.length, 1)) * 100,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
    },
    {
      label: "Privacy Score",
      value: "89%",
      trend: "+3%",
      accent: "#F97C00",
      progress: 89,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-6 sm:py-8 md:py-10">
      {/* ================================================================
          ROW 1: TOP HEADER
          ================================================================ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Privacy Dashboard</h1>
        </div>
        <div className="flex items-center gap-2.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full glass-card self-start sm:self-auto">
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
          ROW 2: CARD DUO (credit card front + back) - KEPT AS-IS
          ================================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 mb-5">
        {/* Credit Card Style Balance */}
        <div className="relative rounded-2xl sm:rounded-[1.5rem] overflow-hidden p-5 sm:p-8 min-h-[240px] sm:min-h-[280px] md:min-h-[320px] flex flex-col justify-between"
          style={{
            background: "linear-gradient(145deg, #2a2a2a 0%, #1c1c1c 30%, #111 60%, #0a0a0a 100%)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.8), inset 1px 1px 6px rgba(255,255,255,0.08), inset -1px -1px 6px rgba(0,0,0,0.6)",
            border: "1px solid rgba(255,255,255,0.06)"
          }}
        >
          {/* Brushed metal sheen */}
          <div className="absolute inset-0 pointer-events-none rounded-[1.5rem]" style={{
            background: "linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.03) 20%, transparent 45%, rgba(255,255,255,0.02) 70%, transparent 100%)"
          }} />
          {/* Noise texture */}
          <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay pointer-events-none rounded-[1.5rem]" style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }} />

          {/* Top row: label + contactless */}
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-semibold mb-1">Available Balance</p>
              <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight">
                {leftBalance.toFixed(2)} <span className="text-base sm:text-lg font-semibold text-white/40">sBTC</span>
              </p>
              <p className="text-xs mt-2">
                <span className="text-white/35">Deposited </span>
                <span className="text-[#4ADE80] font-semibold">{spentAmount.toFixed(2)} sBTC</span>
              </p>
            </div>
            {/* Contactless icon */}
            <svg className="w-8 h-8 text-white/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8.5 16.5S6 14 6 12s2.5-4.5 2.5-4.5M12 18s-4-3-4-6 4-6 4-6M15.5 19.5S10 16 10 12s5.5-7.5 5.5-7.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Progress bar */}
          <div className="relative z-10 my-5">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${spendRatio * 100}%` }} />
            </div>
            <div className="absolute -top-2.5 w-0 h-0" style={{
              left: `${spendRatio * 100}%`, transform: "translateX(-50%)",
              borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "6px solid #FACC15"
            }} />
          </div>

          {/* Bottom row: chip + branding + address */}
          <div className="relative z-10 flex justify-between items-end">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              {/* Chip */}
              <div className="w-10 sm:w-12 h-7 sm:h-9 rounded-md border border-white/15 bg-gradient-to-br from-white/10 to-transparent flex flex-col justify-center items-center gap-1 flex-shrink-0">
                <div className="w-6 sm:w-8 h-[1px] bg-white/25" />
                <div className="w-7 sm:w-9 h-[1px] bg-white/25" />
                <div className="w-6 sm:w-8 h-[1px] bg-white/25" />
              </div>
              <div className="min-w-0">
                <p className="text-white/30 text-[9px] sm:text-[10px] uppercase tracking-[0.15em]">Stealth Address</p>
                <p className="text-white/70 text-xs sm:text-sm font-mono tracking-wider truncate">{truncatedAddr}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span className="text-xl sm:text-2xl font-black tracking-[0.2em] text-white/[0.06]">SATSU</span>
              <div className="flex items-center gap-1.5 text-[#4ADE80] text-xs font-semibold">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
                +12.4%
              </div>
            </div>
          </div>
        </div>

        {/* Privacy Shield - Credit Card BACK design */}
        <div className="relative rounded-2xl sm:rounded-[1.5rem] overflow-hidden min-h-[240px] sm:min-h-[280px] md:min-h-[320px] flex flex-col"
          style={{
            background: "linear-gradient(145deg, #2a2a2a 0%, #1c1c1c 30%, #111 60%, #0a0a0a 100%)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.8), inset 1px 1px 6px rgba(255,255,255,0.08), inset -1px -1px 6px rgba(0,0,0,0.6)",
            border: "1px solid rgba(255,255,255,0.06)"
          }}
        >
          {/* Brushed metal sheen - same as front */}
          <div className="absolute inset-0 pointer-events-none rounded-[1.5rem]" style={{
            background: "linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.03) 20%, transparent 45%, rgba(255,255,255,0.02) 70%, transparent 100%)"
          }} />
          {/* Noise texture */}
          <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay pointer-events-none rounded-[1.5rem]" style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }} />

          {/* Magnetic stripe */}
          <div className="w-full h-12 mt-6 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-[#1a1a1a] via-[#252525] to-[#1a1a1a]" />
            <div className="absolute inset-0 opacity-30" style={{
              backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 3px)"
            }} />
            {/* Subtle shimmer on stripe */}
            <div className="absolute inset-0" style={{
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 30%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 70%, transparent 100%)"
            }} />
          </div>

          {/* Content area */}
          <div className="flex-1 px-4 sm:px-8 pt-4 sm:pt-5 pb-5 sm:pb-8 flex flex-col justify-between relative z-10">

            {/* Signature strip + CVV area */}
            <div className="flex gap-3 sm:gap-4 items-stretch">
              {/* Signature strip - contains the gauge */}
              <div className="flex-1 rounded-lg p-4 relative overflow-hidden" style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)"
              }}>
                <p className="text-[9px] text-white/30 uppercase tracking-[0.2em] font-semibold mb-3">Privacy Shield</p>

                {/* Mini gauge inside signature strip */}
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-12 overflow-hidden flex-shrink-0">
                    <svg className="w-20 h-20" viewBox="0 0 200 200" style={{ marginTop: "-2px" }}>
                      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" strokeLinecap="round" />
                      <defs>
                        <linearGradient id="gaugeGradBack" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#F97C00" />
                          <stop offset="50%" stopColor="#FACC15" />
                          <stop offset="100%" stopColor="#4ADE80" />
                        </linearGradient>
                      </defs>
                      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#gaugeGradBack)" strokeWidth="14" strokeLinecap="round"
                        strokeDasharray={`${spendRatio * 251.2} 251.2`}
                        style={{ transition: "stroke-dasharray 1s ease-out" }}
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white/40 text-[10px] mb-0.5">Shielded Balance</p>
                    <p className="text-white font-bold text-xl tracking-tight tabular-nums">${leftBalance.toFixed(2)}</p>
                  </div>
                </div>

                {/* Faint signature scribble lines */}
                <div className="mt-3 space-y-1.5 opacity-20">
                  <div className="h-[1px] w-[70%] bg-white/30 rounded" />
                  <div className="h-[1px] w-[50%] bg-white/20 rounded" />
                </div>
              </div>

              {/* CVV box */}
              <div className="w-20 rounded-lg flex flex-col items-center justify-center" style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)"
              }}>
                <p className="text-[8px] text-white/25 uppercase tracking-[0.2em] mb-1">Score</p>
                <p className="text-2xl font-bold text-white tabular-nums tracking-tight">{Math.round(spendRatio * 100)}</p>
                <p className="text-[8px] text-white/25 uppercase tracking-wider mt-0.5">/ 100</p>
              </div>
            </div>

            {/* Bottom row: hologram + info text */}
            <div className="flex items-end justify-between mt-5">
              <div className="flex items-center gap-3">
                {/* Hologram sticker */}
                <div className="w-10 h-10 rounded-lg relative overflow-hidden" style={{
                  background: "conic-gradient(from 0deg, rgba(249,124,0,0.3), rgba(250,204,21,0.3), rgba(74,222,128,0.3), rgba(249,124,0,0.3))"
                }}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  </div>
                  {/* Holographic shimmer */}
                  <div className="absolute inset-0 animate-shimmer" style={{
                    background: "linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%)"
                  }} />
                </div>
                <div>
                  <p className="text-white/35 text-[10px] uppercase tracking-[0.15em]">Anonymity strength</p>
                  <p className={`text-sm font-semibold ${spendRatio >= 0.8 ? "text-[#4ADE80]" : spendRatio >= 0.5 ? "text-[#FACC15]" : "text-[#F97C00]"}`}>
                    {spendRatio >= 0.8 ? "Strong" : spendRatio >= 0.5 ? "Moderate" : "Building"}
                  </p>
                </div>
              </div>

              {/* Branding */}
              <span className="text-xl font-black tracking-[0.2em] text-white/[0.04]">SATSU</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================
          ROW 3: QUICK ACTIONS + POOL ACTIVITY + STATS (3 columns)
          ================================================================ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5 mb-5">
        {/* Left: Quick Action Buttons */}
        <div className="flex flex-row sm:flex-col gap-3">
          <button
            onClick={() => setActiveTab("deposit")}
            className={`flex-1 h-14 rounded-2xl flex items-center justify-center gap-3 text-sm font-semibold transition-all duration-300 ${
              activeTab === "deposit"
                ? "bg-[#F97C00]/15 border border-[#F97C00]/40 text-[#F97C00] shadow-[0_0_20px_rgba(249,124,0,0.1)]"
                : "bg-[#1a1a1a] border border-white/[0.08] text-white/70 hover:border-white/[0.15] hover:text-white"
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Deposit sBTC
          </button>
          <button
            onClick={() => setActiveTab("withdraw")}
            className={`flex-1 h-14 rounded-2xl flex items-center justify-center gap-3 text-sm font-semibold transition-all duration-300 ${
              activeTab === "withdraw"
                ? "bg-[#F97C00]/15 border border-[#F97C00]/40 text-[#F97C00] shadow-[0_0_20px_rgba(249,124,0,0.1)]"
                : "bg-[#1a1a1a] border border-white/[0.08] text-white/70 hover:border-white/[0.15] hover:text-white"
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
            </svg>
            Withdraw sBTC
          </button>
        </div>

        {/* Center: Pool Activity mini chart */}
        <div className="glass-card p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-white/35 uppercase tracking-[0.2em] font-semibold">Pool Activity</p>
            <span className="text-[10px] text-[#4ADE80] font-semibold">+24h</span>
          </div>
          {/* Decorative sparkline SVG */}
          <div className="flex-1 flex items-end">
            <svg className="w-full h-16" viewBox="0 0 200 60" preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F97C00" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#F97C00" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="sparkStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#F97C00" />
                  <stop offset="100%" stopColor="#FACC15" />
                </linearGradient>
              </defs>
              {/* Area fill */}
              <path
                d="M0,45 L15,40 L30,42 L50,30 L70,35 L90,20 L110,25 L130,15 L150,22 L170,10 L185,18 L200,12 L200,60 L0,60 Z"
                fill="url(#sparkFill)"
              />
              {/* Line */}
              <path
                d="M0,45 L15,40 L30,42 L50,30 L70,35 L90,20 L110,25 L130,15 L150,22 L170,10 L185,18 L200,12"
                fill="none"
                stroke="url(#sparkStroke)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* End dot */}
              <circle cx="200" cy="12" r="3" fill="#FACC15" />
            </svg>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.06]">
            <span className="text-white font-bold text-lg tabular-nums">{poolBalance} sBTC</span>
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Pool TVL</span>
          </div>
        </div>

        {/* Right: Two stacked mini stat cards with circular progress rings */}
        <div className="flex flex-col gap-3">
          {/* Anonymity Set ring */}
          <div className="glass-card p-4 flex items-center gap-4 flex-1">
            <div className="relative w-12 h-12 flex-shrink-0">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="18" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                <circle cx="24" cy="24" r="18" fill="none" stroke="#F97C00" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${89 * 1.131} ${113.1}`}
                  style={{ transition: "stroke-dasharray 1s ease-out" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white tabular-nums">89%</span>
              </div>
            </div>
            <div>
              <p className="text-white font-bold text-lg tracking-tight tabular-nums">892</p>
              <p className="text-[10px] text-white/35 uppercase tracking-wider font-semibold">Anonymity Set</p>
            </div>
            <div className="ml-auto">
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#4ADE80]">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
                +12%
              </span>
            </div>
          </div>
          {/* Privacy Score ring */}
          <div className="glass-card p-4 flex items-center gap-4 flex-1">
            <div className="relative w-12 h-12 flex-shrink-0">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="18" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                <circle cx="24" cy="24" r="18" fill="none" stroke="#4ADE80" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${89 * 1.131} ${113.1}`}
                  style={{ transition: "stroke-dasharray 1s ease-out" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-[#4ADE80] tabular-nums">89</span>
              </div>
            </div>
            <div>
              <p className="text-white font-bold text-lg tracking-tight">Strong</p>
              <p className="text-[10px] text-white/35 uppercase tracking-wider font-semibold">Privacy Score</p>
            </div>
            <div className="ml-auto">
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#4ADE80]">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
                +3%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================
          ROW 3b: STATS STRIP (4-column enhanced cards)
          ================================================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-5">
        {dashboardStats.map((stat) => (
          <div
            key={stat.label}
            className="glass-card p-3 sm:p-5 hover-lift"
          >
            {/* Icon circle */}
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center mb-3"
              style={{ background: `${stat.accent}15`, color: stat.accent }}
            >
              {stat.icon}
            </div>
            <p className="text-xl sm:text-2xl font-bold text-white tracking-tight tabular-nums">
              {stat.value}
            </p>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px] text-white/35 uppercase tracking-wider font-semibold">
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
            {/* Mini progress bar */}
            <div className="mt-3 h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${stat.progress}%`,
                  background: stat.accent === "#FFFFFF" ? "rgba(255,255,255,0.4)" : stat.accent,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ================================================================
          ROW 4: MAIN CONTENT (2 columns) - Tabbed card + Sidebar
          ================================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* LEFT: Tabbed content card (wider) */}
        <div className="md:col-span-2 glass-card p-4 sm:p-6 md:p-8">
          {/* Tab navigation */}
          <div className="flex gap-1 p-1 rounded-full bg-white/[0.04] border border-white/[0.06] mb-6">
            <button
              onClick={() => setActiveTab("deposit")}
              className={`flex-1 h-9 sm:h-10 rounded-full text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-2 ${
                activeTab === "deposit"
                  ? "bg-white/[0.1] text-white shadow-sm"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              <svg className="h-4 w-4 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Deposit
            </button>
            <button
              onClick={() => setActiveTab("withdraw")}
              className={`flex-1 h-9 sm:h-10 rounded-full text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-2 ${
                activeTab === "withdraw"
                  ? "bg-white/[0.1] text-white shadow-sm"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              <svg className="h-4 w-4 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
              </svg>
              Withdraw
            </button>
            <button
              onClick={() => setActiveTab("activity")}
              className={`flex-1 h-9 sm:h-10 rounded-full text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-2 ${
                activeTab === "activity"
                  ? "bg-white/[0.1] text-white shadow-sm"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              <svg className="h-4 w-4 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
              Activity
            </button>
          </div>

          {/* Tab content */}
          <div className="min-h-[280px]">
            {activeTab === "deposit" && (
              <div className="animate-fade-in-up" style={{ animationDuration: "0.3s" }}>
                <DepositForm />
              </div>
            )}
            {activeTab === "withdraw" && (
              <div className="animate-fade-in-up" style={{ animationDuration: "0.3s" }}>
                <WithdrawForm />
              </div>
            )}
            {activeTab === "activity" && (
              <div className="animate-fade-in-up" style={{ animationDuration: "0.3s" }}>
                {/* Inline transaction list */}
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-semibold tracking-tight text-white">Recent Transactions</h2>
                  <button className="text-xs text-white/40 hover:text-white transition-colors font-medium">See All</button>
                </div>
                <div className="divide-y divide-white/[0.06]">
                  {recentTransactions.map((tx, i) => (
                    <div key={i} className="flex items-center justify-between py-4 first:pt-0 last:pb-0 gap-2">
                      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
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
                      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                        <div className="text-right">
                          <span className={`text-xs sm:text-sm font-semibold tabular-nums ${tx.amount.startsWith("+") ? "text-[#4ADE80]" : "text-white/70"}`}>
                            {tx.amount}
                          </span>
                          <p className="text-[10px] text-white/25 mt-0.5">{tx.time}</p>
                        </div>
                        <button className="text-white/25 hover:text-white/60 transition-colors p-1 rounded-lg hover:bg-white/[0.06] hidden sm:block">
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Sidebar stack */}
        <div className="flex flex-col gap-5">

          {/* Compact Privacy Meter */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded-full bg-[#F97C00]/10 flex items-center justify-center">
                <svg className="h-4 w-4 text-[#F97C00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-white">Privacy Score</p>
            </div>
            {/* Compact gauge */}
            <div className="flex flex-col items-center">
              <div className="relative w-28 sm:w-32 h-16 sm:h-[72px] overflow-hidden">
                <svg className="w-28 sm:w-32 h-28 sm:h-32" viewBox="0 0 200 200" style={{ marginTop: "-4px" }}>
                  <path d="M 30 100 A 70 70 0 0 1 170 100" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="sidebarGauge" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#F97C00" />
                      <stop offset="60%" stopColor="#FACC15" />
                      <stop offset="100%" stopColor="#4ADE80" />
                    </linearGradient>
                  </defs>
                  <path d="M 30 100 A 70 70 0 0 1 170 100" fill="none" stroke="url(#sidebarGauge)" strokeWidth="12" strokeLinecap="round"
                    strokeDasharray={`${0.89 * 220} 220`}
                    style={{ transition: "stroke-dasharray 1s ease-out" }}
                  />
                </svg>
              </div>
              <p className="text-3xl font-bold text-white tracking-tight tabular-nums -mt-1">
                89<span className="text-sm font-semibold text-white/35 ml-0.5">/100</span>
              </p>
              <p className="text-xs text-[#4ADE80] font-semibold mt-1">Strong</p>
            </div>
          </div>

          {/* Notes Summary */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-[#FACC15]/10 flex items-center justify-center">
                  <svg className="h-4 w-4 text-[#FACC15]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-white">Deposit Notes</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Active Notes</span>
                <span className="text-sm font-bold text-white tabular-nums">{activeNotes.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Total Value</span>
                <span className="text-sm font-bold text-[#4ADE80] tabular-nums">{totalNoteValue.toFixed(2)} sBTC</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Total Notes</span>
                <span className="text-sm font-bold text-white tabular-nums">{notes.length}</span>
              </div>
            </div>
            {/* Backup status */}
            <div className={`mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between ${!hasBackedUp && notes.length > 0 ? "" : ""}`}>
              <div className="flex items-center gap-2">
                {hasBackedUp ? (
                  <>
                    <div className="h-2 w-2 rounded-full bg-[#4ADE80]" />
                    <span className="text-xs text-white/40">Backed up</span>
                  </>
                ) : (
                  <>
                    <div className="h-2 w-2 rounded-full bg-[#F97C00]" />
                    <span className="text-xs text-[#F97C00]/70">Not backed up</span>
                  </>
                )}
              </div>
              <button
                onClick={() => setActiveTab("activity")}
                className="text-[10px] font-semibold text-white/40 hover:text-white px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.15] transition-all duration-300"
              >
                View All
              </button>
            </div>
          </div>

          {/* Pool Info */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded-full bg-[#4ADE80]/10 flex items-center justify-center">
                <svg className="h-4 w-4 text-[#4ADE80]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-white">Pool Status</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Pool TVL</span>
                <span className="text-sm font-bold text-white tabular-nums">{poolBalance} sBTC</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Relayer</span>
                <span className={`text-xs font-semibold flex items-center gap-1.5 ${relayerStatus.isOnline ? "text-[#4ADE80]" : "text-[#EF4444]"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${relayerStatus.isOnline ? "bg-[#4ADE80]" : "bg-[#EF4444]"}`} />
                  {relayerStatus.isOnline ? "Online" : "Offline"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Deposits</span>
                <span className="text-sm font-bold text-white tabular-nums">1,247</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
