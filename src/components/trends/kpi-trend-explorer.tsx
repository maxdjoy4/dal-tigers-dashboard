"use client";

import { useMemo, useState } from "react";

import { KpiTrendChart } from "@/components/charts/kpi-trend-chart";
import { CATEGORY_METADATA } from "@/lib/category-metadata";
import {
  buildKpiTrendData,
  buildKpiTrendOptions,
  formatKpiDisplayValue,
} from "@/lib/kpi-trends";
import { getOpponentDisplayName } from "@/lib/opponents";
import type { KpiWeight, ScoredGame } from "@/lib/types";

function trendBadgeTone(trend: ReturnType<typeof buildKpiTrendData>["summary"]["trend"]) {
  if (trend === "Improving") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }

  if (trend === "Worsening") {
    return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  }

  if (trend === "Limited data") {
    return "border-gold-300/30 bg-gold-300/10 text-gold-50";
  }

  return "border-white/10 bg-white/5 text-slate-200";
}

export function KpiTrendExplorer({
  games,
  weights,
}: {
  games: ScoredGame[];
  weights: KpiWeight[];
}) {
  const options = useMemo(() => buildKpiTrendOptions(games, weights), [games, weights]);
  const [selectedKey, setSelectedKey] = useState(options[0]?.key ?? "");
  const effectiveSelectedKey =
    options.some((option) => option.key === selectedKey) ? selectedKey : (options[0]?.key ?? "");

  const selectedWeight = useMemo(
    () => weights.find((weight) => weight.key === effectiveSelectedKey) ?? null,
    [weights, effectiveSelectedKey],
  );
  const trendData = useMemo(
    () => (selectedWeight ? buildKpiTrendData(games, selectedWeight) : null),
    [games, selectedWeight],
  );

  if (!options.length || !selectedWeight || !trendData) {
    return (
      <p className="text-sm text-slate-300">
        No KPI trend data is available for the current filter stack.
      </p>
    );
  }

  const { points, summary } = trendData;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr,0.8fr]">
        <div>
          <label
            htmlFor="kpi-trend-select"
            className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-300"
          >
            Select KPI
          </label>
          <select
            id="kpi-trend-select"
            className="select-gold"
            value={effectiveSelectedKey}
            onChange={(event) => setSelectedKey(event.target.value)}
          >
            {(["offense", "defense", "special_teams"] as const).map((category) => {
              const groupOptions = options.filter((option) => option.category === category);
              if (!groupOptions.length) {
                return null;
              }

              return (
                <optgroup key={category} label={CATEGORY_METADATA[category].label}>
                  {groupOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Direction
          </p>
          <p className="mt-3 text-lg font-semibold text-white">
            {selectedWeight.direction === "higher_is_better"
              ? "Higher is better"
              : "Lower is better"}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Trend
          </p>
          <div className="mt-3">
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${trendBadgeTone(summary.trend)}`}
            >
              {summary.trend}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr,0.65fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-4">
            <p className="text-sm font-semibold text-white">{selectedWeight.name}</p>
            <p className="mt-1 text-sm text-slate-300">
              Game-by-game raw KPI values across the current filtered history.
            </p>
          </div>
          <KpiTrendChart
            data={points}
            isPercent={summary.isPercent}
            direction={selectedWeight.direction}
          />
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="section-title">KPI Insight</p>
            <p className="mt-3 text-sm leading-6 text-slate-100">{summary.explanation}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="grid gap-3 text-sm text-slate-200">
              <p>Recent average: {formatKpiDisplayValue(summary.recentAverage, summary.isPercent)}</p>
              <p>Previous average: {formatKpiDisplayValue(summary.previousAverage, summary.isPercent)}</p>
              <p>Change: {summary.change === null ? "n/a" : formatKpiDisplayValue(summary.change, summary.isPercent)}</p>
              <p>Highest game value: {formatKpiDisplayValue(summary.highestValue, summary.isPercent)}</p>
              <p>Lowest game value: {formatKpiDisplayValue(summary.lowestValue, summary.isPercent)}</p>
              <p>
                Best game: {summary.bestGame ? `${getOpponentDisplayName(summary.bestGame.opponent)} (${formatKpiDisplayValue(summary.bestGame.displayValue, summary.isPercent)})` : "n/a"}
              </p>
              <p>
                Worst game: {summary.worstGame ? `${getOpponentDisplayName(summary.worstGame.opponent)} (${formatKpiDisplayValue(summary.worstGame.displayValue, summary.isPercent)})` : "n/a"}
              </p>
              <p>Valid games: {summary.validCount}</p>
              {summary.missingCount > 0 ? <p>Missing/invalid games excluded: {summary.missingCount}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
