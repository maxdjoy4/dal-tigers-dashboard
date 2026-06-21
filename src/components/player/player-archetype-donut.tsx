"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
} from "recharts";

import type { PlayerArchetypeProfile } from "@/lib/player-archetypes";

interface HoverState {
  name: string;
  share: number;
  score: number | null;
  color: string;
  x: number;
  y: number;
}

export function PlayerArchetypeDonut({
  profile,
}: {
  profile: PlayerArchetypeProfile;
}) {
  const data = profile.scores.filter((row) => row.share > 0);
  const [hoverState, setHoverState] = useState<HoverState | null>(null);
  const primaryShare =
    profile.scores.find((row) => row.name === profile.primaryArchetype)?.share ??
    data[0]?.share ??
    0;

  if (!data.length) {
    return (
      <div className="rounded-[24px] border border-dashed border-white/12 bg-white/3 p-6 text-sm text-slate-400">
        No archetype distribution is available yet for this player.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[30px] border border-white/8 bg-white/[0.025] p-4">
        <div className="relative h-[320px] w-full">
          {hoverState ? (
            <div
              className={cn(
                "pointer-events-none absolute z-20 w-[190px] -translate-x-1/2 -translate-y-1/2 rounded-[22px] border border-white/10 bg-[#08101a]/95 px-4 py-3 text-sm text-slate-100 shadow-[0_18px_40px_rgba(2,6,23,0.5)] backdrop-blur-sm",
                hoverState.x < 110 && "translate-x-0",
                hoverState.x > 250 && "-translate-x-full",
              )}
              style={{
                left: hoverState.x,
                top: hoverState.y,
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-1 h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: hoverState.color }}
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-100">
                    {hoverState.name}
                  </p>
                  <div className="mt-2 space-y-1.5">
                    <p>Identity share: {hoverState.share.toFixed(1)}%</p>
                    <p>
                      Archetype score:{" "}
                      {hoverState.score === null ? "n/a" : hoverState.score.toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="share"
                  nameKey="name"
                  innerRadius="70%"
                outerRadius="84%"
                paddingAngle={4}
                stroke="rgba(8,16,26,0.95)"
                strokeWidth={2}
                onMouseEnter={(entry, index) => {
                  const radius =
                    typeof entry.outerRadius === "number" ? entry.outerRadius + 28 : 140;
                  const angle = ((entry.midAngle ?? 0) * Math.PI) / 180;
                  const cx = typeof entry.cx === "number" ? entry.cx : 160;
                  const cy = typeof entry.cy === "number" ? entry.cy : 160;
                  const rawX = cx + Math.cos(-angle) * radius;
                  const rawY = cy + Math.sin(-angle) * radius;
                  const clampedX = Math.max(18, Math.min(302, rawX));
                  const clampedY = Math.max(28, Math.min(292, rawY));

                  setHoverState({
                    name: data[index]?.name ?? entry.name ?? "",
                    share: data[index]?.share ?? entry.value ?? 0,
                    score: data[index]?.score ?? null,
                    color: data[index]?.color ?? "#94A3B8",
                    x: clampedX,
                    y: clampedY,
                  });
                }}
                onMouseLeave={() => setHoverState(null)}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="max-w-[220px] rounded-full border border-white/8 bg-[#0b1320]/88 px-6 py-5 text-center shadow-[0_18px_50px_rgba(2,6,23,0.35)] backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Primary mix
                </p>
                <p className="mt-2 text-[2.1rem] font-semibold leading-none text-white">
                  {primaryShare.toFixed(1)}%
                </p>
                <p className="mt-2 text-sm leading-5 text-slate-300">{profile.primaryArchetype}</p>
              </div>
            </div>
          </div>
      </div>

      <div className="rounded-[30px] border border-white/8 bg-white/[0.025] p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-100">
              Archetype Mix
            </p>
            <p className="mt-1 text-sm text-slate-300">Identity share, score, and profile balance.</p>
          </div>
        </div>
        <div className="space-y-3">
          {profile.scores.map((row) => (
            <div
              key={row.name}
              className="rounded-[24px] border border-white/8 bg-white/[0.03] px-4 py-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="truncate text-sm font-semibold text-slate-100">{row.name}</span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-white/6">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${Math.max(0, Math.min(100, row.share))}%`,
                        backgroundColor: row.color,
                      }}
                    />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-white">{row.share.toFixed(1)}%</p>
                  <p className="text-xs text-slate-400">
                    Score {row.score === null ? "n/a" : row.score.toFixed(1)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
