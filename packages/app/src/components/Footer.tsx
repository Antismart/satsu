import Link from "next/link";

const footerLinks = [
  { href: "https://github.com/satsu-privacy", label: "GitHub" },
  { href: "/docs", label: "Documentation" },
  { href: "/register", label: "Register" },
];

export function Footer() {
  return (
    <footer className="border-t border-card-border mt-auto">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
              <span className="text-xs font-bold text-white">S</span>
            </div>
            <span className="text-sm text-muted">
              Satsu -- Private Payments on Bitcoin
            </span>
          </div>

          <nav className="flex items-center gap-6">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <p className="text-xs text-muted">
            Built on Stacks. Secured by Bitcoin.
          </p>
        </div>
      </div>
    </footer>
  );
}
