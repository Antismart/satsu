import Link from "next/link";

const footerLinks = [
  { href: "https://github.com/satsu-privacy", label: "GitHub" },
  { href: "/docs", label: "Documentation" },
  { href: "/register", label: "Register" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] mt-auto bg-background/50">
      <div className="mx-auto max-w-[1200px] px-6 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <span className="text-xs font-bold text-white">S</span>
            </div>
            <span className="text-sm text-muted-dim">
              Satsu -- Private Payments on Bitcoin
            </span>
          </div>

          <nav className="flex items-center gap-8">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-dim hover:text-foreground transition-colors duration-200"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <p className="text-xs text-muted-dim">
            Built on Stacks. Secured by Bitcoin.
          </p>
        </div>
      </div>
    </footer>
  );
}
