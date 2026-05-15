"use client";

import dynamic from "next/dynamic";

const RegisterContent = dynamic(() => import("./RegisterContent"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-16 sm:py-28">
      <div className="max-w-md mx-auto text-center">
        <p className="text-white/50">Loading...</p>
      </div>
    </div>
  ),
});

export default function RegisterPage() {
  return <RegisterContent />;
}
