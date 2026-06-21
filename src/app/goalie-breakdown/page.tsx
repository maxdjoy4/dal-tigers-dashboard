import Link from "next/link";

import { DemoBanner } from "@/components/ui/demo-banner";
import { PageHero } from "@/components/ui/page-hero";
import { Panel } from "@/components/ui/panel";
import { StatCard } from "@/components/ui/stat-card";
import { getPlayerGoalieData } from "@/lib/player-goalie-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function formatScore(value: number | null) {
  return value === null ? "Insufficient data" : `${value.toFixed(1)}/100`;
}

function formatMetricValue(value: number | null) {
  return value === null ? "n/a" : value.toFixed(2);
}

export default async function GoalieBreakdownPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const params = (await searchParams) ?? {};
  const source = await getPlayerGoalieData();

  const selectedSeason =
    typeof params.season === "string"
      ? params.season
      : source.seasons.at(-1) ?? "all";
  const seasonRows = source.goalieBreakdowns.filter((row) =>
    selectedSeason === "all" ? true : row.season === selectedSeason,
  );
  const availableGoalies = [...seasonRows].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const selectedGoalieId =
    typeof params.goalie === "string" ? params.goalie : availableGoalies[0]?.id;
  const breakdown =
    availableGoalies.find((row) => row.id === selectedGoalieId) ??
    availableGoalies[0] ??
    null;
  const firstGoalieIdBySeason = source.goalieBreakdowns
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name))
    .reduce((map, row) => {
      if (!map.has(row.season)) {
        map.set(row.season, row.id);
      }
      return map;
    }, new Map<string, string>());

  return (
    <>
      <PageHero
        eyebrow="Goalie Analytics"
        title="Goalie Breakdown"
        description="Review the goalie model one netminder at a time, with shot-stopping, xG-adjusted, high-danger, and workload categories calculated from the stored goalie KPI table."
      />
      <DemoBanner isDemoMode={!source.available} />

      {!source.available ? (
        <Panel
          eyebrow="Unavailable"
          title="Player-goalie analytics are not ready yet."
          description={source.reason ?? "Run the player-goalie schema and import a metric workbook first."}
        />
      ) : (
        <>
          <Panel
            eyebrow="Goalie Selector"
            title="Switch the goalie in view"
            description="Keep the season fixed, then swap between saved goalie snapshot scorecards."
          >
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {source.seasons.map((season) => (
                  <Link
                    key={season}
                    href={`/goalie-breakdown?season=${encodeURIComponent(season)}&goalie=${encodeURIComponent(firstGoalieIdBySeason.get(season) ?? breakdown?.id ?? "")}`}
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

              <form action="/goalie-breakdown" method="get" className="flex flex-col gap-3 md:flex-row">
                <input type="hidden" name="season" value={selectedSeason} />
                <label className="sr-only" htmlFor="goalie">
                  Goalie
                </label>
                <select
                  id="goalie"
                  name="goalie"
                  defaultValue={breakdown?.id ?? ""}
                  className="h-14 flex-1 rounded-3xl border border-white/10 bg-white/5 px-4 text-base text-white outline-none transition focus:border-gold-300/35"
                >
                  {availableGoalies.map((row) => (
                    <option key={`${row.id}-${row.season}`} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="h-14 rounded-3xl border border-gold-300/30 bg-gold-300/15 px-5 text-sm font-semibold text-gold-100 transition hover:bg-gold-300/20"
                >
                  View goalie
                </button>
              </form>
            </div>
          </Panel>

          {breakdown ? (
            <>
              <div className="grid gap-4 xl:grid-cols-4">
                <StatCard
                  label="Overall Score"
                  value={formatScore(breakdown.overallScore)}
                  note="Goalie model"
                />
                <StatCard
                  label="Games Played"
                  value={String(breakdown.gamesPlayed ?? "n/a")}
                  note={breakdown.season}
                />
                <StatCard
                  label="TOI"
                  value={
                    breakdown.toiMinutes === null
                      ? "n/a"
                      : `${Math.round(breakdown.toiMinutes)} min`
                  }
                  note="Season aggregate time on ice"
                />
                <StatCard
                  label="Reliability"
                  value={breakdown.reliabilityFlag ?? "n/a"}
                  note={
                    breakdown.reliabilityScore === null
                      ? "Usage sample unavailable"
                      : `${breakdown.reliabilityScore.toFixed(1)}/100`
                  }
                />
              </div>

              <Panel
                eyebrow="Category Scores"
                title={`${breakdown.name} goalie profile`}
                description="These category scores come directly from the stored goalie weight model and are recalculated whenever the season aggregate upload changes."
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {breakdown.categoryScores.map((category) => (
                    <div
                      key={category.category}
                      className="rounded-3xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <p className="section-title">{category.category}</p>
                      <p className="mt-3 text-3xl font-semibold text-white">
                        {formatScore(category.score)}
                      </p>
                      <p className="mt-2 text-sm text-slate-300">
                        {category.availableMetricCount}/{category.totalMetricCount} metrics active
                      </p>
                    </div>
                  ))}
                </div>
              </Panel>

              <div className="grid gap-6 xl:grid-cols-2">
                <Panel
                  eyebrow="Strongest KPIs"
                  title="What is holding up best?"
                  description="The top goalie KPI signals in the current season aggregate."
                >
                  <div className="space-y-3">
                    {breakdown.strongestKpis.map((metric) => (
                      <div
                        key={`${metric.metricKey}-${metric.category}-strong`}
                        className="rounded-3xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <p className="font-semibold text-white">{metric.displayName}</p>
                        <p className="mt-1 text-sm text-slate-300">{metric.category}</p>
                        <p className="mt-3 text-sm text-slate-200">
                          Calculated value: {formatMetricValue(metric.calculatedValue)} · Score:{" "}
                          {formatMetricValue(metric.score0100)}
                        </p>
                      </div>
                    ))}
                  </div>
                </Panel>
                <Panel
                  eyebrow="Development KPIs"
                  title="What needs the most attention?"
                  description="The weakest weighted goalie KPI signals in the current season aggregate."
                >
                  <div className="space-y-3">
                    {breakdown.developmentKpis.map((metric) => (
                      <div
                        key={`${metric.metricKey}-${metric.category}-dev`}
                        className="rounded-3xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <p className="font-semibold text-white">{metric.displayName}</p>
                        <p className="mt-1 text-sm text-slate-300">{metric.category}</p>
                        <p className="mt-3 text-sm text-slate-200">
                          Calculated value: {formatMetricValue(metric.calculatedValue)} · Score:{" "}
                          {formatMetricValue(metric.score0100)}
                        </p>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>

              <Panel
                eyebrow="Metric Evidence"
                title="Stored goalie KPI evidence"
                description="This table shows the calculated goalie metrics and their stored 0-100 scores from the weighted goalie model."
              >
                <div className="overflow-hidden rounded-3xl border border-white/10">
                  <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                    <thead className="bg-white/5">
                      <tr>
                        {["Metric", "Category", "Raw", "Calculated", "Score", "Reliability"].map(
                          (header) => (
                            <th
                              key={header}
                              className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-slate-400"
                            >
                              {header}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {breakdown.metrics.map((metric) => (
                        <tr
                          key={`${metric.metricKey}-${metric.category}`}
                          className="bg-white/[0.02]"
                        >
                          <td className="px-4 py-3 text-white">{metric.displayName}</td>
                          <td className="px-4 py-3 text-slate-200">{metric.category}</td>
                          <td className="px-4 py-3 text-slate-200">{formatMetricValue(metric.rawValue)}</td>
                          <td className="px-4 py-3 text-slate-200">{formatMetricValue(metric.calculatedValue)}</td>
                          <td className="px-4 py-3 text-slate-100">{formatMetricValue(metric.score0100)}</td>
                          <td className="px-4 py-3 text-slate-200">{metric.reliabilityFlag ?? "n/a"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </>
          ) : (
            <Panel
              eyebrow="No Data"
              title="No goalie scorecards are available yet."
              description="Import the metric workbook, then upload a goalie aggregate file from Admin Upload to populate this page."
            />
          )}
        </>
      )}
    </>
  );
}
