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

import { formatKpiDisplayValue } from "@/lib/kpi-trends";
import { formatOpponentWithFullName } from "@/lib/opponents";
import { TREND_WINDOW_GAMES } from "@/lib/trend-window";
import type { KpiDirection } from "@/lib/types";
import type { KpiTrendPoint } from "@/lib/kpi-trends";

function signalLabel(signal: KpiTrendPoint["signal"]) {
  if (signal === "positive") {
    return "Directionally positive";
  }

  if (signal === "negative") {
    return "Directionally negative";
  }

  return "Near filtered average";
}

function signalTone(signal: KpiTrendPoint["signal"]) {
  if (signal === "positive") {
    return "text-emerald-200";
  }

  if (signal === "negative") {
    return "text-rose-200";
  }

  return "text-slate-200";
}

function KpiTrendTooltip({
  active,
  payload,
  isPercent,
  direction,
}: TooltipProps<ValueType, NameType> & {
  payload?: Array<{ payload: KpiTrendPoint }>;
  isPercent: boolean;
  direction: KpiDirection;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;
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
          Raw KPI Value: {formatKpiDisplayValue(point.rawValue, isPercent)}
        </p>
        <p className="text-slate-200">
          Rolling {TREND_WINDOW_GAMES} Avg: {formatKpiDisplayValue(point.rollingAverage, isPercent)}
        </p>
        <p className={signalTone(point.signal)}>
          {signalLabel(point.signal)} ·{" "}
          {direction === "higher_is_better" ? "higher is better" : "lower is better"}
        </p>
      </div>
    </div>
  );
}

export function KpiTrendChart({
  data,
  isPercent,
  direction,
}: {
  data: KpiTrendPoint[];
  isPercent: boolean;
  direction: KpiDirection;
}) {
  return (
    <div className="h-96 w-full">
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
            tick={{ fill: "#94A3B8", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) =>
              typeof value === "number" ? formatKpiDisplayValue(value, isPercent) : "n/a"
            }
          />
          <Tooltip
            cursor={{ stroke: "rgba(247,207,47,0.4)" }}
            content={<KpiTrendTooltip isPercent={isPercent} direction={direction} />}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="displayValue"
            name="KPI Value"
            stroke="#F7CF2F"
            strokeWidth={3}
            dot={{ fill: "#F7CF2F", r: 4 }}
            activeDot={{ r: 7 }}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="rollingAverage"
            name={`Rolling ${TREND_WINDOW_GAMES} Avg`}
            stroke="#FFFFFF"
            strokeDasharray="6 6"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
