"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import type { TacticalDriverRow } from "@/lib/types";

function formatSigned(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "n/a";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function wrapLabel(value: string) {
  return value.replace(" / ", " /\n").replace(" & ", " &\n");
}

export function MatchupTacticalRadarChart({
  rows,
}: {
  rows: TacticalDriverRow[];
}) {
  const chartRows = rows
    .filter((row) => row.score !== null && row.baselineScore !== null)
    .map((row) => ({
      group: row.group,
      label: row.label,
      matchup: row.score ?? 0,
      baseline: row.baselineScore ?? 0,
      delta: row.delta,
      status: row.status,
    }));

  if (chartRows.length < 3) {
    return (
      <div className="rounded-[24px] border border-dashed border-white/12 bg-white/3 p-6 text-sm text-slate-400">
        Not enough matchup data to render tactical profile.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="h-[420px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartRows} outerRadius="68%">
            <PolarGrid stroke="rgba(148,163,184,0.14)" />
            <PolarAngleAxis
              dataKey="label"
              tick={({ payload, x, y, textAnchor }) => {
                const label = wrapLabel(String(payload?.value ?? ""));
                const lines = label.split("\n");

                return (
                  <g transform={`translate(${x},${y})`}>
                    {lines.map((line, index) => (
                      <text
                        key={`${line}-${index}`}
                        y={index * 14}
                        textAnchor={textAnchor}
                        fill="#CBD5E1"
                        fontSize={12}
                        fontWeight={600}
                      >
                        {line}
                      </text>
                    ))}
                  </g>
                );
              }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: "#94A3B8", fontSize: 10 }}
              tickCount={5}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) {
                  return null;
                }

                const entry = payload[0]?.payload as
                  | {
                      label: string;
                      matchup: number;
                      baseline: number;
                      delta: number | null;
                    }
                  | undefined;

                if (!entry) {
                  return null;
                }

                return (
                  <div className="rounded-[20px] border border-white/10 bg-[#08101a]/95 px-4 py-3 text-sm text-slate-100 shadow-[0_14px_32px_rgba(2,6,23,0.45)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-100">
                      {label}
                    </p>
                    <div className="mt-3 space-y-1.5">
                      <p>Matchup: {entry.matchup.toFixed(1)}/100</p>
                      <p>Baseline: {entry.baseline.toFixed(1)}/100</p>
                      <p>Delta: {formatSigned(entry.delta)}</p>
                    </div>
                  </div>
                );
              }}
            />
            <Radar
              name="Season baseline"
              dataKey="baseline"
              stroke="rgba(148,163,184,0.75)"
              fill="rgba(148,163,184,0.08)"
              fillOpacity={1}
              strokeWidth={1.8}
              isAnimationActive={false}
            />
            <Radar
              name="Current matchup"
              dataKey="matchup"
              stroke="#F7CF2F"
              fill="rgba(247,207,47,0.18)"
              fillOpacity={1}
              strokeWidth={2.6}
              dot={{
                r: 3,
                strokeWidth: 1,
                stroke: "rgba(8,16,26,0.95)",
                fill: "#F7CF2F",
              }}
              isAnimationActive={false}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-300">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#F7CF2F]" />
          Current matchup
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-400/80" />
          Season baseline
        </span>
      </div>
    </div>
  );
}
