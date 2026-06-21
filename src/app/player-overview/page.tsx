import { DemoBanner } from "@/components/ui/demo-banner";
import { PageHero } from "@/components/ui/page-hero";
import { Panel } from "@/components/ui/panel";
import {
  SquadOverviewDashboard,
  type GoalieSeasonSummary,
  type SquadOverviewRow,
} from "@/components/player/squad-overview-dashboard";
import { buildPlayerArchetypeProfile } from "@/lib/player-archetypes";
import { getPlayerGoalieData } from "@/lib/player-goalie-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function buildDashboardRows(
  source: Awaited<ReturnType<typeof getPlayerGoalieData>>,
): SquadOverviewRow[] {
  return source.playerBreakdowns.map((row) => {
    const peerGroup = source.playerBreakdowns.filter(
      (peer) => peer.season === row.season && peer.modelType === row.modelType,
    );
    const profile = buildPlayerArchetypeProfile(row, peerGroup);
    const primaryScore =
      profile.scores.find((score) => score.name === profile.primaryArchetype) ?? null;
    const position =
      row.position === "F" || row.position === "D" ? row.position : "Unknown";

    return {
      id: row.id,
      name: row.name,
      season: row.season,
      modelType: row.modelType,
      position,
      gamesPlayed: row.gamesPlayed,
      toiMinutes: row.toiMinutes,
      overallScore: row.overallScore,
      reliabilityScore: row.reliabilityScore,
      reliabilityFlag: row.reliabilityFlag,
      topCategory:
        row.categoryScores
          .filter((category) => category.score !== null)
          .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))[0]?.category ?? null,
      developmentCategory:
        row.categoryScores
          .filter((category) => category.score !== null)
          .sort((left, right) => (left.score ?? 0) - (right.score ?? 0))[0]?.category ?? null,
      archetype: profile.primaryArchetype,
      archetypeColor: primaryScore?.color ?? "#94A3B8",
      secondaryArchetype: profile.secondaryArchetype,
      archetypeConfidence: profile.confidenceLabel,
      styleTags: profile.styleTags,
      latestTrendLabel: row.latestInterval?.trendLabel ?? null,
      latestOverallChange: row.latestInterval?.overallScoreChange ?? null,
      categoryScores: row.categoryScores.map((category) => ({
        category: category.category,
        score: category.score,
      })),
      diagnostics: {
        adjustedByContradiction: profile.adjustedByContradiction,
        scoreGap: profile.scoreGap,
        topSignals: profile.topSignals.map((signal) => signal.label),
        cautionSignals: profile.cautionSignals.map((signal) => signal.label),
        scoreSummary: profile.scores
          .map((score) =>
            score.score === null ? null : `${score.name}: ${score.score.toFixed(1)}`,
          )
          .filter((score): score is string => Boolean(score)),
      },
      rawStats: row.rawStats,
    };
  });
}

export default async function PlayerOverviewPage({
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
  const dashboardRows = buildDashboardRows(source);
  const goalieRows: GoalieSeasonSummary[] = source.goalieOverview.map((row) => ({
    id: row.id,
    season: row.season,
  }));

  return (
    <>
      <PageHero
        eyebrow="Player Analytics"
        title="Squad Overview"
        description="A coach-facing read on player impact, roster construction, and the development needs shaping the group."
        chips={
          <>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
              Skaters: {source.playerOverview.length}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
              Goalies: {source.goalieOverview.length}
            </span>
            <span className="rounded-full border border-gold-300/25 bg-gold-300/10 px-4 py-2 text-sm text-gold-100">
              Relative impact model
            </span>
          </>
        }
      />
      <DemoBanner isDemoMode={!source.available} />

      {!source.available ? (
        <Panel
          eyebrow="Unavailable"
          title="Player-goalie analytics are not ready yet."
          description={
            source.reason ??
            "Run the player-goalie schema and import a metric workbook first."
          }
        />
      ) : (
        <SquadOverviewDashboard
          seasons={source.seasons}
          initialSeason={selectedSeason}
          rows={dashboardRows}
          goalieRows={goalieRows}
        />
      )}
    </>
  );
}
