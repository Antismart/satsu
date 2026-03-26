"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, Lock, Activity, Wallet, ArrowUpRight, RefreshCw, Fingerprint } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-[#050505] text-white selection:bg-[#F97C00] selection:text-white pb-32 relative overflow-hidden">

      {/* ================= GLOBAL BACKGROUNDS & TEXTURES ================= */}
      {/* Grid Pattern + WARM ORANGE GLOW (more prominent, centered) */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        backgroundImage: `
          radial-gradient(ellipse at 50% 15%, rgba(249, 124, 0, 0.22) 0%, rgba(249, 124, 0, 0.08) 35%, transparent 65%),
          linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 100px 100px, 100px 100px',
        backgroundPosition: '0 0, 50px 50px, 50px 50px'
      }} />
      {/* Noise Texture */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none z-0 mix-blend-overlay" style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }} />

      {/* Decorative Crosshairs - subtle CSS crosshairs instead of icons */}
      <div className="crosshair" style={{ top: "18%", left: "8%" }} />
      <div className="crosshair" style={{ top: "55%", right: "12%" }} />
      <div className="crosshair" style={{ bottom: "15%", left: "18%" }} />
      <div className="crosshair" style={{ top: "30%", right: "25%" }} />
      <div className="crosshair" style={{ bottom: "35%", left: "5%" }} />


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

        {/* Full-width heading - text dominates */}
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

        {/* Subtitle + CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 mb-32"
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

        {/* Card showcase - centered below text with floating stats */}
        <div className="relative flex justify-center items-center">

          {/* Ambient warm glow behind card */}
          <div className="absolute w-[500px] h-[400px] bg-[#F97C00]/[0.08] blur-[120px] rounded-full pointer-events-none" />

          {/* The 3D card */}
          <motion.div
            initial={{ opacity: 0, y: 60, rotateX: 20, rotateY: -15 }}
            animate={{ opacity: 1, y: 0, rotateX: 20, rotateY: -15 }}
            transition={{ duration: 1.2, delay: 0.5, ease: "easeOut" }}
            whileHover={{ rotateX: 10, rotateY: -8, scale: 1.03 }}
            className="relative w-[360px] h-[230px] rounded-[1.5rem] p-7 flex flex-col justify-between cursor-pointer z-10"
            style={{
              background: "linear-gradient(145deg, #2a2a2a 0%, #1c1c1c 30%, #111 60%, #0a0a0a 100%)",
              boxShadow: "-20px 30px 70px rgba(0,0,0,0.9), inset 1px 1px 8px rgba(255,255,255,0.1), inset -1px -1px 8px rgba(0,0,0,0.7)",
              border: "1px solid rgba(255,255,255,0.08)"
            }}
          >
            {/* Noise + sheen */}
            <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay pointer-events-none rounded-[1.5rem]" style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }} />
            <div className="absolute inset-0 rounded-[1.5rem] pointer-events-none" style={{
              background: "linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.04) 25%, transparent 50%, rgba(255,255,255,0.02) 75%, transparent 100%)"
            }} />

            {/* Top: chip + contactless */}
            <div className="relative z-10 flex justify-between items-start">
              <div className="w-11 h-8 rounded-md border border-white/15 bg-gradient-to-br from-white/10 to-transparent flex flex-col justify-center items-center gap-0.5">
                <div className="w-7 h-[1px] bg-white/25" />
                <div className="w-8 h-[1px] bg-white/25" />
                <div className="w-7 h-[1px] bg-white/25" />
              </div>
              <svg className="w-6 h-6 text-white/25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8.5 16.5S6 14 6 12s2.5-4.5 2.5-4.5M12 18s-4-3-4-6 4-6 4-6M15.5 19.5S10 16 10 12s5.5-7.5 5.5-7.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            {/* Bottom: branding + number */}
            <div className="relative z-10 flex justify-between items-end">
              <div>
                <span className="text-white/25 text-[9px] tracking-[0.2em] uppercase block mb-1">Zero Knowledge</span>
                <span className="text-white/70 text-lg font-mono tracking-widest">**** **** 8921</span>
              </div>
              <span className="text-xl font-black tracking-[0.2em] text-white/[0.08]">SATSU</span>
            </div>
          </motion.div>

          {/* Floating stat widget - top right of card */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="absolute top-[-30px] right-[5%] lg:right-[15%] bg-[#0f0f0f]/90 border border-white/[0.08] rounded-2xl p-5 backdrop-blur-md z-20 hidden md:block"
          >
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-2">Pool TVL</p>
            <p className="text-2xl font-bold text-white tabular-nums mb-3">42.85 <span className="text-sm text-white/40">sBTC</span></p>
            <div className="progress-track w-40">
              <div className="progress-fill" style={{ width: "68%" }} />
            </div>
          </motion.div>

          {/* Floating stat widget - bottom left of card */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 1.1 }}
            className="absolute bottom-[-20px] left-[5%] lg:left-[15%] bg-[#0f0f0f]/90 border border-white/[0.08] rounded-2xl p-4 backdrop-blur-md z-20 hidden md:flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] border border-white/5 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#F97C00]" />
            </div>
            <div>
              <p className="text-white text-sm font-semibold">892 deposits</p>
              <p className="text-white/35 text-[10px]">Anonymity set</p>
            </div>
          </motion.div>

          {/* Pedestal shadow */}
          <div className="absolute bottom-[-30px] w-[40%] h-8 bg-black/80 rounded-[100%] blur-2xl z-0" />
        </div>
      </section>

      {/* ================= BANNER SECTION (Behance Screenshot 2) ================= */}
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
                <p className="hidden md:block text-white/35 text-sm max-w-[280px] text-right leading-relaxed">
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

      {/* ================= DETAILED BROWSER MOCKUP ================= */}
      <section className="relative w-full py-24 px-6 overflow-hidden z-10">
        <div className="max-w-[1100px] mx-auto relative flex flex-col items-center">

          <div className="text-center mb-14">
            <h2 className="text-white text-3xl sm:text-4xl font-medium tracking-tight mb-4">Your <span className="text-gradient-warm">Privacy Dashboard</span></h2>
            <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">Monitor your shielded deposits, withdrawals, and privacy score. Everything stays between you and the blockchain.</p>
          </div>

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

                {/* Glowing Orb */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-r from-[#F97C00]/25 to-[#FACC15]/15 blur-[120px] rounded-[100%] mix-blend-screen pointer-events-none" />

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
                       {/* Subtle noise inside inner card */}
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

      {/* ================= TYPOGRAPHY & AVATARS SECTION ================= */}
      <section className="py-28 px-6 relative z-10 mt-16 border-t border-white/[0.03]">
        {/* Subtle radial gradient to highlight center */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

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
              Untraceable Payments <br/>For Everyone
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
      </section>

    </div>
  );
}
