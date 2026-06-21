import { ArrowDownRight, ArrowRight, ArrowUpRight, Shield, Swords, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CategoryVisualRow, ScoreCategory } from "@/lib/types";

function categoryIcon(category: ScoreCategory) {
  if (category === "offense") {
    return Swords;
  }

  if (category === "defense") {
    return Shield;
  }

  return Zap;
}

function toneClasses(tone: CategoryVisualRow["statusTone"] | CategoryVisualRow["trendTone"]) {
  if (tone === "strength") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }

  if (tone === "concern") {
    return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  }

  if (tone === "limited_data") {
    return "border-gold-300/30 bg-gold-300/10 text-gold-50";
  }

  if (tone === "stable") {
    return "border-white/10 bg-white/5 text-slate-200";
  }

  return "border-white/10 bg-white/5 text-slate-200";
}

function TrendIcon({ tone }: { tone: CategoryVisualRow["trendTone"] }) {
  const Icon =
    tone === "strength"
      ? ArrowUpRight
      : tone === "concern"
        ? ArrowDownRight
        : ArrowRight;

  return <Icon className="h-4 w-4" />;
}

export function CategoryScoreRows({
  rows,
  showSummary = false,
  layout = "standard",
}: {
  rows: CategoryVisualRow[];
  showSummary?: boolean;
  layout?: "standard" | "expanded";
}) {
  const strongest =
    [...rows]
      .filter((row) => row.score !== null)
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))[0] ?? null;
  const concern =
    [...rows]
      .filter((row) => row.score !== null)
      .sort((left, right) => (left.score ?? 0) - (right.score ?? 0))[0] ?? null;

  return (
    <div className="space-y-4">
      {showSummary ? (
        <div className="flex flex-wrap gap-3 text-sm text-slate-300">
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-emerald-200">
            Strongest: {strongest?.label ?? "n/a"}
          </span>
          <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1.5 text-rose-200">
            Main concern: {concern?.label ?? "n/a"}
          </span>
        </div>
      ) : null}

      <div className="space-y-3">
        {rows.map((row) => {
          const Icon = categoryIcon(row.category);

          return (
            <div
              key={row.category}
              className={cn(
                "grid gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4",
                layout === "expanded"
                  ? "xl:grid-cols-[0.85fr,2fr,0.8fr]"
                  : "xl:grid-cols-[1.05fr,1.65fr,0.9fr]",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-2xl border border-gold-300/20 bg-gold-300/10 p-2 text-gold-100">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-200">
                    {row.label}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">{row.descriptor}</p>
                </div>
              </div>

              <div className="flex flex-col justify-center gap-2">
                <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
                  <span>0</span>
                  <span>25</span>
                  <span>50</span>
                  <span>75</span>
                  <span>100</span>
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-[2%]">
                    {Array.from({ length: 21 }).map((_, index) => (
                      <span
                        key={index}
                        className={cn(
                          "h-2 w-px bg-white/10",
                          index % 5 === 0 ? "bg-white/15" : "",
                        )}
                      />
                    ))}
                  </div>
                  <div className="h-4 rounded-full border border-white/10 bg-[#0f1624] px-1 py-0.5">
                    <div
                      className="group relative h-full"
                      title={row.score === null ? "Insufficient data" : `${row.score.toFixed(1)}/100`}
                    >
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#d7b54e] via-[#efd27a] to-[#d7b54e] shadow-[0_0_18px_rgba(247,207,47,0.22)]"
                        style={{ width: `${Math.max(0, Math.min(row.score ?? 0, 100))}%` }}
                      />
                      {row.score !== null ? (
                        <div
                          className="pointer-events-none absolute -top-9 z-10 -translate-x-1/2 rounded-full border border-gold-300/30 bg-[#0b111b] px-2.5 py-1 text-[11px] font-semibold text-gold-50 opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
                          style={{ left: `${Math.max(6, Math.min(row.score, 94))}%` }}
                        >
                          {row.score.toFixed(1)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 xl:justify-end">
                <div className="text-left xl:text-right">
                  <p className="text-3xl font-semibold text-white">
                    {row.score === null ? "n/a" : row.score.toFixed(1)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 xl:justify-end">
                    {row.statusLabel ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                          toneClasses(row.statusTone),
                        )}
                      >
                        {row.statusLabel}
                      </span>
                    ) : null}
                    {row.trendLabel ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                          toneClasses(row.trendTone),
                        )}
                      >
                        <TrendIcon tone={row.trendTone} />
                        {row.trendLabel}
                      </span>
                    ) : null}
                  </div>
                  {row.detail ? (
                    <p className="mt-2 text-xs leading-5 text-slate-400">{row.detail}</p>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
