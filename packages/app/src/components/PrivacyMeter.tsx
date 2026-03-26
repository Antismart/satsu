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
  return "text-red-400";
}

function getBarColor(score: number): string {
  if (score >= 80) return "bg-accent-green";
  if (score >= 50) return "bg-primary";
  if (score >= 20) return "bg-accent-amber";
  return "bg-red-400";
}

export function PrivacyMeter({
  anonymitySetSize,
  maxSetSize = 1000,
}: PrivacyMeterProps) {
  const score = getPrivacyScore(anonymitySetSize, maxSetSize);
  const label = getScoreLabel(score);
  const scoreColor = getScoreColor(score);
  const barColor = getBarColor(score);

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Privacy Score</h2>
        <span className={`text-2xl font-bold ${scoreColor}`}>{score}%</span>
      </div>

      <div className="w-full h-2 rounded-full bg-background mb-3">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className={scoreColor}>{label}</span>
        <span className="text-muted">
          {anonymitySetSize.toLocaleString()} deposits in anonymity set
        </span>
      </div>

      <p className="text-xs text-muted mt-3">
        A larger anonymity set makes it harder for observers to link your
        deposits and withdrawals. The privacy score reflects the relative size
        of the current pool.
      </p>
    </div>
  );
}
