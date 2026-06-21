import { format } from "date-fns";

import { LineTrendChart } from "@/components/charts/line-trend-chart";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { KpiLookupPanel } from "@/components/dashboard/kpi-lookup-panel";
import { RecentGamesTable } from "@/components/dashboard/recent-games-table";
import { SummaryCategoryOverview } from "@/components/dashboard/summary-category-overview";
import { TacticalRadarChart } from "@/components/dashboard/tactical-radar-chart";
import { DemoBanner } from "@/components/ui/demo-banner";
import { PageHero } from "@/components/ui/page-hero";
import { Panel } from "@/components/ui/panel";
import { ScoreBadge } from "@/components/ui/score-badge";
import { StatCard } from "@/components/ui/stat-card";
import { getDashboardData } from "@/lib/data";
import { getOpponentDisplayName, getOpponentFullName } from "@/lib/opponents";
import {
  buildAnalyticsBundle,
  describeTrend,
  formatTrendDelta,
  parseFilters,
  trendToCardTrend,
} from "@/lib/scoring";
import { TREND_WINDOW_GAMES } from "@/lib/trend-window";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function formatScore(value: number | null) {
  return value === null ? "Insufficient data" : `${value.toFixed(1)}/100`;
}

function strongestCategoryLabel(
  latestGame: ReturnType<typeof buildAnalyticsBundle>["latestGame"],
) {
  if (!latestGame) {
    return null;
  }

  const rows = [
    { label: "Offense", score: latestGame.categoryScores.offense.score },
    { label: "Defense", score: latestGame.categoryScores.defense.score },
    { label: "Special Teams", score: latestGame.categoryScores.special_teams.score },
  ].filter((row) => row.score !== null);

  return [...rows].sort((left, right) => (right.score ?? 0) - (left.score ?? 0))[0]?.label ?? null;
}

function weakestCategoryLabel(
  latestGame: ReturnType<typeof buildAnalyticsBundle>["latestGame"],
) {
  if (!latestGame) {
    return null;
  }

  const rows = [
    { label: "Offense", score: latestGame.categoryScores.offense.score },
    { label: "Defense", score: latestGame.categoryScores.defense.score },
    { label: "Special Teams", score: latestGame.categoryScores.special_teams.score },
  ].filter((row) => row.score !== null);

  return [...rows].sort((left, right) => (left.score ?? 0) - (right.score ?? 0))[0]?.label ?? null;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const source = await getDashboardData();
  const analytics = buildAnalyticsBundle(
    source.games,
    source.weights,
    filters,
    source.demoMode,
  );
  const latest = analytics.latestGame;
  const latestStrongestCategory = strongestCategoryLabel(latest);
  const latestConcernCategory = weakestCategoryLabel(latest);
  const recentGames = analytics.recentGames.slice(0, 5);

  return (
    <>
      <PageHero
        eyebrow="Team Summary"
        title="Summary Dashboard"
        description="A high-level overview of current team performance, recent form, and priority areas."
        chips={
          <>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100">
              {analytics.allGamesCount} saved games
            </span>
            <span className="rounded-full border border-gold-300/30 bg-gold-300/10 px-4 py-2 text-sm text-gold-50">
              {analytics.weights.length} weighted KPIs
            </span>
          </>
        }
      />

      <DemoBanner isDemoMode={analytics.isDemoMode} />

      {analytics.calculationWarnings.length > 0 ? (
        <div className="space-y-3">
          {analytics.calculationWarnings.slice(0, 3).map((warning) => (
            <div
              key={warning}
              className="glass-panel gold-ring rounded-3xl border-gold-300/20 bg-gold-300/10 px-4 py-3 text-sm text-gold-50"
            >
              {warning}
            </div>
          ))}
        </div>
      ) : null}

      <Panel
        eyebrow="Filters"
        title="Current view"
        description="Use the same filter stack as the rest of the app. For a deeper trend view, see Trends & History."
      >
        <FilterBar filters={analytics.filters} options={analytics.filterOptions} />
      </Panel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Season Score"
          value={formatScore(analytics.seasonAverage)}
          note="Current filtered season view"
        />
        <StatCard
          label={`Last ${TREND_WINDOW_GAMES} Score`}
          value={formatScore(analytics.recentWindowAverage)}
          note="Recent form"
          tone="slate"
        />
        <StatCard
          label="Latest Game"
          value={formatScore(analytics.lastGameScore)}
          note={latest ? `vs ${getOpponentDisplayName(latest.game.opponent)}` : "Awaiting valid games"}
          tone="slate"
        />
        <StatCard
          label="Trend"
          value={describeTrend(analytics.trendDirection)}
          note={`${formatTrendDelta(analytics.trendDelta)} vs previous game`}
          trend={trendToCardTrend(analytics.trendDirection)}
        />
        <StatCard
          label="Games In View"
          value={String(analytics.filteredGamesCount)}
          note="Scored games in current filter"
          tone="slate"
        />
        <StatCard
          label="Record"
          value={analytics.recordLabel}
          note="Current filter sample"
          tone="slate"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <Panel
          eyebrow="Quick Summary"
          title="At a glance"
          description="The fastest read on what matters most right now."
        >
          <div className="space-y-3">
            {analytics.quickSummary.map((item) => (
              <div
                key={item}
                className="rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-slate-100"
              >
                {item}
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          eyebrow="Trend View"
          title="Performance over time"
          description="Team score and rolling average. See Trends & History for the full historical breakdown."
        >
          <LineTrendChart data={analytics.trendSeries} />
        </Panel>
      </div>

      <Panel
        eyebrow="Category Overview"
        title="High-level category split"
        description="A quick read on offense, defense, and special teams in the current filter."
      >
        <SummaryCategoryOverview rows={analytics.categoryOverview} />
      </Panel>

      <Panel
        eyebrow="Tactical Drivers"
        title="Compact tactical summary"
        description="A visual summary of the tactical groups shaping the current team profile. See Game Analyzer or Opponent Matchup for the deeper breakdown."
      >
        <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
          <TacticalRadarChart rows={analytics.tacticalDrivers} />
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="section-title">What matters most</p>
              <p className="mt-3 text-sm leading-7 text-slate-100">
                {analytics.tacticalSummary.summary}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                <p className="section-title">Strongest Driver</p>
                <p className="mt-3 text-xl font-semibold text-white">
                  {analytics.tacticalSummary.strongest ?? "n/a"}
                </p>
              </div>
              <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 p-4">
                <p className="section-title">Biggest Concern</p>
                <p className="mt-3 text-xl font-semibold text-white">
                  {analytics.tacticalSummary.concern ?? "n/a"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <Panel
          eyebrow="Recent Games"
          title="Recent form"
          description="Five-game snapshot. See Game Analyzer for full single-game detail."
        >
          <RecentGamesTable games={recentGames} />
        </Panel>

        <Panel
          eyebrow="Latest Snapshot"
          title="Most recent game"
          description="A compact snapshot of the latest scored game in the current view."
        >
          {latest ? (
            <div className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-300">
                      {format(new Date(latest.game.date), "MMM d, yyyy")}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      <span title={getOpponentFullName(latest.game.opponent)}>
                        {getOpponentDisplayName(latest.game.opponent)}
                      </span>
                    </p>
                    <p className="mt-2 text-sm text-slate-200">{latest.game.result}</p>
                  </div>
                  <ScoreBadge score={latest.overallScore} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                  <p className="section-title">Strongest Category</p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {latestStrongestCategory ?? "n/a"}
                  </p>
                </div>
                <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 p-4">
                  <p className="section-title">Main Concern</p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {latestConcernCategory ?? "n/a"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-300">
              Save a game to generate the latest snapshot.
            </p>
          )}
        </Panel>
      </div>

      <Panel
        eyebrow="KPI Lookup"
        title="Look up one KPI"
        description="Select any weighted KPI to review its current values, scoring direction, and why it matters in the current filter."
      >
        <KpiLookupPanel
          kpiSummary={analytics.kpiSummary}
          weights={analytics.weights}
        />
      </Panel>
    </>
  );
}
