import Link from "next/link";

const stats = [
  { label: "Total Deposits", value: "1,247" },
  { label: "Anonymity Set", value: "892" },
  { label: "Pool Value", value: "42.8 sBTC" },
  { label: "Active Users", value: "318" },
];

const features = [
  {
    title: "Stealth Addresses",
    description:
      "Generate one-time addresses for every payment. Receivers stay completely hidden on-chain -- no address reuse, no trail.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>
    ),
  },
  {
    title: "Shielded Pool",
    description:
      "Deposit sBTC into a shared pool where all deposits become indistinguishable. Your funds blend in with the entire anonymity set.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    title: "Zero Knowledge",
    description:
      "Prove you own funds without revealing which deposit is yours. ZK proofs are generated locally in your browser -- nothing leaves your device.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
      </svg>
    ),
  },
];

const howItWorks = [
  {
    step: 1,
    title: "Deposit",
    description:
      "Deposit a fixed denomination of sBTC into the privacy pool. Your deposit becomes indistinguishable from all others in the set.",
  },
  {
    step: 2,
    title: "Prove",
    description:
      "Generate a zero-knowledge proof locally in your browser. The proof confirms you have funds without revealing which deposit is yours.",
  },
  {
    step: 3,
    title: "Withdraw",
    description:
      "Submit your proof to withdraw to any address. A relayer submits the transaction so your identity is never linked.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* ================================================================
          HERO - Dark with warm orange glow
          ================================================================ */}
      <section className="relative overflow-hidden bg-[#0A0A0A]">
        {/* Warm ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[700px] bg-[radial-gradient(ellipse_at_50%_30%,rgba(249,124,0,0.20),transparent_60%)]" />
          <div className="absolute top-[20%] right-[15%] w-[300px] h-[300px] bg-[radial-gradient(circle,rgba(249,124,0,0.08),transparent_70%)] blur-[60px]" />
        </div>

        {/* Diamond grid overlay */}
        <div className="absolute inset-0 pointer-events-none diamond-grid opacity-50" />

        {/* Decorative shapes */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full border border-white/[0.03] animate-shimmer" />
          <div className="absolute bottom-20 -left-20 w-[300px] h-[300px] rounded-full bg-[#F97C00]/[0.03]" />
          <div className="absolute top-[20%] left-[15%] w-2 h-2 rounded-full bg-[#F97C00]/30" />
          <div className="absolute bottom-[30%] right-[20%] w-1.5 h-1.5 rounded-full bg-white/10" />
        </div>

        <div className="relative mx-auto max-w-[1200px] px-6 py-28 sm:py-36 lg:py-48">
          <div className="max-w-3xl animate-fade-in-up">
            {/* Tag pills */}
            <div className="flex flex-wrap gap-3 mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card !border-white/[0.1]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4ADE80]" />
                <span className="text-xs text-white/60 font-semibold tracking-wide uppercase">
                  Privacy Protocol
                </span>
              </div>
              <div className="inline-flex items-center px-4 py-1.5 rounded-full glass-card !border-white/[0.1]">
                <span className="text-xs text-white/60 font-semibold tracking-wide uppercase">
                  Zero Knowledge
                </span>
              </div>
            </div>

            {/* Serif hero heading */}
            <h1 className="font-heading text-5xl md:text-7xl tracking-tight leading-[1.08] text-white">
              Private Payments
              <br />
              <span className="bg-gradient-to-r from-[#F97C00] to-[#FACC15] bg-clip-text text-transparent">
                on Bitcoin.
              </span>
            </h1>

            <p className="mt-6 text-lg text-white/60 leading-relaxed max-w-xl">
              Satsu brings zero-knowledge privacy to Bitcoin through Stacks.
              Deposit sBTC into shielded pools, generate stealth addresses, and
              withdraw without revealing the link between sender and receiver.
            </p>

            {/* CTA buttons */}
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                href="/dashboard"
                className="group btn-accent inline-flex items-center justify-center h-12 px-8 text-sm"
              >
                Launch App
                <svg
                  className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </Link>
              <a
                href="#features"
                className="btn-glass inline-flex items-center justify-center h-12 px-8 text-sm font-semibold"
              >
                Learn More
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          STATS ROW - Dark glass cards on black
          ================================================================ */}
      <section className="relative bg-[#0A0A0A]">
        <div className="mx-auto max-w-[1200px] px-6 py-14">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={`glass-card p-6 text-center animate-fade-in-up animation-delay-${(i + 1) * 100}`}
              >
                <p className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  {stat.value}
                </p>
                <p className="text-xs text-white/35 mt-2 uppercase tracking-wider font-semibold">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          FEATURES - Dark glass bento cards
          ================================================================ */}
      <section id="features" className="relative bg-[#0A0A0A] diamond-grid">
        <div className="mx-auto max-w-[1200px] px-6 py-24">
          <div className="text-center mb-16">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-white/35 mb-3">
              Core Technology
            </p>
            <h2 className="font-heading text-3xl md:text-4xl tracking-tight text-white">
              Privacy by Design
            </h2>
            <p className="mt-4 text-base text-white/50 max-w-lg mx-auto">
              Three pillars of privacy engineered into every transaction.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="glass-card p-8 group"
              >
                <div className="h-14 w-14 rounded-2xl bg-[#F97C00]/10 flex items-center justify-center mb-6 text-[#F97C00] group-hover:bg-[#F97C00]/15 transition-colors duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3 tracking-tight text-white">
                  {feature.title}
                </h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          LARGE TYPOGRAPHY SECTION
          ================================================================ */}
      <section className="relative bg-[#0A0A0A]">
        <div className="mx-auto max-w-[1200px] px-6 py-24">
          <h2 className="font-heading text-4xl md:text-6xl tracking-tight text-white text-center leading-[1.1] max-w-4xl mx-auto">
            Instant Privacy For Every Transaction
          </h2>
          <p className="mt-6 text-center text-white/40 text-base max-w-xl mx-auto">
            Built on Stacks. Secured by Bitcoin. Powered by zero-knowledge cryptography.
          </p>
          {/* Avatar circles */}
          <div className="flex justify-center mt-10 -space-x-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-10 w-10 rounded-full border-2 border-[#0A0A0A] flex items-center justify-center text-xs font-bold text-white/60"
                style={{
                  background: `linear-gradient(135deg, rgba(249,124,0,${0.15 + i * 0.08}), rgba(250,204,21,${0.1 + i * 0.05}))`,
                }}
              >
                {String.fromCharCode(65 + i)}
              </div>
            ))}
            <div className="h-10 w-10 rounded-full border-2 border-[#0A0A0A] bg-white/[0.06] flex items-center justify-center text-xs font-semibold text-white/50">
              +89
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          HOW IT WORKS - Steps with connector
          ================================================================ */}
      <section className="relative bg-[#0A0A0A] diamond-grid">
        <div className="mx-auto max-w-[1200px] px-6 py-24">
          <div className="text-center mb-16">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-white/35 mb-3">
              Simple Process
            </p>
            <h2 className="font-heading text-3xl md:text-4xl tracking-tight text-white">
              How Satsu Works
            </h2>
            <p className="mt-4 text-base text-white/50 max-w-lg mx-auto">
              Three simple steps to achieve complete financial privacy on
              Bitcoin.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {howItWorks.map((item, i) => (
              <div key={item.step} className="relative flex flex-col items-center text-center">
                {/* Connector line */}
                {i < 2 && (
                  <div className="hidden sm:block absolute top-8 left-[calc(50%+36px)] w-[calc(100%-72px)] h-[1px] bg-white/[0.08]" />
                )}
                {/* Numbered circle with gradient */}
                <div className="relative z-10 h-16 w-16 rounded-full flex items-center justify-center mb-6"
                  style={{ background: "linear-gradient(135deg, #F97C00, #E84D00)", boxShadow: "0 5px 25px rgba(249,124,0,0.3)" }}
                >
                  <span className="text-xl font-bold text-white">{item.step}</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 tracking-tight text-white">
                  {item.title}
                </h3>
                <p className="text-sm text-white/50 leading-relaxed max-w-xs">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          CTA BANNER - Warm orange blurred background card
          ================================================================ */}
      <section className="relative bg-[#0A0A0A]">
        <div className="mx-auto max-w-[1200px] px-6 py-24">
          <div className="relative rounded-[24px] overflow-hidden p-12 sm:p-16 text-center">
            {/* Warm blurred background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#F97C00]/20 via-[#E84D00]/15 to-[#F97C00]/10" />
            <div className="absolute inset-0 bg-[#0A0A0A]/60 backdrop-blur-sm" />
            <div className="absolute inset-0 border border-white/[0.08] rounded-[24px]" />

            <div className="relative z-10">
              <h2 className="font-heading text-3xl md:text-4xl tracking-tight mb-4 text-white">
                Ready to go private?
              </h2>
              <p className="text-white/50 max-w-md mx-auto mb-8 text-base">
                Start using Satsu today. Deposit sBTC, generate proofs, and
                withdraw with complete privacy.
              </p>
              <Link
                href="/dashboard"
                className="btn-accent inline-flex items-center justify-center h-12 px-10 text-sm"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
