import { format } from "date-fns";

import {
  averageNullable,
  buildDatasetAuditSummary,
  buildScoringContext,
  formatWarnings,
  hasValue,
  logCalculationDebug,
  scoreGamesWithContext,
} from "@/lib/calculations";
import { CATEGORY_METADATA } from "@/lib/category-metadata";
import { getUnassignedTacticalKpis } from "@/lib/tactical-groups";
import { buildTacticalDriverRows } from "@/lib/tactical-analysis";
import {
  getTrendComparisonWindow,
  RECENT_RANGE_FILTER_VALUE,
  TREND_WINDOW_GAMES,
} from "@/lib/trend-window";
import type {
  AnalyticsBundle,
  CategoryOverviewRow,
  DashboardFilters,
  DriverInsight,
  GameRecord,
  HomeAway,
  KpiWeight,
  ScoredGame,
  TacticalDriverRow,
  TrendDirection,
} from "@/lib/types";
import { round } from "@/lib/utils";

export const defaultFilters: DashboardFilters = {
  season: "all",
  range: "all",
  opponent: "all",
  homeAway: "all",
  result: "all",
};

const STEADY_TREND_BAND = 5;

export function parseFilters(
  input?: Record<string, string | string[] | undefined>,
) {
  const season = first(input?.season) || "all";
  const range =
    first(input?.range) === RECENT_RANGE_FILTER_VALUE
      ? RECENT_RANGE_FILTER_VALUE
      : "all";
  const opponent = first(input?.opponent) || "all";
  const homeAwayValue = first(input?.homeAway);
  const resultValue = first(input?.result);

  return {
    season,
    range,
    opponent,
    homeAway:
      homeAwayValue === "home" ||
      homeAwayValue === "away" ||
      homeAwayValue === "neutral" ||
      homeAwayValue === "unknown"
        ? homeAwayValue
        : "all",
    result:
      resultValue === "win" || resultValue === "loss" || resultValue === "tie"
        ? resultValue
        : "all",
  } satisfies DashboardFilters;
}

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function takeLast<T>(items: T[], count: number) {
  return items.slice(Math.max(0, items.length - count));
}

function trendDirection(
  scores: number[],
): { direction: TrendDirection; delta: number } {
  if (scores.length < 2) {
    return {
      direction: "stable" as TrendDirection,
      delta: 0,
    };
  }

  const latest = scores.at(-1) ?? 0;
  const previous = scores.at(-2) ?? latest;
  const delta = round(latest - previous, 1);

  return {
    direction:
      delta > STEADY_TREND_BAND
        ? "improving"
        : delta < -STEADY_TREND_BAND
          ? "declining"
          : "stable",
    delta,
  };
}

export function describeTrend(direction: TrendDirection) {
  if (direction === "improving") {
    return "Trending up";
  }

  if (direction === "declining") {
    return "Sliding";
  }

  return "Holding steady";
}

export function trendToCardTrend(direction: TrendDirection): "up" | "down" | "flat" {
  if (direction === "improving") {
    return "up";
  }

  if (direction === "declining") {
    return "down";
  }

  return "flat";
}

export function formatTrendDelta(delta: number) {
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}`;
}

function applyBaseFilters(games: GameRecord[], filters: DashboardFilters) {
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

function applyRangeFilter(scoredGames: ScoredGame[], filters: DashboardFilters) {
  return filters.range === RECENT_RANGE_FILTER_VALUE
    ? takeLast(scoredGames, TREND_WINDOW_GAMES)
    : scoredGames;
}

function buildDriverInsights(
  kpis: ScoredGame["kpis"],
  direction: "positive" | "negative",
): DriverInsight[] {
  return [...kpis]
    .filter(
      (kpi) =>
        kpi.available &&
        hasValue(kpi.impact) &&
        hasValue(kpi.normalizedScore) &&
        hasValue(kpi.weightedScore),
    )
    .sort((left, right) =>
      direction === "positive"
        ? (right.impact ?? 0) - (left.impact ?? 0)
        : (left.impact ?? 0) - (right.impact ?? 0),
    )
    .slice(0, 5)
    .map((kpi) => ({
      key: kpi.key,
      name: kpi.name,
      category: kpi.category,
      impact: kpi.impact ?? 0,
      rawValue: kpi.rawValue,
      normalizedScore: kpi.normalizedScore ?? 0,
      weightedScore: kpi.weightedScore ?? 0,
    }));
}

export function summarizeGamePerformance(
  game: ScoredGame | null,
  drivers: DriverInsight[],
  issues: DriverInsight[],
  trend: TrendDirection,
) {
  if (!game) {
    return "Upload or seed some games to generate the live coaching summary.";
  }

  if (!hasValue(game.overallScore)) {
    return `${game.game.opponent} ${game.game.result}: insufficient KPI coverage to produce a trustworthy performance score. Review the missing stats before using this game for coaching decisions.`;
  }

  const driverNames = drivers.slice(0, 3).map((driver) => driver.name);
  const issueNames = issues.slice(0, 3).map((issue) => issue.name);
  const trendSummary =
    trend === "improving"
      ? "trending up"
      : trend === "declining"
        ? "sliding"
        : "holding steady";
  const categoryRows = [
    { label: "Offense", score: game.categoryScores.offense.score },
    { label: "Defense", score: game.categoryScores.defense.score },
    { label: "Special Teams", score: game.categoryScores.special_teams.score },
  ].filter((row) => hasValue(row.score));
  const strongestCategory = [...categoryRows].sort(
    (left, right) => (right.score ?? 0) - (left.score ?? 0),
  )[0]?.label;
  const weakestCategory = [...categoryRows].sort(
    (left, right) => (left.score ?? 0) - (right.score ?? 0),
  )[0]?.label;

  const formatList = (items: string[]) => {
    if (!items.length) {
      return null;
    }

    if (items.length === 1) {
      return items[0];
    }

    if (items.length === 2) {
      return `${items[0]} and ${items[1]}`;
    }

    return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
  };

  const positives = formatList(driverNames);
  const negatives = formatList(issueNames);
  const opening = `${game.game.opponent} ${game.game.result}. Overall, the team graded at ${game.overallScore.toFixed(1)}/100 and is ${trendSummary}.`;
  const whatWentWell =
    strongestCategory || positives
      ? `What we did well: ${strongestCategory ? `${strongestCategory} was our strongest area` : "our best moments came through a few specific KPIs"}${positives ? `, led by ${positives}` : ""}.`
      : "What we did well: there was no single category or KPI that clearly stood out as a strength in this game.";
  const whatHurtUs =
    weakestCategory || negatives
      ? `What hurt us: ${weakestCategory ? `${weakestCategory} was the biggest concern` : "the main drag came from a few costly metrics"}${negatives ? `, especially ${negatives}` : ""}.`
      : "What hurt us: there was no single negative KPI cluster large enough to isolate cleanly from the current data.";
  const keyInsight =
    strongestCategory && weakestCategory && strongestCategory !== weakestCategory
      ? `Key insight: this game was shaped by the gap between ${strongestCategory.toLowerCase()} and ${weakestCategory.toLowerCase()}, so the next review should focus on whether the strong areas were repeatable and whether the weak areas were process issues or matchup-driven.`
      : `Key insight: the next review should focus on whether the main KPI swings were repeatable process outcomes or one-game volatility.`;

  return `${opening} ${whatWentWell} ${whatHurtUs} ${keyInsight}`;
}

export interface GameReadout {
  overallRead: string;
  worked: string[];
  hurt: string[];
  carryForward: string[];
  cleanUp: string[];
}

type GameReadoutTheme =
  | "offensive_creation"
  | "offensive_zone_possession"
  | "defensive_quality_control"
  | "defensive_zone_play"
  | "transition_play"
  | "puck_management"
  | "special_teams_execution"
  | "retrievals_second_puck";

interface GameReadoutThemeBucket {
  theme: GameReadoutTheme;
  totalImpact: number;
  positiveImpact: number;
  negativeImpact: number;
  positiveKpis: DriverInsight[];
  negativeKpis: DriverInsight[];
}

function trendContextLabel(trend: TrendDirection) {
  switch (trend) {
    case "improving":
      return "This sat in an upward trend pocket for the group.";
    case "declining":
      return "This came during a stretch where the overall profile has been sliding.";
    default:
      return "This sat close to the team's recent trend line.";
  }
}

function categoryLabelFromKey(key: "offense" | "defense" | "special_teams") {
  if (key === "special_teams") {
    return "Special Teams";
  }

  return key === "offense" ? "Offense" : "Defense";
}

function categoryThemeFromKey(
  key: "offense" | "defense" | "special_teams",
): GameReadoutTheme {
  switch (key) {
    case "offense":
      return "offensive_creation";
    case "defense":
      return "defensive_quality_control";
    case "special_teams":
      return "special_teams_execution";
  }
}

function themeLabel(theme: GameReadoutTheme) {
  switch (theme) {
    case "offensive_creation":
      return "Offensive creation";
    case "offensive_zone_possession":
      return "Offensive-zone possession";
    case "defensive_quality_control":
      return "Defensive quality control";
    case "defensive_zone_play":
      return "Defensive-zone play";
    case "transition_play":
      return "Transition play";
    case "puck_management":
      return "Puck management";
    case "special_teams_execution":
      return "Special teams execution";
    case "retrievals_second_puck":
      return "Second-puck pressure";
  }
}

function tacticalDriverTheme(group: TacticalDriverRow["group"]): GameReadoutTheme | null {
  switch (group) {
    case "offensive_creation":
      return "offensive_creation";
    case "transition_offense":
    case "transition_defense":
      return "transition_play";
    case "puck_management":
      return "puck_management";
    case "defensive_zone_play":
      return "defensive_zone_play";
    case "possession_territory":
      return "offensive_zone_possession";
    case "special_teams":
      return "special_teams_execution";
    case "battle_compete":
      return "retrievals_second_puck";
    default:
      return null;
  }
}

function classifyReadoutTheme(name: string, category: DriverInsight["category"]): GameReadoutTheme | null {
  const value = name.toLowerCase();
  const isEvenStrength = value.includes("ev ");

  if (
    !isEvenStrength &&
    (value.includes("power play") ||
      value.includes("penalty kill") ||
      value.includes("short-handed") ||
      value.includes("special teams") ||
      value.includes("man advantage") ||
      value.includes("man disadvantage") ||
      value.includes("pp ") ||
      value.startsWith("pp") ||
      value.includes(" pk") ||
      value.startsWith("pk"))
  ) {
    return "special_teams_execution";
  }

  if (
    value.includes("opponent xg") ||
    value.includes("net xg") ||
    value.includes("slot chances against") ||
    value.includes("scoring chances against") ||
    value.includes("second chances against") ||
    value.includes("xga")
  ) {
    return "defensive_quality_control";
  }

  if (
    value.includes("ev dz retrieval") ||
    value.includes("dz retrieval") ||
    value.includes("defensive-zone retrieval") ||
    value.includes("dz puck loss") ||
    value.includes("defensive-zone puck loss") ||
    value.includes("defensive-zone time") ||
    value.includes("dz time")
  ) {
    return "defensive_zone_play";
  }

  if (
    value.includes("ev oz retrieval") ||
    value.includes("oz retrieval") ||
    value.includes("corsi") ||
    value.includes("oz play") ||
    value.includes("offensive-zone time") ||
    value.includes("possession")
  ) {
    return "offensive_zone_possession";
  }

  if (
    value.includes("takeaways in oz") ||
    value.includes("loose puck") ||
    value.includes("puck battle") ||
    value.includes("battle")
  ) {
    return "retrievals_second_puck";
  }

  if (
    value.includes("controlled entr") ||
    value.includes("entries") ||
    value.includes("entry") ||
    value.includes("exit") ||
    value.includes("breakout") ||
    value.includes("counterattack") ||
    value.includes("rush")
  ) {
    return "transition_play";
  }

  if (
    value.includes("giveaway") ||
    value.includes("puck loss") ||
    value.includes("failed exit") ||
    value.includes("failed entry") ||
    value.includes("pass accuracy") ||
    value.includes("turnover")
  ) {
    return "puck_management";
  }

  if (
    value.includes("shots") ||
    value.includes("shot") ||
    value.includes("scoring chance") ||
    value.includes("slot chance") ||
    value.includes("pre-shot") ||
    value.includes("xg") ||
    value.includes("passes to the slot") ||
    value.includes("pass to the slot")
  ) {
    return "offensive_creation";
  }

  if (category === "defense") {
    return "defensive_quality_control";
  }

  if (category === "special_teams") {
    return "special_teams_execution";
  }

  return category === "offense" ? "offensive_creation" : null;
}

function buildThemeBuckets(game: ScoredGame) {
  const buckets = new Map<GameReadoutTheme, GameReadoutThemeBucket>();

  for (const kpi of game.kpis) {
    if (!kpi.available || !hasValue(kpi.impact)) {
      continue;
    }

    const theme = classifyReadoutTheme(kpi.name, kpi.category);
    if (!theme) {
      continue;
    }

    const bucket =
      buckets.get(theme) ??
      {
        theme,
        totalImpact: 0,
        positiveImpact: 0,
        negativeImpact: 0,
        positiveKpis: [],
        negativeKpis: [],
      };

    bucket.totalImpact += kpi.impact ?? 0;

    const insight: DriverInsight = {
      key: kpi.key,
      name: kpi.name,
      category: kpi.category,
      impact: kpi.impact ?? 0,
      rawValue: kpi.rawValue,
      normalizedScore: kpi.normalizedScore ?? 0,
      weightedScore: kpi.weightedScore ?? 0,
    };

    if ((kpi.impact ?? 0) > 0) {
      bucket.positiveImpact += kpi.impact ?? 0;
      bucket.positiveKpis.push(insight);
    } else if ((kpi.impact ?? 0) < 0) {
      bucket.negativeImpact += Math.abs(kpi.impact ?? 0);
      bucket.negativeKpis.push(insight);
    }

    buckets.set(theme, bucket);
  }

  return [...buckets.values()];
}

function formatEvidenceList(kpis: DriverInsight[]) {
  const names = [...kpis]
    .sort((left, right) => Math.abs(right.impact) - Math.abs(left.impact))
    .slice(0, 3)
    .map((kpi) => kpi.name);

  if (!names.length) {
    return null;
  }

  if (names.length === 1) {
    return names[0];
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }

  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}

export function generateGameReadout(
  game: ScoredGame | null,
  _drivers: DriverInsight[],
  _issues: DriverInsight[],
  trend: TrendDirection,
  tacticalDrivers: TacticalDriverRow[],
): GameReadout {
  if (!game) {
    return {
      overallRead: "Select a saved game to generate a structured post-game readout.",
      worked: ["No game is selected yet."],
      hurt: ["No game is selected yet."],
      carryForward: [],
      cleanUp: [],
    };
  }

  const categoryRows = [
    { key: "offense" as const, score: game.categoryScores.offense.score },
    { key: "defense" as const, score: game.categoryScores.defense.score },
    { key: "special_teams" as const, score: game.categoryScores.special_teams.score },
  ].filter((row) => hasValue(row.score));

  const strongestCategory = [...categoryRows].sort(
    (left, right) => (right.score ?? 0) - (left.score ?? 0),
  )[0] ?? null;
  const weakestCategory = [...categoryRows].sort(
    (left, right) => (left.score ?? 0) - (right.score ?? 0),
  )[0] ?? null;

  const strongestTacticalDriver =
    tacticalDrivers.find((row) => row.status === "strength") ??
    [...tacticalDrivers]
      .filter((row) => hasValue(row.score))
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))[0] ??
    null;
  const biggestTacticalConcern =
    tacticalDrivers.find((row) => row.status === "concern") ??
    [...tacticalDrivers]
      .filter((row) => hasValue(row.score))
      .sort((left, right) => (left.score ?? 0) - (right.score ?? 0))[0] ??
    null;
  const strongestTacticalTheme = strongestTacticalDriver
    ? tacticalDriverTheme(strongestTacticalDriver.group)
    : null;
  const biggestTacticalConcernTheme = biggestTacticalConcern
    ? tacticalDriverTheme(biggestTacticalConcern.group)
    : null;

  const themeBuckets = buildThemeBuckets(game);
  const positiveThemes = [...themeBuckets]
    .filter((bucket) => bucket.totalImpact > 0.15)
    .sort((left, right) => right.totalImpact - left.totalImpact);
  const negativeThemes = [...themeBuckets]
    .filter((bucket) => bucket.totalImpact < -0.15)
    .sort((left, right) => left.totalImpact - right.totalImpact);
  const topPositiveTheme = positiveThemes[0] ?? null;
  const topNegativeTheme = negativeThemes[0] ?? null;
  const positiveEvidence = topPositiveTheme
    ? formatEvidenceList(topPositiveTheme.positiveKpis)
    : null;
  const negativeEvidence = topNegativeTheme
    ? formatEvidenceList(topNegativeTheme.negativeKpis)
    : null;

  const overallRead = !hasValue(game.overallScore)
    ? `Against ${game.game.opponent}, ${game.game.result.toLowerCase()} did not have enough valid KPI coverage to produce a trustworthy performance score. Use the category and KPI evidence cautiously until the missing data is filled in.`
    : `Against ${game.game.opponent}, Dal graded at ${game.overallScore.toFixed(1)}/100 in ${game.game.result.toLowerCase()}. ${trendContextLabel(trend)} ${strongestCategory ? `${categoryLabelFromKey(strongestCategory.key)} carried the strongest signal` : "No category clearly separated itself"}${weakestCategory && strongestCategory?.key !== weakestCategory.key ? `, while ${categoryLabelFromKey(weakestCategory.key).toLowerCase()} pulled the game down most.` : "."}`;

  const worked: string[] = [];
  if (
    strongestCategory &&
    categoryThemeFromKey(strongestCategory.key) !== topNegativeTheme?.theme
  ) {
    worked.push(
      `${categoryLabelFromKey(strongestCategory.key)} was the strongest category at ${(strongestCategory.score ?? 0).toFixed(1)}/100.`,
    );
  }
  if (topPositiveTheme) {
    worked.push(
      positiveEvidence
        ? `${themeLabel(topPositiveTheme.theme)} showed up best through ${positiveEvidence}.`
        : `${themeLabel(topPositiveTheme.theme)} gave the clearest positive KPI push in this game.`,
    );
  }
  if (
    strongestTacticalDriver &&
    strongestTacticalDriver.group !== biggestTacticalConcern?.group &&
    strongestTacticalTheme !== topNegativeTheme?.theme
  ) {
    worked.push(
      `${strongestTacticalDriver.label} was the steadiest tactical driver relative to the rest of the game profile.`,
    );
  }
  if (!worked.length) {
    worked.push("No clear positive KPI edge stood out in this game.");
  }

  const hurt: string[] = [];
  if (
    weakestCategory &&
    categoryThemeFromKey(weakestCategory.key) !== topPositiveTheme?.theme
  ) {
    hurt.push(
      `${categoryLabelFromKey(weakestCategory.key)} was the biggest category drag at ${(weakestCategory.score ?? 0).toFixed(1)}/100.`,
    );
  }
  if (topNegativeTheme) {
    hurt.push(
      negativeEvidence
        ? `${themeLabel(topNegativeTheme.theme)} was the clearest drag, led by ${negativeEvidence}.`
        : `${themeLabel(topNegativeTheme.theme)} was the clearest KPI drag in this game.`,
    );
  }
  if (biggestTacticalConcern && biggestTacticalConcernTheme !== topPositiveTheme?.theme) {
    hurt.push(
      `${biggestTacticalConcern.label} was the main tactical concern in the current game-to-season comparison.`,
    );
  }
  if (!hurt.length) {
    hurt.push("No major KPI drag stood out in this game.");
  }

  const carryForward: string[] = [];
  if (
    strongestCategory &&
    categoryThemeFromKey(strongestCategory.key) !== topNegativeTheme?.theme
  ) {
    carryForward.push(
      `Keep leaning into the ${categoryLabelFromKey(strongestCategory.key).toLowerCase()} habits that gave the team its best foundation in this game.`,
    );
  }
  if (topPositiveTheme) {
    carryForward.push(
      `Protect the habits behind ${themeLabel(topPositiveTheme.theme).toLowerCase()} because they gave the team its clearest positive push.`,
    );
  } else if (strongestTacticalDriver) {
    carryForward.push(
      `Protect the details behind ${strongestTacticalDriver.label.toLowerCase()} so the most stable tactical area carries forward.`,
    );
  }

  const cleanUp: string[] = [];
  if (
    weakestCategory &&
    categoryThemeFromKey(weakestCategory.key) !== topPositiveTheme?.theme
  ) {
    cleanUp.push(
      `Review the sequences inside ${categoryLabelFromKey(weakestCategory.key).toLowerCase()} that pulled the overall score down.`,
    );
  }
  if (topNegativeTheme) {
    cleanUp.push(
      `Review the habits behind ${themeLabel(topNegativeTheme.theme).toLowerCase()} because that was the clearest net drag in this game.`,
    );
  } else if (biggestTacticalConcern) {
    cleanUp.push(
      `Address the habits behind ${biggestTacticalConcern.label.toLowerCase()} before the next game review or practice block.`,
    );
  }

  return {
    overallRead,
    worked: worked.slice(0, 3),
    hurt: hurt.slice(0, 3),
    carryForward: [...new Set(carryForward)].slice(0, 2),
    cleanUp: [...new Set(cleanUp)].slice(0, 2),
  };
}

function buildCalculationWarnings(
  scoredBaseGames: ScoredGame[],
  contextWarnings: string[],
  dataWarnings: string[],
  excludedKpis: string[],
) {
  const gameWarnings = scoredBaseGames.flatMap((game) =>
    game.warnings.map((warning) => warning.message),
  );

  const exclusionSummary =
    excludedKpis.length > 0
      ? [
          `${excludedKpis.length} KPI${excludedKpis.length === 1 ? "" : "s"} were excluded from scoring because no valid reference values were found.`,
        ]
      : [];

  return [
    ...new Set([
      ...exclusionSummary,
      ...contextWarnings.filter((warning) => !warning.includes("excluded because no valid reference values were found")),
      ...dataWarnings,
      ...gameWarnings,
    ]),
  ];
}

function formatRecord(scoredGames: ScoredGame[]) {
  const buckets = scoredGames.map((game) => game.game.resultBucket);
  const wins = buckets.filter((bucket) => bucket === "win").length;
  const losses = buckets.filter((bucket) => bucket === "loss").length;
  const ties = buckets.filter((bucket) => bucket === "tie").length;

  return `${wins}-${losses}${ties > 0 ? `-${ties}` : ""}`;
}

function buildCategoryOverview(
  scoredGames: ScoredGame[],
  seasonBaselineGames: ScoredGame[],
) {
  const categories = ["offense", "defense", "special_teams"] as const;

  function buildCategoryTrend(scores: number[]) {
    if (scores.length < 4) {
      return {
        trend: "limited_data" as const,
        trendDelta: null,
      };
    }

    const comparisonWindow = getTrendComparisonWindow(scores.length);
    if (!comparisonWindow) {
      return {
        trend: "limited_data" as const,
        trendDelta: null,
      };
    }

    const recentScores = scores.slice(-comparisonWindow);
    const previousScores = scores.slice(-comparisonWindow * 2, -comparisonWindow);

    if (!previousScores.length) {
      return {
        trend: "limited_data" as const,
        trendDelta: null,
      };
    }

    const recentAverage = averageNullable(recentScores);
    const previousAverage = averageNullable(previousScores);

    if (!hasValue(recentAverage) || !hasValue(previousAverage)) {
      return {
        trend: "limited_data" as const,
        trendDelta: null,
      };
    }

    const trendDelta = round(recentAverage - previousAverage, 1);

    return {
      trend:
        trendDelta >= 3
          ? ("improving" as const)
          : trendDelta <= -3
            ? ("declining" as const)
            : ("stable" as const),
      trendDelta,
    };
  }

  return categories.map((category) => {
    const score = averageNullable(
      scoredGames.map((game) => game.categoryScores[category].score),
    );
    const baselineScore = averageNullable(
      seasonBaselineGames.map((game) => game.categoryScores[category].score),
    );
    const delta =
      hasValue(score) && hasValue(baselineScore)
        ? round(score - baselineScore, 1)
        : null;
    const status =
      !hasValue(score)
        ? "insufficient_data"
        : delta !== null && delta >= 2.5
          ? "strength"
          : delta !== null && delta <= -2.5
            ? "concern"
            : "stable";
    const sparkline = scoredGames
      .map((game) => game.categoryScores[category].score)
      .filter(hasValue);
    const categoryTrend = buildCategoryTrend(sparkline);

    return {
      category,
      label: CATEGORY_METADATA[category].label,
      score,
      baselineScore,
      delta,
      status,
      trend: categoryTrend.trend,
      trendDelta: categoryTrend.trendDelta,
      sparkline,
      descriptor: CATEGORY_METADATA[category].shortDescription,
    } satisfies CategoryOverviewRow;
  });
}

function buildTacticalSummary(analyticsRows: AnalyticsBundle["tacticalDrivers"]) {
  const strongest =
    analyticsRows.find((row) => row.status === "strength") ??
    [...analyticsRows]
      .filter((row) => hasValue(row.score))
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))[0];
  const concern =
    analyticsRows.find((row) => row.status === "concern") ??
    [...analyticsRows]
      .filter((row) => hasValue(row.score))
      .sort((left, right) => (left.score ?? 0) - (right.score ?? 0))[0];

  const summary =
    strongest || concern
      ? `${strongest ? `${strongest.label} is strongest` : "No clear tactical strength surfaced"}${strongest && concern ? "; " : "."}${
          concern ? `${concern.label} needs the most attention.` : ""
        }`
      : "Insufficient data to summarize tactical drivers.";

  return {
    strongest: strongest?.label ?? null,
    concern: concern?.label ?? null,
    summary,
  };
}

function buildQuickSummary(params: {
  trend: ReturnType<typeof trendDirection>;
  recentWindowAverage: number | null;
  seasonAverage: number | null;
  categoryOverview: CategoryOverviewRow[];
  tacticalSummary: AnalyticsBundle["tacticalSummary"];
  topDrivers: DriverInsight[];
  improvementAreas: DriverInsight[];
}) {
  const bullets: string[] = [];

  bullets.push(
    params.trend.direction === "improving"
      ? "The team is trending upward in the current view."
      : params.trend.direction === "declining"
        ? "The team is trending downward in the current view."
        : "Overall form is holding fairly steady right now.",
  );

  if (hasValue(params.recentWindowAverage) && hasValue(params.seasonAverage)) {
    const diff = round(params.recentWindowAverage - params.seasonAverage, 1);
    bullets.push(
      diff >= 2
        ? `Recent form is ${diff.toFixed(1)} points above the season average.`
        : diff <= -2
          ? `Recent form is ${Math.abs(diff).toFixed(1)} points below the season average.`
          : "Recent form is tracking close to the season average.",
    );
  }

  const strongestCategory =
    params.categoryOverview.find((row) => row.status === "strength") ??
    [...params.categoryOverview]
      .filter((row) => hasValue(row.score))
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))[0];
  if (strongestCategory) {
    bullets.push(`${strongestCategory.label} is the clearest category strength right now.`);
  }

  const mainConcern =
    params.categoryOverview.find((row) => row.status === "concern") ??
    (params.tacticalSummary.concern
      ? { label: params.tacticalSummary.concern }
      : null);
  if (mainConcern) {
    bullets.push(`${mainConcern.label} is the clearest current concern.`);
  }

  if (params.topDrivers[0] || params.improvementAreas[0]) {
    bullets.push(
      `${params.topDrivers[0] ? `${params.topDrivers[0].name} is lifting the profile` : "No standout positive KPI surfaced"}${params.topDrivers[0] && params.improvementAreas[0] ? ", while " : "."}${
        params.improvementAreas[0]
          ? `${params.improvementAreas[0].name} remains the main KPI drag.`
          : ""
      }`,
    );
  }

  return bullets.slice(0, 5);
}

function categoryExtremes(game: ScoredGame) {
  const rows = [
    { label: "Offense", score: game.categoryScores.offense.score },
    { label: "Defense", score: game.categoryScores.defense.score },
    { label: "Special Teams", score: game.categoryScores.special_teams.score },
  ].filter((row) => hasValue(row.score));

  return {
    strongestCategory:
      [...rows].sort((left, right) => (right.score ?? 0) - (left.score ?? 0))[0]?.label ?? null,
    weakestCategory:
      [...rows].sort((left, right) => (left.score ?? 0) - (right.score ?? 0))[0]?.label ?? null,
  };
}

export function buildAnalyticsBundle(
  games: GameRecord[],
  weights: KpiWeight[],
  filters: DashboardFilters,
  demoMode: boolean,
): AnalyticsBundle {
  const sortedGames = [...games].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const seasonScopedGames =
    filters.season === "all"
      ? sortedGames
      : sortedGames.filter((game) => game.season === filters.season);
  const baseFilteredGames = applyBaseFilters(sortedGames, filters);
  const scoringReference = seasonScopedGames.length ? seasonScopedGames : sortedGames;
  const context = buildScoringContext(scoringReference, weights);
  const scoredBaseGamesAll = scoreGamesWithContext(baseFilteredGames, context);
  const scoredBaseGames = scoredBaseGamesAll.filter((game) => hasValue(game.overallScore));
  const seasonBaselineScoredGames = seasonScopedGames.length
    ? scoreGamesWithContext(seasonScopedGames, context)
    : scoredBaseGamesAll;
  const filteredContextGames = applyRangeFilter(scoredBaseGamesAll, filters);
  const scoredGames = applyRangeFilter(scoredBaseGames, filters);
  const latestGame = scoredGames.at(-1) ?? null;
  const incompleteGamesCount = scoredBaseGamesAll.length - scoredBaseGames.length;
  const overallScores = scoredBaseGames
    .map((game) => game.overallScore)
    .filter(hasValue);
  const recentWindowAverage = averageNullable(
    takeLast(scoredGames, TREND_WINDOW_GAMES).map((game) => game.overallScore),
  );
  const seasonAverage = averageNullable(overallScores);
  const trend = trendDirection(overallScores);
  const latestKpis = latestGame?.kpis ?? [];
  const topDrivers = buildDriverInsights(latestKpis, "positive");
  const improvementAreas = buildDriverInsights(latestKpis, "negative");
  const dataAudit = buildDatasetAuditSummary(sortedGames, weights);
  const dataWarnings = [
    ...(dataAudit.unmatchedStatKeys.length
      ? [
          `${dataAudit.unmatchedStatKeys.length} saved stat key${dataAudit.unmatchedStatKeys.length === 1 ? "" : "s"} do not match the current KPI model.`,
        ]
      : []),
    ...(dataAudit.missingWeightNames.length
      ? [
          `${dataAudit.missingWeightNames.length} weighted KPI${dataAudit.missingWeightNames.length === 1 ? "" : "s"} have no valid saved values in the current dataset.`,
        ]
      : []),
    ...(incompleteGamesCount
      ? [
          `${incompleteGamesCount} saved game${incompleteGamesCount === 1 ? "" : "s"} have no usable KPI data and were excluded from score trends and summary cards.`,
        ]
      : []),
  ];
  const calculationWarnings = buildCalculationWarnings(
    scoredBaseGamesAll,
    formatWarnings(context.warnings),
    dataWarnings,
    context.excludedKpis,
  );
  const tacticalDrivers = buildTacticalDriverRows(
    scoredGames,
    seasonBaselineScoredGames,
    weights,
  );
  const tacticalSummary = buildTacticalSummary(tacticalDrivers);
  const tacticalUnassignedKpis = getUnassignedTacticalKpis(weights).map(
    (weight) => weight.name,
  );
  const categoryOverview = buildCategoryOverview(
    scoredGames,
    seasonBaselineScoredGames,
  );
  const recordLabel = formatRecord(scoredGames);
  const quickSummary = buildQuickSummary({
    trend,
    recentWindowAverage,
    seasonAverage,
    categoryOverview,
    tacticalSummary,
    topDrivers,
    improvementAreas,
  });

  logCalculationDebug("bundle", {
    filters,
    gamesLoaded: dataAudit.gamesLoaded,
    statsLoaded: dataAudit.statsLoaded,
    matchedWeights: dataAudit.matchedWeights,
    unmatchedStatKeys: dataAudit.unmatchedStatKeys,
    missingWeightNames: dataAudit.missingWeightNames,
    invalidStatCount: dataAudit.invalidStatCount,
    excludedKpis: dataAudit.excludedKpis,
    referenceGames: scoringReference.length,
    filteredGames: baseFilteredGames.length,
    scoredGames: scoredGames.length,
    latestGameScore: latestGame?.overallScore ?? null,
  });

  return {
    filters,
    filterOptions: {
      seasons: [...new Set(sortedGames.map((game) => game.season))].sort().reverse(),
      opponents: [...new Set(sortedGames.map((game) => game.opponent))].sort(),
    },
    isDemoMode: demoMode,
    weights,
    allGamesCount: sortedGames.length,
    filteredGamesCount: scoredGames.length,
    scoredGames,
    filteredContextGames,
    latestGame,
    lastGameScore: latestGame?.overallScore ?? null,
    recentWindowAverage,
    seasonAverage,
    trendDirection: trend.direction,
    trendDelta: trend.delta,
    recordLabel,
    categoryAverages: {
      offense: averageNullable(
        scoredGames.map((game) => game.categoryScores.offense.score),
      ),
      defense: averageNullable(
        scoredGames.map((game) => game.categoryScores.defense.score),
      ),
      special_teams: averageNullable(
        scoredGames.map((game) => game.categoryScores.special_teams.score),
      ),
    },
    categoryOverview,
    seasonBaselineScoredGames,
    tacticalDrivers,
    tacticalUnassignedKpis,
    quickSummary,
    tacticalSummary,
    topDrivers,
    improvementAreas,
    calculationWarnings,
    dataWarnings,
    calculationAudit: dataAudit,
    trendSeries: scoredBaseGames.map((game, index, items) => {
      const priorScores = items
        .slice(0, index + 1)
        .map((entry) => entry.overallScore)
        .filter(hasValue);
      const snapshot = trendDirection(priorScores);
      const extremes = categoryExtremes(game);

      return {
        id: game.game.id,
        date: game.game.date,
        label: format(new Date(game.game.date), "MMM d"),
        score: game.overallScore,
        rollingAverage: averageNullable(
          items
            .slice(Math.max(0, index - (TREND_WINDOW_GAMES - 1)), index + 1)
            .map((entry) => entry.overallScore),
        ),
        opponent: game.game.opponent,
        result: game.game.result,
        trendDirection: snapshot.direction,
        trendDelta: snapshot.delta,
        strongestCategory: extremes.strongestCategory,
        weakestCategory: extremes.weakestCategory,
        warnings: game.warnings.map((warning) => warning.message),
      };
    }),
    recentGames: [...takeLast(scoredBaseGames, 8)]
      .reverse()
      .map((game) => ({
        id: game.game.id,
        date: game.game.date,
        opponent: game.game.opponent,
        result: game.game.result,
        homeAway: game.game.homeAway,
        score: game.overallScore,
        season: game.game.season,
        warnings: game.warnings.map((warning) => warning.message),
      })),
    kpiSummary: weights
      .filter((weight) => weight.includeInScore)
      .map((weight) => {
        const matchingKpis = scoredBaseGames
          .map((game) => game.kpis.find((kpi) => kpi.name === weight.name))
          .filter((kpi): kpi is NonNullable<typeof kpi> => Boolean(kpi));
        const validKpis = matchingKpis.filter(
          (kpi) => hasValue(kpi.normalizedScore) && kpi.available,
        );
        const latestKpi = latestKpis.find((kpi) => kpi.name === weight.name);

        return {
          key: weight.key,
          name: weight.name,
          category: weight.category,
          weight: weight.weight,
          rValue: weight.rValue,
          direction: weight.direction,
          latestRaw: latestKpi?.rawValue ?? null,
          latestNormalized: latestKpi?.normalizedScore ?? null,
          latestWeighted: latestKpi?.weightedScore ?? null,
          averageNormalized: averageNullable(
            validKpis.map((kpi) => kpi.normalizedScore),
          ),
          availableGames: validKpis.length,
        };
      })
      .sort((left, right) => right.weight - left.weight),
    summary: summarizeGamePerformance(
      latestGame,
      topDrivers,
      improvementAreas,
      trend.direction,
    ),
  };
}

export function splitByHomeAway(games: ScoredGame[], homeAway: HomeAway) {
  return games.filter((game) => game.game.homeAway === homeAway);
}
