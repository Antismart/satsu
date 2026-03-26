import Link from "next/link";

const footerLinks = [
  { href: "https://github.com/satsu-privacy", label: "GitHub" },
  { href: "/docs", label: "Documentation" },
  { href: "/register", label: "Register" },
];

export function Footer() {
  return (
    <footer className="bg-[#191919] mt-auto">
      <div className="mx-auto max-w-[1200px] px-6 py-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-[#0057ff] flex items-center justify-center">
              <span className="text-xs font-bold text-white">S</span>
            </div>
            <span className="text-sm text-gray-400">
              Satsu -- Private Payments on Bitcoin
            </span>
          </div>

          <nav className="flex items-center gap-8">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-gray-400 hover:text-white transition-colors duration-300"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <p className="text-xs text-gray-500">
            Built on Stacks. Secured by Bitcoin.
          </p>
        </div>
      </div>
    </footer>
  );
}
