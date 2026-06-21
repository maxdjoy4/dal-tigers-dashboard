import Link from "next/link";

import { DriversBarChart } from "@/components/charts/drivers-bar-chart";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { TacticalDriversPanel } from "@/components/dashboard/tactical-drivers-panel";
import { Panel } from "@/components/ui/panel";
import { PageHero } from "@/components/ui/page-hero";
import { DemoBanner } from "@/components/ui/demo-banner";
import { StatCard } from "@/components/ui/stat-card";
import { CategoryBarChart } from "@/components/charts/category-bar-chart";
import { getDashboardData } from "@/lib/data";
import { getOpponentDisplayName, getOpponentFullName } from "@/lib/opponents";
import { buildTacticalDriverRows } from "@/lib/tactical-analysis";
import {
  buildAnalyticsBundle,
  describeTrend,
  formatTrendDelta,
  generateGameReadout,
  parseFilters,
  trendToCardTrend,
} from "@/lib/scoring";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function formatScore(value: number | null) {
  return value === null ? "Insufficient data" : `${value.toFixed(1)}/100`;
}

export default async function GameAnalyzerPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const selectedGameId =
    (Array.isArray(params.game) ? params.game[0] : params.game) || null;
  const source = await getDashboardData();
  const analytics = buildAnalyticsBundle(
    source.games,
    source.weights,
    filters,
    source.demoMode,
  );
  const selectedGame =
    analytics.scoredGames.find((game) => game.game.id === selectedGameId) ||
    analytics.latestGame;
  const selectedTrend = selectedGame
    ? analytics.trendSeries.find((point) => point.id === selectedGame.game.id)
    : null;
  const selectedDrivers = selectedGame
    ? [...selectedGame.kpis]
        .filter((kpi) => kpi.available && kpi.impact !== null)
        .sort((left, right) => (right.impact ?? 0) - (left.impact ?? 0))
        .slice(0, 5)
        .map((kpi) => ({
          key: kpi.key,
          name: kpi.name,
          category: kpi.category,
          impact: kpi.impact ?? 0,
          rawValue: kpi.rawValue,
          normalizedScore: kpi.normalizedScore ?? 0,
          weightedScore: kpi.weightedScore ?? 0,
        }))
    : [];
  const selectedIssues = selectedGame
    ? [...selectedGame.kpis]
        .filter((kpi) => kpi.available && kpi.impact !== null)
        .sort((left, right) => (left.impact ?? 0) - (right.impact ?? 0))
        .slice(0, 5)
        .map((kpi) => ({
          key: kpi.key,
          name: kpi.name,
          category: kpi.category,
          impact: kpi.impact ?? 0,
          rawValue: kpi.rawValue,
          normalizedScore: kpi.normalizedScore ?? 0,
          weightedScore: kpi.weightedScore ?? 0,
        }))
    : [];
  const categoryData = selectedGame
    ? [
        { category: "Offense", score: selectedGame.categoryScores.offense.score },
        { category: "Defense", score: selectedGame.categoryScores.defense.score },
        { category: "Special Teams", score: selectedGame.categoryScores.special_teams.score },
      ]
    : [];
  const tacticalDrivers = selectedGame
    ? buildTacticalDriverRows(
        [selectedGame],
        analytics.seasonBaselineScoredGames,
        analytics.weights,
      )
    : [];
  const gameReadout = generateGameReadout(
    selectedGame,
    selectedDrivers,
    selectedIssues,
    selectedTrend?.trendDirection ?? analytics.trendDirection,
    tacticalDrivers,
  );

  return (
    <>
      <PageHero
        eyebrow="Game Analyzer"
        title="Single-game breakdowns for film sessions and staff debriefs."
        description="Choose a game, review category output, and isolate the KPIs that drove the final performance score."
        titleClassName="max-w-5xl leading-[1.1] md:leading-[1.08]"
      />
      <DemoBanner isDemoMode={analytics.isDemoMode} />
      {analytics.calculationWarnings.length > 0 ? (
        <div className="space-y-3">
          {analytics.calculationWarnings.slice(0, 6).map((warning) => (
            <div
              key={warning}
              className="glass-panel gold-ring rounded-3xl border-gold-300/20 bg-gold-300/10 px-4 py-3 text-sm text-gold-50"
            >
              {warning}
            </div>
          ))}
        </div>
      ) : null}
      <Panel title="Filters" description="Use the dashboard filters to narrow the game pool before selecting a specific matchup.">
        <FilterBar filters={analytics.filters} options={analytics.filterOptions} />
      </Panel>

      <Panel
        eyebrow="Game Picker"
        title="Select a saved matchup"
        description="Jump straight to one of the most recent games in the filtered set."
      >
        <div className="flex flex-wrap gap-2">
          {analytics.recentGames.map((game) => (
            <Link
              key={game.id}
              href={`/game-analyzer?game=${game.id}`}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                selectedGame?.game.id === game.id
                  ? "border border-gold-300/35 bg-gold-300/15 text-gold-50"
                  : "border border-white/10 bg-white/5 text-slate-200"
              }`}
            >
              <span title={getOpponentFullName(game.opponent)}>
                {getOpponentDisplayName(game.opponent)}
              </span>{" "}
              {game.result}
            </Link>
          ))}
        </div>
      </Panel>

      {selectedGame ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Game Score"
              value={formatScore(selectedGame.overallScore)}
              note="Weighted overall rating"
            />
            <StatCard
              label="Opponent"
              value={getOpponentDisplayName(selectedGame.game.opponent)}
              note={`${selectedGame.game.result} | ${getOpponentFullName(selectedGame.game.opponent)}`}
              tone="slate"
            />
            <StatCard
              label="Location"
              value={selectedGame.game.homeAway}
              note={selectedGame.game.season}
              tone="slate"
            />
            <StatCard
              label="Trend Context"
              value={describeTrend(selectedTrend?.trendDirection ?? analytics.trendDirection)}
              note={
                selectedTrend
                  ? `${formatTrendDelta(selectedTrend.trendDelta)} vs the previous game at this point in the season`
                  : "Trend context becomes available after two saved games"
              }
              trend={trendToCardTrend(
                selectedTrend?.trendDirection ?? analytics.trendDirection,
              )}
            />
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-[0.9fr,1.1fr]">
            <Panel
              className="xl:self-start"
              eyebrow="Category Mix"
              title="Category score split"
              description="How the selected game graded across offense, defense, and special teams."
            >
              <CategoryBarChart data={categoryData} />
            </Panel>
            <Panel
              eyebrow="Coach Takeaway"
              title="Post-Game Readout"
              description="High-level interpretation from the weighted KPI model."
            >
              <div className="rounded-3xl border border-gold-300/20 bg-gold-300/10 p-5">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-gold-100/80">
                  Overall Read
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-100">
                  {gameReadout.overallRead}
                </p>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-500/8 p-5">
                  <p className="text-sm font-semibold text-white">What Worked</p>
                  <ul className="mt-3 space-y-3 text-sm leading-7 text-slate-200">
                    {gameReadout.worked.map((item) => (
                      <li key={item} className="flex gap-3">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-[24px] border border-rose-400/15 bg-rose-500/8 p-5">
                  <p className="text-sm font-semibold text-white">What Hurt Us</p>
                  <ul className="mt-3 space-y-3 text-sm leading-7 text-slate-200">
                    {gameReadout.hurt.map((item) => (
                      <li key={item} className="flex gap-3">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-300" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-white/4 p-5">
                  <p className="text-sm font-semibold text-white">Carry Forward</p>
                  <ul className="mt-3 space-y-3 text-sm leading-7 text-slate-200">
                    {gameReadout.carryForward.map((item) => (
                      <li key={item} className="flex gap-3">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-200" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/4 p-5">
                  <p className="text-sm font-semibold text-white">Clean Up</p>
                  <ul className="mt-3 space-y-3 text-sm leading-7 text-slate-200">
                    {gameReadout.cleanUp.map((item) => (
                      <li key={item} className="flex gap-3">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-200" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {selectedGame.warnings.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {selectedGame.warnings.map((warning) => (
                    <div
                      key={warning.code + warning.message}
                      className="rounded-2xl border border-gold-300/20 bg-gold-300/10 px-4 py-3 text-sm text-gold-50"
                    >
                      {warning.message}
                    </div>
                  ))}
                </div>
              ) : null}
            </Panel>
          </div>

          <Panel
            eyebrow="Tactical Performance Drivers"
            title="What shaped this game's category scores?"
            description="Single-game tactical groups compared with the season baseline for the current season context."
          >
            <TacticalDriversPanel
              rows={tacticalDrivers}
              baselineLabel="Season baseline"
              showMiniBulletChart
              sortByScore
            />
          </Panel>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel
              eyebrow="Positive Drivers"
              title="What worked"
              description="Highest positive impacts inside the selected game."
            >
              <DriversBarChart
                data={[...selectedGame.kpis]
                  .filter((kpi) => kpi.available && kpi.impact !== null)
                  .sort((left, right) => (right.impact ?? 0) - (left.impact ?? 0))
                  .slice(0, 5)
                  .map((kpi) => ({ name: kpi.name, impact: kpi.impact ?? 0 }))}
              />
            </Panel>
            <Panel
              eyebrow="Negative Drivers"
              title="What needs attention"
              description="KPIs that pulled the score down most sharply."
            >
              <DriversBarChart
                tone="negative"
                data={[...selectedGame.kpis]
                  .filter((kpi) => kpi.available && kpi.impact !== null)
                  .sort((left, right) => (left.impact ?? 0) - (right.impact ?? 0))
                  .slice(0, 5)
                  .map((kpi) => ({ name: kpi.name, impact: kpi.impact ?? 0 }))}
              />
            </Panel>
          </div>
        </>
      ) : null}
    </>
  );
}
