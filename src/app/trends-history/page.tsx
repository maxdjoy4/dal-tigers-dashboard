import { CategoryTrendChart } from "@/components/charts/category-trend-chart";
import { LineTrendChart } from "@/components/charts/line-trend-chart";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { KpiTrendExplorer } from "@/components/trends/kpi-trend-explorer";
import { DemoBanner } from "@/components/ui/demo-banner";
import { PageHero } from "@/components/ui/page-hero";
import { Panel } from "@/components/ui/panel";
import { StatCard } from "@/components/ui/stat-card";
import { CATEGORY_METADATA, TACTICAL_GROUP_METADATA } from "@/lib/category-metadata";
import { getDashboardData } from "@/lib/data";
import { formatKpiDisplayValue, isPercentLikeKpi } from "@/lib/kpi-trends";
import {
  getOpponentDisplayName,
  getOpponentFullName,
} from "@/lib/opponents";
import {
  buildCategoryMomentumRows,
  buildCategoryTrendSeries,
  buildHotColdStretches,
  buildKpiMomentumMovers,
  buildMomentumGameRows,
  buildMomentumSummary,
  buildRecentChangeSummary,
  buildTacticalMomentumRows,
  type MomentumTrendLabel,
} from "@/lib/momentum";
import { buildAnalyticsBundle, parseFilters } from "@/lib/scoring";
import { TREND_WINDOW_GAMES } from "@/lib/trend-window";
import { cn } from "@/lib/utils";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function formatNullable(value: number | null, digits = 1) {
  return value === null ? "n/a" : value.toFixed(digits);
}

function formatScore(value: number | null) {
  return value === null ? "Limited data" : `${value.toFixed(1)}/100`;
}

function formatSigned(value: number | null, digits = 1) {
  return value === null ? "n/a" : `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function trendTone(trend: MomentumTrendLabel) {
  if (trend === "Improving") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }

  if (trend === "Declining") {
    return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  }

  if (trend === "Limited data") {
    return "border-gold-300/30 bg-gold-300/10 text-gold-50";
  }

  return "border-white/10 bg-white/5 text-slate-200";
}

function heatmapTone(change: number | null) {
  if (change === null) {
    return "bg-white/[0.03] text-slate-300";
  }

  if (change >= 3) {
    return "bg-emerald-400/15 text-emerald-100";
  }

  if (change <= -3) {
    return "bg-rose-400/15 text-rose-100";
  }

  return "bg-gold-300/10 text-gold-50";
}

export default async function TrendsHistoryPage({
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
  const momentumSummary = buildMomentumSummary(analytics.scoredGames);
  const recentChange = buildRecentChangeSummary(
    analytics.scoredGames,
    analytics.filteredContextGames,
    analytics.weights,
  );
  const categoryRows = buildCategoryMomentumRows(analytics.filteredContextGames);
  const categoryTrendSeries = buildCategoryTrendSeries(analytics.filteredContextGames);
  const tacticalRows = buildTacticalMomentumRows(
    analytics.filteredContextGames,
    analytics.weights,
  );
  const kpiMovers = buildKpiMomentumMovers(
    analytics.filteredContextGames,
    analytics.weights,
  );
  const stretches = buildHotColdStretches(analytics.scoredGames);
  const gameRows = buildMomentumGameRows(analytics.scoredGames);
  const weightByKey = new Map(analytics.weights.map((weight) => [weight.key, weight] as const));

  return (
    <>
      <PageHero
        eyebrow="Momentum & Form"
        title="Momentum & Form"
        description="Track how team performance is changing over time, what is improving, and what needs attention next."
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
      <Panel
        title="Filters"
        description="Refine the historical lens before reviewing momentum, form, and what has changed recently."
      >
        <FilterBar filters={analytics.filters} options={analytics.filterOptions} />
      </Panel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Current Form"
          value={formatScore(momentumSummary.currentForm)}
          note={`${momentumSummary.trend}${momentumSummary.windowSize ? ` over the last ${momentumSummary.windowSize} games` : ""}`}
          tone="slate"
        />
        <StatCard
          label="Season Average"
          value={formatScore(momentumSummary.seasonAverage)}
          note="Average team score in the current filtered view"
        />
        <StatCard
          label={`Change vs Previous ${momentumSummary.windowSize || 0}`}
          value={formatSigned(momentumSummary.changeVsPrevious)}
          note={
            momentumSummary.windowSize
              ? `Last ${momentumSummary.windowSize} minus previous ${momentumSummary.windowSize}`
              : "Limited comparison data"
          }
          tone="slate"
        />
        <StatCard
          label="Best Stretch"
          value={formatScore(momentumSummary.bestStretch?.average ?? null)}
          note={momentumSummary.bestStretch?.label ?? "Limited data"}
          tone="slate"
        />
        <StatCard
          label="Worst Stretch"
          value={formatScore(momentumSummary.worstStretch?.average ?? null)}
          note={momentumSummary.worstStretch?.label ?? "Limited data"}
          tone="slate"
        />
        <StatCard
          label="Games In View"
          value={String(analytics.filteredContextGames.length)}
          note="Filtered game sample"
          tone="slate"
        />
      </div>

      <Panel
        eyebrow="Score History"
        title="Performance score and rolling form"
        description="The main momentum view. Hover to inspect score, rolling form, and the category balance in each game."
      >
        <LineTrendChart data={analytics.trendSeries} />
      </Panel>

      <Panel
        eyebrow="What Changed Recently?"
        title="Last block vs previous block"
        description={
          recentChange.windowSize
            ? `Comparing the last ${recentChange.windowSize} games with the previous ${recentChange.windowSize}.`
            : "Not enough games in this filter to compare recent and prior blocks yet."
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="section-title">Team Score Change</p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {formatSigned(recentChange.teamScoreChange)}
            </p>
          </div>
          {recentChange.categoryRows.map((row) => (
            <div
              key={row.category}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
            >
              <p className="section-title">{row.label}</p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {formatSigned(row.change)}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                {formatNullable(row.previousAverage)} to {formatNullable(row.recentAverage)}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="section-title">Tactical Shift</p>
            <div className="mt-4 space-y-3 text-sm">
              <p className="text-emerald-100">
                Improving: {recentChange.topImprovingTactical?.label ?? "n/a"}{" "}
                {recentChange.topImprovingTactical?.change !== null
                  ? `(${formatSigned(recentChange.topImprovingTactical.change)})`
                  : ""}
              </p>
              <p className="text-rose-100">
                Declining: {recentChange.topDecliningTactical?.label ?? "n/a"}{" "}
                {recentChange.topDecliningTactical?.change !== null
                  ? `(${formatSigned(recentChange.topDecliningTactical.change)})`
                  : ""}
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="section-title">KPI Shift</p>
            <div className="mt-4 space-y-3 text-sm">
              <p className="text-emerald-100">
                Improving: {recentChange.topImprovingKpi?.name ?? "n/a"}{" "}
                {recentChange.topImprovingKpi?.weightedDelta !== null
                  ? `(${formatSigned(recentChange.topImprovingKpi.weightedDelta, 2)})`
                  : ""}
              </p>
              <p className="text-rose-100">
                Declining: {recentChange.topDecliningKpi?.name ?? "n/a"}{" "}
                {recentChange.topDecliningKpi?.weightedDelta !== null
                  ? `(${formatSigned(recentChange.topDecliningKpi.weightedDelta, 2)})`
                  : ""}
              </p>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <Panel
          eyebrow="Category Trends"
          title="How the main categories are moving"
          description="Use this view to see which big areas are gaining or losing momentum over time."
        >
          <CategoryTrendChart data={categoryTrendSeries} />
        </Panel>

        <Panel
          eyebrow="Category Momentum"
          title="Recent category direction"
          description="Recent block versus previous block for offense, defense, and special teams."
        >
          <div className="space-y-4">
            {categoryRows.map((row) => (
              <div
                key={row.category}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{row.label}</p>
                    <p className="mt-1 text-sm text-slate-400">{row.descriptor}</p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                      trendTone(row.trend),
                    )}
                  >
                    {row.trend}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm text-slate-200">
                  <div>
                    <p className="text-slate-400">Previous</p>
                    <p className="mt-1">{formatNullable(row.previousAverage)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Recent</p>
                    <p className="mt-1">{formatNullable(row.recentAverage)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Change</p>
                    <p className="mt-1">{formatSigned(row.change)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        eyebrow="Tactical Driver Trends"
        title="Which tactical areas are moving?"
        description="Time-based tactical comparison using recent block versus previous block, rather than static baseline duplication."
      >
        <div className="overflow-hidden rounded-3xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Tactical Driver</th>
                <th className="px-4 py-3">Previous</th>
                <th className="px-4 py-3">Recent</th>
                <th className="px-4 py-3">Change</th>
                <th className="px-4 py-3">Trend</th>
                <th className="px-4 py-3">Strongest KPI</th>
                <th className="px-4 py-3">Weakest KPI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tacticalRows.map((row) => (
                <tr key={row.group} className="bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium text-white">{row.label}</td>
                  <td className="px-4 py-3 text-slate-200">{formatNullable(row.previousAverage)}</td>
                  <td className="px-4 py-3 text-slate-200">{formatNullable(row.recentAverage)}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", heatmapTone(row.change))}>
                      {formatSigned(row.change)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                        trendTone(row.trend),
                      )}
                    >
                      {row.trend}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-200">{row.strongestKpi ?? "n/a"}</td>
                  <td className="px-4 py-3 text-slate-200">{row.weakestKpi ?? "n/a"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          eyebrow="KPI Momentum Movers"
          title="Biggest improvers"
          description="KPIs gaining momentum recently after direction and weighted impact are applied."
        >
          <div className="space-y-3">
            {kpiMovers.improvers.slice(0, 6).map((row) => {
              const weight = weightByKey.get(row.key);
              const isPercent = weight ? isPercentLikeKpi(weight) : false;
              return (
                <div
                  key={row.key}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{row.name}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {CATEGORY_METADATA[row.category].label} · {TACTICAL_GROUP_METADATA[row.tacticalGroup].label}
                      </p>
                    </div>
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
                      {formatSigned(row.weightedDelta, 2)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-200">
                    <p>Previous: {formatKpiDisplayValue(row.previousAverage, isPercent)}</p>
                    <p>Recent: {formatKpiDisplayValue(row.recentAverage, isPercent)}</p>
                    <p>Raw change: {formatKpiDisplayValue(row.change, isPercent)}</p>
                    <p>{row.direction === "higher_is_better" ? "Higher is better" : "Lower is better"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel
          eyebrow="KPI Momentum Movers"
          title="Biggest decliners"
          description="KPIs creating the sharpest recent drag after direction and weighted impact are applied."
        >
          <div className="space-y-3">
            {kpiMovers.decliners.slice(0, 6).map((row) => {
              const weight = weightByKey.get(row.key);
              const isPercent = weight ? isPercentLikeKpi(weight) : false;
              return (
                <div
                  key={row.key}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{row.name}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {CATEGORY_METADATA[row.category].label} · {TACTICAL_GROUP_METADATA[row.tacticalGroup].label}
                      </p>
                    </div>
                    <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-200">
                      {formatSigned(row.weightedDelta, 2)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-200">
                    <p>Previous: {formatKpiDisplayValue(row.previousAverage, isPercent)}</p>
                    <p>Recent: {formatKpiDisplayValue(row.recentAverage, isPercent)}</p>
                    <p>Raw change: {formatKpiDisplayValue(row.change, isPercent)}</p>
                    <p>{row.direction === "higher_is_better" ? "Higher is better" : "Lower is better"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel
        eyebrow="KPI Trend Explorer"
        title="Track one KPI over time"
        description="Select any KPI to see how it has changed across the filtered game history."
      >
        <KpiTrendExplorer
          games={analytics.filteredContextGames}
          weights={analytics.weights}
        />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          eyebrow="Best Stretch"
          title="Hot stretch"
          description={
            stretches.windowSize
              ? `Best rolling ${stretches.windowSize}-game run in the current filter.`
              : "Not enough games to evaluate stretches yet."
          }
        >
          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5">
            <p className="text-3xl font-semibold text-white">
              {formatScore(stretches.best?.averageScore ?? null)}
            </p>
            <p className="mt-2 text-sm text-slate-100">{stretches.best?.label ?? "Limited data"}</p>
            <p className="mt-3 text-sm text-slate-200">
              Opponents: {stretches.best?.opponents.map(getOpponentDisplayName).join(", ") ?? "n/a"}
            </p>
            <p className="mt-2 text-sm text-slate-200">
              Strongest category: {stretches.best?.strongestCategory ?? "n/a"}
            </p>
          </div>
        </Panel>

        <Panel
          eyebrow="Worst Stretch"
          title="Cold stretch"
          description={
            stretches.windowSize
              ? `Lowest rolling ${stretches.windowSize}-game run in the current filter.`
              : "Not enough games to evaluate stretches yet."
          }
        >
          <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 p-5">
            <p className="text-3xl font-semibold text-white">
              {formatScore(stretches.worst?.averageScore ?? null)}
            </p>
            <p className="mt-2 text-sm text-slate-100">{stretches.worst?.label ?? "Limited data"}</p>
            <p className="mt-3 text-sm text-slate-200">
              Opponents: {stretches.worst?.opponents.map(getOpponentDisplayName).join(", ") ?? "n/a"}
            </p>
            <p className="mt-2 text-sm text-slate-200">
              Weakest category: {stretches.worst?.weakestCategory ?? "n/a"}
            </p>
          </div>
        </Panel>
      </div>

      <Panel
        eyebrow="Game-by-Game History"
        title="Full momentum table"
        description="Chronological game log with score, category context, tactical read, and trend versus the previous game."
      >
        <div className="overflow-hidden rounded-3xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Opponent</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">{`Rolling ${TREND_WINDOW_GAMES} Avg`}</th>
                <th className="px-4 py-3">Offense</th>
                <th className="px-4 py-3">Defense</th>
                <th className="px-4 py-3">Special Teams</th>
                <th className="px-4 py-3">Strongest Driver</th>
                <th className="px-4 py-3">Biggest Concern</th>
                <th className="px-4 py-3">Trend vs Prev</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {gameRows.map((row) => (
                <tr key={row.id} className="bg-white/[0.02]">
                  <td className="px-4 py-3 text-slate-200">
                    {new Date(row.date).toLocaleDateString()}
                  </td>
                  <td
                    className="px-4 py-3 font-medium text-white"
                    title={getOpponentFullName(row.opponent)}
                  >
                    {getOpponentDisplayName(row.opponent)}
                  </td>
                  <td className="px-4 py-3 text-slate-200">{row.result}</td>
                  <td className="px-4 py-3 text-slate-200">{formatNullable(row.score)}</td>
                  <td className="px-4 py-3 text-slate-200">{formatNullable(row.rollingAverage)}</td>
                  <td className="px-4 py-3 text-slate-200">{formatNullable(row.offenseScore)}</td>
                  <td className="px-4 py-3 text-slate-200">{formatNullable(row.defenseScore)}</td>
                  <td className="px-4 py-3 text-slate-200">{formatNullable(row.specialTeamsScore)}</td>
                  <td className="px-4 py-3 text-slate-200">{row.strongestTacticalDriver ?? "n/a"}</td>
                  <td className="px-4 py-3 text-slate-200">{row.biggestConcern ?? "n/a"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                        trendTone(row.trendVsPrevious),
                      )}
                    >
                      {row.trendVsPrevious}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
