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
      <section className="relative w-full pt-28 sm:pt-36 pb-24 px-6 max-w-[1400px] mx-auto z-10">

        {/* Top-right pill tags (Behance-style) */}
        <div className="hidden lg:flex absolute top-32 right-6 gap-3 z-20">
          <span className="px-4 py-1.5 rounded-full border border-white/[0.12] bg-white/[0.03] text-[11px] text-white/50 font-medium tracking-wide backdrop-blur-sm">
            Digital Banking
          </span>
          <span className="px-4 py-1.5 rounded-full border border-white/[0.12] bg-white/[0.03] text-[11px] text-white/50 font-medium tracking-wide backdrop-blur-sm">
            Secure Finances
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">

          {/* Left: Floating Metal Card Component & Abstract Elements */}
          <div className="relative w-full h-[600px] flex items-center justify-center order-2 lg:order-1">

            {/* Ambient Backlight for Card - warmer, bigger */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-[#F97C00]/[0.06] blur-[100px] rounded-full" />

            {/* Floating Mini Orbs - slightly smaller, more subtle */}
            <motion.div
              animate={{ y: [0, -12, 0], rotate: [0, 8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-[15%] right-[20%] w-12 h-12 rounded-full bg-gradient-to-br from-[#F97C00] to-[#FACC15] blur-[1px] opacity-70 shadow-[0_0_24px_rgba(249,124,0,0.4)] border border-white/20 z-20 flex items-center justify-center"
            >
              <Fingerprint className="text-black/40 w-6 h-6" />
            </motion.div>

            <motion.div
              animate={{ y: [0, 16, 0], rotate: [0, -12, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
              className="absolute bottom-[15%] left-[15%] w-14 h-14 rounded-full bg-gradient-to-br from-[#111] to-[#333] border border-white/10 z-20 flex items-center justify-center shadow-2xl"
            >
              <Shield className="text-[#F97C00] w-6 h-6" />
            </motion.div>

            {/* Main Card - stronger 3D perspective and shadows */}
            <motion.div
              initial={{ opacity: 0, y: 50, rotateX: 20, rotateY: -20 }}
              animate={{ opacity: 1, y: 0, rotateX: 28, rotateY: -28 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              whileHover={{ rotateX: 15, rotateY: -15, scale: 1.05 }}
              className="relative w-[340px] h-[520px] rounded-[2rem] p-8 flex flex-col justify-between shadow-2xl cursor-pointer z-10"
              style={{
                background: "linear-gradient(145deg, #2a2a2a 0%, #1c1c1c 30%, #111 60%, #0a0a0a 100%)",
                boxShadow: "-35px 45px 90px rgba(0,0,0,0.95), inset 2px 2px 10px rgba(255,255,255,0.12), inset -2px -2px 10px rgba(0,0,0,0.8), 0 0 60px rgba(0,0,0,0.6)",
                border: "1px solid rgba(255,255,255,0.08)"
              }}
            >
              {/* Card Grain Overlay */}
              <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay pointer-events-none rounded-[2rem]" style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }} />

              {/* Brushed metal sheen effect */}
              <div className="absolute inset-0 rounded-[2rem] pointer-events-none" style={{
                background: "linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.04) 25%, transparent 50%, rgba(255,255,255,0.02) 75%, transparent 100%)"
              }} />

              {/* Top Card Elements */}
              <div className="relative z-10 flex justify-between items-start">
                {/* SATSU text rotated vertically */}
                <span className="text-3xl font-black tracking-[0.25em] text-white/[0.07]" style={{
                  transform: "rotate(-90deg)",
                  transformOrigin: "top left",
                  position: "absolute",
                  top: "160px",
                  left: "-6px"
                }}>
                  SATSU
                </span>
                <div className="ml-auto flex flex-col items-end gap-4">
                  <div className="w-14 h-16 border border-white/15 rounded-lg bg-gradient-to-br from-white/10 to-transparent flex flex-col justify-center items-center gap-1.5 shadow-inner">
                    <div className="w-10 h-[1px] bg-white/25" />
                    <div className="w-12 h-[1px] bg-white/25" />
                    <div className="w-10 h-[1px] bg-white/25" />
                  </div>
                  {/* Contactless icon */}
                  <svg className="w-8 h-8 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v20M17 5S21 8 21 12s-4 7-4 7M7 5S3 8 3 12s4 7 4 7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              {/* Bottom Card Elements */}
              <div className="relative z-10 flex justify-between items-end pb-2">
                <div className="flex flex-col">
                  <span className="text-white/30 text-xs tracking-[0.2em] uppercase mb-2">Zero Knowledge</span>
                  <span className="text-white/80 text-2xl font-mono tracking-widest drop-shadow-md">**** 8921</span>
                </div>
                <div className="w-12 h-12 rounded-full border border-white/15 bg-white/5 flex items-center justify-center backdrop-blur-md">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#F97C00] to-[#FACC15]" />
                </div>
              </div>
            </motion.div>

            {/* Pedestal / Shadow Base */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[60%] h-12 bg-black/90 rounded-[100%] blur-2xl flex items-center justify-center z-0">
               <div className="w-[80%] h-8 bg-[#F97C00]/15 rounded-[100%] blur-xl" />
            </div>
          </div>

          {/* Right: Hero Text + Widgets */}
          <div className="flex flex-col gap-8 w-full max-w-lg mx-auto lg:mx-0 order-1 lg:order-2">

            {/* Editorial Hero Text - BIGGER, more luxurious */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1
                className="font-heading text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white mb-8"
                style={{
                  lineHeight: "1.08",
                  letterSpacing: "-0.02em"
                }}
              >
                Smarter card control for{" "}
                <span className="text-gradient-warm">secure</span>, effortless management.
              </h1>
              <p className="text-white/50 text-base sm:text-lg leading-relaxed max-w-md">
                Privacy-first financial tools powered by zero-knowledge proofs on Bitcoin.
                Take control of every transaction.
              </p>
            </motion.div>

            {/* Network Shield Widget */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="bg-[#0f0f0f] border border-white/[0.08] rounded-[2rem] p-8 relative overflow-hidden group shadow-2xl"
            >
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-white text-lg font-medium">Network Shield</h3>
                  <p className="text-white/40 text-xs mt-1">Total anonymized assets</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] border border-white/5 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-white/70" />
                </div>
              </div>

              {/* Advanced Gauge Chart */}
              <div className="relative w-full h-[160px] flex items-end justify-center overflow-hidden mb-8">
                <svg className="absolute w-[280px] h-[280px] bottom-[-140px] opacity-20" viewBox="0 0 100 100">
                  <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="white" strokeWidth="2" strokeDasharray="2 4" strokeLinecap="round" />
                </svg>
                <div className="absolute w-[260px] h-[260px] rounded-full border-[18px] border-[#1a1a1a] bottom-[-130px]" />
                <div className="absolute w-[260px] h-[260px] rounded-full border-[18px] border-t-transparent border-r-transparent border-b-[#F97C00] border-l-[#FACC15] bottom-[-130px] rotate-45 transform transition-transform duration-1000 group-hover:rotate-[75deg]" />

                <div className="relative z-10 flex flex-col items-center">
                  <span className="text-white/40 text-[10px] uppercase tracking-widest mb-1">Left Balance</span>
                  <span className="text-white font-bold text-5xl tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60">42.85 <span className="text-2xl text-white/40">sBTC</span></span>
                </div>
              </div>

              {/* View More Activity - btn-dark style (rounded-xl, not rounded-full) */}
              <Link href="/dashboard" className="w-full flex items-center justify-center gap-2.5 btn-dark py-4 text-sm hover:bg-[#222] transition-all duration-300">
                <RefreshCw className="w-4 h-4 text-white/60" />
                <span>Sync Shielded Activity</span>
              </Link>
            </motion.div>

            {/* List Widgets */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="flex flex-col gap-3"
            >
              {[
                { label: "Anonymity Set", max: "1,000", value: "892", percent: 89, icon: <Shield className="w-4 h-4" /> },
                { label: "Daily Transfers", max: "5,000", value: "1,247", percent: 25, icon: <ArrowUpRight className="w-4 h-4" /> }
              ].map((stat, i) => (
                <div key={i} className="bg-[#0f0f0f] border border-white/5 rounded-[1.5rem] p-4 flex items-center gap-4 hover:border-white/10 transition-all duration-300 shadow-lg hover-lift">
                  <div className="w-12 h-12 rounded-2xl bg-[#1a1a1a] border border-white/5 flex items-center justify-center text-white/70">
                    {stat.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white text-sm font-medium">{stat.label}</h4>
                    <p className="text-white/40 text-[10px] font-mono mt-0.5">{stat.value} of {stat.max}</p>
                  </div>
                  <div className="relative w-14 h-14 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <path className="text-[#1a1a1a]" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                      <path className="text-[#e5e5e5]" strokeDasharray={`${stat.percent}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                    </svg>
                    <span className="absolute text-[10px] text-white/90 font-medium">{stat.percent}%</span>
                  </div>
                </div>
              ))}
            </motion.div>

          </div>

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
                  Next-Gen Credit Management
                </h2>
              </div>

              <div className="flex items-end justify-between mt-auto">
                <div className="bg-[#0f0f0f]/90 border border-white/[0.08] rounded-2xl p-5 backdrop-blur-md max-w-[240px]">
                  <p className="text-white font-bold text-2xl tracking-tight tabular-nums mb-1">$748,42.87</p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-5 rounded bg-gradient-to-r from-[#1a1a1a] to-[#2a2a2a] border border-white/10" />
                    <span className="text-xs text-white/40">Card - **** 2774</span>
                  </div>
                </div>
                <p className="hidden md:block text-white/35 text-sm max-w-[280px] text-right leading-relaxed">
                  Manage your credit card securely with smart controls
                </p>
              </div>
            </div>

            {/* Floating widget card (top-right) */}
            <div className="absolute top-8 right-8 bg-[#0f0f0f]/90 border border-white/[0.08] rounded-2xl p-5 backdrop-blur-md hidden md:block">
              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-2">Left balance</p>
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
            <h2 className="text-white text-3xl sm:text-4xl font-medium tracking-tight mb-4">Maximize Your <span className="text-gradient-warm">Financial Potential</span></h2>
            <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">With our zero-knowledge proofs, you can track spending, optimize savings, and make data-driven decisions effortlessly.</p>
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
                    <span className="hover:text-white cursor-pointer transition-colors">Features</span>
                    <span className="hover:text-white cursor-pointer transition-colors">How it Works</span>
                    <span className="hover:text-white cursor-pointer transition-colors">Pricing</span>
                    <span className="hover:text-white cursor-pointer transition-colors">Security</span>
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
                       <span className="text-white/60 font-medium text-sm">Main Account</span>
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
                           Manage Card
                         </div>
                         <div className="flex-1 bg-white text-black rounded-lg py-2.5 text-center text-xs font-bold hover:bg-white/90 cursor-pointer transition-colors flex justify-center items-center gap-2">
                           Transfer <ArrowUpRight className="w-3 h-3" />
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
            <p>Effortless</p>
            <p className="text-white/60">Spending</p>
            <p>Limits And</p>
            <p>Protection</p>
          </div>

          <div className="md:col-span-6 flex flex-col items-center text-center">
            <span className="text-white/40 text-[11px] tracking-[0.2em] font-medium uppercase mb-5">Real-Time Alerts For Safety</span>
            <h2
              className="font-heading text-5xl sm:text-6xl md:text-7xl font-bold tracking-tighter mb-12"
              style={{ lineHeight: "1.05" }}
            >
              Instant Control <br/>For Every Card
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
              <p className="text-white/60 text-sm font-medium order-1 md:order-2">Easy Management</p>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}
