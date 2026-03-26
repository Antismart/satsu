import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-[#0A0A0A] mt-auto border-t border-white/[0.06] relative glow-line-top">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-10 sm:py-16">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-10">
          <div>
            <Link href="/">
              <span className="text-xl font-black tracking-[0.25em] text-white/90">SATSU</span>
            </Link>
            <p className="text-sm text-white/35 leading-relaxed max-w-[280px] mt-3">
              Private payments on Bitcoin through zero-knowledge proofs and stealth addresses.
            </p>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/" className="text-sm text-white/50 hover:text-white transition-colors duration-300">Home</Link>
            <Link href="/dashboard" className="text-sm text-white/50 hover:text-white transition-colors duration-300">Dashboard</Link>
            <Link href="/register" className="text-sm text-white/50 hover:text-white transition-colors duration-300">Register</Link>
            <a href="https://github.com/satsu-privacy" target="_blank" rel="noopener noreferrer" className="text-sm text-white/50 hover:text-white transition-colors duration-300">GitHub</a>
          </div>
        </div>

        <div className="pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/25">
            Built on Stacks. Secured by Bitcoin.
          </p>
          <p className="text-xs text-white/25">
            Satsu Protocol. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
