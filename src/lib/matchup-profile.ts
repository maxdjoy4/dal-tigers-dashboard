import {
  averageNullable,
  buildScoringContext,
  calculateDirectionalDelta,
  formatWarnings,
  hasValue,
  logCalculationDebug,
  scoreGamesWithContext,
} from "@/lib/calculations";
import { buildTacticalDriverRows } from "@/lib/tactical-analysis";
import { CATEGORY_METADATA } from "@/lib/category-metadata";
import {
  buildCoachingRecommendations,
  type CoachingRecommendation,
  type MatchupStrengthSignal,
} from "@/lib/coaching-recommendations";
import { getUnassignedTacticalKpis } from "@/lib/tactical-groups";
import {
  RECENT_RANGE_FILTER_VALUE,
  TREND_WINDOW_GAMES,
} from "@/lib/trend-window";
import type {
  DashboardFilters,
  FilterOptions,
  GameRecord,
  KpiDirection,
  KpiWeight,
  ResultBucket,
  ScoredGame,
  ScoreCategory,
  TacticalDriverRow,
} from "@/lib/types";
import { round } from "@/lib/utils";

export type MatchupStatus = "strength" | "neutral" | "concern";

export interface MatchupCategoryRow {
  category: ScoreCategory;
  label: string;
  focusedScore: number | null;
  baselineScore: number | null;
  delta: number | null;
  status: MatchupStatus;
  note: string;
}

export interface MatchupKpiRow {
  key: string;
  name: string;
  category: ScoreCategory;
  direction: KpiDirection;
  weight: number;
  coachingAdjustment: number | null;
  notes: string | null;
  focusedRawAverage: number | null;
  baselineRawAverage: number | null;
  baselineExcludingOpponentRawAverage: number | null;
  rawDelta: number | null;
  focusedNormalizedAverage: number | null;
  baselineNormalizedAverage: number | null;
  normalizedDelta: number | null;
  directionalDelta: number | null;
  weightedImpact: number | null;
  status: MatchupStatus;
  focusedCoverage: number;
  baselineCoverage: number;
}

export interface MatchupGameRow {
  id: string;
  date: string;
  opponent: string;
  result: string;
  teamScore: number | null;
  offenseScore: number | null;
  defenseScore: number | null;
  specialTeamsScore: number | null;
  topPositiveKpi: string | null;
  topNegativeKpi: string | null;
  warnings: string[];
}

export interface MatchupSummary {
  headline: string;
  narrative: string;
  matchupScore: number | null;
  seasonBaselineScore: number | null;
  baselineExcludingOpponentScore: number | null;
  differenceVsBaseline: number | null;
  gamesInFocus: number;
  opponentGames: number;
  baselineGames: number;
  recordLabel: string;
  focusedRecordLabel: string;
  bestCategory: MatchupCategoryRow | null;
  biggestConcern: MatchupCategoryRow | null;
}

export interface MatchupTransparency {
  focusedDescription: string;
  baselineDescription: string;
  baselineExcludingOpponentDescription: string | null;
  directionDescription: string;
  weightedImpactDescription: string;
  teamScoreDescription: string;
  categoryScoreDescription: string;
}

export interface MatchupProfile {
  filters: DashboardFilters;
  filterOptions: FilterOptions;
  isDemoMode: boolean;
  selectedOpponent: string | null;
  focusedGames: ScoredGame[];
  opponentGames: ScoredGame[];
  baselineGames: ScoredGame[];
  baselineExcludingOpponentGames: ScoredGame[];
  summary: MatchupSummary;
  categoryRows: MatchupCategoryRow[];
  tacticalDrivers: TacticalDriverRow[];
  tacticalUnassignedKpis: string[];
  kpiRows: MatchupKpiRow[];
  strengths: MatchupKpiRow[];
  concerns: MatchupKpiRow[];
  neutralKpis: MatchupKpiRow[];
  takeaways: string[];
  workedSignals: MatchupStrengthSignal[];
  struggledSignals: MatchupStrengthSignal[];
  priorities: CoachingRecommendation[];
  gamePlanReminders: string[];
  recommendationNotes: string[];
  gameRows: MatchupGameRow[];
  warnings: string[];
  transparency: MatchupTransparency;
}

const CATEGORY_LABELS: Record<ScoreCategory, string> = {
  offense: CATEGORY_METADATA.offense.label,
  defense: CATEGORY_METADATA.defense.label,
  special_teams: CATEGORY_METADATA.special_teams.label,
};

const KPI_STATUS_THRESHOLD = 0.35;
const CATEGORY_STATUS_THRESHOLD = 2.5;
const SUMMARY_DELTA_THRESHOLD = 2;

function takeLast<T>(items: T[], count: number) {
  return items.slice(Math.max(0, items.length - count));
}

function buildFilterOptions(games: GameRecord[]): FilterOptions {
  return {
    seasons: [...new Set(games.map((game) => game.season))].sort().reverse(),
    opponents: [...new Set(games.map((game) => game.opponent))].sort(),
  };
}

function applyFocusedFilters(games: GameRecord[], filters: DashboardFilters) {
  return games.filter((game) => {
    if (filters.season !== "all" && game.season !== filters.season) {
      return false;
    }

    if (filters.opponent !== "all" && game.opponent !== filters.opponent) {
      return false;
    }

    if (filters.homeAway !== "all" && game.homeAway !== filters.homeAway) {
      return false;
    }

    if (filters.result !== "all" && game.resultBucket !== filters.result) {
      return false;
    }

    return true;
  });
}

function applyRangeFilter(games: GameRecord[], filters: DashboardFilters) {
  return filters.range === RECENT_RANGE_FILTER_VALUE
    ? takeLast(games, TREND_WINDOW_GAMES)
    : games;
}

function statusFromDelta(delta: number | null, threshold: number): MatchupStatus {
  if (!hasValue(delta)) {
    return "neutral";
  }

  if (delta >= threshold) {
    return "strength";
  }

  if (delta <= -threshold) {
    return "concern";
  }

  return "neutral";
}

function formatRecord(resultBuckets: ResultBucket[]) {
  const wins = resultBuckets.filter((bucket) => bucket === "win").length;
  const losses = resultBuckets.filter((bucket) => bucket === "loss").length;
  const ties = resultBuckets.filter((bucket) => bucket === "tie").length;

  return `${wins}-${losses}${ties > 0 ? `-${ties}` : ""}`;
}

function categoryNote(category: ScoreCategory, status: MatchupStatus, delta: number | null) {
  if (!hasValue(delta)) {
    return `${CATEGORY_LABELS[category]} is unavailable because the comparison slice does not have enough valid KPI coverage.`;
  }

  const deltaLabel = `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} vs baseline`;

  if (category === "offense") {
    if (status === "strength") {
      return `${deltaLabel} - strength in chance creation and attacking process.`;
    }

    if (status === "concern") {
      return `${deltaLabel} - concern in offensive creation and zone pressure.`;
    }

    return `${deltaLabel} - offense is tracking close to the season norm.`;
  }

  if (category === "defense") {
    if (status === "strength") {
      return `${deltaLabel} - strength in limiting opponent quality and defensive pressure.`;
    }

    if (status === "concern") {
      return `${deltaLabel} - concern in defensive control and concession management.`;
    }

    return `${deltaLabel} - defense is holding close to the season norm.`;
  }

  if (status === "strength") {
    return `${deltaLabel} - special teams are giving Dal an edge in this matchup.`;
  }

  if (status === "concern") {
    return `${deltaLabel} - special teams are costing ground in this matchup.`;
  }

  return `${deltaLabel} - special teams are relatively stable versus baseline.`;
}

function generateSummaryNarrative(
  opponent: string | null,
  matchupScore: number | null,
  baselineScore: number | null,
  bestCategory: MatchupCategoryRow | null,
  biggestConcern: MatchupCategoryRow | null,
) {
  if (!hasValue(matchupScore) || !hasValue(baselineScore)) {
    return "There is not enough valid KPI coverage in this slice to produce a trustworthy matchup summary yet.";
  }

  const delta = matchupScore - baselineScore;
  const tone =
    delta >= SUMMARY_DELTA_THRESHOLD
      ? "above"
      : delta <= -SUMMARY_DELTA_THRESHOLD
        ? "below"
        : "close to";
  const subject = opponent ? `Dalhousie vs ${opponent}` : "The current filter slice";
  const strengthLabel = bestCategory ? bestCategory.label.toLowerCase() : "overall balance";
  const concernLabel = biggestConcern
    ? biggestConcern.label.toLowerCase()
    : "no major category concern";

  return `${subject} is ${tone} the season baseline, with ${strengthLabel} standing out most while ${concernLabel} remains the main area to monitor.`;
}

function generateTakeaways(
  opponent: string | null,
  differenceVsBaseline: number | null,
  bestCategory: MatchupCategoryRow | null,
  biggestConcern: MatchupCategoryRow | null,
  strengths: MatchupKpiRow[],
  concerns: MatchupKpiRow[],
) {
  const takeaways: string[] = [];
  const subject = opponent ? `Against ${opponent}` : "In the current filter slice";

  if (!hasValue(differenceVsBaseline)) {
    takeaways.push(
      `${subject}, there is not enough valid KPI coverage to trust the overall matchup score yet.`,
    );
  } else if (differenceVsBaseline >= SUMMARY_DELTA_THRESHOLD) {
    takeaways.push(
      `${subject}, Dal is outperforming its season baseline overall, which suggests this matchup profile has been favorable.`,
    );
  } else if (differenceVsBaseline <= -SUMMARY_DELTA_THRESHOLD) {
    takeaways.push(
      `${subject}, Dal is trailing its season baseline overall, which points to a tougher matchup profile than the team norm.`,
    );
  } else {
    takeaways.push(
      `${subject}, overall performance is tracking close to the season baseline, so the details inside the category and KPI splits matter most.`,
    );
  }

  if (bestCategory && hasValue(bestCategory.delta)) {
    takeaways.push(
      `${CATEGORY_LABELS[bestCategory.category]} has been the main relative strength, running ${bestCategory.delta >= 0 ? "+" : ""}${bestCategory.delta.toFixed(1)} versus baseline.`,
    );
  }

  if (biggestConcern && hasValue(biggestConcern.delta)) {
    takeaways.push(
      `${CATEGORY_LABELS[biggestConcern.category]} is the main concern, sitting ${Math.abs(biggestConcern.delta).toFixed(1)} below the season baseline in this matchup context.`,
    );
  }

  if (strengths[0]) {
    takeaways.push(
      `${strengths[0].name} has been one of the clearest matchup advantages, helping tilt the profile in Dal's favor.`,
    );
  }

  if (concerns[0]) {
    takeaways.push(
      `${concerns[0].name} is the biggest KPI drag relative to baseline and should be a planning priority before the next meeting.`,
    );
  }

  return takeaways.slice(0, 5);
}

function averageKpiMetric(
  games: ScoredGame[],
  kpiName: string,
  selector: (kpi: ScoredGame["kpis"][number]) => number | null,
) {
  return averageNullable(
    games.map((game) => {
      const kpi = game.kpis.find((entry) => entry.name === kpiName);
      return kpi ? selector(kpi) : null;
    }),
  );
}

function coverageCount(games: ScoredGame[], kpiName: string) {
  return games.filter((game) => {
    const kpi = game.kpis.find((entry) => entry.name === kpiName);
    return Boolean(kpi && kpi.available);
  }).length;
}

function selectBestCategory(rows: MatchupCategoryRow[]) {
  const strengthRows = rows.filter((row) => row.status === "strength" && hasValue(row.delta));
  if (strengthRows.length) {
    return [...strengthRows].sort((left, right) => (right.delta ?? 0) - (left.delta ?? 0))[0] ?? null;
  }

  const rowsWithValues = rows.filter((row) => hasValue(row.delta));
  return [...rowsWithValues].sort((left, right) => (right.delta ?? 0) - (left.delta ?? 0))[0] ?? null;
}

function selectBiggestConcern(rows: MatchupCategoryRow[]) {
  const concernRows = rows.filter((row) => row.status === "concern" && hasValue(row.delta));
  if (concernRows.length) {
    return [...concernRows].sort((left, right) => (left.delta ?? 0) - (right.delta ?? 0))[0] ?? null;
  }

  return null;
}

function buildGameRows(games: ScoredGame[]): MatchupGameRow[] {
  return [...games]
    .sort((left, right) => new Date(right.game.date).getTime() - new Date(left.game.date).getTime())
    .map((game) => {
      const topPositiveKpi = [...game.kpis]
        .filter((kpi) => kpi.available && hasValue(kpi.impact))
        .sort((left, right) => (right.impact ?? 0) - (left.impact ?? 0))[0];
      const topNegativeKpi = [...game.kpis]
        .filter((kpi) => kpi.available && hasValue(kpi.impact))
        .sort((left, right) => (left.impact ?? 0) - (right.impact ?? 0))[0];

      return {
        id: game.game.id,
        date: game.game.date,
        opponent: game.game.opponent,
        result: game.game.result,
        teamScore: game.overallScore,
        offenseScore: game.categoryScores.offense.score,
        defenseScore: game.categoryScores.defense.score,
        specialTeamsScore: game.categoryScores.special_teams.score,
        topPositiveKpi: topPositiveKpi?.name ?? null,
        topNegativeKpi: topNegativeKpi?.name ?? null,
        warnings: game.warnings.map((warning) => warning.message),
      };
    });
}

export function buildMatchupProfile(
  games: GameRecord[],
  weights: KpiWeight[],
  filters: DashboardFilters,
  demoMode: boolean,
): MatchupProfile {
  const sortedGames = [...games].sort(
    (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime(),
  );
  const filterOptions = buildFilterOptions(sortedGames);
  const selectedOpponent = filters.opponent !== "all" ? filters.opponent : null;
  const seasonScopedGames =
    filters.season === "all"
      ? sortedGames
      : sortedGames.filter((game) => game.season === filters.season);

  const focusedBaseGames = applyFocusedFilters(sortedGames, filters);
  const focusedGames = applyRangeFilter(focusedBaseGames, filters);
  const opponentGamesRaw = selectedOpponent
    ? seasonScopedGames.filter((game) => game.opponent === selectedOpponent)
    : focusedGames;
  const baselineGamesRaw = seasonScopedGames;
  const baselineExcludingOpponentRaw = selectedOpponent
    ? seasonScopedGames.filter((game) => game.opponent !== selectedOpponent)
    : [];

  const referenceGames = baselineGamesRaw.length ? baselineGamesRaw : focusedGames;
  const context = buildScoringContext(referenceGames, weights);
  const focusedScoredGames = scoreGamesWithContext(focusedGames, context);
  const opponentScoredGames = scoreGamesWithContext(opponentGamesRaw, context);
  const baselineScoredGames = scoreGamesWithContext(baselineGamesRaw, context);
  const baselineExcludingOpponentGames = scoreGamesWithContext(
    baselineExcludingOpponentRaw,
    context,
  );

  const categoryRows: MatchupCategoryRow[] = ([
    "offense",
    "defense",
    "special_teams",
  ] as const).map((category) => {
    const focusedScore = averageNullable(
      focusedScoredGames.map((game) => game.categoryScores[category].score),
    );
    const baselineScore = averageNullable(
      baselineScoredGames.map((game) => game.categoryScores[category].score),
    );
    const delta =
      hasValue(focusedScore) && hasValue(baselineScore)
        ? round(focusedScore - baselineScore, 1)
        : null;
    const status = statusFromDelta(delta, CATEGORY_STATUS_THRESHOLD);

    return {
      category,
      label: CATEGORY_LABELS[category],
      focusedScore,
      baselineScore,
      delta,
      status,
      note: categoryNote(category, status, delta),
    };
  });

  const bestCategory = selectBestCategory(categoryRows);
  const biggestConcern = selectBiggestConcern(categoryRows);
  const tacticalDrivers = buildTacticalDriverRows(
    focusedScoredGames,
    baselineScoredGames,
    weights,
  );
  const tacticalUnassignedKpis = getUnassignedTacticalKpis(weights).map(
    (weight) => weight.name,
  );

  const kpiRows: MatchupKpiRow[] = weights
    .filter((weight) => weight.includeInScore && context.activeWeightByName.has(weight.name))
    .map((weight) => {
      const focusedRawAverage = averageNullable(
        focusedScoredGames.map((game) => {
          const kpi = game.kpis.find((entry) => entry.name === weight.name);
          return kpi?.rawValue ?? null;
        }),
      );
      const baselineRawAverage = averageNullable(
        baselineScoredGames.map((game) => {
          const kpi = game.kpis.find((entry) => entry.name === weight.name);
          return kpi?.rawValue ?? null;
        }),
      );
      const baselineExcludingOpponentRawAverage = baselineExcludingOpponentGames.length
        ? averageNullable(
            baselineExcludingOpponentGames.map((game) => {
              const kpi = game.kpis.find((entry) => entry.name === weight.name);
              return kpi?.rawValue ?? null;
            }),
          )
        : null;

      const focusedNormalizedAverage = averageKpiMetric(
        focusedScoredGames,
        weight.name,
        (kpi) => kpi.normalizedScore,
      );
      const baselineNormalizedAverage = averageKpiMetric(
        baselineScoredGames,
        weight.name,
        (kpi) => kpi.normalizedScore,
      );
      const normalizedDelta =
        hasValue(focusedNormalizedAverage) && hasValue(baselineNormalizedAverage)
          ? round(focusedNormalizedAverage - baselineNormalizedAverage, 1)
          : null;
      const weightShare = context.referenceWeightShareByName.get(weight.name) ?? 0;
      const weightedImpact =
        hasValue(normalizedDelta) ? round(normalizedDelta * weightShare, 2) : null;
      const status = statusFromDelta(weightedImpact, KPI_STATUS_THRESHOLD);

      return {
        key: weight.key,
        name: weight.name,
        category: weight.category,
        direction: weight.direction,
        weight: weight.weight,
        coachingAdjustment: weight.coachingAdjustment ?? null,
        notes: weight.notes ?? null,
        focusedRawAverage,
        baselineRawAverage,
        baselineExcludingOpponentRawAverage,
        rawDelta:
          hasValue(focusedRawAverage) && hasValue(baselineRawAverage)
            ? round(focusedRawAverage - baselineRawAverage, 2)
            : null,
        focusedNormalizedAverage,
        baselineNormalizedAverage,
        normalizedDelta,
        directionalDelta: calculateDirectionalDelta(
          focusedRawAverage,
          baselineRawAverage,
          weight.direction === "higher_is_better",
        ),
        weightedImpact,
        status,
        focusedCoverage: focusedScoredGames.length
          ? round(coverageCount(focusedScoredGames, weight.name) / focusedScoredGames.length, 2)
          : 0,
        baselineCoverage: baselineScoredGames.length
          ? round(coverageCount(baselineScoredGames, weight.name) / baselineScoredGames.length, 2)
          : 0,
      };
    });

  const strengths = [...kpiRows]
    .filter((row) => row.status === "strength" && hasValue(row.weightedImpact))
    .sort((left, right) => (right.weightedImpact ?? 0) - (left.weightedImpact ?? 0));
  const concerns = [...kpiRows]
    .filter((row) => row.status === "concern" && hasValue(row.weightedImpact))
    .sort((left, right) => (left.weightedImpact ?? 0) - (right.weightedImpact ?? 0));
  const neutralKpis = [...kpiRows]
    .filter((row) => row.status === "neutral")
    .sort(
      (left, right) =>
        Math.abs(right.weightedImpact ?? 0) - Math.abs(left.weightedImpact ?? 0),
    );

  const recommendationEngine = buildCoachingRecommendations({
    concerns: concerns.map((row) => ({
      key: row.key,
      name: row.name,
      category: row.category,
      focusedRawAverage: row.focusedRawAverage,
      baselineRawAverage: row.baselineRawAverage,
      rawDelta: row.rawDelta,
      normalizedDelta: row.normalizedDelta,
      weightedImpact: row.weightedImpact,
      focusedCoverage: row.focusedCoverage,
    })),
    strengths: strengths.map((row) => ({
      key: row.key,
      name: row.name,
      category: row.category,
      focusedRawAverage: row.focusedRawAverage,
      baselineRawAverage: row.baselineRawAverage,
      rawDelta: row.rawDelta,
      normalizedDelta: row.normalizedDelta,
      weightedImpact: row.weightedImpact,
      focusedCoverage: row.focusedCoverage,
    })),
    categoryRows: categoryRows.map((row) => ({
      category: row.category,
      label: row.label,
      focusedScore: row.focusedScore,
      baselineScore: row.baselineScore,
      delta: row.delta,
      status: row.status,
    })),
    tacticalRows: tacticalDrivers.map((row) => ({
      group: row.group,
      label: row.label,
      score: row.score,
      baselineScore: row.baselineScore,
      delta: row.delta,
      status: row.status,
      coverage: row.coverage,
    })),
    focusedGamesCount: focusedScoredGames.length,
  });
  const priorities = recommendationEngine.priorities;

  const matchupScore = averageNullable(focusedScoredGames.map((game) => game.overallScore));
  const baselineTeamScore = averageNullable(
    baselineScoredGames.map((game) => game.overallScore),
  );
  const baselineExcludingOpponentScore = baselineExcludingOpponentGames.length
    ? averageNullable(
        baselineExcludingOpponentGames.map((game) => game.overallScore),
      )
    : null;
  const differenceVsBaseline =
    hasValue(matchupScore) && hasValue(baselineTeamScore)
      ? round(matchupScore - baselineTeamScore, 1)
      : null;
  const recordSource = selectedOpponent ? opponentGamesRaw : focusedGames;
  const recordLabel = formatRecord(recordSource.map((game) => game.resultBucket));
  const focusedRecordLabel = formatRecord(
    focusedGames.map((game) => game.resultBucket),
  );

  const summary = {
    headline: selectedOpponent
      ? `Dalhousie vs ${selectedOpponent}`
      : "All Opponents Overview",
    narrative: generateSummaryNarrative(
      selectedOpponent,
      matchupScore,
      baselineTeamScore,
      bestCategory,
      biggestConcern,
    ),
    matchupScore,
    seasonBaselineScore: baselineTeamScore,
    baselineExcludingOpponentScore,
    differenceVsBaseline,
    gamesInFocus: focusedScoredGames.length,
    opponentGames: opponentGamesRaw.length,
    baselineGames: baselineScoredGames.length,
    recordLabel,
    focusedRecordLabel,
    bestCategory,
    biggestConcern,
  } satisfies MatchupSummary;

  const takeaways = generateTakeaways(
    selectedOpponent,
    differenceVsBaseline,
    bestCategory,
    biggestConcern,
    strengths,
    concerns,
  );
  const workedSignals = recommendationEngine.positiveSignals;
  const struggledSignals = recommendationEngine.concernSignals;
  const gamePlanReminders = recommendationEngine.gamePlanReminders;
  const recommendationNotes = recommendationEngine.notes;

  const warnings = [
    ...(context.excludedKpis.length
      ? [
          `${context.excludedKpis.length} KPI${context.excludedKpis.length === 1 ? "" : "s"} were excluded from matchup scoring because no valid reference values were found.`,
        ]
      : []),
    ...formatWarnings(context.warnings).filter(
      (warning) => !warning.includes("excluded because no valid reference values were found"),
    ),
    ...focusedScoredGames.flatMap((game) =>
      game.warnings.map((warning) => warning.message),
    ),
  ];

  if (!weights.length) {
    warnings.push("No KPI weights are configured, so matchup comparisons cannot be scored reliably.");
  }

  if (!focusedScoredGames.length) {
    warnings.push(
      selectedOpponent
        ? `No games matched the current filters for ${selectedOpponent}.`
        : "No games matched the current filter stack.",
    );
  }

  const focusScopeDetail =
    selectedOpponent && opponentGamesRaw.length !== focusedGames.length
      ? ` Within that season-opponent context, ${opponentGamesRaw.length} game${opponentGamesRaw.length === 1 ? "" : "s"} exist before the extra venue, result, or range filters are applied.`
      : "";

  const transparency = {
    focusedDescription: `Focused slice uses only games that match the selected season, opponent, venue, result, and range filters. It currently includes ${focusedScoredGames.length} game${focusedScoredGames.length === 1 ? "" : "s"}.${focusScopeDetail}`,
    baselineDescription: `Season baseline uses all games in the selected season context, regardless of opponent, venue, result, or range filters. It currently includes ${baselineScoredGames.length} game${baselineScoredGames.length === 1 ? "" : "s"}.`,
    baselineExcludingOpponentDescription: selectedOpponent
      ? `Optional opponent-excluded baseline uses the same season context but removes ${selectedOpponent}. It currently includes ${baselineExcludingOpponentGames.length} game${baselineExcludingOpponentGames.length === 1 ? "" : "s"}.`
      : null,
    directionDescription:
      "KPI direction is applied before comparison: higher-is-better KPIs reward larger values, while lower-is-better KPIs reward smaller values.",
    weightedImpactDescription:
      "Weighted impact compares focused and baseline KPI scores on the same 0-100 normalized scale, then applies the KPI's weight share from the shared season reference set.",
    teamScoreDescription:
      "Team score is calculated from the valid weighted KPI scores only. If not enough KPI coverage exists, the score is marked unavailable instead of defaulting to 50.",
    categoryScoreDescription:
      "Category scores are weighted KPI averages inside offense, defense, and special teams using only KPIs with valid data in that slice.",
  } satisfies MatchupTransparency;

  logCalculationDebug("matchup-profile", {
    filters,
    referenceGames: referenceGames.length,
    focusedGames: focusedScoredGames.length,
    opponentGames: opponentScoredGames.length,
    baselineGames: baselineScoredGames.length,
    warnings,
  });

  return {
    filters,
    filterOptions,
    isDemoMode: demoMode,
    selectedOpponent,
    focusedGames: focusedScoredGames,
    opponentGames: opponentScoredGames,
    baselineGames: baselineScoredGames,
    baselineExcludingOpponentGames,
    summary,
    categoryRows,
    tacticalDrivers,
    tacticalUnassignedKpis,
    kpiRows,
    strengths,
    concerns,
    neutralKpis,
    takeaways,
    workedSignals,
    struggledSignals,
    priorities,
    gamePlanReminders,
    recommendationNotes,
    gameRows: buildGameRows(focusedScoredGames),
    warnings: [...new Set(warnings)],
    transparency,
  };
}
