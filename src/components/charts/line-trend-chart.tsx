"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

import { formatOpponentWithFullName } from "@/lib/opponents";
import { TREND_WINDOW_GAMES } from "@/lib/trend-window";

interface LineTrendChartProps {
  data: Array<{
    label: string;
    score: number | null;
    rollingAverage: number | null;
    opponent: string;
    result: string;
    strongestCategory?: string | null;
    weakestCategory?: string | null;
  }>;
}

function TrendTooltip({
  active,
  payload,
}: TooltipProps<ValueType, NameType> & {
  payload?: Array<{ payload: LineTrendChartProps["data"][number] }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload as
    | LineTrendChartProps["data"][number]
    | undefined;

  if (!point) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-[rgba(6,10,17,0.96)] px-4 py-3 text-sm text-white shadow-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-100/80">
        {point.label}
      </p>
      <p className="mt-2 font-semibold text-white">
        {formatOpponentWithFullName(point.opponent)}
      </p>
      <p className="mt-1 text-slate-300">{point.result}</p>
      <div className="mt-3 space-y-1 text-sm">
        <p className="text-gold-100">
          Performance Score: {point.score === null ? "n/a" : point.score.toFixed(1)}
        </p>
        <p className="text-slate-200">
          Rolling {TREND_WINDOW_GAMES} Avg:{" "}
          {point.rollingAverage === null ? "n/a" : point.rollingAverage.toFixed(1)}
        </p>
        {point.strongestCategory ? (
          <p className="text-emerald-200">Strongest Category: {point.strongestCategory}</p>
        ) : null}
        {point.weakestCategory ? (
          <p className="text-rose-200">Main Concern: {point.weakestCategory}</p>
        ) : null}
      </div>
    </div>
  );
}

export function LineTrendChart({ data }: LineTrendChartProps) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
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
            cursor={{ stroke: "rgba(247,207,47,0.4)" }}
            content={<TrendTooltip />}
            contentStyle={{
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(6, 10, 17, 0.96)",
              color: "#fff",
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="score"
            name="Performance Score"
            stroke="#F7CF2F"
            strokeWidth={3}
            dot={{ fill: "#F7CF2F", r: 4 }}
            activeDot={{ r: 7 }}
          />
          <Line
            type="monotone"
            dataKey="rollingAverage"
            name={`Rolling ${TREND_WINDOW_GAMES} Avg`}
            stroke="#FFFFFF"
            strokeDasharray="6 6"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
