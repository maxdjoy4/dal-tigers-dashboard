import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  note: string;
  trend?: "up" | "down" | "flat";
  tone?: "gold" | "slate";
  valueClassName?: string;
}

export function StatCard({
  label,
  value,
  note,
  trend,
  tone = "gold",
  valueClassName,
}: StatCardProps) {
  const TrendIcon =
    trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : ArrowRight;
  const trendLabel =
    trend === "up"
      ? "Trending up"
      : trend === "down"
        ? "Sliding"
        : "Holding steady";
  const trendTone =
    trend === "up"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : trend === "down"
        ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
        : "border-white/10 bg-white/5 text-slate-200";

  return (
    <article className="metric-gradient gold-ring glass-panel relative overflow-hidden rounded-4xl p-5">
      <div
        className={cn(
          "absolute right-0 top-0 h-28 w-28 rounded-full blur-3xl",
          tone === "gold" ? "bg-gold-300/10" : "bg-white/5",
        )}
      />
      <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <div className="relative mt-4">
        <p
          className={cn(
            "text-[2.45rem] font-semibold leading-[1.08] tracking-tight text-white break-normal [text-wrap:balance] md:text-[2.85rem]",
            valueClassName,
          )}
        >
          {value}
        </p>
        <p className="mt-2 text-sm text-slate-300">{note}</p>
        {trend ? (
          <div
            className={cn(
              "mt-4 inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em]",
              trendTone,
            )}
            aria-label={`${label} trend: ${trendLabel}`}
            title={`${label} trend: ${trendLabel}`}
          >
            <TrendIcon className="h-4 w-4" />
            <span className="truncate">{trendLabel}</span>
          </div>
        ) : null}
      </div>
    </article>
  );
}
