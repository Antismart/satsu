"use client";

import { useState } from "react";
import { DepositForm } from "@/components/DepositForm";
import { WithdrawForm } from "@/components/WithdrawForm";
import { useWallet } from "@/hooks/useWallet";
import { useRelayer } from "@/hooks/useRelayer";
import { useSatsu } from "@/hooks/useSatsu";

export default function DashboardPage() {
  const { isConnected, address, isConnecting, error, connect } = useWallet();
  const { status: relayerStatus } = useRelayer();
  const { notes } = useSatsu();
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
            disabled={isConnecting}
            className="btn-accent h-12 px-8 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
          {error && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-left"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-[#EF4444]">
                Connection failed
              </p>
              <p className="mt-1 text-sm text-white/80">{error}</p>
              <p className="mt-2 text-xs text-white/50">
                Install{" "}
                <a
                  href="https://leather.io/install-extension"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#F97C00] hover:underline"
                >
                  Leather
                </a>{" "}
                or{" "}
                <a
                  href="https://www.xverse.app/download"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#F97C00] hover:underline"
                >
                  Xverse
                </a>{" "}
                and try again.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const truncatedAddr = address
    ? `${address.slice(0, 8)}...${address.slice(-6)}`
    : "";

  // Derive all values from actual note state
  const activeNotes = notes.filter((n) => n.status === "unspent");
  const spentNotes = notes.filter((n) => n.status === "spent");
  const totalNoteValue = activeNotes.reduce((sum, n) => sum + n.amount, 0);
  const spentAmount = spentNotes.reduce((sum, n) => sum + n.amount, 0);
  const leftBalance = totalNoteValue;
  const spendRatio = leftBalance + spentAmount > 0 ? leftBalance / (leftBalance + spentAmount) : 0;


  return (
  <div className="mx-auto max-w-[1200px] px-4 sm:px-6 pt-6 pb-24 sm:py-8 md:py-10 min-h-[100dvh]">
      {/* ================================================================
          ROW 1: TOP HEADER
          ================================================================ */}
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sticky top-0 z-20 bg-[#050505]/90 backdrop-blur-md py-3">
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
      ROW 2: BALANCE + ESSENTIAL STATS
      ================================================================ */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mb-6">
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

  <div className="glass-card p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <p className="text-xs text-white/40 uppercase tracking-[0.2em] font-semibold">Key stats</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Active notes</span>
                <span className="text-sm font-semibold text-white tabular-nums">{activeNotes.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Total deposits</span>
                <span className="text-sm font-semibold text-white tabular-nums">{notes.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Pool TVL</span>
                <span className="text-sm font-semibold text-white tabular-nums">{totalNoteValue.toFixed(2)} sBTC</span>
              </div>
            </div>
          </div>
          <div className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Relayer</p>
            <p className={`text-sm font-semibold ${relayerStatus.isOnline ? "text-[#4ADE80]" : "text-[#EF4444]"}`}>
              {relayerStatus.isOnline ? "Online" : "Offline"}
            </p>
          </div>
        </div>
      </div>
      {/* ================================================================
          ROW 3: MAIN CONTENT (tabs)
          ================================================================ */}
  <div className="glass-card p-4 sm:p-6 md:p-8">
          {/* Tab navigation */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2 rounded-2xl sm:rounded-full bg-white/[0.04] border border-white/[0.06] mb-6">
            <button
              onClick={() => setActiveTab("deposit")}
              className={`h-11 rounded-xl sm:rounded-full text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-2 ${
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
              className={`h-11 rounded-xl sm:rounded-full text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-2 ${
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
              className={`h-11 rounded-xl sm:rounded-full text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-2 ${
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
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-semibold tracking-tight text-white">Note Activity</h2>
                </div>
                {notes.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="h-12 w-12 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
                      <svg className="h-6 w-6 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <p className="text-sm text-white/35">No activity yet. Make a deposit to get started.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.06]">
                    {notes.map((note) => (
                      <div key={note.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0 gap-2">
                        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                            note.status === "unspent" ? "bg-[#F97C00]/10 text-[#F97C00]" : "bg-white/[0.06] text-white/50"
                          }`}>
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                            </svg>
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-white">{note.status === "unspent" ? "Deposit" : "Spent"}</span>
                            <p className="text-[10px] text-white/25 mt-0.5">{note.createdAt}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className={`text-xs sm:text-sm font-semibold tabular-nums ${note.status === "unspent" ? "text-[#4ADE80]" : "text-white/40"}`}>
                            {note.amount} sBTC
                          </span>
                          <p className={`text-[10px] mt-0.5 ${note.status === "unspent" ? "text-[#4ADE80]/60" : "text-white/20"}`}>{note.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
      </div>
    </div>
  );
}
