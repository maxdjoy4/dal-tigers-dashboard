"use client";

import { useMemo, useState } from "react";

import {
  CartesianGrid,
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
import { cn } from "@/lib/utils";

type CategoryKey = "offense" | "defense" | "specialTeams";

const CATEGORY_OPTIONS: Array<{
  key: CategoryKey;
  label: string;
  stroke: string;
  checkedClassName: string;
}> = [
  {
    key: "offense",
    label: "Offense",
    stroke: "#F7CF2F",
    checkedClassName: "border-gold-300/30 bg-gold-300/10 text-gold-50",
  },
  {
    key: "defense",
    label: "Defense",
    stroke: "#8DD3C7",
    checkedClassName: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
  },
  {
    key: "specialTeams",
    label: "Special Teams",
    stroke: "#F28E2B",
    checkedClassName: "border-orange-400/30 bg-orange-400/10 text-orange-100",
  },
];

interface CategoryTrendChartProps {
  data: Array<{
    label: string;
    opponent: string;
    result: string;
    offense: number | null;
    defense: number | null;
    specialTeams: number | null;
  }>;
}

function CategoryTrendTooltip({
  active,
  payload,
  visibleKeys,
}: TooltipProps<ValueType, NameType> & {
  payload?: Array<{
    payload: CategoryTrendChartProps["data"][number];
    dataKey?: string;
    name?: string;
    color?: string;
    value?: ValueType;
  }>;
  visibleKeys: CategoryKey[];
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const filteredPayload = payload.filter(
    (entry) =>
      entry.dataKey &&
      visibleKeys.includes(entry.dataKey as CategoryKey),
  );
  const point = filteredPayload[0]?.payload ?? payload[0]?.payload;
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
        {filteredPayload.map((entry) => (
          <p key={String(entry.dataKey)} style={{ color: entry.color ?? "#fff" }}>
            {entry.name}: {typeof entry.value === "number" ? entry.value.toFixed(1) : "n/a"}
          </p>
        ))}
      </div>
    </div>
  );
}

export function CategoryTrendChart({ data }: CategoryTrendChartProps) {
  const [visibleKeys, setVisibleKeys] = useState<CategoryKey[]>(
    CATEGORY_OPTIONS.map((option) => option.key),
  );

  const selectedKeys = useMemo(
    () => (visibleKeys.length ? visibleKeys : CATEGORY_OPTIONS.map((option) => option.key)),
    [visibleKeys],
  );

  function toggleCategory(category: CategoryKey) {
    setVisibleKeys((current) => {
      const next = current.includes(category)
        ? current.filter((key) => key !== category)
        : [...current, category];

      return next.length ? next : current;
    });
  }

  function showAll() {
    setVisibleKeys(CATEGORY_OPTIONS.map((option) => option.key));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {CATEGORY_OPTIONS.map((option) => {
          const checked = selectedKeys.includes(option.key);

          return (
            <button
              key={option.key}
              type="button"
              onClick={() => toggleCategory(option.key)}
              aria-pressed={checked}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-4 py-2 text-sm transition-colors",
                checked
                  ? option.checkedClassName
                  : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/20 hover:bg-white/[0.05]",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded border text-[11px] font-bold",
                  checked
                    ? "border-current bg-white/10"
                    : "border-white/20 bg-transparent text-transparent",
                )}
              >
                ✓
              </span>
              <span className="font-medium">{option.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={showAll}
          className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
        >
          Show all
        </button>
      </div>

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
            domain={[0, 100]}
            tick={{ fill: "#94A3B8", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ stroke: "rgba(247,207,47,0.4)" }}
            content={<CategoryTrendTooltip visibleKeys={selectedKeys} />}
          />
          {selectedKeys.includes("offense") ? (
            <Line
              type="monotone"
              dataKey="offense"
              name="Offense"
              stroke="#F7CF2F"
              strokeWidth={2.75}
              dot={{ fill: "#F7CF2F", r: 3 }}
              activeDot={{ r: 6 }}
              connectNulls={false}
            />
          ) : null}
          {selectedKeys.includes("defense") ? (
            <Line
              type="monotone"
              dataKey="defense"
              name="Defense"
              stroke="#8DD3C7"
              strokeWidth={2.75}
              dot={{ fill: "#8DD3C7", r: 3 }}
              activeDot={{ r: 6 }}
              connectNulls={false}
            />
          ) : null}
          {selectedKeys.includes("specialTeams") ? (
            <Line
              type="monotone"
              dataKey="specialTeams"
              name="Special Teams"
              stroke="#F28E2B"
              strokeWidth={2.75}
              dot={{ fill: "#F28E2B", r: 3 }}
              activeDot={{ r: 6 }}
              connectNulls={false}
            />
          ) : null}
        </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
