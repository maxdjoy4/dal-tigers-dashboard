"use client";

import { useMemo, useRef, useState } from "react";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { TACTICAL_GROUP_METADATA } from "@/lib/category-metadata";
import type { TacticalDriverRow } from "@/lib/types";

const RANGE_BANDS = [
  {
    key: "strongZone",
    label: "Strong",
    value: 100,
    fill: "rgba(52, 211, 153, 0.08)",
    stroke: "rgba(52, 211, 153, 0.12)",
  },
  {
    key: "stableZone",
    label: "Stable",
    value: 65,
    fill: "rgba(245, 200, 66, 0.08)",
    stroke: "rgba(245, 200, 66, 0.12)",
  },
  {
    key: "watchZone",
    label: "Watch",
    value: 50,
    fill: "rgba(251, 191, 36, 0.08)",
    stroke: "rgba(251, 191, 36, 0.12)",
  },
  {
    key: "concernZone",
    label: "Concern",
    value: 35,
    fill: "rgba(251, 113, 133, 0.08)",
    stroke: "rgba(251, 113, 133, 0.12)",
  },
] as const;

const LABEL_OFFSET = 18;

type RadarTooltipState = {
  label: string;
  description: string;
  examples: string;
  x: number;
  y: number;
  horizontalAlign: "left" | "center" | "right";
  verticalAlign: "above" | "below";
};

export function TacticalRadarChart({
  rows,
}: {
  rows: TacticalDriverRow[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [labelTooltip, setLabelTooltip] = useState<RadarTooltipState | null>(null);
  const chartRows = rows
    .filter((row) => row.score !== null)
    .map((row) =>
      RANGE_BANDS.reduce<Record<string, string | number>>(
        (result, band) => ({
          ...result,
          [band.key]: band.value,
        }),
        {
          group: row.group,
          label: row.label,
          score: row.score ?? 0,
        },
      ),
    );
  const metadataByLabel = useMemo(
    () =>
      new Map(
        rows.map((row) => [
          row.label,
          TACTICAL_GROUP_METADATA[row.group],
        ]),
      ),
    [rows],
  );

  function showLabelTooltip(label: string, x: number, y: number) {
    const metadata = metadataByLabel.get(label);
    if (!metadata) {
      return;
    }

    const containerWidth = containerRef.current?.clientWidth ?? 0;
    const containerHeight = containerRef.current?.clientHeight ?? 0;
    const horizontalAlign =
      containerWidth && x < 150 ? "left" : containerWidth && x > containerWidth - 150 ? "right" : "center";
    const verticalAlign =
      containerHeight && y < containerHeight / 2 ? "below" : "above";

    setLabelTooltip({
      label,
      description: metadata.description,
      examples: metadata.examples,
      x,
      y,
      horizontalAlign,
      verticalAlign,
    });
  }

  if (chartRows.length < 3) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.group}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              {row.label}
            </p>
            <p className="mt-2 text-xl font-semibold text-white">
              {row.score === null ? "n/a" : row.score.toFixed(1)}
            </p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div ref={containerRef} className="relative h-[360px] w-full overflow-visible">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartRows}>
            <PolarGrid stroke="rgba(148,163,184,0.12)" />
            <PolarAngleAxis
              dataKey="label"
              tick={({ payload, x, y, textAnchor }) => {
                const label = String(payload?.value ?? "");
                const pointX = Number(x);
                const pointY = Number(y);
                const centerX = (containerRef.current?.clientWidth ?? 0) / 2;
                const centerY = (containerRef.current?.clientHeight ?? 0) / 2;
                const dx = pointX - centerX;
                const dy = pointY - centerY;
                const distance = Math.hypot(dx, dy) || 1;
                const labelX = centerX + (dx / distance) * (distance + LABEL_OFFSET);
                const labelY = centerY + (dy / distance) * (distance + LABEL_OFFSET);

                return (
                  <g
                    transform={`translate(${labelX},${labelY})`}
                    onMouseEnter={() => showLabelTooltip(label, labelX, labelY)}
                    onMouseLeave={() => setLabelTooltip(null)}
                    onFocus={() => showLabelTooltip(label, labelX, labelY)}
                    onBlur={() => setLabelTooltip(null)}
                    tabIndex={0}
                    role="button"
                    aria-label={`${label}. Hover for tactical driver details.`}
                    style={{ cursor: "help", outline: "none" }}
                  >
                    <text
                      textAnchor={textAnchor}
                      fill="#CBD5E1"
                      fontSize={12}
                      fontWeight={600}
                      className="transition-opacity"
                    >
                      {label}
                    </text>
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
              formatter={(value) =>
                typeof value === "number" ? [`${value.toFixed(1)}/100`, "Score"] : [value, "Score"]
              }
              contentStyle={{
                borderRadius: 18,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(6, 10, 17, 0.96)",
              }}
            />
            {RANGE_BANDS.map((band) => (
              <Radar
                key={band.key}
                dataKey={band.key}
                stroke={band.stroke}
                fill={band.fill}
                fillOpacity={1}
                strokeWidth={1}
                isAnimationActive={false}
              />
            ))}
            <Radar
              dataKey="score"
              stroke="#F7CF2F"
              fill="#F7CF2F"
              fillOpacity={0.22}
              strokeWidth={2.5}
              dot={{
                r: 3,
                strokeWidth: 1,
                stroke: "rgba(6, 10, 17, 0.9)",
                fill: "#F7CF2F",
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
        {labelTooltip ? (
          <div
            className="pointer-events-none absolute z-20 w-64 rounded-2xl border border-gold-300/20 bg-[#0b111b]/95 px-4 py-3 shadow-[0_16px_40px_rgba(2,6,23,0.45)] backdrop-blur-sm"
            style={{
              left: labelTooltip.x,
              top: labelTooltip.y,
              transform: `${labelTooltip.horizontalAlign === "left" ? "translateX(0)" : labelTooltip.horizontalAlign === "right" ? "translateX(-100%)" : "translateX(-50%)"} ${labelTooltip.verticalAlign === "above" ? "translateY(calc(-100% - 12px))" : "translateY(12px)"}`,
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-100">
              {labelTooltip.label}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-100">
              {labelTooltip.description}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              <span className="font-semibold text-gold-50">Example KPIs:</span>{" "}
              {labelTooltip.examples}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-300">
        {RANGE_BANDS.map((band) => (
          <span
            key={band.key}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: band.stroke }}
            />
            {band.label}
          </span>
        ))}
      </div>
    </div>
  );
}
