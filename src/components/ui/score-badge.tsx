import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number | null;
}

export function ScoreBadge({ score }: ScoreBadgeProps) {
  if (score === null) {
    return (
      <span className="inline-flex min-w-16 items-center justify-center rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-300">
        n/a
      </span>
    );
  }

  const tone =
    score >= 75
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : score >= 60
        ? "border-gold-300/30 bg-gold-300/10 text-gold-100"
        : "border-rose-400/30 bg-rose-400/10 text-rose-200";

  return (
    <span
      className={cn(
        "inline-flex min-w-16 items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold",
        tone,
      )}
    >
      {score.toFixed(1)}
    </span>
  );
}
