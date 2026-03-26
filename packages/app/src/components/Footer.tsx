import Link from "next/link";

const footerSections = [
  {
    title: "Protocol",
    links: [
      { href: "#", label: "How It Works" },
      { href: "#", label: "Privacy Model" },
      { href: "#", label: "Stealth Addresses" },
      { href: "/docs", label: "Documentation" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "#", label: "Stacks Network" },
      { href: "#", label: "sBTC Bridge" },
      { href: "https://github.com/satsu-privacy", label: "GitHub" },
      { href: "#", label: "Status" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "#", label: "Terms of Service" },
      { href: "#", label: "Privacy Policy" },
      { href: "#", label: "Security" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-[#0A0A0A] mt-auto border-t border-white/[0.06] relative glow-line-top">
      <div className="mx-auto max-w-[1200px] px-6 pt-20 pb-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-12 mb-16">
          {/* Brand column */}
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2.5 mb-5">
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(249,124,0,0.15)]"
                style={{ background: "linear-gradient(135deg, #F97C00, #E84D00)" }}
              >
                <span className="text-sm font-bold text-white">S</span>
              </div>
              <span className="text-lg font-semibold text-white tracking-tight">Satsu</span>
            </div>
            <p className="text-sm text-white/35 leading-relaxed max-w-[220px] mb-6">
              Private payments on Bitcoin through zero-knowledge proofs and stealth addresses.
            </p>
            {/* Satsu wordmark */}
            <span className="text-3xl font-heading font-bold text-white/[0.04] tracking-tight select-none">
              SATSU
            </span>
          </div>

          {/* Link columns */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h4 className="text-[10px] uppercase tracking-widest font-semibold text-white/35 mb-5">
                {section.title}
              </h4>
              <ul className="space-y-3.5">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/50 hover:text-white transition-colors duration-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/25">
            Built on Stacks. Secured by Bitcoin.
          </p>
          <div className="flex items-center gap-6">
            <p className="text-xs text-white/25">
              Satsu Protocol. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
