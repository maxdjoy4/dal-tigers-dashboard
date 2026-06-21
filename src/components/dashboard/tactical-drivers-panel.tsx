"use client";

import { TACTICAL_GROUP_METADATA } from "@/lib/category-metadata";
import { cn } from "@/lib/utils";
import type { TacticalDriverRow } from "@/lib/types";

const statusStyles: Record<TacticalDriverRow["status"], string> = {
  strength: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  neutral: "border-white/10 bg-white/5 text-slate-200",
  concern: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  insufficient_data: "border-gold-300/30 bg-gold-300/10 text-gold-50",
};

function formatScore(value: number | null) {
  return value === null ? "Insufficient data" : `${value.toFixed(1)}/100`;
}

function formatDelta(value: number | null) {
  return value === null ? "n/a" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function statusLabel(status: TacticalDriverRow["status"]) {
  if (status === "insufficient_data") {
    return "Insufficient data";
  }

  return status === "strength"
    ? "Strength"
    : status === "concern"
      ? "Concern"
      : "Neutral";
}

function barToneClass(row: TacticalDriverRow) {
  if (row.score === null) {
    return "from-slate-500/50 via-slate-400/40 to-slate-500/50";
  }

  if (row.delta !== null && row.baselineScore !== null && row.score < row.baselineScore) {
    return "from-[#d7b54e] via-[#e6c468] to-[#c89a9a]";
  }

  return "from-[#d7b54e] via-[#efd27a] to-[#d7b54e]";
}

function BulletScoreGraph({
  score,
  baselineScore,
  baselineLabel,
  tone,
}: {
  score: number | null;
  baselineScore: number | null;
  baselineLabel: string;
  tone: string;
}) {
  if (score === null) {
    return (
      <div className="mt-3 rounded-2xl border border-white/10 bg-[#0f1624] px-3 py-2 text-xs text-slate-400">
        Insufficient data for a score graph.
      </div>
    );
  }

  const safeScore = Math.max(0, Math.min(score, 100));
  const safeBaseline =
    baselineScore === null ? null : Math.max(0, Math.min(baselineScore, 100));

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>
      <div className="relative h-5 rounded-full border border-white/10 bg-[#0f1624] px-1 py-1">
        <div className="pointer-events-none absolute inset-x-[4%] top-1/2 flex -translate-y-1/2 justify-between">
          {Array.from({ length: 17 }).map((_, index) => (
            <span
              key={index}
              className={cn(
                "h-2 w-px bg-white/8",
                index % 4 === 0 ? "bg-white/14" : "",
              )}
            />
          ))}
        </div>
        <div className="group relative h-full">
          <div
            className={cn(
              "h-full rounded-full bg-gradient-to-r shadow-[0_0_18px_rgba(247,207,47,0.18)]",
              tone,
            )}
            style={{ width: `${safeScore}%` }}
            title={`${safeScore.toFixed(1)}/100 current score`}
          />
          <div
            className="pointer-events-none absolute -top-9 z-10 -translate-x-1/2 rounded-full border border-gold-300/30 bg-[#0b111b] px-2 py-1 text-[11px] font-semibold text-gold-50 opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
            style={{ left: `${Math.max(6, Math.min(safeScore, 94))}%` }}
          >
            {safeScore.toFixed(1)}
          </div>
          {safeBaseline !== null ? (
            <div
              className="absolute inset-y-[-2px] w-px -translate-x-1/2 rounded-full bg-slate-100/90 shadow-[0_0_8px_rgba(255,255,255,0.18)]"
              style={{ left: `${safeBaseline}%` }}
              title={`${baselineLabel}: ${safeBaseline.toFixed(1)}/100`}
            />
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <span>Current: {safeScore.toFixed(1)}</span>
        {safeBaseline !== null ? (
          <span>
            {baselineLabel}: {safeBaseline.toFixed(1)}
          </span>
        ) : (
          <span>{baselineLabel}: n/a</span>
        )}
      </div>
    </div>
  );
}

export function TacticalDriversPanel({
  rows,
  baselineLabel = "Baseline",
  showMiniBulletChart = false,
  sortByScore = false,
}: {
  rows: TacticalDriverRow[];
  baselineLabel?: string;
  showMiniBulletChart?: boolean;
  sortByScore?: boolean;
}) {
  if (!rows.length) {
    return <p className="text-sm text-slate-300">No tactical driver data is available.</p>;
  }

  const orderedRows = sortByScore
    ? [...rows].sort((left, right) => {
        if (left.score === null && right.score === null) {
          return left.label.localeCompare(right.label);
        }

        if (left.score === null) {
          return 1;
        }

        if (right.score === null) {
          return -1;
        }

        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return (right.delta ?? 0) - (left.delta ?? 0);
      })
    : rows;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
        {orderedRows.map((row) => (
          <div
            key={row.group}
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="section-title">{row.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {TACTICAL_GROUP_METADATA[row.group].description}
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">{formatScore(row.score)}</p>
                {showMiniBulletChart ? (
                  <BulletScoreGraph
                    score={row.score}
                    baselineScore={row.baselineScore}
                    baselineLabel={baselineLabel}
                    tone={barToneClass(row)}
                  />
                ) : null}
              </div>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                  statusStyles[row.status],
                )}
              >
                {statusLabel(row.status)}
              </span>
            </div>

            <div className="mt-4 grid gap-2 text-sm text-slate-300">
              <p>{baselineLabel}: {formatScore(row.baselineScore)}</p>
              <p>Delta: {formatDelta(row.delta)}</p>
              <p>
                KPIs used: {row.validKpis}/{row.totalKpis}
                {row.coverage !== null ? ` (${Math.round(row.coverage * 100)}% weighted coverage)` : ""}
              </p>
              <p>Strongest KPI: {row.strongestKpi ?? "n/a"}</p>
              <p>Weakest KPI: {row.weakestKpi ?? "n/a"}</p>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-100">{row.takeaway}</p>
          </div>
        ))}
    </div>
  );
}
