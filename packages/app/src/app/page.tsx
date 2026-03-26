"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, Lock, ArrowUpRight, Wallet } from "lucide-react";

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
        <div className="mb-32" />

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
                  {/* EMV Chip */}
                  <div className="w-12 h-[3.75rem] rounded-lg relative overflow-hidden" style={{
                    background: "linear-gradient(150deg, #F0DBA8 0%, #D4B878 25%, #C4A060 50%, #A08040 75%, #8B7340 100%)",
                    boxShadow: "inset 0 2px 4px rgba(255,255,255,0.5), inset 0 -2px 3px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.5)",
                    border: "1px solid rgba(200,170,90,0.5)"
                  }}>
                    <div className="absolute inset-0 flex flex-col justify-center items-center gap-[3px] p-2">
                      <div className="w-full h-[1px] bg-black/25" />
                      <div className="w-[75%] h-[1px] bg-black/25" />
                      <div className="w-full h-[1px] bg-black/25" />
                      <div className="w-[55%] h-[1px] bg-black/25" />
                      <div className="w-full h-[1px] bg-black/25" />
                    </div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-4 rounded-sm border border-black/20 bg-gradient-to-br from-white/30 to-transparent" />
                  </div>

                  {/* Contactless icon - white so it shows on both light and dark areas */}
                  <svg className="w-8 h-8 text-white/40 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8.5 16.5S6 14 6 12s2.5-4.5 2.5-4.5M12 18s-4-3-4-6 4-6 4-6M15.5 19.5S10 16 10 12s5.5-7.5 5.5-7.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>

                {/* Center: SATSU embossed - white with dark shadow for visibility on any bg */}
                <div className="flex-1 flex items-center">
                  <span className="text-[2.4rem] font-black tracking-[0.3em] uppercase select-none text-white/20 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
                    style={{ textShadow: "0 1px 0 rgba(255,255,255,0.1), 0 -1px 0 rgba(0,0,0,0.3)" }}
                  >SATSU</span>
                </div>

                {/* Bottom: stealth address + brand circle */}
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-[10px] text-white/35 tracking-[0.15em] uppercase block mb-1.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">Stealth Address</span>
                    <span className="text-white/50 text-[12px] font-mono tracking-[0.12em] drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">SP1A2B...X7Y8Z9</span>
                  </div>
                  {/* Embossed shield mark */}
                  <div className="w-10 h-10 flex items-center justify-center">
                    <svg className="w-9 h-9 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1">
                      <path d="M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z" fill="white" fillOpacity="0.08" strokeOpacity="0.3" />
                      <path d="M9 12l2 2 4-4" stroke="white" strokeOpacity="0.35" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
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
            className="relative rounded-[2.5rem] overflow-hidden min-h-[520px] diamond-grid"
            style={{
              background: "linear-gradient(145deg, #111 0%, #0d0d0d 100%)",
              border: "1px solid rgba(255, 255, 255, 0.06)"
            }}
          >
            {/* Layered warm glow - left side dominant */}
            <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[140%] pointer-events-none" style={{
              background: "radial-gradient(ellipse at 40% 50%, rgba(249,124,0,0.25) 0%, rgba(232,77,0,0.12) 35%, transparent 70%)",
            }} />
            {/* Secondary glow - center top */}
            <div className="absolute top-[-30%] left-[30%] w-[50%] h-[80%] pointer-events-none" style={{
              background: "radial-gradient(ellipse at 50% 50%, rgba(249,124,0,0.1) 0%, transparent 60%)",
              filter: "blur(40px)"
            }} />
            {/* Noise */}
            <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none rounded-[2.5rem]" style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }} />

            {/* Content grid */}
            <div className="relative z-10 p-10 sm:p-14 flex flex-col min-h-[520px]">

              {/* Top row: heading + floating card */}
              <div className="flex justify-between items-start mb-auto">
                <div className="max-w-[550px]">
                  <span className="text-[10px] text-white/30 uppercase tracking-[0.25em] font-semibold block mb-5">Privacy Infrastructure</span>
                  <h2 className="font-heading text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight mb-6" style={{ lineHeight: "1.08" }}>
                    Stealth Payments,{" "}
                    <span className="text-gradient-warm">Zero Trace</span>
                  </h2>
                  <p className="text-white/40 text-base sm:text-lg leading-relaxed max-w-md">
                    Send and receive sBTC privately through stealth addresses and zero-knowledge proofs. The transaction graph stays hidden.
                  </p>
                </div>

              </div>

              {/* Bottom row: three feature pills + mini card */}
              <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-8 mt-auto pt-10">

                {/* Three feature highlights */}
                <div className="flex flex-wrap gap-3">
                  {[
                    { label: "Stealth Addresses", desc: "Unlinkable recipients" },
                    { label: "ZK-STARK Proofs", desc: "Hidden transaction graph" },
                    { label: "Relayer Network", desc: "Anonymous submission" },
                  ].map((f) => (
                    <div key={f.label} className="bg-white/[0.04] border border-white/[0.06] rounded-2xl px-5 py-4 backdrop-blur-sm hover:border-white/[0.12] transition-colors duration-300">
                      <p className="text-white text-sm font-medium mb-0.5">{f.label}</p>
                      <p className="text-white/30 text-[11px]">{f.desc}</p>
                    </div>
                  ))}
                </div>

                {/* Mini card preview */}
                <div className="bg-[#0a0a0a]/80 border border-white/[0.08] rounded-2xl p-4 backdrop-blur-xl flex items-center gap-4 flex-shrink-0" style={{
                  boxShadow: "0 10px 30px rgba(0,0,0,0.4)"
                }}>
                  {/* Tiny card icon */}
                  <div className="w-14 h-9 rounded-lg relative overflow-hidden flex-shrink-0" style={{
                    background: "linear-gradient(145deg, #888 0%, #444 50%, #1a1a1a 100%)",
                    border: "1px solid rgba(255,255,255,0.1)"
                  }}>
                    <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }} />
                    <div className="absolute bottom-1 right-1.5 w-3 h-2 rounded-sm border border-white/15 bg-gradient-to-br from-white/10 to-transparent" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-lg tabular-nums tracking-tight">748.42 <span className="text-xs text-white/30">sBTC</span></p>
                    <p className="text-white/30 text-[10px] tracking-wider">SP1A2B...X7Y8</p>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      </section>


      {/* ================= HOW IT WORKS SECTION ================= */}
      <section className="relative w-full py-32 px-6 z-10">
        {/* Top gradient line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="max-w-[1200px] mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-20"
          >
            <div>
              <span className="text-[#F97C00] text-[11px] tracking-[0.25em] font-semibold uppercase block mb-4">The Process</span>
              <h2 className="font-heading text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight" style={{ lineHeight: "1.08" }}>
                Three steps to<br /><span className="text-gradient-warm">full privacy</span>
              </h2>
            </div>
            <p className="text-white/35 text-base leading-relaxed max-w-sm md:text-right">
              From deposit to withdrawal, your identity stays hidden at every stage.
            </p>
          </motion.div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 relative">

            {/* Connecting line across all three cards (desktop) */}
            <div className="hidden md:block absolute top-[72px] left-[16.66%] right-[16.66%] h-px z-0" style={{
              background: "linear-gradient(90deg, transparent, rgba(249,124,0,0.3) 20%, rgba(249,124,0,0.3) 80%, transparent)"
            }} />

            {/* Step 1 */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, delay: 0 }}
              className="relative z-10 group"
            >
              <div className="p-8 sm:p-10 rounded-[2rem] transition-all duration-500 hover:bg-white/[0.03] border border-transparent hover:border-white/[0.06]" style={{ minHeight: "320px" }}>
                {/* Step number - large */}
                <div className="flex items-center gap-5 mb-8">
                  <div className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center relative overflow-hidden" style={{
                    background: "linear-gradient(135deg, rgba(249,124,0,0.15), rgba(249,124,0,0.05))",
                    border: "1px solid rgba(249,124,0,0.2)"
                  }}>
                    <span className="text-[#F97C00] text-2xl font-bold">01</span>
                    {/* Subtle inner glow */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{
                      background: "radial-gradient(circle at 50% 50%, rgba(249,124,0,0.2), transparent 70%)"
                    }} />
                  </div>
                  {/* Arrow connector on mobile */}
                  <div className="hidden md:block flex-1 h-px bg-gradient-to-r from-[#F97C00]/30 to-transparent" />
                </div>

                <h3 className="text-white text-xl sm:text-2xl font-semibold mb-4 tracking-tight">Deposit sBTC</h3>
                <p className="text-white/35 text-sm sm:text-base leading-relaxed mb-6">
                  Send sBTC into the shielded pool through a stealth address. Your deposit mixes with hundreds of others.
                </p>

                {/* Visual detail - mini progress indicator */}
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-8 h-1 rounded-full bg-[#F97C00]" />
                    <div className="w-8 h-1 rounded-full bg-white/[0.06]" />
                    <div className="w-8 h-1 rounded-full bg-white/[0.06]" />
                  </div>
                  <span className="text-[10px] text-white/20 uppercase tracking-widest">Step 1 of 3</span>
                </div>
              </div>
            </motion.div>

            {/* Step 2 */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="relative z-10 group"
            >
              <div className="p-8 sm:p-10 rounded-[2rem] transition-all duration-500 hover:bg-white/[0.03] border border-transparent hover:border-white/[0.06] md:border-l md:border-l-white/[0.04] md:border-r md:border-r-white/[0.04]" style={{ minHeight: "320px" }}>
                <div className="flex items-center gap-5 mb-8">
                  <div className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center relative overflow-hidden" style={{
                    background: "linear-gradient(135deg, rgba(249,124,0,0.15), rgba(249,124,0,0.05))",
                    border: "1px solid rgba(249,124,0,0.2)"
                  }}>
                    <span className="text-[#F97C00] text-2xl font-bold">02</span>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{
                      background: "radial-gradient(circle at 50% 50%, rgba(249,124,0,0.2), transparent 70%)"
                    }} />
                  </div>
                  <div className="hidden md:block flex-1 h-px bg-gradient-to-r from-[#F97C00]/30 to-transparent" />
                </div>

                <h3 className="text-white text-xl sm:text-2xl font-semibold mb-4 tracking-tight">Generate Proof</h3>
                <p className="text-white/35 text-sm sm:text-base leading-relaxed mb-6">
                  A zero-knowledge STARK proof is generated in your browser. It proves ownership without revealing your identity.
                </p>

                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-8 h-1 rounded-full bg-[#F97C00]" />
                    <div className="w-8 h-1 rounded-full bg-[#F97C00]" />
                    <div className="w-8 h-1 rounded-full bg-white/[0.06]" />
                  </div>
                  <span className="text-[10px] text-white/20 uppercase tracking-widest">Step 2 of 3</span>
                </div>
              </div>
            </motion.div>

            {/* Step 3 */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="relative z-10 group"
            >
              <div className="p-8 sm:p-10 rounded-[2rem] transition-all duration-500 hover:bg-white/[0.03] border border-transparent hover:border-white/[0.06]" style={{ minHeight: "320px" }}>
                <div className="flex items-center gap-5 mb-8">
                  <div className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center relative overflow-hidden" style={{
                    background: "linear-gradient(135deg, rgba(249,124,0,0.15), rgba(249,124,0,0.05))",
                    border: "1px solid rgba(249,124,0,0.2)"
                  }}>
                    <span className="text-[#F97C00] text-2xl font-bold">03</span>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{
                      background: "radial-gradient(circle at 50% 50%, rgba(249,124,0,0.2), transparent 70%)"
                    }} />
                  </div>
                </div>

                <h3 className="text-white text-xl sm:text-2xl font-semibold mb-4 tracking-tight">Withdraw Privately</h3>
                <p className="text-white/35 text-sm sm:text-base leading-relaxed mb-6">
                  Withdraw to any stealth address through the relayer. No one can link the withdrawal to your deposit.
                </p>

                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-8 h-1 rounded-full bg-[#F97C00]" />
                    <div className="w-8 h-1 rounded-full bg-[#F97C00]" />
                    <div className="w-8 h-1 rounded-full bg-[#F97C00]" />
                  </div>
                  <span className="text-[10px] text-white/20 uppercase tracking-widest">Complete</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>


      {/* ================= BROWSER MOCKUP SECTION ================= */}
      <section className="relative w-full py-32 px-6 overflow-hidden z-10">
        <div className="max-w-[1100px] mx-auto relative flex flex-col items-center">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span className="text-[#F97C00] text-[11px] tracking-[0.25em] font-semibold uppercase block mb-4">Dashboard Preview</span>
            <h2 className="font-heading text-4xl sm:text-5xl font-bold text-white tracking-tight mb-4">Your <span className="text-gradient-warm">Privacy Dashboard</span></h2>
            <p className="text-white/35 text-base max-w-lg mx-auto leading-relaxed">Full control over your shielded assets, deposits, and withdrawal history — all in one place.</p>
          </motion.div>

          {/* Warm glow behind the monitor */}
          <div className="absolute top-[45%] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-[#F97C00]/[0.04] blur-[120px] rounded-full pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="w-full rounded-[2rem] p-2 bg-[#111] border border-white/[0.08] relative" style={{
              boxShadow: "0 40px 120px rgba(0,0,0,0.9), 0 0 1px rgba(255,255,255,0.1)"
            }}
          >
            {/* Monitor stand */}
            <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 w-40 h-14 bg-gradient-to-t from-[#0a0a0a] to-[#1a1a1a] rounded-t-lg z-[-1]" />
            <div className="absolute -bottom-[68px] left-1/2 -translate-x-1/2 w-56 h-3 bg-[#111] rounded-full z-[-1]" style={{
              boxShadow: "0 4px 20px rgba(0,0,0,0.8)"
            }} />

            {/* Screen */}
            <div className="bg-[#0A0A0A] rounded-[1.5rem] overflow-hidden relative flex flex-col" style={{ minHeight: "520px" }}>

              {/* Browser chrome */}
              <div className="h-11 border-b border-white/[0.04] flex items-center px-5 gap-2 bg-[#0e0e0e] flex-shrink-0">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
                </div>
                <div className="mx-auto bg-black/40 border border-white/[0.04] px-16 sm:px-32 py-1 rounded-md text-[10px] text-white/25 font-mono tracking-wider flex items-center gap-3">
                  <Lock className="w-2.5 h-2.5" />
                  satsu.network/dashboard
                </div>
              </div>

              {/* Dashboard content inside browser */}
              <div className="flex-1 p-5 sm:p-8 overflow-hidden relative">

                {/* Top nav inside dashboard */}
                <div className="flex justify-between items-center mb-6">
                  <span className="text-sm font-black tracking-[0.2em] text-white/80">SATSU</span>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />
                      <span className="text-[9px] text-white/40">Online</span>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-white/[0.06] text-[9px] text-white/50 font-mono">SP1A...8Z9</div>
                  </div>
                </div>

                {/* Two-column dashboard layout */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* Left: Mini credit card (matching our metallic card style) */}
                  <div className="rounded-xl p-5 flex flex-col justify-between relative overflow-hidden" style={{
                    background: "linear-gradient(145deg, #d4d4d4 0%, #a0a0a0 25%, #666 50%, #2a2a2a 80%, #1a1a1a 100%)",
                    minHeight: "180px"
                  }}>
                    {/* Brushed texture */}
                    <div className="absolute inset-0 rounded-xl opacity-[0.06]" style={{
                      backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.1) 1px, rgba(255,255,255,0.1) 2px)",
                      backgroundSize: "100% 3px"
                    }} />
                    {/* Specular */}
                    <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                      <div className="absolute w-[200%] h-[40px] bg-gradient-to-r from-transparent via-white/15 to-transparent" style={{
                        top: "25%", left: "-50%", transform: "rotate(-30deg)", filter: "blur(6px)"
                      }} />
                    </div>
                    <div className="relative z-10 flex justify-between items-start">
                      <span className="text-[10px] font-black tracking-[0.2em] text-white/15">SATSU</span>
                      {/* Mini chip */}
                      <div className="w-7 h-5 rounded-sm" style={{
                        background: "linear-gradient(150deg, #E8D5A3, #A08040)",
                        boxShadow: "inset 0 1px 2px rgba(255,255,255,0.4)"
                      }} />
                    </div>
                    <div className="relative z-10">
                      <p className="text-[9px] text-white/30 uppercase tracking-widest mb-0.5">Available</p>
                      <p className="text-xl font-bold text-white/70 tabular-nums drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">749.87 <span className="text-[10px] text-white/30">sBTC</span></p>
                    </div>
                  </div>

                  {/* Right: Stats grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Deposits", value: "892", color: "#F97C00" },
                      { label: "Score", value: "89%", color: "#4ADE80" },
                      { label: "Notes", value: "3", color: "#FACC15" },
                      { label: "Pool TVL", value: "42.8", color: "#F97C00" },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3 flex flex-col justify-between">
                        <span className="text-[8px] text-white/25 uppercase tracking-widest">{s.label}</span>
                        <span className="text-lg font-bold text-white tabular-nums mt-1">{s.value}</span>
                        <div className="h-1 rounded-full bg-white/[0.04] mt-2">
                          <div className="h-full rounded-full" style={{ width: "65%", background: s.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Transaction rows */}
                <div className="mt-4 rounded-xl bg-white/[0.02] border border-white/[0.04] overflow-hidden">
                  {[
                    { title: "Stealth Deposit", time: "2m ago", amount: "-0.1 sBTC", positive: false },
                    { title: "Shielded Withdrawal", time: "1h ago", amount: "+0.1 sBTC", positive: true },
                    { title: "Pool Contribution", time: "3h ago", amount: "-0.05 sBTC", positive: false },
                  ].map((tx, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-white/[0.03] last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${tx.positive ? "bg-[#4ADE80]/10" : "bg-[#F97C00]/10"}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${tx.positive ? "bg-[#4ADE80]" : "bg-[#F97C00]"}`} />
                        </div>
                        <div>
                          <p className="text-[11px] text-white/70 font-medium">{tx.title}</p>
                          <p className="text-[9px] text-white/20">{tx.time}</p>
                        </div>
                      </div>
                      <span className={`text-[11px] font-semibold tabular-nums ${tx.positive ? "text-[#4ADE80]" : "text-white/40"}`}>{tx.amount}</span>
                    </div>
                  ))}
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
