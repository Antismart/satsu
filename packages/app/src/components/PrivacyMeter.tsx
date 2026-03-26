"use client";

interface PrivacyMeterProps {
  anonymitySetSize: number;
  maxSetSize?: number;
}

function getPrivacyScore(size: number, max: number): number {
  return Math.min(Math.round((size / max) * 100), 100);
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Strong";
  if (score >= 50) return "Moderate";
  if (score >= 20) return "Low";
  return "Weak";
}

export function PrivacyMeter({
  anonymitySetSize,
  maxSetSize = 1000,
}: PrivacyMeterProps) {
  const score = getPrivacyScore(anonymitySetSize, maxSetSize);
  const label = getScoreLabel(score);

  // Semi-circular gauge matching the Behance "Total Expenses" design
  // Arc from left to right (half circle)
  const arcLength = 251.2; // approx pi * 80 (semicircle)
  const filledLength = (score / 100) * arcLength;

  return (
    <div className="glass-card p-6 sm:p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-full bg-[#F97C00]/10 flex items-center justify-center">
          <svg
            className="h-5 w-5 text-[#F97C00]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">
            Privacy Score
          </h2>
          <p className="text-xs text-white/35">Anonymity set strength</p>
        </div>
      </div>

      {/* Semi-circular gauge */}
      <div className="flex flex-col items-center my-4">
        <div className="relative w-44 h-24 overflow-hidden">
          <svg className="w-44 h-44" viewBox="0 0 200 200" style={{ marginTop: "-4px" }}>
            {/* Background track */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="10"
              strokeLinecap="round"
            />
            {/* Gradient arc */}
            <defs>
              <linearGradient id="privacyGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F97C00" />
                <stop offset="60%" stopColor="#FACC15" />
                <stop offset="100%" stopColor="#4ADE80" />
              </linearGradient>
            </defs>
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="url(#privacyGaugeGrad)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${filledLength} ${arcLength}`}
              style={{ transition: "stroke-dasharray 1s ease-out" }}
            />
          </svg>
        </div>

        {/* Center text */}
        <div className="text-center -mt-2">
          <p className="text-xs text-white/35 mb-0.5">Privacy score</p>
          <p className="text-3xl font-bold text-white tracking-tight tabular-nums">
            {score}<span className="text-sm font-semibold text-white/35">/100</span>
          </p>
        </div>
      </div>

      {/* Label and set size */}
      <div className="flex items-center justify-between mb-3">
        <span className={`text-sm font-semibold ${
          score >= 80 ? "text-[#4ADE80]" : score >= 50 ? "text-[#FACC15]" : "text-[#F97C00]"
        }`}>
          {label}
        </span>
        <span className="text-xs text-white/35 tabular-nums">
          {anonymitySetSize.toLocaleString()} deposits
        </span>
      </div>

      {/* Progress bar */}
      <div className="progress-track mb-4">
        <div
          className="progress-fill"
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Explanation */}
      <p className="text-xs text-white/35 leading-relaxed">
        A larger anonymity set makes it harder for observers to link your
        deposits and withdrawals. The score reflects the relative size of the
        current pool.
      </p>
    </div>
  );
}
