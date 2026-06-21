"use client";

import { useMemo, useState } from "react";

import { CATEGORY_METADATA } from "@/lib/category-metadata";
import type { AnalyticsBundle, KpiWeight } from "@/lib/types";

function formatNullable(value: number | null, digits = 1) {
  return value === null ? "n/a" : value.toFixed(digits);
}

export function KpiLookupPanel({
  kpiSummary,
  weights,
}: {
  kpiSummary: AnalyticsBundle["kpiSummary"];
  weights: KpiWeight[];
}) {
  const selectableKpis = useMemo(
    () =>
      kpiSummary.filter(
        (kpi) =>
          kpi.availableGames > 0 ||
          kpi.latestRaw !== null ||
          kpi.averageNormalized !== null,
      ),
    [kpiSummary],
  );
  const [selectedKey, setSelectedKey] = useState(selectableKpis[0]?.key ?? "");

  const effectiveKey = selectableKpis.some((kpi) => kpi.key === selectedKey)
    ? selectedKey
    : (selectableKpis[0]?.key ?? "");

  const selectedKpi = selectableKpis.find((kpi) => kpi.key === effectiveKey) ?? null;
  const selectedWeight = weights.find((weight) => weight.key === effectiveKey) ?? null;

  if (!selectedKpi || !selectedWeight) {
    return (
      <p className="text-sm text-slate-300">
        No KPI lookup data is available in the current filter view.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <div>
          <label
            htmlFor="kpi-lookup-select"
            className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-300"
          >
            Select KPI
          </label>
          <select
            id="kpi-lookup-select"
            className="select-gold"
            value={effectiveKey}
            onChange={(event) => setSelectedKey(event.target.value)}
          >
            {(["offense", "defense", "special_teams"] as const).map((category) => {
              const options = selectableKpis.filter((kpi) => kpi.category === category);
              if (!options.length) {
                return null;
              }

              return (
                <optgroup
                  key={category}
                  label={CATEGORY_METADATA[category].label}
                >
                  {options.map((kpi) => (
                    <option key={kpi.key} value={kpi.key}>
                      {kpi.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <p className="section-title">Why it matters</p>
          <p className="mt-3 text-sm leading-6 text-slate-100">
            {selectedWeight.notes || "No coaching note is configured for this KPI yet."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <p className="section-title">Category</p>
          <p className="mt-3 text-lg font-semibold text-white">
            {CATEGORY_METADATA[selectedKpi.category].label}
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <p className="section-title">Weight</p>
          <p className="mt-3 text-lg font-semibold text-white">
            {selectedKpi.weight.toFixed(2)}
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <p className="section-title">Direction</p>
          <p className="mt-3 text-lg font-semibold text-white">
            {selectedKpi.direction === "higher_is_better"
              ? "Higher is better"
              : "Lower is better"}
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <p className="section-title">Games with Data</p>
          <p className="mt-3 text-lg font-semibold text-white">
            {selectedKpi.availableGames}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-slate-400">
            <tr>
              <th className="px-4 py-3">Field</th>
              <th className="px-4 py-3">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            <tr className="bg-white/[0.02]">
              <td className="px-4 py-3 text-white">Latest raw value</td>
              <td className="px-4 py-3 text-slate-200">
                {selectedKpi.latestRaw ?? "n/a"}
              </td>
            </tr>
            <tr className="bg-white/[0.02]">
              <td className="px-4 py-3 text-white">Average normalized score</td>
              <td className="px-4 py-3 text-slate-200">
                {formatNullable(selectedKpi.averageNormalized)}
              </td>
            </tr>
            <tr className="bg-white/[0.02]">
              <td className="px-4 py-3 text-white">Latest normalized score</td>
              <td className="px-4 py-3 text-slate-200">
                {formatNullable(selectedKpi.latestNormalized)}
              </td>
            </tr>
            <tr className="bg-white/[0.02]">
              <td className="px-4 py-3 text-white">Latest weighted contribution</td>
              <td className="px-4 py-3 text-slate-200">
                {formatNullable(selectedKpi.latestWeighted, 2)}
              </td>
            </tr>
            <tr className="bg-white/[0.02]">
              <td className="px-4 py-3 text-white">R value</td>
              <td className="px-4 py-3 text-slate-200">
                {selectedKpi.rValue.toFixed(2)}
              </td>
            </tr>
            <tr className="bg-white/[0.02]">
              <td className="px-4 py-3 text-white">Coaching adjustment</td>
              <td className="px-4 py-3 text-slate-200">
                {selectedWeight.coachingAdjustment ?? "n/a"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

