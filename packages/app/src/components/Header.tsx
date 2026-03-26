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
    <header className="sticky top-0 z-50 border-b border-[#e8e8e8] bg-white/80 backdrop-blur-[30px]">
      <div className="mx-auto max-w-[1200px] flex items-center justify-between px-6 h-16">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-lg bg-[#0057ff] flex items-center justify-center transition-shadow duration-300 group-hover:shadow-[0_0_16px_rgba(0,87,255,0.3)]">
              <span className="text-sm font-bold text-white">S</span>
            </div>
            <span className="text-lg font-semibold tracking-tight text-[#191919]">
              Satsu
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                    isActive
                      ? "text-[#0057ff] bg-[#0057ff]/[0.06]"
                      : "text-[#6b7280] hover:text-[#191919] hover:bg-[#f9f9f9]"
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
