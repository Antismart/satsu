"use client";

import dynamic from "next/dynamic";

const DashboardContent = dynamic(() => import("./DashboardContent"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-16 sm:py-28">
      <div className="max-w-md mx-auto text-center">
        <div className="h-16 w-16 rounded-2xl bg-[#F97C00]/10 mx-auto mb-6" />
        <p className="text-white/50">Loading dashboard...</p>
      </div>
    </div>
  ),
});

export default function DashboardPage() {
  return <DashboardContent />;
}
