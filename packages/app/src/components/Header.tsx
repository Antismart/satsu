"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletConnect } from "./WalletConnect";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/register", label: "Register" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] glow-line-bottom relative" style={{ background: "rgba(10, 10, 10, 0.85)", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)" }}>
      <div className="mx-auto max-w-[1200px] flex items-center justify-between px-6 h-16">
        <div className="flex items-center gap-8">
          <Link href="/" className="group">
            <span className="text-xl font-black tracking-[0.25em] text-white/90 group-hover:text-white transition-colors duration-300">
              SATSU
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
                    isActive
                      ? "text-white bg-white/[0.1]"
                      : "text-white/50 hover:text-white hover:bg-white/[0.06]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <WalletConnect />
      </div>
    </header>
  );
}
