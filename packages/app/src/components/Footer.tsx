import Link from "next/link";

const footerSections = [
  {
    title: "Product",
    links: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/register", label: "Register" },
      { href: "#features", label: "Features" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/docs", label: "Documentation" },
      { href: "https://github.com/satsu-privacy", label: "GitHub" },
      { href: "#", label: "FAQ" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "#", label: "Privacy Policy" },
      { href: "#", label: "Terms of Service" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-[#0A0A0A] mt-auto border-t border-white/[0.06]">
      <div className="mx-auto max-w-[1200px] px-6 py-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-10 mb-12">
          {/* Brand column */}
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #F97C00, #E84D00)" }}
              >
                <span className="text-sm font-bold text-white">S</span>
              </div>
              <span className="text-base font-semibold text-white">Satsu</span>
            </div>
            <p className="text-sm text-white/35 leading-relaxed max-w-[200px]">
              Private payments on Bitcoin through zero-knowledge proofs and stealth addresses.
            </p>
          </div>

          {/* Link columns */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h4 className="text-[10px] uppercase tracking-widest font-semibold text-white/35 mb-4">
                {section.title}
              </h4>
              <ul className="space-y-3">
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
          <p className="text-xs text-white/25">
            Satsu Protocol. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
