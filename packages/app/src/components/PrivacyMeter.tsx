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
  if (score >= 80) return "text-accent-green";
  if (score >= 50) return "text-primary";
  if (score >= 20) return "text-accent-amber";
  return "text-accent-red";
}

function getGradientStops(score: number): string {
  if (score >= 80) return "from-accent-green to-accent-green/60";
  if (score >= 50) return "from-primary to-secondary";
  if (score >= 20) return "from-accent-amber to-accent-amber/60";
  return "from-accent-red to-accent-red/60";
}

function getGlowColor(score: number): string {
  if (score >= 80) return "rgba(34, 197, 94, 0.15)";
  if (score >= 50) return "rgba(59, 130, 246, 0.15)";
  if (score >= 20) return "rgba(245, 158, 11, 0.15)";
  return "rgba(239, 68, 68, 0.15)";
}

export function PrivacyMeter({
  anonymitySetSize,
  maxSetSize = 1000,
}: PrivacyMeterProps) {
  const score = getPrivacyScore(anonymitySetSize, maxSetSize);
  const label = getScoreLabel(score);
  const scoreColor = getScoreColor(score);
  const gradientStops = getGradientStops(score);
  const glowColor = getGlowColor(score);

  // Calculate circumference for circular gauge
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-6 sm:p-8 transition-all duration-300 hover:border-white/[0.1]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-secondary/10 flex items-center justify-center">
          <svg
            className="h-5 w-5 text-primary"
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
          <h2 className="text-lg font-semibold tracking-tight">
            Privacy Score
          </h2>
          <p className="text-xs text-muted-dim">Anonymity set strength</p>
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
              stroke="rgba(255,255,255,0.04)"
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
                <stop offset="0%" stopColor={score >= 50 ? "#3b82f6" : score >= 20 ? "#f59e0b" : "#ef4444"} />
                <stop offset="100%" stopColor={score >= 80 ? "#22c55e" : score >= 50 ? "#6366f1" : score >= 20 ? "#f59e0b" : "#ef4444"} />
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
            <span className="text-xs text-muted-dim mt-0.5">/ 100</span>
          </div>
        </div>
      </div>

      {/* Label and set size */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full bg-gradient-to-r ${gradientStops}`} />
          <span className={`text-sm font-semibold ${scoreColor}`}>
            {label}
          </span>
        </div>
        <span className="text-xs text-muted-dim font-mono tabular-nums">
          {anonymitySetSize.toLocaleString()} deposits
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full bg-white/[0.04] mb-4">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gradientStops} transition-all duration-700`}
          style={{
            width: `${score}%`,
            boxShadow: `0 0 12px ${glowColor}`,
          }}
        />
      </div>

      {/* Explanation */}
      <p className="text-xs text-muted-dim leading-relaxed">
        A larger anonymity set makes it harder for observers to link your
        deposits and withdrawals. The score reflects the relative size of the
        current pool.
      </p>
    </div>
  );
}
