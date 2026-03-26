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
    icon: "shield",
  },
  {
    title: "Shielded Pool",
    description:
      "Deposit sBTC into a shared pool where all deposits become indistinguishable. Your funds blend in with the entire anonymity set.",
    icon: "lock",
  },
  {
    title: "Zero Knowledge",
    description:
      "Prove you own funds without revealing which deposit is yours. ZK proofs are generated locally in your browser -- nothing leaves your device.",
    icon: "eye-off",
  },
];

const howItWorks = [
  {
    step: "01",
    title: "Deposit",
    description:
      "Deposit a fixed denomination of sBTC into the privacy pool. Your deposit becomes indistinguishable from all others in the set.",
  },
  {
    step: "02",
    title: "Prove",
    description:
      "Generate a zero-knowledge proof locally in your browser. The proof confirms you have funds without revealing which deposit is yours.",
  },
  {
    step: "03",
    title: "Withdraw",
    description:
      "Submit your proof to withdraw to any address. A relayer submits the transaction so your identity is never linked.",
  },
];

function ShieldIcon() {
  return (
    <svg
      className="h-7 w-7 text-[#0057ff]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      className="h-7 w-7 text-[#0057ff]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      className="h-7 w-7 text-[#0057ff]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  );
}

const iconMap: Record<string, () => React.JSX.Element> = {
  shield: ShieldIcon,
  lock: LockIcon,
  "eye-off": EyeOffIcon,
};

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero - Dark section */}
      <section className="relative overflow-hidden bg-[#191919]">
        {/* Background effects */}
        <div className="absolute inset-0 dot-pattern opacity-30" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-gradient-to-b from-[#0057ff]/[0.12] via-[#4f8aff]/[0.06] to-transparent rounded-full blur-[120px] pointer-events-none" />

        <div className="relative mx-auto max-w-[1200px] px-6 py-28 sm:py-36 lg:py-44">
          <div className="max-w-2xl animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] mb-8">
              <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
              <span className="text-xs text-gray-400 font-medium tracking-wide">
                Testnet Live
              </span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-white">
              Private Payments
              <br />
              <span className="text-[#0057ff]">on Bitcoin</span>
            </h1>

            <p className="mt-6 text-lg text-gray-400 leading-relaxed max-w-xl">
              Satsu brings zero-knowledge privacy to Bitcoin through Stacks.
              Deposit sBTC into shielded pools, generate stealth addresses, and
              withdraw without revealing the link between sender and receiver.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                href="/dashboard"
                className="group inline-flex items-center justify-center px-8 py-3 rounded-full bg-[#0057ff] text-white font-semibold text-sm shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-all duration-300 hover:bg-[#0046cc] hover:brightness-110"
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
                className="inline-flex items-center justify-center px-8 py-3 rounded-full border border-white/[0.15] text-gray-300 hover:text-white hover:border-white/[0.3] hover:bg-white/[0.04] font-semibold text-sm transition-all duration-300"
              >
                Learn More
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="relative bg-white border-b border-[#e8e8e8]">
        <div className="mx-auto max-w-[1200px] px-6 py-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={`text-center animate-fade-in-up animation-delay-${(i + 1) * 100}`}
              >
                <p className="text-3xl sm:text-4xl font-bold tracking-tight font-mono tabular-nums text-[#0057ff]">
                  {stat.value}
                </p>
                <p className="text-sm text-[#6b7280] mt-1.5 font-medium">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative bg-[#f9f9f9]">
        <div className="mx-auto max-w-[1200px] px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#191919]">
              Privacy by Design
            </h2>
            <p className="mt-4 text-[#6b7280] max-w-lg mx-auto">
              Three pillars of privacy engineered into every transaction.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {features.map((feature) => {
              const Icon = iconMap[feature.icon];
              return (
                <div
                  key={feature.title}
                  className="group bg-white rounded-2xl border border-[#e8e8e8] p-8 shadow-sm transition-all duration-300 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                >
                  <div className="h-14 w-14 rounded-2xl bg-[#0057ff]/[0.08] flex items-center justify-center mb-6">
                    <Icon />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 tracking-tight text-[#191919]">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-[#6b7280] leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative bg-white">
        <div className="mx-auto max-w-[1200px] px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#191919]">
              How Satsu Works
            </h2>
            <p className="mt-4 text-[#6b7280] max-w-lg mx-auto">
              Three simple steps to achieve complete financial privacy on
              Bitcoin.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {howItWorks.map((item, i) => (
              <div key={item.step} className="relative flex flex-col items-center text-center">
                {/* Numbered circle */}
                <div className="h-16 w-16 rounded-full bg-gradient-to-r from-[#0057ff] to-[#4f8aff] flex items-center justify-center mb-6 shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
                  <span className="text-xl font-bold text-white">{item.step}</span>
                </div>
                {/* Connector line */}
                {i < 2 && (
                  <div className="hidden sm:block absolute top-8 left-[calc(50%+40px)] w-[calc(100%-80px)] h-px bg-[#e8e8e8]" />
                )}
                <h3 className="text-xl font-semibold mb-3 tracking-tight text-[#191919]">
                  {item.title}
                </h3>
                <p className="text-sm text-[#6b7280] leading-relaxed max-w-xs">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative bg-[#f9f9f9]">
        <div className="mx-auto max-w-[1200px] px-6 py-24">
          <div className="bg-gradient-to-r from-[#0057ff] to-[#4f8aff] rounded-2xl p-12 sm:p-16 text-center shadow-[0_4px_24px_rgba(0,87,255,0.2)]">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-white">
              Ready to go private?
            </h2>
            <p className="text-blue-100 max-w-md mx-auto mb-8">
              Start using Satsu today. Deposit sBTC, generate proofs, and
              withdraw with complete privacy.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center px-10 py-3.5 rounded-full bg-white text-[#0057ff] font-semibold text-sm transition-all duration-300 hover:brightness-95 shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
            >
              Launch App
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
