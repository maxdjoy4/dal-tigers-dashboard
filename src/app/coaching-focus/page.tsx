import { CoachingFocusDashboard } from "@/components/coaching/coaching-focus-dashboard";
import { buildCoachingFocusPageModel } from "@/lib/coaching-focus";
import { resolveCoachingFocusBrief } from "@/lib/coaching-focus-ai";
import { getDashboardData } from "@/lib/data";
import { getPlayerGoalieData } from "@/lib/player-goalie-data";
import { buildAnalyticsBundle } from "@/lib/scoring";
import type { DashboardFilters } from "@/lib/types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type SnapshotView = "latest" | "compare";

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

export default async function CoachingFocusPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const params = (await searchParams) ?? {};
  const [teamData, playerGoalieData] = await Promise.all([
    getDashboardData(),
    getPlayerGoalieData(),
  ]);

  const teamSeasons = uniqueSorted(teamData.games.map((game) => game.season));
  const playerSeasons = uniqueSorted(playerGoalieData.seasons);
  const sharedSeasons = teamSeasons.filter((season) => playerSeasons.includes(season));
  const seasons =
    sharedSeasons.length > 0
      ? sharedSeasons
      : uniqueSorted([...teamSeasons, ...playerSeasons]);

  const requestedSeason = first(params.season);
  const selectedSeason =
    requestedSeason && seasons.includes(requestedSeason)
      ? requestedSeason
      : seasons.at(-1) ?? "all";

  const snapshotView: SnapshotView =
    first(params.snapshot) === "compare" ? "compare" : "latest";
  const includeSpecialTeams = first(params.specialTeams) !== "exclude";
  const forceRegenerate = first(params.regenerate) === "1";

  if (!playerGoalieData.available) {
    return (
      <div className="space-y-6">
        <header className="glass-panel gold-ring rounded-4xl px-6 py-7">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold-100">
            Coaching Focus
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
            This week&apos;s staff brief
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-300">
            Turn team and player analytics into this week&apos;s practice and video plan.
          </p>
        </header>

        <div className="glass-panel gold-ring rounded-4xl p-6 text-sm leading-7 text-slate-300">
          {playerGoalieData.reason ??
            "Run the player-goalie schema and upload skater and goalie data before using this page."}
        </div>
      </div>
    );
  }

  const filters: DashboardFilters = {
    season: selectedSeason,
    range: "all",
    opponent: "all",
    homeAway: "all",
    result: "all",
  };

  const analytics = buildAnalyticsBundle(
    teamData.games,
    teamData.weights,
    filters,
    teamData.demoMode,
  );

  const seasonPlayers = playerGoalieData.playerBreakdowns.filter(
    (row) => row.season === selectedSeason,
  );
  const seasonGoalies = playerGoalieData.goalieBreakdowns.filter(
    (row) => row.season === selectedSeason,
  );

  const model = buildCoachingFocusPageModel({
    analytics,
    playerBreakdowns: seasonPlayers,
    goalieBreakdowns: seasonGoalies,
    includeSpecialTeams,
  });

  const latestPlayerSnapshot = seasonPlayers
    .flatMap((row) => row.snapshots)
    .sort((left, right) => new Date(right.snapshotDate).getTime() - new Date(left.snapshotDate).getTime())[0] ?? null;
  const latestGoalieSnapshot = seasonGoalies
    .flatMap((row) => row.snapshots)
    .sort((left, right) => new Date(right.snapshotDate).getTime() - new Date(left.snapshotDate).getTime())[0] ?? null;
  const snapshotId =
    latestPlayerSnapshot?.id ?? latestGoalieSnapshot?.id ?? null;
  const uploadId =
    latestPlayerSnapshot?.uploadId ?? latestGoalieSnapshot?.uploadId ?? null;

  const brief = await resolveCoachingFocusBrief({
    season: selectedSeason,
    snapshotId,
    uploadId,
    model,
    forceRegenerate,
  });

  const hydratedModel = {
    ...model,
    renderedTeamPriorities: brief.teamPriorities,
    renderedMicroPriorities: brief.microPriorities,
    renderedStaffNote: brief.staffNote,
    aiGenerated: !brief.fallbackUsed,
    aiDiagnostics: {
      evidenceHash: brief.evidenceHash,
      generatedAt: brief.generatedAt,
      modelUsed: brief.modelUsed,
      fallbackUsed: brief.fallbackUsed,
      note: brief.fallbackUsed
        ? "AI summary unavailable; showing calculation-based fallback."
        : null,
      evidenceBundle: brief.evidenceBundle,
      aiOutput: brief.aiOutput,
    },
  };

  return (
    <CoachingFocusDashboard
      seasons={seasons}
      selectedSeason={selectedSeason}
      snapshotView={snapshotView}
      includeSpecialTeams={includeSpecialTeams}
      model={hydratedModel}
    />
  );
}
