import Link from "next/link";

const stats = [
  { label: "Total Deposits", value: "1,247" },
  { label: "Anonymity Set", value: "892" },
  { label: "Pool Value", value: "42.8 sBTC" },
  { label: "Unique Users", value: "318" },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-6xl px-6 py-24 sm:py-32 lg:py-40">
          <div className="max-w-2xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
              Private Payments
              <br />
              <span className="text-primary">on Bitcoin</span>
            </h1>
            <p className="mt-6 text-lg text-muted leading-relaxed max-w-xl">
              Satsu brings zero-knowledge privacy to Bitcoin through Stacks.
              Deposit sBTC into shielded pools, generate stealth addresses, and
              withdraw without revealing the link between sender and receiver.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-sm transition-colors"
              >
                Launch App
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-card-border text-muted hover:text-foreground hover:border-muted font-medium text-sm transition-colors"
              >
                Register Address
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-card-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl font-semibold mb-12 text-center">
            How Satsu Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="rounded-xl border border-card-border bg-card-bg p-6">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <span className="text-primary font-bold text-sm">1</span>
              </div>
              <h3 className="font-semibold mb-2">Deposit</h3>
              <p className="text-sm text-muted leading-relaxed">
                Deposit a fixed denomination of sBTC into the privacy pool.
                Your deposit becomes indistinguishable from all others.
              </p>
            </div>
            <div className="rounded-xl border border-card-border bg-card-bg p-6">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <span className="text-primary font-bold text-sm">2</span>
              </div>
              <h3 className="font-semibold mb-2">Prove</h3>
              <p className="text-sm text-muted leading-relaxed">
                Generate a zero-knowledge proof locally in your browser. The
                proof confirms you have funds without revealing which deposit is
                yours.
              </p>
            </div>
            <div className="rounded-xl border border-card-border bg-card-bg p-6">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <span className="text-primary font-bold text-sm">3</span>
              </div>
              <h3 className="font-semibold mb-2">Withdraw</h3>
              <p className="text-sm text-muted leading-relaxed">
                Submit your proof to withdraw to any address. A relayer submits
                the transaction so your identity is never linked.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-card-border">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-card-border bg-card-bg p-6 text-center"
              >
                <p className="text-2xl font-bold text-primary">{stat.value}</p>
                <p className="text-sm text-muted mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Assurances */}
      <section className="border-t border-card-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="rounded-xl border border-card-border bg-card-bg p-6">
              <h3 className="font-semibold mb-2">Non-custodial</h3>
              <p className="text-sm text-muted leading-relaxed">
                Your keys, your funds. Satsu never takes custody of your
                assets. The smart contract enforces all rules on-chain.
              </p>
            </div>
            <div className="rounded-xl border border-card-border bg-card-bg p-6">
              <h3 className="font-semibold mb-2">Client-side proofs</h3>
              <p className="text-sm text-muted leading-relaxed">
                Zero-knowledge proofs are generated entirely in your browser.
                No secrets ever leave your device.
              </p>
            </div>
            <div className="rounded-xl border border-card-border bg-card-bg p-6">
              <h3 className="font-semibold mb-2">Bitcoin-secured</h3>
              <p className="text-sm text-muted leading-relaxed">
                All state is anchored to Bitcoin through Stacks. Pool
                integrity is guaranteed by Clarity smart contracts.
              </p>
            </div>
            <div className="rounded-xl border border-card-border bg-card-bg p-6">
              <h3 className="font-semibold mb-2">Open source</h3>
              <p className="text-sm text-muted leading-relaxed">
                Every component -- SDK, contracts, prover, and relayer -- is
                open source and auditable.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
