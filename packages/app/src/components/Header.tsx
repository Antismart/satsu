"use client";

import { useState } from "react";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] glow-line-bottom relative" style={{ background: "rgba(10, 10, 10, 0.85)", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)" }}>
      <div className="mx-auto max-w-[1200px] flex items-center justify-between px-4 sm:px-6 h-14 sm:h-16">
        <div className="flex items-center gap-4 sm:gap-8">
          <Link href="/" className="group" onClick={() => setMobileMenuOpen(false)}>
            <span className="text-lg sm:text-xl font-black tracking-[0.15em] sm:tracking-[0.25em] text-white/90 group-hover:text-white transition-colors duration-300">
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

        <div className="flex items-center gap-2">
          <WalletConnect />

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-all duration-300"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-white/[0.06]" style={{ background: "rgba(10, 10, 10, 0.95)", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)" }}>
          <nav className="flex flex-col px-4 py-3 gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
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
      )}
    </header>
  );
}
