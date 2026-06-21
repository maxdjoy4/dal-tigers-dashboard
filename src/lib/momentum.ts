import { format } from "date-fns";

import { effectiveWeight, hasValue } from "@/lib/calculations";
import { CATEGORY_METADATA, getVisibleTacticalGroups, TACTICAL_GROUP_METADATA } from "@/lib/category-metadata";
import { resolveTacticalGroup } from "@/lib/tactical-groups";
import {
  getTrendComparisonWindow,
  TREND_WINDOW_GAMES,
} from "@/lib/trend-window";
import type { KpiWeight, ScoredGame, ScoreCategory, TacticalGroup } from "@/lib/types";
import { round } from "@/lib/utils";

export type MomentumTrendLabel = "Improving" | "Stable" | "Declining" | "Limited data";

interface BlockComparison {
  windowSize: number;
  recentAverage: number | null;
  previousAverage: number | null;
  change: number | null;
  trend: MomentumTrendLabel;
}

export interface MomentumSummaryMetrics {
  currentForm: number | null;
  seasonAverage: number | null;
  changeVsPrevious: number | null;
  trend: MomentumTrendLabel;
  windowSize: number;
  bestStretch: {
    average: number | null;
    label: string;
  } | null;
  worstStretch: {
    average: number | null;
    label: string;
  } | null;
}

export interface CategoryMomentumRow {
  category: ScoreCategory;
  label: string;
  descriptor: string;
  recentAverage: number | null;
  previousAverage: number | null;
  change: number | null;
  trend: MomentumTrendLabel;
}

export interface TacticalMomentumRow {
  group: TacticalGroup;
  label: string;
  previousAverage: number | null;
  recentAverage: number | null;
  change: number | null;
  trend: MomentumTrendLabel;
  strongestKpi: string | null;
  weakestKpi: string | null;
}

export interface KpiMomentumMover {
  key: string;
  name: string;
  category: ScoreCategory;
  tacticalGroup: TacticalGroup;
  direction: KpiWeight["direction"];
  previousAverage: number | null;
  recentAverage: number | null;
  change: number | null;
  weightedDelta: number | null;
}

export interface StretchSummary {
  label: string;
  averageScore: number | null;
  opponents: string[];
  strongestCategory: string | null;
  weakestCategory: string | null;
}

export interface MomentumGameRow {
  id: string;
  date: string;
  opponent: string;
  result: string;
  score: number | null;
  rollingAverage: number | null;
  offenseScore: number | null;
  defenseScore: number | null;
  specialTeamsScore: number | null;
  strongestTacticalDriver: string | null;
  biggestConcern: string | null;
  trendVsPrevious: MomentumTrendLabel;
}

function average(values: Array<number | null | undefined>) {
  const validValues = values.filter(hasValue);
  if (!validValues.length) {
    return null;
  }

  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

function comparisonWindow(count: number) {
  return getTrendComparisonWindow(count);
}

function buildTrendFromChange(change: number | null, threshold: number) {
  if (!hasValue(change)) {
    return "Limited data" as MomentumTrendLabel;
  }

  if (change >= threshold) {
    return "Improving" as MomentumTrendLabel;
  }

  if (change <= -threshold) {
    return "Declining" as MomentumTrendLabel;
  }

  return "Stable" as MomentumTrendLabel;
}

function compareBlocks(values: number[], threshold: number): BlockComparison {
  const windowSize = comparisonWindow(values.length);

  if (!windowSize) {
    return {
      windowSize: 0,
      recentAverage: null,
      previousAverage: null,
      change: null,
      trend: "Limited data",
    };
  }

  const recentAverage = average(values.slice(-windowSize));
  const previousAverage = average(values.slice(-windowSize * 2, -windowSize));
  const change =
    hasValue(recentAverage) && hasValue(previousAverage)
      ? round(recentAverage - previousAverage, 1)
      : null;

  return {
    windowSize,
    recentAverage,
    previousAverage,
    change,
    trend: buildTrendFromChange(change, threshold),
  };
}

function rollingAverage(values: Array<number | null>, windowSize: number) {
  return values.map((_, index) =>
    average(values.slice(Math.max(0, index - windowSize + 1), index + 1)),
  );
}

function categoryExtremes(game: ScoredGame) {
  const rows = [
    { label: "Offense", score: game.categoryScores.offense.score },
    { label: "Defense", score: game.categoryScores.defense.score },
    { label: "Special Teams", score: game.categoryScores.special_teams.score },
  ].filter((row) => row.score !== null);

  const strongest = [...rows].sort((left, right) => (right.score ?? 0) - (left.score ?? 0))[0] ?? null;
  const weakest = [...rows].sort((left, right) => (left.score ?? 0) - (right.score ?? 0))[0] ?? null;

  return {
    strongestCategory: strongest?.label ?? null,
    weakestCategory: weakest?.label ?? null,
  };
}

export function buildMomentumSummary(scoredGames: ScoredGame[]): MomentumSummaryMetrics {
  const scores = scoredGames.map((game) => game.overallScore).filter(hasValue);
  const comparison = compareBlocks(scores, 3);
  const stretchWindow = comparisonWindow(scores.length);
  let bestStretch: MomentumSummaryMetrics["bestStretch"] = null;
  let worstStretch: MomentumSummaryMetrics["worstStretch"] = null;

  if (stretchWindow) {
    const stretches = [];
    for (let index = 0; index <= scoredGames.length - stretchWindow; index += 1) {
      const windowGames = scoredGames.slice(index, index + stretchWindow);
      const windowScores = windowGames.map((game) => game.overallScore).filter(hasValue);
      const averageScore = average(windowScores);
      const start = windowGames[0]?.game.date;
      const end = windowGames.at(-1)?.game.date;

      if (averageScore !== null && start && end) {
        stretches.push({
          average: round(averageScore, 1),
          label: `${format(new Date(start), "MMM d")} - ${format(new Date(end), "MMM d")}`,
        });
      }
    }

    bestStretch = [...stretches].sort((left, right) => right.average - left.average)[0] ?? null;
    worstStretch = [...stretches].sort((left, right) => left.average - right.average)[0] ?? null;
  }

  return {
    currentForm: comparison.recentAverage,
    seasonAverage: average(scores),
    changeVsPrevious: comparison.change,
    trend: comparison.trend,
    windowSize: comparison.windowSize,
    bestStretch,
    worstStretch,
  };
}

export function buildCategoryTrendSeries(games: ScoredGame[]) {
  const sortedGames = [...games].sort(
    (left, right) => new Date(left.game.date).getTime() - new Date(right.game.date).getTime(),
  );

  return sortedGames.map((game) => ({
    id: game.game.id,
    date: game.game.date,
    label: format(new Date(game.game.date), "MMM d"),
    opponent: game.game.opponent,
    result: game.game.result,
    offense: game.categoryScores.offense.score,
    defense: game.categoryScores.defense.score,
    specialTeams: game.categoryScores.special_teams.score,
  }));
}

export function buildCategoryMomentumRows(games: ScoredGame[]): CategoryMomentumRow[] {
  const categories = ["offense", "defense", "special_teams"] as const;

  return categories.map((category) => {
    const values = games
      .map((game) => game.categoryScores[category].score)
      .filter(hasValue);
    const comparison = compareBlocks(values, 3);

    return {
      category,
      label: CATEGORY_METADATA[category].label,
      descriptor: CATEGORY_METADATA[category].shortDescription,
      recentAverage: comparison.recentAverage,
      previousAverage: comparison.previousAverage,
      change: comparison.change,
      trend: comparison.trend,
    };
  });
}

export function buildTacticalMomentumRows(
  games: ScoredGame[],
  weights: KpiWeight[],
): TacticalMomentumRow[] {
  const sortedGames = [...games].sort(
    (left, right) => new Date(left.game.date).getTime() - new Date(right.game.date).getTime(),
  );

  return getVisibleTacticalGroups().map((group) => {
    const values = sortedGames
      .map((game) => game.tacticalGroupScores[group].score)
      .filter(hasValue);
    const comparison = compareBlocks(values, 3);
    const windowSize = comparison.windowSize;
    const recentGames = windowSize ? sortedGames.slice(-windowSize) : [];
    const previousGames = windowSize ? sortedGames.slice(-windowSize * 2, -windowSize) : [];
    const groupWeights = weights.filter(
      (weight) => weight.includeInScore && resolveTacticalGroup(weight) === group,
    );
    const totalGroupWeight = groupWeights.reduce((sum, weight) => sum + effectiveWeight(weight), 0);

    const weightedKpis = groupWeights.map((weight) => {
      const recentNormalizedAverage = average(
        recentGames.map((game) => game.kpis.find((entry) => entry.key === weight.key)?.normalizedScore ?? null),
      );
      const previousNormalizedAverage = average(
        previousGames.map((game) => game.kpis.find((entry) => entry.key === weight.key)?.normalizedScore ?? null),
      );
      const delta =
        hasValue(recentNormalizedAverage) && hasValue(previousNormalizedAverage)
          ? round(
              (recentNormalizedAverage - previousNormalizedAverage) *
                (totalGroupWeight > 0 ? effectiveWeight(weight) / totalGroupWeight : 0),
              2,
            )
          : null;

      return {
        name: weight.name,
        delta,
      };
    });

    const strongestKpi =
      [...weightedKpis]
        .filter((row) => hasValue(row.delta))
        .sort((left, right) => (right.delta ?? 0) - (left.delta ?? 0))[0]
        ?.name ?? null;
    const weakestKpi =
      [...weightedKpis]
        .filter((row) => hasValue(row.delta))
        .sort((left, right) => (left.delta ?? 0) - (right.delta ?? 0))[0]
        ?.name ?? null;

    return {
      group,
      label: TACTICAL_GROUP_METADATA[group].label,
      previousAverage: comparison.previousAverage,
      recentAverage: comparison.recentAverage,
      change: comparison.change,
      trend: comparison.trend,
      strongestKpi,
      weakestKpi,
    };
  });
}

export function buildKpiMomentumMovers(
  games: ScoredGame[],
  weights: KpiWeight[],
) {
  const sortedGames = [...games].sort(
    (left, right) => new Date(left.game.date).getTime() - new Date(right.game.date).getTime(),
  );
  const windowSize = comparisonWindow(sortedGames.length);
  const recentGames = windowSize ? sortedGames.slice(-windowSize) : [];
  const previousGames = windowSize ? sortedGames.slice(-windowSize * 2, -windowSize) : [];

  const movers = weights
    .filter((weight) => weight.includeInScore)
    .map((weight) => {
      const recentRawAverage = average(
        recentGames.map((game) => game.kpis.find((entry) => entry.key === weight.key)?.rawValue ?? null),
      );
      const previousRawAverage = average(
        previousGames.map((game) => game.kpis.find((entry) => entry.key === weight.key)?.rawValue ?? null),
      );
      const recentWeightedAverage = average(
        recentGames.map((game) => game.kpis.find((entry) => entry.key === weight.key)?.weightedScore ?? null),
      );
      const previousWeightedAverage = average(
        previousGames.map((game) => game.kpis.find((entry) => entry.key === weight.key)?.weightedScore ?? null),
      );

      return {
        key: weight.key,
        name: weight.name,
        category: weight.category,
        tacticalGroup: resolveTacticalGroup(weight),
        direction: weight.direction,
        previousAverage: previousRawAverage,
        recentAverage: recentRawAverage,
        change:
          hasValue(recentRawAverage) && hasValue(previousRawAverage)
            ? round(recentRawAverage - previousRawAverage, 2)
            : null,
        weightedDelta:
          hasValue(recentWeightedAverage) && hasValue(previousWeightedAverage)
            ? round(recentWeightedAverage - previousWeightedAverage, 2)
            : null,
      } satisfies KpiMomentumMover;
    })
    .filter((row) => hasValue(row.weightedDelta));

  return {
    windowSize,
    improvers: [...movers].sort((left, right) => (right.weightedDelta ?? 0) - (left.weightedDelta ?? 0)).slice(0, 8),
    decliners: [...movers].sort((left, right) => (left.weightedDelta ?? 0) - (right.weightedDelta ?? 0)).slice(0, 8),
  };
}

export function buildHotColdStretches(scoredGames: ScoredGame[]) {
  const sortedGames = [...scoredGames].sort(
    (left, right) => new Date(left.game.date).getTime() - new Date(right.game.date).getTime(),
  );
  const windowSize = comparisonWindow(sortedGames.length);

  if (!windowSize) {
    return {
      windowSize: 0,
      best: null as StretchSummary | null,
      worst: null as StretchSummary | null,
    };
  }

  const stretches: StretchSummary[] = [];
  for (let index = 0; index <= sortedGames.length - windowSize; index += 1) {
    const windowGames = sortedGames.slice(index, index + windowSize);
    const averageScore = average(windowGames.map((game) => game.overallScore));
    if (!hasValue(averageScore)) {
      continue;
    }

    const categoryAverages = {
      offense: average(windowGames.map((game) => game.categoryScores.offense.score)),
      defense: average(windowGames.map((game) => game.categoryScores.defense.score)),
      special_teams: average(windowGames.map((game) => game.categoryScores.special_teams.score)),
    };
    const validCategories = Object.entries(categoryAverages).filter((entry): entry is [ScoreCategory, number] => hasValue(entry[1]));
    const strongest = [...validCategories].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
    const weakest = [...validCategories].sort((left, right) => left[1] - right[1])[0]?.[0] ?? null;
    const start = windowGames[0]?.game.date;
    const end = windowGames.at(-1)?.game.date;
    if (!start || !end) {
      continue;
    }

    stretches.push({
      label: `${format(new Date(start), "MMM d")} - ${format(new Date(end), "MMM d")}`,
      averageScore: round(averageScore, 1),
      opponents: windowGames.map((game) => game.game.opponent),
      strongestCategory: strongest ? CATEGORY_METADATA[strongest].label : null,
      weakestCategory: weakest ? CATEGORY_METADATA[weakest].label : null,
    });
  }

  return {
    windowSize,
    best: [...stretches].sort((left, right) => (right.averageScore ?? 0) - (left.averageScore ?? 0))[0] ?? null,
    worst: [...stretches].sort((left, right) => (left.averageScore ?? 0) - (right.averageScore ?? 0))[0] ?? null,
  };
}

export function buildMomentumGameRows(scoredGames: ScoredGame[]): MomentumGameRow[] {
  const sortedGames = [...scoredGames].sort(
    (left, right) => new Date(left.game.date).getTime() - new Date(right.game.date).getTime(),
  );
  const rolling = rollingAverage(
    sortedGames.map((game) => game.overallScore),
    TREND_WINDOW_GAMES,
  );

  return [...sortedGames].reverse().map((game, reverseIndex) => {
    const chronologicalIndex = sortedGames.length - reverseIndex - 1;
    const previousScore = chronologicalIndex > 0 ? sortedGames[chronologicalIndex - 1]?.overallScore ?? null : null;
    const currentScore = game.overallScore;
    const change =
      hasValue(currentScore) && hasValue(previousScore)
        ? round(currentScore - previousScore, 1)
        : null;
    const tacticalRows = getVisibleTacticalGroups()
      .map((group) => ({
        group,
        label: TACTICAL_GROUP_METADATA[group].label,
        score: game.tacticalGroupScores[group].score,
      }))
      .filter((row) => row.score !== null);
    const strongestDriver = [...tacticalRows].sort((left, right) => (right.score ?? 0) - (left.score ?? 0))[0] ?? null;
    const weakestDriver = [...tacticalRows].sort((left, right) => (left.score ?? 0) - (right.score ?? 0))[0] ?? null;

    return {
      id: game.game.id,
      date: game.game.date,
      opponent: game.game.opponent,
      result: game.game.result,
      score: currentScore,
      rollingAverage: rolling[chronologicalIndex] ?? null,
      offenseScore: game.categoryScores.offense.score,
      defenseScore: game.categoryScores.defense.score,
      specialTeamsScore: game.categoryScores.special_teams.score,
      strongestTacticalDriver: strongestDriver?.label ?? null,
      biggestConcern: weakestDriver?.label ?? null,
      trendVsPrevious:
        change === null
          ? "Limited data"
          : change >= 3
            ? "Improving"
            : change <= -3
              ? "Declining"
              : "Stable",
    };
  });
}

export function buildRecentChangeSummary(
  scoredGames: ScoredGame[],
  contextGames: ScoredGame[],
  weights: KpiWeight[],
) {
  const scoreMetrics = buildMomentumSummary(scoredGames);
  const categoryRows = buildCategoryMomentumRows(contextGames);
  const tacticalRows = buildTacticalMomentumRows(contextGames, weights);
  const kpiMovers = buildKpiMomentumMovers(contextGames, weights);

  const topImprovingTactical = [...tacticalRows]
    .filter((row) => hasValue(row.change))
    .sort((left, right) => (right.change ?? 0) - (left.change ?? 0))[0] ?? null;
  const topDecliningTactical = [...tacticalRows]
    .filter((row) => hasValue(row.change))
    .sort((left, right) => (left.change ?? 0) - (right.change ?? 0))[0] ?? null;

  return {
    windowSize: scoreMetrics.windowSize,
    teamScoreChange: scoreMetrics.changeVsPrevious,
    categoryRows,
    topImprovingTactical,
    topDecliningTactical,
    topImprovingKpi: kpiMovers.improvers[0] ?? null,
    topDecliningKpi: kpiMovers.decliners[0] ?? null,
  };
}

export function buildScoreHistoryTooltipContext(game: ScoredGame) {
  return categoryExtremes(game);
}
