"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, Lock, ArrowUpRight, Wallet, ArrowDownToLine, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-[#050505] text-white selection:bg-[#F97C00] selection:text-white pb-32 relative overflow-hidden">

      {/* ================= GLOBAL BACKGROUNDS & TEXTURES ================= */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        backgroundImage: `
          radial-gradient(ellipse at 50% 12%, rgba(249, 124, 0, 0.18) 0%, rgba(249, 124, 0, 0.06) 30%, transparent 60%),
          linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 80px 80px, 80px 80px',
        backgroundPosition: '0 0, 40px 40px, 40px 40px'
      }} />
      <div className="fixed inset-0 opacity-[0.025] pointer-events-none z-0 mix-blend-overlay" style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }} />


      {/* ================= HERO SECTION ================= */}
      <section className="relative w-full pt-32 sm:pt-44 pb-32 px-6 max-w-[1400px] mx-auto z-10">

        {/* Pill tags - top right */}
        <div className="hidden lg:flex absolute top-36 right-6 gap-3 z-20">
          <span className="px-4 py-1.5 rounded-full border border-white/[0.12] bg-white/[0.03] text-[11px] text-white/50 font-medium tracking-wide backdrop-blur-sm">
            Privacy Protocol
          </span>
          <span className="px-4 py-1.5 rounded-full border border-white/[0.12] bg-white/[0.03] text-[11px] text-white/50 font-medium tracking-wide backdrop-blur-sm">
            Zero Knowledge
          </span>
        </div>

        {/* Full-width heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="max-w-[900px] mb-10"
        >
          <h1
            className="font-heading text-5xl sm:text-7xl md:text-8xl lg:text-[7rem] font-bold text-white"
            style={{ lineHeight: "1.05", letterSpacing: "-0.03em" }}
          >
            Private payments on Bitcoin,{" "}
            <span className="text-gradient-warm">shielded</span> by zero knowledge.
          </h1>
        </motion.div>

        {/* Thin fading line below heading */}
        <div className="w-full max-w-[900px] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-10" />

        {/* Subtitle + CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 mb-8"
        >
          <p className="text-white/45 text-lg sm:text-xl leading-relaxed max-w-md">
            Deposit sBTC into a shielded pool. Withdraw to stealth addresses.
            No one sees who sent what to whom.
          </p>
          <div className="flex gap-4 flex-shrink-0">
            <Link href="/dashboard" className="btn-accent h-12 px-8 text-sm flex items-center gap-2">
              Launch App
              <ArrowUpRight className="w-4 h-4" />
            </Link>
            <Link href="/register" className="btn-glass h-12 px-8 text-sm flex items-center">
              Get Started
            </Link>
          </div>
        </motion.div>

        {/* Stats row below CTAs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex items-center gap-6 text-white/30 text-sm mb-32"
        >
          <span className="tabular-nums">892 <span className="text-white/20">deposits</span></span>
          <span className="w-px h-4 bg-white/10" />
          <span className="tabular-nums">42.85 <span className="text-white/20">sBTC TVL</span></span>
          <span className="w-px h-4 bg-white/10" />
          <span className="tabular-nums">99.9% <span className="text-white/20">uptime</span></span>
        </motion.div>

        {/* ====== CARD SHOWCASE ====== */}
        <div className="relative flex flex-col items-center min-h-[500px] sm:min-h-[600px]">

          {/* Subtle ambient light from above */}
          <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-white/[0.04] blur-[100px] rounded-full pointer-events-none" />

          {/* Card + ledge container */}
          <div className="relative flex items-end justify-center w-full h-[500px] sm:h-[580px]" style={{ perspective: "1400px" }}>

            {/* The Card - PORTRAIT orientation, standing upright, tilted back */}
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.4, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ rotateY: -8, rotateX: 3, scale: 1.02 }}
              className="absolute bottom-[90px] sm:bottom-[100px] z-10 cursor-pointer"
              style={{
                width: "280px",
                height: "420px",
                transformStyle: "preserve-3d",
                transform: "rotateY(-18deg) rotateX(8deg)",
              }}
            >
              {/* Card surface */}
              <div className="absolute inset-0 rounded-[1.25rem] overflow-hidden" style={{
                background: `linear-gradient(165deg,
                  #d4d4d4 0%,
                  #c0c0c0 8%,
                  #b0b0b0 15%,
                  #a0a0a0 25%,
                  #888 40%,
                  #666 55%,
                  #444 70%,
                  #2a2a2a 85%,
                  #1a1a1a 100%)`,
                boxShadow: `-30px 40px 80px rgba(0,0,0,0.85),
                            -10px 15px 30px rgba(0,0,0,0.5),
                            inset 0 1px 0 rgba(255,255,255,0.25),
                            inset 0 -1px 0 rgba(0,0,0,0.3)`,
                border: "1px solid rgba(255,255,255,0.15)"
              }} />

              {/* Brushed metal texture - horizontal lines */}
              <div className="absolute inset-0 rounded-[1.25rem] pointer-events-none opacity-[0.08]" style={{
                backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.1) 1px, rgba(255,255,255,0.1) 2px)",
                backgroundSize: "100% 3px"
              }} />

              {/* Strong specular hotspot - top left area */}
              <div className="absolute rounded-[1.25rem] pointer-events-none overflow-hidden inset-0">
                <div className="absolute w-[250px] h-[300px] top-[-50px] left-[-30px]" style={{
                  background: "radial-gradient(ellipse at 40% 30%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.1) 30%, transparent 65%)",
                }} />
              </div>

              {/* Edge light - catches the right edge */}
              <div className="absolute top-0 right-0 w-[2px] h-full rounded-r-[1.25rem] pointer-events-none" style={{
                background: "linear-gradient(to bottom, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 50%, transparent 100%)"
              }} />

              {/* Noise grain */}
              <div className="absolute inset-0 opacity-[0.08] mix-blend-overlay pointer-events-none rounded-[1.25rem]" style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }} />

              {/* Card content */}
              <div className="absolute inset-0 rounded-[1.25rem] p-7 sm:p-8 flex flex-col justify-between z-10">
                {/* Top: chip + contactless */}
                <div className="flex justify-between items-start">
                  {/* EMV Chip - realistic golden */}
                  <div className="w-11 h-14 rounded-lg relative overflow-hidden" style={{
                    background: "linear-gradient(150deg, #E8D5A3 0%, #D4B878 20%, #C9A96E 40%, #A08040 70%, #8B7340 100%)",
                    boxShadow: "inset 0 1px 3px rgba(255,255,255,0.5), inset 0 -1px 2px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.3)",
                    border: "1px solid rgba(180,150,80,0.4)"
                  }}>
                    {/* Chip circuit pattern */}
                    <div className="absolute inset-0 flex flex-col justify-center items-center gap-[3px] p-1.5">
                      <div className="w-full h-[1px] bg-black/10" />
                      <div className="w-[80%] h-[1px] bg-black/10" />
                      <div className="w-full h-[1px] bg-black/10" />
                      <div className="w-[60%] h-[1px] bg-black/10" />
                      <div className="w-full h-[1px] bg-black/10" />
                    </div>
                    {/* Center pad */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-4 rounded-sm border border-black/10 bg-gradient-to-br from-white/20 to-transparent" />
                  </div>

                  {/* Contactless icon */}
                  <svg className="w-7 h-7 text-black/[0.12]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M8.5 16.5S6 14 6 12s2.5-4.5 2.5-4.5M12 18s-4-3-4-6 4-6 4-6M15.5 19.5S10 16 10 12s5.5-7.5 5.5-7.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>

                {/* Center: large SATSU embossed */}
                <div className="flex-1 flex items-center">
                  <span className="text-[2.2rem] font-black tracking-[0.3em] uppercase select-none" style={{
                    color: "transparent",
                    WebkitTextStroke: "1px rgba(0,0,0,0.08)",
                    textShadow: "1px 1px 0px rgba(255,255,255,0.06), -1px -1px 0px rgba(0,0,0,0.1)"
                  }}>SATSU</span>
                </div>

                {/* Bottom: card number + brand circle */}
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-[9px] text-black/[0.12] tracking-[0.15em] uppercase block mb-1.5">Privacy Card</span>
                    <span className="text-black/[0.15] text-[13px] font-mono tracking-[0.25em]">4821 **** **** 0917</span>
                  </div>
                  <div className="w-9 h-9 rounded-full relative" style={{
                    background: "linear-gradient(135deg, #F97C00 0%, #FACC15 100%)",
                    boxShadow: "0 2px 12px rgba(249,124,0,0.2), inset 0 1px 2px rgba(255,255,255,0.3)"
                  }}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[8px] font-black text-black/40 tracking-wider">ZK</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Dark stone ledge / surface */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] sm:w-[800px] h-[100px] z-0">
              {/* Ledge top surface */}
              <div className="absolute top-0 left-0 right-0 h-[50px] rounded-t-lg" style={{
                background: "linear-gradient(180deg, #1a1a1a 0%, #111 60%, #0d0d0d 100%)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)"
              }} />
              {/* Ledge front face */}
              <div className="absolute top-[50px] left-0 right-0 h-[50px]" style={{
                background: "linear-gradient(180deg, #0d0d0d 0%, #080808 100%)"
              }} />
              {/* Subtle texture on ledge */}
              <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay pointer-events-none" style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }} />
              {/* Shadow below card on the ledge */}
              <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-[200px] h-[30px] bg-black/60 blur-[20px] rounded-full" />
            </div>

            {/* Soft shadow on the floor beneath ledge */}
            <div className="absolute bottom-[-20px] left-1/2 -translate-x-1/2 w-[500px] h-[40px] bg-black/50 blur-[30px] rounded-full z-0" />
          </div>
        </div>

      </section>


      {/* ================= BANNER SECTION ================= */}
      <section className="relative w-full py-20 px-6 z-10">
        <div className="max-w-[1200px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8 }}
            className="relative rounded-[2rem] overflow-hidden min-h-[400px] p-10 sm:p-14 diamond-grid"
            style={{
              background: "linear-gradient(135deg, rgba(249, 124, 0, 0.15) 0%, rgba(200, 60, 0, 0.1) 40%, rgba(10, 10, 10, 0.95) 100%)",
              border: "1px solid rgba(255, 255, 255, 0.06)"
            }}
          >
            {/* Animated gradient overlay */}
            <div className="absolute inset-0 pointer-events-none rounded-[2rem] overflow-hidden">
              <div className="absolute inset-0 animate-shimmer" style={{
                background: "linear-gradient(135deg, rgba(249, 124, 0, 0.12) 0%, rgba(200, 40, 0, 0.08) 50%, rgba(249, 124, 0, 0.06) 100%)"
              }} />
            </div>

            {/* Warm photographic blur */}
            <div className="absolute top-0 left-0 w-[60%] h-full bg-gradient-to-r from-[#F97C00]/20 via-[#E84D00]/10 to-transparent blur-[60px] pointer-events-none" />

            {/* Content */}
            <div className="relative z-10 flex flex-col justify-between h-full min-h-[320px]">
              <div className="max-w-lg">
                <h2 className="font-heading text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight mb-6" style={{ lineHeight: "1.1" }}>
                  Stealth Payments, Zero Trace
                </h2>
              </div>

              <div className="flex items-end justify-between mt-auto">
                <div className="bg-[#0f0f0f]/90 border border-white/[0.08] rounded-2xl p-5 backdrop-blur-md max-w-[240px]">
                  <p className="text-white font-bold text-2xl tracking-tight tabular-nums mb-1">$748,42.87</p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-5 rounded bg-gradient-to-r from-[#1a1a1a] to-[#2a2a2a] border border-white/10" />
                    <span className="text-xs text-white/40">Stealth Address</span>
                  </div>
                </div>
                <p className="hidden md:block text-white/40 text-base max-w-[300px] text-right leading-relaxed">
                  Send and receive sBTC privately. No one sees who paid whom.
                </p>
              </div>
            </div>

            {/* Floating widget card (top-right) */}
            <div className="absolute top-8 right-8 bg-[#0f0f0f]/90 border border-white/[0.08] rounded-2xl p-5 backdrop-blur-md hidden md:block">
              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-2">Pool TVL</p>
              <p className="text-2xl font-bold text-white tabular-nums mb-3">$749.87</p>
              <div className="progress-track w-36">
                <div className="progress-fill" style={{ width: "46%" }} />
              </div>
            </div>
          </motion.div>
        </div>
      </section>


      {/* ================= HOW IT WORKS SECTION ================= */}
      <section className="relative w-full py-24 px-6 z-10">
        <div className="max-w-[1100px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span className="text-white/40 text-[11px] tracking-[0.2em] font-medium uppercase mb-4 block">The Process</span>
            <h2 className="text-white text-3xl sm:text-4xl font-medium tracking-tight">How It Works</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Connecting dotted lines (desktop only) */}
            <div className="hidden md:block absolute top-1/2 left-[calc(33.33%+12px)] right-[calc(66.67%-12px)] border-t border-dashed border-white/10 -translate-y-1/2 z-0" style={{ width: "calc(33.33% - 24px)", left: "calc(33.33% - calc(33.33% - 24px) / 2 + 12px)" }} />

            {/* Step 1: Deposit */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: 0 }}
              className="relative z-10 group"
            >
              <div className="bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-2xl p-8 transition-all duration-300 hover:border-white/[0.15] hover:bg-white/[0.05]">
                <div className="w-12 h-12 rounded-xl bg-[#F97C00]/10 border border-[#F97C00]/20 flex items-center justify-center mb-6 group-hover:bg-[#F97C00]/15 transition-colors">
                  <ArrowDownToLine className="w-5 h-5 text-[#F97C00]" />
                </div>
                <div className="text-white/20 text-xs font-mono mb-3">01</div>
                <h3 className="text-white text-lg font-semibold mb-3">Deposit</h3>
                <p className="text-white/40 text-sm leading-relaxed">Send sBTC into the shielded pool. Your deposit is mixed with others, breaking the on-chain link.</p>
              </div>
            </motion.div>

            {/* Step 2: Shield */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="relative z-10 group"
            >
              <div className="bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-2xl p-8 transition-all duration-300 hover:border-white/[0.15] hover:bg-white/[0.05]">
                <div className="w-12 h-12 rounded-xl bg-[#F97C00]/10 border border-[#F97C00]/20 flex items-center justify-center mb-6 group-hover:bg-[#F97C00]/15 transition-colors">
                  <ShieldCheck className="w-5 h-5 text-[#F97C00]" />
                </div>
                <div className="text-white/20 text-xs font-mono mb-3">02</div>
                <h3 className="text-white text-lg font-semibold mb-3">Shield</h3>
                <p className="text-white/40 text-sm leading-relaxed">Zero-knowledge proofs verify your deposit without revealing your identity. Your funds are shielded.</p>
              </div>
            </motion.div>

            {/* Step 3: Withdraw */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="relative z-10 group"
            >
              <div className="bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-2xl p-8 transition-all duration-300 hover:border-white/[0.15] hover:bg-white/[0.05]">
                <div className="w-12 h-12 rounded-xl bg-[#F97C00]/10 border border-[#F97C00]/20 flex items-center justify-center mb-6 group-hover:bg-[#F97C00]/15 transition-colors">
                  <Wallet className="w-5 h-5 text-[#F97C00]" />
                </div>
                <div className="text-white/20 text-xs font-mono mb-3">03</div>
                <h3 className="text-white text-lg font-semibold mb-3">Withdraw</h3>
                <p className="text-white/40 text-sm leading-relaxed">Withdraw to any stealth address. No one can link the withdrawal to your original deposit.</p>
              </div>
            </motion.div>
          </div>

          {/* Dotted connector lines (desktop) */}
          <div className="hidden md:flex justify-center items-center -mt-[calc(50%+1rem)] pointer-events-none absolute inset-x-0" />
        </div>
      </section>


      {/* ================= BROWSER MOCKUP SECTION ================= */}
      <section className="relative w-full py-24 px-6 overflow-hidden z-10">
        <div className="max-w-[1100px] mx-auto relative flex flex-col items-center">

          <div className="text-center mb-14">
            <h2 className="text-white text-3xl sm:text-4xl font-medium tracking-tight mb-4">Your <span className="text-gradient-warm">Privacy Dashboard</span></h2>
            <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">Monitor your shielded deposits, withdrawals, and privacy score. Everything stays between you and the blockchain.</p>
          </div>

          {/* Warm glow behind the monitor */}
          <div className="absolute top-[40%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[#F97C00]/[0.04] blur-[100px] rounded-full pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="w-full rounded-[2rem] p-2 bg-[#121212] border border-white/[0.08] shadow-[0_30px_100px_rgba(0,0,0,1)] relative"
          >
            {/* Monitor stand */}
            <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-48 h-16 bg-gradient-to-t from-black to-[#222] rounded-t-xl z-[-1]" />
            <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-64 h-4 bg-[#111] rounded-full z-[-1] shadow-[0_10px_20px_black]" />

            {/* Dark inner wrapper */}
            <div className="bg-[#050505] rounded-[1.5rem] overflow-hidden relative min-h-[550px] border border-black flex flex-col">

              {/* Browser Header */}
              <div className="h-[52px] border-b border-white/5 flex items-center px-6 gap-2 bg-[#0a0a0a]">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-black/20" />
                  <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-black/20" />
                  <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-black/20" />
                </div>
                <div className="mx-auto bg-black/50 border border-white/5 px-20 sm:px-40 py-1.5 rounded-lg text-[11px] text-white/30 font-mono tracking-wider flex items-center justify-between gap-4">
                  <Lock className="w-3 h-3" />
                  satsu.network
                </div>
                <div className="flex gap-4 items-center">
                  <div className="w-6 h-6 rounded-md bg-white/5" />
                  <div className="w-6 h-6 rounded-md bg-white/5" />
                </div>
              </div>

              {/* Browser Inner Workspace */}
              <div className="relative flex-1 flex flex-col items-center justify-center p-8 sm:p-12 overflow-hidden bg-[#0A0A0A]">

                {/* Glowing Orb - more vibrant */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-r from-[#F97C00]/30 to-[#FACC15]/20 blur-[100px] rounded-[100%] mix-blend-screen pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[300px] bg-[#F97C00]/15 blur-[60px] rounded-full pointer-events-none" />

                {/* Desktop Inner NavBar */}
                <div className="absolute top-6 left-8 right-8 sm:left-12 sm:right-12 flex justify-between items-center z-10 text-white/60 text-xs">
                  <div className="font-bold text-white tracking-widest">SATSU</div>
                  <div className="hidden sm:flex gap-6">
                    <span className="hover:text-white cursor-pointer transition-colors">Protocol</span>
                    <span className="hover:text-white cursor-pointer transition-colors">How It Works</span>
                    <span className="hover:text-white cursor-pointer transition-colors">Privacy</span>
                    <span className="hover:text-white cursor-pointer transition-colors">Docs</span>
                  </div>
                  <div className="px-4 py-1.5 bg-white text-black rounded-full font-semibold cursor-pointer text-[11px]">Log In</div>
                </div>

                {/* Dashboard illustration */}
                <div className="relative z-10 w-full max-w-2xl mt-12 flex flex-col items-center">
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-white tracking-tight mb-8 text-center leading-tight">
                    Seamless Privacy.<br/> Absolute Control.
                  </h1>

                  {/* Action Buttons */}
                  <div className="flex gap-4 mb-16">
                    <div className="bg-white text-black px-6 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 hover:scale-105 transition-transform cursor-pointer">
                      Get Started
                    </div>
                    <div className="bg-transparent border border-white/20 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-white/10 transition-colors cursor-pointer">
                      Learn More
                    </div>
                  </div>

                  {/* Inner Dark Floating Card Widget */}
                  <div className="w-full max-w-[480px] h-[260px] rounded-[1.5rem] bg-[#141414] border border-white/5 p-6 flex flex-col shadow-2xl">
                    <div className="flex justify-between items-center mb-8">
                       <span className="text-white/60 font-medium text-sm">Shielded Wallet</span>
                       <span className="text-white/80 font-mono text-sm tracking-wider">**** 4784</span>
                    </div>

                    <div className="flex-1 bg-gradient-to-tr from-[#1a1a1a] to-[#222] rounded-xl border border-white/5 p-5 relative overflow-hidden flex flex-col justify-between">
                       <div className="absolute inset-0 opacity-10 mix-blend-overlay" style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }} />

                       <div className="relative z-10 flex justify-between">
                         <div className="text-2xl font-black text-white/20 tracking-widest">SATSU</div>
                         <Shield className="w-5 h-5 text-white/40" />
                       </div>

                       <div className="relative z-10 flex gap-3 mt-auto">
                         <div className="flex-1 bg-white/5 border border-white/10 rounded-lg py-2.5 text-center text-xs text-white/90 hover:bg-white/10 cursor-pointer transition-colors backdrop-blur-sm">
                           Deposit
                         </div>
                         <div className="flex-1 bg-white text-black rounded-lg py-2.5 text-center text-xs font-bold hover:bg-white/90 cursor-pointer transition-colors flex justify-center items-center gap-2">
                           Withdraw <ArrowUpRight className="w-3 h-3" />
                         </div>
                       </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        </div>
      </section>


      {/* ================= POWERED BY STRIP ================= */}
      <section className="relative w-full py-16 px-6 z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="max-w-[1000px] mx-auto">
          <p className="text-center text-white/20 text-[11px] tracking-[0.25em] uppercase font-medium mb-10">Built on</p>
          <div className="flex items-center justify-center gap-10 sm:gap-16 flex-wrap">
            {[
              { name: "Bitcoin", sub: "Settlement" },
              { name: "Stacks", sub: "Smart Contracts" },
              { name: "sBTC", sub: "Peg" },
              { name: "Winterfell", sub: "ZK Proofs" },
              { name: "Chainhook", sub: "Indexing" },
            ].map((tech) => (
              <div key={tech.name} className="flex flex-col items-center gap-1.5 group cursor-default">
                <span className="text-lg sm:text-xl font-bold text-white/20 group-hover:text-white/50 transition-colors duration-500 tracking-wide">{tech.name}</span>
                <span className="text-[9px] text-white/10 group-hover:text-white/25 transition-colors duration-500 tracking-[0.15em] uppercase">{tech.sub}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>


      {/* ================= TYPOGRAPHY & AVATARS SECTION ================= */}
      <section className="py-28 px-6 relative z-10 mt-16">
        {/* Top rule */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-12 items-center text-white">

          <div className="md:col-span-3 text-white/30 text-[13px] font-medium tracking-wide uppercase space-y-2 border-l border-white/10 pl-6 h-full flex flex-col justify-center">
            <p>Stealth</p>
            <p className="text-white/60">Deposits</p>
            <p>Shielded</p>
            <p>Withdrawals</p>
          </div>

          <div className="md:col-span-6 flex flex-col items-center text-center">
            <span className="text-white/40 text-[11px] tracking-[0.2em] font-medium uppercase mb-5">Privacy By Default</span>
            <h2
              className="font-heading text-5xl sm:text-6xl md:text-7xl font-bold tracking-tighter mb-12"
              style={{ lineHeight: "1.05" }}
            >
              <span className="text-gradient-warm">Untraceable</span> Payments <br/>For Everyone
            </h2>

            <div className="flex items-center justify-center pr-4">
               {/* Mini physical card */}
               <div className="h-[48px] w-[72px] rounded-lg bg-[#111] border border-white/10 mr-4 flex items-center justify-center relative overflow-hidden shadow-xl z-30">
                 <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-[#333]" />
                 <div className="absolute bottom-2 right-2 w-4 h-1 rounded-sm bg-white/20" />
                 <div className="w-full h-full bg-gradient-to-tr from-transparent to-white/5" />
               </div>

               {/* Overlapping avatars */}
               {[
                 "https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?auto=format&fit=crop&w=100&h=100&q=80",
                 "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80",
                 "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80",
               ].map((src, i) => (
                 <div key={i} className="w-12 h-12 md:w-14 md:h-14 rounded-full border-[3px] border-[#050505] bg-[#222] -ml-4 z-20 flex items-center justify-center overflow-hidden shadow-lg hover:scale-110 transition-transform duration-300 cursor-pointer grayscale hover:grayscale-0">
                   <img src={src} alt="User" className="w-full h-full object-cover" />
                 </div>
               ))}

               {/* 3D sphere */}
               <div className="w-12 h-12 md:w-14 md:h-14 rounded-full border-[3px] border-[#050505] bg-[#F97C00] -ml-4 z-30 flex items-center justify-center shadow-[0_0_15px_rgba(249,124,0,0.4)] relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-full h-full bg-white/30 rounded-full blur-[8px] transform translate-x-2 -translate-y-2 pointer-events-none" />
                 <span className="text-black font-bold text-xs">AI</span>
               </div>
            </div>
          </div>

          <div className="md:col-span-3 flex justify-end">
            <div className="flex w-full md:w-auto mt-8 md:mt-0 justify-between md:justify-start items-center md:items-end md:flex-col border-b border-white/10 pb-6 md:border-none md:pb-0 h-full">
              <div className="w-10 h-10 rounded-full bg-[#111] border border-white/10 flex items-center justify-center mb-4 md:order-1 order-2 cursor-pointer hover:bg-white/10 transition-colors duration-300">
                <Wallet className="w-4 h-4 text-white/80" />
              </div>
              <p className="text-white/60 text-sm font-medium order-1 md:order-2">Full Privacy</p>
            </div>
          </div>

        </div>

        {/* Bottom rule */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>

    </div>
  );
}
