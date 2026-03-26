import Link from "next/link";

const stats = [
  { label: "Total Deposits", value: "1,247" },
  { label: "Anonymity Set", value: "892" },
  { label: "Pool Value", value: "42.8 sBTC" },
  { label: "Unique Users", value: "318" },
];

const features = [
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

const assurances = [
  {
    title: "Non-custodial",
    description:
      "Your keys, your funds. Satsu never takes custody of your assets. The smart contract enforces all rules on-chain.",
  },
  {
    title: "Client-side proofs",
    description:
      "Zero-knowledge proofs are generated entirely in your browser. No secrets ever leave your device.",
  },
  {
    title: "Bitcoin-secured",
    description:
      "All state is anchored to Bitcoin through Stacks. Pool integrity is guaranteed by Clarity smart contracts.",
  },
  {
    title: "Open source",
    description:
      "Every component -- SDK, contracts, prover, and relayer -- is open source and auditable.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 dot-pattern" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.07] via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-primary/[0.08] via-secondary/[0.04] to-transparent rounded-full blur-[120px] pointer-events-none" />

        <div className="relative mx-auto max-w-[1200px] px-6 py-28 sm:py-36 lg:py-44">
          <div className="max-w-2xl animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] mb-8">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-green" />
              <span className="text-xs text-muted font-medium tracking-wide">
                Testnet Live
              </span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
              Private Payments
              <br />
              <span className="gradient-text">on Bitcoin</span>
            </h1>

            <p className="mt-6 text-lg text-muted leading-relaxed max-w-xl">
              Satsu brings zero-knowledge privacy to Bitcoin through Stacks.
              Deposit sBTC into shielded pools, generate stealth addresses, and
              withdraw without revealing the link between sender and receiver.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                href="/dashboard"
                className="group relative inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold text-sm transition-all duration-300 hover:shadow-[0_0_40px_rgba(59,130,246,0.25)] hover:brightness-110"
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
              <Link
                href="/register"
                className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl border border-white/[0.08] text-muted hover:text-foreground hover:border-white/[0.16] hover:bg-white/[0.03] font-medium text-sm transition-all duration-300"
              >
                Register Address
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="relative border-t border-b border-white/[0.06]">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] via-transparent to-secondary/[0.03]" />
        <div className="relative mx-auto max-w-[1200px] px-6 py-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={`text-center animate-fade-in-up animation-delay-${(i + 1) * 100}`}
              >
                <p className="text-3xl sm:text-4xl font-bold tracking-tight font-mono tabular-nums gradient-text">
                  {stat.value}
                </p>
                <p className="text-sm text-muted-dim mt-1.5 font-medium">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative">
        <div className="mx-auto max-w-[1200px] px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              How Satsu Works
            </h2>
            <p className="mt-4 text-muted max-w-lg mx-auto">
              Three simple steps to achieve complete financial privacy on
              Bitcoin.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.step}
                className="group rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-8 transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.08)]"
              >
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-xs font-mono font-bold text-primary/60 tracking-wider">
                    {feature.step}
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-primary/20 to-transparent" />
                </div>
                <h3 className="text-xl font-semibold mb-3 tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Assurances */}
      <section className="relative">
        <div className="absolute inset-0 dot-pattern opacity-50" />
        <div className="relative mx-auto max-w-[1200px] px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Built for Trust
            </h2>
            <p className="mt-4 text-muted max-w-lg mx-auto">
              Every layer of Satsu is designed to minimize trust assumptions.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {assurances.map((item) => (
              <div
                key={item.title}
                className="group rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-8 transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.08)]"
              >
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-secondary/10 flex items-center justify-center mb-5">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2 tracking-tight">
                  {item.title}
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/[0.04] to-transparent" />
        <div className="relative mx-auto max-w-[1200px] px-6 py-24">
          <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-12 sm:p-16 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Ready to go private?
            </h2>
            <p className="text-muted max-w-md mx-auto mb-8">
              Start using Satsu today. Deposit sBTC, generate proofs, and
              withdraw with complete privacy.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center px-10 py-4 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold text-sm transition-all duration-300 hover:shadow-[0_0_40px_rgba(59,130,246,0.25)] hover:brightness-110"
            >
              Launch App
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
