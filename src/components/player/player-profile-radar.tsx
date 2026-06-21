"use client";

import { useMemo, useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import type { PlayerComparisonCategoryRow } from "@/lib/player-breakdown";

type CompareMode = "team" | "position";

export function PlayerProfileRadar({
  rows,
  defaultMode = "position",
}: {
  rows: PlayerComparisonCategoryRow[];
  defaultMode?: CompareMode;
}) {
  const [mode, setMode] = useState<CompareMode>(defaultMode);

  const chartRows = useMemo(
    () =>
      rows
        .filter((row) => row.score !== null)
        .map((row) => ({
          label: row.shortLabel,
          player: row.score ?? 0,
          comparison: mode === "team" ? row.teamAverage ?? 0 : row.positionAverage ?? 0,
          teamAverage: row.teamAverage,
          positionAverage: row.positionAverage,
        })),
    [mode, rows],
  );

  if (chartRows.length < 3) {
    return (
      <div className="rounded-[24px] border border-dashed border-white/12 bg-white/3 p-6 text-sm text-slate-400">
        Not enough category score data to render the player profile yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("position")}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            mode === "position"
              ? "border border-gold-300/30 bg-gold-300/15 text-gold-100"
              : "border border-white/10 bg-white/5 text-slate-200"
          }`}
        >
          vs Position Average
        </button>
        <button
          type="button"
          onClick={() => setMode("team")}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            mode === "team"
              ? "border border-gold-300/30 bg-gold-300/15 text-gold-100"
              : "border border-white/10 bg-white/5 text-slate-200"
          }`}
        >
          vs Team Average
        </button>
      </div>

      <div className="h-[380px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartRows} outerRadius="68%">
            <PolarGrid stroke="rgba(148,163,184,0.14)" />
            <PolarAngleAxis
              dataKey="label"
              tick={{ fill: "#CBD5E1", fontSize: 12, fontWeight: 600 }}
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
                      player: number;
                      teamAverage: number | null;
                      positionAverage: number | null;
                    }
                  | undefined;

                if (!entry) {
                  return null;
                }

                const comparison = mode === "team" ? entry.teamAverage : entry.positionAverage;

                return (
                  <div className="rounded-[20px] border border-white/10 bg-[#08101a]/95 px-4 py-3 text-sm text-slate-100 shadow-[0_14px_32px_rgba(2,6,23,0.45)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-100">
                      {label}
                    </p>
                    <div className="mt-3 space-y-1.5">
                      <p>Player: {entry.player.toFixed(1)}/100</p>
                      <p>
                        {mode === "team" ? "Team avg" : "Position avg"}:{" "}
                        {comparison === null ? "n/a" : `${comparison.toFixed(1)}/100`}
                      </p>
                    </div>
                  </div>
                );
              }}
            />
            <Radar
              name={mode === "team" ? "Team average" : "Position average"}
              dataKey="comparison"
              stroke="rgba(148,163,184,0.75)"
              fill="rgba(148,163,184,0.08)"
              fillOpacity={1}
              strokeWidth={1.8}
              isAnimationActive={false}
            />
            <Radar
              name="Player profile"
              dataKey="player"
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
    </div>
  );
}
