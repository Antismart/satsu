import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Satsu - Private Payments on Bitcoin",
  description:
    "Stealth deposits. Shielded transfers. Zero-knowledge privacy on Bitcoin via Stacks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#F9F9F9] text-[#191919]" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
