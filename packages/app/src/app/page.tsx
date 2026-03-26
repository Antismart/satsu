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
    icon: "S",
    color: "#0057FF",
  },
  {
    title: "Shielded Pool",
    description:
      "Deposit sBTC into a shared pool where all deposits become indistinguishable. Your funds blend in with the entire anonymity set.",
    icon: "L",
    color: "#B125C0",
  },
  {
    title: "Zero Knowledge",
    description:
      "Prove you own funds without revealing which deposit is yours. ZK proofs are generated locally in your browser -- nothing leaves your device.",
    icon: "Z",
    color: "#002F9A",
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
          HERO - Deep blue dark section with decorative shapes
          ================================================================ */}
      <section className="relative overflow-hidden bg-[#0F214D]">
        {/* Decorative SVG shapes */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Large circle top-right */}
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full border border-white/[0.04] animate-shimmer" />
          <div className="absolute -top-16 -right-16 w-[400px] h-[400px] rounded-full border border-white/[0.03]" />
          {/* Small circle bottom-left */}
          <div className="absolute bottom-20 -left-20 w-[300px] h-[300px] rounded-full bg-[#0057FF]/[0.06]" />
          {/* Rounded rect mid-right */}
          <div className="absolute top-1/3 right-[10%] w-[200px] h-[120px] rounded-3xl bg-[#0057FF]/[0.04] rotate-12" />
          {/* Small accent dot */}
          <div className="absolute top-[20%] left-[15%] w-3 h-3 rounded-full bg-[#0057FF]/20" />
          <div className="absolute bottom-[30%] right-[20%] w-2 h-2 rounded-full bg-white/10" />
          {/* Gradient glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-gradient-to-b from-[#0057FF]/[0.08] via-[#0057FF]/[0.03] to-transparent rounded-full blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-[1200px] px-6 py-28 sm:py-36 lg:py-48">
          <div className="max-w-3xl animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] mb-8">
              <span className="h-1.5 w-1.5 rounded-full bg-[#028901]" />
              <span className="text-xs text-white/60 font-semibold tracking-wide uppercase">
                Testnet Live
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05] text-white">
              Private Payments
              <br />
              <span className="text-[#0057FF]">on Bitcoin</span>
            </h1>

            <p className="mt-6 text-lg text-white/70 leading-relaxed max-w-xl">
              Satsu brings zero-knowledge privacy to Bitcoin through Stacks.
              Deposit sBTC into shielded pools, generate stealth addresses, and
              withdraw without revealing the link between sender and receiver.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                href="/dashboard"
                className="group inline-flex items-center justify-center h-12 px-8 rounded-full bg-white text-[#0F214D] font-semibold text-sm shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-all duration-300 hover:shadow-[0_5px_20px_rgba(255,255,255,0.15)]"
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
                className="inline-flex items-center justify-center h-12 px-8 rounded-full border border-white/[0.15] text-white/80 hover:text-white hover:border-white/[0.3] hover:bg-white/[0.04] font-semibold text-sm transition-all duration-300"
              >
                Documentation
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          STATS ROW - White strip with 4 stat cards
          ================================================================ */}
      <section className="relative bg-white">
        <div className="mx-auto max-w-[1200px] px-6 py-14">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={`bg-white rounded-xl p-6 shadow-[0_5px_20px_rgba(0,0,0,0.08)] text-center transition-all duration-300 hover:shadow-[0_5px_30px_rgba(0,0,0,0.12)] animate-fade-in-up animation-delay-${(i + 1) * 100}`}
              >
                <p className="text-2xl sm:text-3xl font-bold tracking-tight text-[#191919]">
                  {stat.value}
                </p>
                <p className="text-xs text-[#9CA3AF] mt-2 uppercase tracking-wider font-semibold">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          FEATURES - Elevated white cards on light background
          ================================================================ */}
      <section id="features" className="relative bg-[#F9F9F9]">
        <div className="mx-auto max-w-[1200px] px-6 py-24">
          <div className="text-center mb-16">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[#9CA3AF] mb-3">
              Core Technology
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-[#191919]">
              Privacy by Design
            </h2>
            <p className="mt-4 text-base text-[#6B7280] max-w-lg mx-auto">
              Three pillars of privacy engineered into every transaction.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group bg-white rounded-2xl p-8 shadow-[0_5px_20px_rgba(0,0,0,0.08)] transition-all duration-300 hover:shadow-[0_5px_30px_rgba(0,0,0,0.12)]"
              >
                <div
                  className="h-14 w-14 rounded-full flex items-center justify-center mb-6"
                  style={{ backgroundColor: `${feature.color}10` }}
                >
                  <span
                    className="text-xl font-bold"
                    style={{ color: feature.color }}
                  >
                    {feature.icon}
                  </span>
                </div>
                <h3 className="text-xl font-semibold mb-3 tracking-tight text-[#191919]">
                  {feature.title}
                </h3>
                <p className="text-sm text-[#6B7280] leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          HOW IT WORKS - Numbered circles with connector line
          ================================================================ */}
      <section className="relative bg-white">
        <div className="mx-auto max-w-[1200px] px-6 py-24">
          <div className="text-center mb-16">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[#9CA3AF] mb-3">
              Simple Process
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-[#191919]">
              How Satsu Works
            </h2>
            <p className="mt-4 text-base text-[#6B7280] max-w-lg mx-auto">
              Three simple steps to achieve complete financial privacy on
              Bitcoin.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {howItWorks.map((item, i) => (
              <div key={item.step} className="relative flex flex-col items-center text-center">
                {/* Connector line between circles */}
                {i < 2 && (
                  <div className="hidden sm:block absolute top-8 left-[calc(50%+36px)] w-[calc(100%-72px)] h-[2px] bg-[#E8E8E8]" />
                )}
                {/* Numbered circle */}
                <div className="relative z-10 h-16 w-16 rounded-full bg-[#0057FF] flex items-center justify-center mb-6 shadow-[0_5px_20px_rgba(0,87,255,0.25)]">
                  <span className="text-xl font-bold text-white">{item.step}</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 tracking-tight text-[#191919]">
                  {item.title}
                </h3>
                <p className="text-sm text-[#6B7280] leading-relaxed max-w-xs">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          CTA - Blue gradient card
          ================================================================ */}
      <section className="relative bg-[#F9F9F9]">
        <div className="mx-auto max-w-[1200px] px-6 py-24">
          <div className="bg-gradient-to-br from-[#0057FF] to-[#002F9A] rounded-2xl p-12 sm:p-16 text-center shadow-[0_5px_30px_rgba(0,87,255,0.2)]">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-white">
              Ready to go private?
            </h2>
            <p className="text-white/70 max-w-md mx-auto mb-8 text-base">
              Start using Satsu today. Deposit sBTC, generate proofs, and
              withdraw with complete privacy.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center h-12 px-10 rounded-full bg-white text-[#0057FF] font-semibold text-sm transition-all duration-300 hover:shadow-[0_5px_20px_rgba(255,255,255,0.2)] shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
            >
              Get Started
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
