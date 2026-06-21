import Link from "next/link";

import { PlayerArchetypeDonut } from "@/components/player/player-archetype-donut";
import { PlayerPerformanceTrend } from "@/components/player/player-performance-trend";
import { PlayerProfileRadar } from "@/components/player/player-profile-radar";
import { DemoBanner } from "@/components/ui/demo-banner";
import { PageHero } from "@/components/ui/page-hero";
import { Panel } from "@/components/ui/panel";
import { StatCard } from "@/components/ui/stat-card";
import { buildPlayerArchetypeProfile } from "@/lib/player-archetypes";
import {
  buildPlayerComparisonSummary,
  buildPlayerDevelopmentAreas,
  buildPlayerSnapshotTrendPoints,
  buildPlayerStrengths,
  buildSinceLastUploadSummary,
} from "@/lib/player-breakdown";
import { getPlayerGoalieData } from "@/lib/player-goalie-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function formatScore(value: number | null, digits = 1) {
  return value === null ? "n/a" : `${value.toFixed(digits)}/100`;
}

function formatSigned(value: number | null, digits = 1) {
  if (value === null || Number.isNaN(value)) {
    return "n/a";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function formatMinutes(value: number | null) {
  return value === null ? "n/a" : `${Math.round(value)} min`;
}

function formatPosition(value: string) {
  if (value === "D") {
    return "Defense";
  }

  if (value === "F") {
    return "Forward";
  }

  return value;
}

function formatMetricValue(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "n/a";
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatDateLabel(value: string | null) {
  if (!value) {
    return "n/a";
  }

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function deltaBadgeClass(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "border-white/10 bg-white/5 text-slate-200";
  }

  if (value >= 5) {
    return "border-emerald-400/30 bg-emerald-400/12 text-emerald-100";
  }

  if (value <= -5) {
    return "border-rose-400/30 bg-rose-400/12 text-rose-100";
  }

  return "border-amber-400/30 bg-amber-400/12 text-amber-100";
}

export default async function PlayerBreakdownPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const params = (await searchParams) ?? {};
  const source = await getPlayerGoalieData();

  const selectedSeason =
    typeof params.season === "string"
      ? params.season
      : source.seasons.at(-1) ?? "";
  const seasonRows = source.playerBreakdowns.filter((row) => row.season === selectedSeason);
  const availablePlayers = [...seasonRows].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const selectedPlayerId =
    typeof params.player === "string" ? params.player : availablePlayers[0]?.id ?? "";
  const breakdown =
    availablePlayers.find((row) => row.id === selectedPlayerId) ?? availablePlayers[0] ?? null;
  const firstPlayerIdBySeason = source.playerBreakdowns
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name))
    .reduce((map, row) => {
      if (!map.has(row.season)) {
        map.set(row.season, row.id);
      }
      return map;
    }, new Map<string, string>());

  if (!source.available) {
    return (
      <>
        <PageHero
          eyebrow="Player Breakdown"
          title="Player evaluation dashboard"
          description="Run the player-goalie schema and import a skater aggregate export to unlock snapshot-based player breakdowns."
        />
        <DemoBanner isDemoMode />
        <Panel
          eyebrow="Unavailable"
          title="Player-goalie analytics are not ready yet."
          description={source.reason ?? "The player data model has not been set up yet."}
        />
      </>
    );
  }

  if (!breakdown) {
    return (
      <>
        <PageHero
          eyebrow="Player Breakdown"
          title="Player evaluation dashboard"
          description="Import a skater aggregate export to generate the first player scorecards and unlock the player breakdown page."
        />
        <Panel
          eyebrow="No data"
          title="No player scorecards are saved yet."
          description="The player model is ready, but there are no stored skater season score rows to display yet."
        />
      </>
    );
  }

  const comparison = buildPlayerComparisonSummary(breakdown, seasonRows);
  const archetypeProfile = buildPlayerArchetypeProfile(breakdown, seasonRows);
  const sinceLastUpload = buildSinceLastUploadSummary(breakdown);
  const strengths = buildPlayerStrengths(breakdown, comparison);
  const developmentAreas = buildPlayerDevelopmentAreas(breakdown, comparison);
  const trendPoints = buildPlayerSnapshotTrendPoints(breakdown);
  const topRole = archetypeProfile.primaryArchetype;
  const secondRole = archetypeProfile.secondaryArchetype;

  return (
    <>
      <PageHero
        eyebrow="Player Breakdown"
        title={breakdown.name}
        description={`${formatPosition(breakdown.position)} - ${breakdown.season} snapshot-based player evaluation built for staff review, development planning, and role context.`}
        chips={
          <>
            <span className="rounded-full border border-gold-300/30 bg-gold-300/12 px-4 py-2 text-sm font-semibold text-gold-100">
              {breakdown.modelType}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
              {archetypeProfile.primaryArchetype}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
              {archetypeProfile.confidenceLabel}
            </span>
            {archetypeProfile.secondaryArchetype ? (
              <span
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200"
              >
                Secondary: {archetypeProfile.secondaryArchetype}
              </span>
            ) : null}
          </>
        }
      />
      <DemoBanner isDemoMode={false} />

      <Panel
        eyebrow="Player Selector"
        title="Switch the skater in view"
        description="Keep the season fixed, then swap between saved player snapshot scorecards."
      >
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {source.seasons.map((season) => (
              <Link
                key={season}
                href={`/player-breakdown?season=${encodeURIComponent(season)}&player=${encodeURIComponent(firstPlayerIdBySeason.get(season) ?? breakdown.id)}`}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  selectedSeason === season
                    ? "border border-gold-300/30 bg-gold-300/15 text-gold-100"
                    : "border border-white/10 bg-white/5 text-slate-200"
                }`}
              >
                {season}
              </Link>
            ))}
          </div>

          <form action="/player-breakdown" method="get" className="flex flex-col gap-3 md:flex-row">
            <input type="hidden" name="season" value={selectedSeason} />
            <label className="sr-only" htmlFor="player">
              Skater
            </label>
            <select
              id="player"
              name="player"
              defaultValue={breakdown.id}
              className="h-14 flex-1 rounded-3xl border border-white/10 bg-white/5 px-4 text-base text-white outline-none transition focus:border-gold-300/35"
            >
              {availablePlayers.map((player) => (
                <option key={player.id} value={player.id} className="bg-slate-950 text-white">
                  {player.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="h-14 rounded-3xl border border-gold-300/30 bg-gold-300/15 px-6 text-sm font-semibold text-gold-100 transition hover:bg-gold-300/20"
            >
              View player
            </button>
          </form>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-6">
        <StatCard
          label="Overall Score"
          value={formatScore(breakdown.overallScore)}
          valueClassName="text-[2.25rem] md:text-[2.55rem]"
          note="Current season-to-date player score."
          tone="gold"
        />
        <StatCard
          label="Since Last Upload"
          value={sinceLastUpload.overallChange === null ? sinceLastUpload.trendLabel : formatSigned(sinceLastUpload.overallChange)}
          valueClassName="text-[1.95rem] md:text-[2.2rem]"
          note={sinceLastUpload.detail}
          trend={
            sinceLastUpload.tone === "up"
              ? "up"
              : sinceLastUpload.tone === "down"
                ? "down"
                : sinceLastUpload.tone === "flat"
                  ? "flat"
                  : undefined
          }
          tone="slate"
        />
        <StatCard
          label="Games Played"
          value={breakdown.gamesPlayed === null ? "n/a" : String(breakdown.gamesPlayed)}
          valueClassName="text-[2.2rem] md:text-[2.5rem]"
          note="Season-to-date games in the current export."
          tone="slate"
        />
        <StatCard
          label="TOI"
          value={formatMinutes(breakdown.toiMinutes)}
          valueClassName="text-[2.15rem] md:text-[2.4rem]"
          note="Total ice time in the current season export."
          tone="slate"
        />
        <StatCard
          label="Reliability"
          value={breakdown.reliabilityFlag ?? "n/a"}
          valueClassName="text-[1.72rem] md:text-[1.95rem]"
          note={
            breakdown.reliabilityScore === null
              ? "Sample context is limited."
              : `${breakdown.reliabilityScore.toFixed(1)}/100 reliability score.`
          }
          tone="slate"
        />
        <StatCard
          label="Role / Profile"
          value={topRole}
          valueClassName="text-[1.62rem] md:text-[1.82rem]"
          note={
            secondRole
              ? `${secondRole} is the secondary lean. ${archetypeProfile.confidenceLabel}.`
              : archetypeProfile.insufficientData
                ? "Needs more reliable data before the profile locks in."
                : `${archetypeProfile.confidenceLabel}. Weighted archetype mix built from current season-to-date player data.`
          }
          tone="slate"
        />
      </div>

      <Panel
        eyebrow="Player Archetype"
        title="How this player is wired right now"
        description="A cleaner read on what kind of player this is, based on the current season profile."
      >
        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="rounded-[32px] border border-white/8 bg-white/[0.035] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.18)]">
              <p className="section-title">Primary Archetype</p>
              <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-3xl font-semibold text-white">
                    {archetypeProfile.primaryArchetype}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    Secondary lean: {archetypeProfile.secondaryArchetype ?? "No strong secondary lean"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-gold-300/20 bg-gold-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-100">
                      {archetypeProfile.confidenceLabel}
                    </span>
                    {archetypeProfile.adjustedByContradiction && archetypeProfile.rawPrimaryArchetype ? (
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200">
                        Adjusted from raw {archetypeProfile.rawPrimaryArchetype}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {archetypeProfile.styleTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-[26px] border border-white/8 bg-[#0b1320]/70 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-100">
                  Statistical Player Description
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-200">
                  {archetypeProfile.statisticalDescription}
                </p>
              </div>

              <div className="mt-5 rounded-[26px] border border-white/8 bg-white/[0.025] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-100">
                  Coach Summary
                </p>
                <ul className="mt-3 space-y-2.5 text-sm leading-6 text-slate-200">
                  {archetypeProfile.coachBullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-200" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
                {archetypeProfile.cautionSignals.length ? (
                  <div className="mt-4 rounded-[22px] border border-amber-300/15 bg-amber-400/[0.04] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100">
                      Caution Signals
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">
                      {archetypeProfile.cautionSignals.map((signal) => signal.label).join(", ")}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <PlayerArchetypeDonut profile={archetypeProfile} />
        </div>
      </Panel>

      <Panel
        eyebrow="Snapshot Trend"
        title="Player progress over time"
        description="Track how the player profile has moved from upload to upload. This is snapshot tracking, not game-by-game scoring."
      >
        <div className="grid gap-4 xl:grid-cols-[1.3fr_0.85fr]">
          <PlayerPerformanceTrend
            points={trendPoints}
            currentScore={breakdown.overallScore}
            teamAverage={comparison.overallTeamAverage}
            positionAverage={comparison.overallPositionAverage}
          />

          <div className="space-y-3">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
              <p className="section-title">Since Last Upload</p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {sinceLastUpload.overallChange === null
                  ? sinceLastUpload.trendLabel
                  : formatSigned(sinceLastUpload.overallChange)}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {sinceLastUpload.detail}
              </p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
              <p className="section-title">Upload Block Context</p>
              <div className="mt-3 space-y-2 text-sm text-slate-200">
                <p>Games added: {sinceLastUpload.gamesAdded ?? "n/a"}</p>
                <p>
                  TOI added:{" "}
                  {sinceLastUpload.toiAddedMinutes === null
                    ? "n/a"
                    : `${Math.round(sinceLastUpload.toiAddedMinutes)} min`}
                </p>
                <p>Biggest improvement: {sinceLastUpload.biggestImprovement ?? "n/a"}</p>
                <p>Biggest decline: {sinceLastUpload.biggestDecline ?? "n/a"}</p>
              </div>
            </div>

            <p className="px-1 text-xs uppercase tracking-[0.16em] text-slate-400">
              Latest snapshot: {formatDateLabel(breakdown.snapshots.at(-1)?.snapshotDate ?? null)}
            </p>
          </div>
        </div>
      </Panel>

      <Panel
        eyebrow="Category Snapshot"
        title="Current profile at a glance"
        description="Use the compact bars to see where the player is helping most and where they trail the team or position group."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {comparison.categoryRows.map((row) => (
            <article
              key={row.category}
              className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {row.shortLabel}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {formatScore(row.score)}
                  </p>
                </div>
                <p
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${deltaBadgeClass(
                    row.deltaVsPosition,
                  )}`}
                >
                  vs pos {formatSigned(row.deltaVsPosition)}
                </p>
              </div>
              <div className="mt-4 h-2 rounded-full bg-white/5">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-gold-300 via-gold-200 to-gold-100"
                  style={{ width: `${Math.max(0, Math.min(100, row.score ?? 0))}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-slate-300">
                Team avg {formatScore(row.teamAverage)} · Position avg {formatScore(row.positionAverage)}
              </p>
            </article>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <Panel
          eyebrow="Profile Shape"
          title="How this player compares to the group"
          description="Switch between team-average and position-average reference shapes to see the player profile more clearly."
        >
          <PlayerProfileRadar rows={comparison.categoryRows} defaultMode="position" />
        </Panel>

        <div className="space-y-4">
          <Panel
            eyebrow="Player Profile"
            title="Quick staff read"
            description="Use the current archetype, recent direction, and category shape together when discussing role and next focus."
          >
            <ul className="space-y-3 text-sm leading-7 text-slate-200">
              <li className="rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-3">
                Primary read: {archetypeProfile.primaryArchetype}
                {archetypeProfile.secondaryArchetype
                  ? ` with ${archetypeProfile.secondaryArchetype.toLowerCase()} support.`
                  : "."}
              </li>
              <li className="rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-3">
                Recent direction: {sinceLastUpload.trendLabel}.
              </li>
              <li className="rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-3">
                Biggest current coaching opportunity: {developmentAreas[0]?.title ?? "No single development theme is separating clearly right now."}
              </li>
              <li className="rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-3">
                Most bankable current plus: {strengths[0]?.title ?? "No clear positive edge has separated from the profile yet."}
              </li>
            </ul>
          </Panel>

        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          eyebrow="Strengths"
          title="What this player is giving the group"
          description="Concise coach-facing positives built from the current score profile and the strongest supporting KPI signals."
        >
          <div className="space-y-3">
            {strengths.map((item) => (
              <article
                key={item.title}
                className="rounded-[28px] border border-emerald-300/15 bg-emerald-400/[0.04] p-4"
              >
                <p className="text-sm font-semibold text-emerald-100">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">{item.evidence}</p>
                {item.focus ? <p className="mt-2 text-sm text-slate-300">{item.focus}</p> : null}
              </article>
            ))}
          </div>
        </Panel>

        <Panel
          eyebrow="Development Areas"
          title="Where the next lift can come from"
          description="Use these notes to focus video, coaching touchpoints, and role-specific development attention."
        >
          <div className="space-y-3">
            {developmentAreas.map((item) => (
              <article
                key={item.title}
                className="rounded-[28px] border border-rose-300/15 bg-rose-400/[0.04] p-4"
              >
                <p className="text-sm font-semibold text-rose-100">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">{item.evidence}</p>
                {item.focus ? <p className="mt-2 text-sm text-slate-300">{item.focus}</p> : null}
              </article>
            ))}
          </div>
        </Panel>
      </div>

      <Panel eyebrow="Advanced Metrics" title="Detailed KPI view">
        <details className="group rounded-[28px] border border-white/10 bg-white/[0.03]">
          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-white">
            Open the underlying metric table
          </summary>
          <div className="border-t border-white/10 p-4">
            <div className="overflow-hidden rounded-3xl border border-white/10">
              <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                <thead className="bg-white/5">
                  <tr>
                    {["Metric", "Category", "Raw", "Calculated", "Score"].map((header) => (
                      <th
                        key={header}
                        className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-slate-400"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {breakdown.metrics.map((metric) => (
                    <tr key={`${metric.metricKey}-${metric.category}`} className="bg-white/[0.02]">
                      <td className="px-4 py-3 text-white">{metric.displayName}</td>
                      <td className="px-4 py-3 text-slate-300">{metric.category}</td>
                      <td className="px-4 py-3 text-slate-300">{formatMetricValue(metric.rawValue)}</td>
                      <td className="px-4 py-3 text-slate-300">
                        {formatMetricValue(metric.calculatedValue)}
                      </td>
                      <td className="px-4 py-3 text-slate-100">
                        {metric.score0100 === null ? "n/a" : `${metric.score0100.toFixed(1)}/100`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </Panel>
    </>
  );
}
