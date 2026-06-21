import { FilterBar } from "@/components/dashboard/filter-bar";
import { DemoBanner } from "@/components/ui/demo-banner";
import { PageHero } from "@/components/ui/page-hero";
import { Panel } from "@/components/ui/panel";
import { getDashboardData } from "@/lib/data";
import { buildAnalyticsBundle, parseFilters } from "@/lib/scoring";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function formatValue(value: number | null, digits = 1) {
  return value === null ? "n/a" : value.toFixed(digits);
}

export default async function CalculationAuditPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (process.env.NODE_ENV === "production") {
    return (
      <Panel
        eyebrow="Calculation Audit"
        title="Development-only page"
        description="The calculation audit view is only available in development mode."
      />
    );
  }

  const params = await searchParams;
  const filters = parseFilters(params);
  const source = await getDashboardData();
  const analytics = buildAnalyticsBundle(
    source.games,
    source.weights,
    filters,
    source.demoMode,
  );

  return (
    <>
      <PageHero
        eyebrow="Calculation Audit"
        title="Inspect score coverage and warnings game by game."
        description="Use this audit view to verify KPI coverage, excluded stats, top impacts, and whether each score is based on enough real data to trust."
      />

      <DemoBanner isDemoMode={analytics.isDemoMode} />

      <Panel
        title="Filters"
        description="Use the same filters as the main dashboard while auditing calculation coverage."
      >
        <FilterBar filters={analytics.filters} options={analytics.filterOptions} />
      </Panel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="section-title">Games Loaded</p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {analytics.calculationAudit.gamesLoaded}
          </p>
          <p className="mt-2 text-sm text-slate-300">Saved games available to the app.</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="section-title">Stats Loaded</p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {analytics.calculationAudit.statsLoaded}
          </p>
          <p className="mt-2 text-sm text-slate-300">Raw KPI stat rows matched into game objects.</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="section-title">Matched Weights</p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {analytics.calculationAudit.matchedWeights}
          </p>
          <p className="mt-2 text-sm text-slate-300">Weighted KPIs with at least one valid saved value.</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="section-title">Excluded KPIs</p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {analytics.calculationAudit.excludedKpis.length}
          </p>
          <p className="mt-2 text-sm text-slate-300">KPIs excluded because reference scoring data was unavailable.</p>
        </div>
      </div>

      {analytics.calculationWarnings.length > 0 ? (
        <Panel
          eyebrow="Warnings"
          title="Calculation warnings"
          description="These warnings are generated from the live scoring model."
        >
          <div className="space-y-3">
            {analytics.calculationWarnings.map((warning) => (
              <div
                key={warning}
                className="rounded-3xl border border-gold-300/20 bg-gold-300/10 px-4 py-3 text-sm text-gold-50"
              >
                {warning}
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel
        eyebrow="Per-Game Audit"
        title="Game scoring coverage"
        description="Check whether each game has enough valid KPI coverage to support the published team and category scores."
      >
        <div className="overflow-hidden rounded-3xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Opponent</th>
                <th className="px-4 py-3">Valid KPIs</th>
                <th className="px-4 py-3">Missing KPIs</th>
                <th className="px-4 py-3">Weight Coverage</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Offense</th>
                <th className="px-4 py-3">Defense</th>
                <th className="px-4 py-3">Special Teams</th>
                <th className="px-4 py-3">Top Positive</th>
                <th className="px-4 py-3">Top Negative</th>
                <th className="px-4 py-3">Warnings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {analytics.scoredGames.map((game) => {
                const positives = [...game.kpis]
                  .filter((kpi) => kpi.available && kpi.impact !== null)
                  .sort((left, right) => (right.impact ?? 0) - (left.impact ?? 0))[0];
                const negatives = [...game.kpis]
                  .filter((kpi) => kpi.available && kpi.impact !== null)
                  .sort((left, right) => (left.impact ?? 0) - (right.impact ?? 0))[0];

                return (
                  <tr key={game.game.id} className="bg-white/[0.02] align-top">
                    <td className="px-4 py-3 text-slate-200">
                      {new Date(game.game.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-white">
                      {game.game.opponent}
                    </td>
                    <td className="px-4 py-3 text-slate-200">{game.validKpiCount}</td>
                    <td className="px-4 py-3 text-slate-200">{game.missingKpiCount}</td>
                    <td className="px-4 py-3 text-slate-200">
                      {game.coverage === null ? "n/a" : `${Math.round(game.coverage * 100)}%`}
                    </td>
                    <td className="px-4 py-3 text-slate-200">{formatValue(game.overallScore)}</td>
                    <td className="px-4 py-3 text-slate-200">
                      {formatValue(game.categoryScores.offense.score)}
                    </td>
                    <td className="px-4 py-3 text-slate-200">
                      {formatValue(game.categoryScores.defense.score)}
                    </td>
                    <td className="px-4 py-3 text-slate-200">
                      {formatValue(game.categoryScores.special_teams.score)}
                    </td>
                    <td className="px-4 py-3 text-slate-200">{positives?.name ?? "n/a"}</td>
                    <td className="px-4 py-3 text-slate-200">{negatives?.name ?? "n/a"}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {game.warnings.length
                        ? game.warnings.map((warning) => warning.message).join(" ")
                        : "None"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
