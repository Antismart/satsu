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
  if (score >= 80) return "text-[#028901]";
  if (score >= 50) return "text-[#0057FF]";
  if (score >= 20) return "text-[#F97C00]";
  return "text-[#D00D00]";
}

function getBarGradient(score: number): string {
  if (score >= 80) return "from-[#028901] to-[#046700]";
  if (score >= 50) return "from-[#0057FF] to-[#006ACB]";
  if (score >= 20) return "from-[#F97C00] to-[#F97C00]/70";
  return "from-[#D00D00] to-[#910000]";
}

export function PrivacyMeter({
  anonymitySetSize,
  maxSetSize = 1000,
}: PrivacyMeterProps) {
  const score = getPrivacyScore(anonymitySetSize, maxSetSize);
  const label = getScoreLabel(score);
  const scoreColor = getScoreColor(score);
  const barGradient = getBarGradient(score);

  // Circular gauge
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-[0_5px_20px_rgba(0,0,0,0.08)] transition-all duration-300 hover:shadow-[0_5px_30px_rgba(0,0,0,0.12)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-full bg-[#0057FF]/[0.08] flex items-center justify-center">
          <svg
            className="h-5 w-5 text-[#0057FF]"
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
          <h2 className="text-xl font-semibold tracking-tight text-[#191919]">
            Privacy Score
          </h2>
          <p className="text-xs text-[#9CA3AF]">Anonymity set strength</p>
        </div>
      </div>

      {/* Circular gauge */}
      <div className="flex flex-col items-center mb-6">
        <div className="relative w-36 h-36">
          <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
            {/* Background ring */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="#E8E8E8"
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
                <stop offset="0%" stopColor="#0057FF" />
                <stop offset="100%" stopColor="#006ACB" />
              </linearGradient>
            </defs>
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={`text-3xl font-bold tabular-nums ${scoreColor}`}
            >
              {score}
            </span>
            <span className="text-xs text-[#9CA3AF] mt-0.5">/ 100</span>
          </div>
        </div>
      </div>

      {/* Label and set size */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${scoreColor}`}>
            {label}
          </span>
        </div>
        <span className="text-xs text-[#9CA3AF] tabular-nums">
          {anonymitySetSize.toLocaleString()} deposits
        </span>
      </div>

      {/* Progress bar - thin horizontal */}
      <div className="w-full h-1.5 rounded-full bg-[#E8E8E8] mb-4">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barGradient} transition-all duration-700`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Explanation */}
      <p className="text-xs text-[#9CA3AF] leading-relaxed">
        A larger anonymity set makes it harder for observers to link your
        deposits and withdrawals. The score reflects the relative size of the
        current pool.
      </p>
    </div>
  );
}
