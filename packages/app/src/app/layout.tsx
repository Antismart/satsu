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
    <html lang="en" className="h-full antialiased" style={{ background: "#0A0A0A" }}>
      <body
        className="min-h-full flex flex-col"
        style={{
          background: "#0A0A0A",
          color: "#FFFFFF",
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
