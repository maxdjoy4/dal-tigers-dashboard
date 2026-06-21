"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { PlayerSnapshotTrendPoint } from "@/lib/player-breakdown";
import type { SnapshotScoreKey } from "@/lib/player-goalie-snapshots";
import { scoreKeyLabel } from "@/lib/player-goalie-snapshots";

const SCORE_OPTIONS: SnapshotScoreKey[] = [
  "overallScore",
  "offensiveScore",
  "defensiveScore",
  "transitionScore",
  "puckManagementScore",
  "battleCompeteScore",
  "possessionScore",
];

function formatScore(value: number | null) {
  return value === null ? "n/a" : `${value.toFixed(1)}/100`;
}

export function PlayerPerformanceTrend({
  points,
  currentScore,
  teamAverage,
  positionAverage,
  defaultScoreKey = "overallScore",
}: {
  points: PlayerSnapshotTrendPoint[];
  currentScore: number | null;
  teamAverage: number | null;
  positionAverage: number | null;
  defaultScoreKey?: SnapshotScoreKey;
}) {
  const [scoreKey, setScoreKey] = useState<SnapshotScoreKey>(defaultScoreKey);

  const chartRows = useMemo(
    () =>
      points.map((point) => ({
        ...point,
        selectedScore: point[scoreKey],
        teamAverageRef: teamAverage,
        positionAverageRef: positionAverage,
      })),
    [points, positionAverage, scoreKey, teamAverage],
  );

  if (points.length < 2) {
    return (
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <p className="section-title">Current Score</p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {formatScore(currentScore)}
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <p className="section-title">Team Average</p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {formatScore(teamAverage)}
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <p className="section-title">Position Average</p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {formatScore(positionAverage)}
            </p>
          </div>
        </div>
        <div className="rounded-[28px] border border-dashed border-white/12 bg-white/[0.02] px-5 py-6 text-sm text-slate-300">
          No trend yet. Upload another Instat export later in the season to compare
          player progress.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {SCORE_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setScoreKey(option)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              scoreKey === option
                ? "border border-gold-300/30 bg-gold-300/15 text-gold-100"
                : "border border-white/10 bg-white/5 text-slate-200"
            }`}
          >
            {scoreKeyLabel(option)}
          </button>
        ))}
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartRows}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#94A3B8", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "#94A3B8", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ stroke: "rgba(247,207,47,0.35)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) {
                  return null;
                }

                const point = payload[0]?.payload as
                  | (PlayerSnapshotTrendPoint & { selectedScore: number | null })
                  | undefined;
                if (!point) {
                  return null;
                }

                return (
                  <div className="rounded-3xl border border-white/10 bg-[rgba(6,10,17,0.96)] px-4 py-3 text-sm text-white shadow-2xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-100/80">
                      {point.label}
                    </p>
                    <div className="mt-3 space-y-1">
                      <p>
                        {scoreKeyLabel(scoreKey)}:{" "}
                        {point.selectedScore === null ? "n/a" : point.selectedScore.toFixed(1)}
                      </p>
                      <p>Overall score: {point.overallScore === null ? "n/a" : point.overallScore.toFixed(1)}</p>
                      <p>Team avg: {teamAverage === null ? "n/a" : teamAverage.toFixed(1)}</p>
                    </div>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="teamAverageRef"
              name="Team average"
              stroke="#94A3B8"
              strokeDasharray="6 6"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="selectedScore"
              name={scoreKeyLabel(scoreKey)}
              stroke="#F7CF2F"
              strokeWidth={3}
              dot={{ fill: "#F7CF2F", r: 4 }}
              activeDot={{ r: 7 }}
              isAnimationActive={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
