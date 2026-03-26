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

function getScoreColor(score: number): string {
  if (score >= 80) return "text-[#22c55e]";
  if (score >= 50) return "text-[#0057ff]";
  if (score >= 20) return "text-[#f59e0b]";
  return "text-[#ef4444]";
}

function getGlowColor(score: number): string {
  if (score >= 80) return "rgba(34, 197, 94, 0.15)";
  if (score >= 50) return "rgba(0, 87, 255, 0.15)";
  if (score >= 20) return "rgba(245, 158, 11, 0.15)";
  return "rgba(239, 68, 68, 0.15)";
}

function getBarColor(score: number): string {
  if (score >= 80) return "from-[#22c55e] to-[#22c55e]/70";
  if (score >= 50) return "from-[#0057ff] to-[#4f8aff]";
  if (score >= 20) return "from-[#f59e0b] to-[#f59e0b]/70";
  return "from-[#ef4444] to-[#ef4444]/70";
}

export function PrivacyMeter({
  anonymitySetSize,
  maxSetSize = 1000,
}: PrivacyMeterProps) {
  const score = getPrivacyScore(anonymitySetSize, maxSetSize);
  const label = getScoreLabel(score);
  const scoreColor = getScoreColor(score);
  const glowColor = getGlowColor(score);
  const barColor = getBarColor(score);

  // Calculate circumference for circular gauge
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="bg-white rounded-2xl border border-[#e8e8e8] p-6 sm:p-8 shadow-sm transition-all duration-300 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-full bg-[#0057ff]/[0.08] flex items-center justify-center">
          <svg
            className="h-5 w-5 text-[#0057ff]"
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
          <h2 className="text-lg font-semibold tracking-tight text-[#191919]">
            Privacy Score
          </h2>
          <p className="text-xs text-[#9ca3af]">Anonymity set strength</p>
        </div>
      </div>

      {/* Circular gauge */}
      <div className="flex flex-col items-center mb-6">
        <div className="relative w-36 h-36">
          <svg
            className="w-36 h-36 -rotate-90"
            viewBox="0 0 120 120"
          >
            {/* Background ring */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="#e8e8e8"
              strokeWidth="8"
            />
            {/* Score ring */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="url(#scoreGradient)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{
                transition: "stroke-dashoffset 1s ease-out",
                filter: `drop-shadow(0 0 8px ${glowColor})`,
              }}
            />
            <defs>
              <linearGradient
                id="scoreGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#0057ff" />
                <stop offset="100%" stopColor="#4f8aff" />
              </linearGradient>
            </defs>
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={`text-3xl font-bold font-mono tabular-nums ${scoreColor}`}
            >
              {score}
            </span>
            <span className="text-xs text-[#9ca3af] mt-0.5">/ 100</span>
          </div>
        </div>
      </div>

      {/* Label and set size */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full bg-gradient-to-r ${barColor}`} />
          <span className={`text-sm font-semibold ${scoreColor}`}>
            {label}
          </span>
        </div>
        <span className="text-xs text-[#9ca3af] font-mono tabular-nums">
          {anonymitySetSize.toLocaleString()} deposits
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full bg-[#e8e8e8] mb-4">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700`}
          style={{
            width: `${score}%`,
            boxShadow: `0 0 12px ${glowColor}`,
          }}
        />
      </div>

      {/* Explanation */}
      <p className="text-xs text-[#9ca3af] leading-relaxed">
        A larger anonymity set makes it harder for observers to link your
        deposits and withdrawals. The score reflects the relative size of the
        current pool.
      </p>
    </div>
  );
}
