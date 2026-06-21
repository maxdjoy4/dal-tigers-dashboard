import { clamp, round } from "@/lib/utils";
import {
  canonicalizePlayerGoalieColumn,
  goalieSourceColumnMap,
  skaterSourceColumnMap,
} from "@/lib/player-goalie-reference";
import type {
  CalculatedPlayerMetricRow,
  CategoryScoreSummary,
  ParsedGoalieSeasonStat,
  ParsedPlayerSeasonStat,
  PlayerGoalieModelType,
  PlayerGoalieScoreRow,
  PlayerMetricWeightRow,
  PositionBucket,
} from "@/lib/player-goalie-types";

type RawStatsRecord = Record<string, string | number | null>;

interface EntityInputRow {
  season: string;
  entityName: string;
  modelType: PlayerGoalieModelType;
  position: PositionBucket;
  gamesPlayed: number | null;
  toiSeconds: number | null;
  raw: RawStatsRecord;
}

interface EntityCalculationResult {
  metrics: CalculatedPlayerMetricRow[];
  score: PlayerGoalieScoreRow;
}

const GOALIE_SAMPLE_BASELINES: Record<string, number> = {
  save_pct_adj: 0.9,
  scoring_chance_save_pct_adj: 0.78,
  goalie_pass_accuracy_adj: 0.72,
  shootout_save_pct_adj: 0.67,
};

const ADJUSTED_RATE_SAMPLE_WEIGHTS: Record<string, number> = {
  save_pct_adj: 100,
  scoring_chance_save_pct_adj: 25,
  accurate_pass_pct_adj: 30,
  goalie_pass_accuracy_adj: 30,
  adjusted_battle_win_pct: 10,
  corsi_for_pct_adj: 50,
  fenwick_for_pct_adj: 50,
  shootout_save_pct_adj: 10,
};

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeDivide(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

function toMinutes(seconds: number | null) {
  if (seconds === null || seconds <= 0) {
    return null;
  }

  return seconds / 60;
}

function per60(value: number | null, toiSeconds: number | null) {
  const minutes = toMinutes(toiSeconds);
  if (value === null || minutes === null || minutes <= 0) {
    return null;
  }

  return (value / minutes) * 60;
}

function buildSourceValueResolver(modelType: PlayerGoalieModelType, raw: RawStatsRecord) {
  const sourceMap = modelType === "Goalie" ? goalieSourceColumnMap : skaterSourceColumnMap;

  return (sourceColumn: string) => {
    const metricKey = sourceMap.get(canonicalizePlayerGoalieColumn(sourceColumn));
    if (metricKey && metricKey in raw) {
      return safeNumber(raw[metricKey]);
    }

    if (sourceColumn in raw) {
      return safeNumber(raw[sourceColumn]);
    }

    const canonicalSource = canonicalizePlayerGoalieColumn(sourceColumn);
    for (const [key, value] of Object.entries(raw)) {
      if (canonicalizePlayerGoalieColumn(key) === canonicalSource) {
        return safeNumber(value);
      }
    }

    return null;
  };
}

function defaultAdjustedRateBaseline(metricKey: string) {
  if (metricKey in GOALIE_SAMPLE_BASELINES) {
    return GOALIE_SAMPLE_BASELINES[metricKey];
  }

  if (metricKey.includes("pass")) {
    return 0.75;
  }

  if (metricKey.includes("battle")) {
    return 0.5;
  }

  if (metricKey.includes("corsi") || metricKey.includes("fenwick")) {
    return 0.5;
  }

  return 0.5;
}

function adjustedRate(
  numerator: number | null,
  denominator: number | null,
  baselineRate: number,
  sampleWeight: number,
  fallbackRate: number | null,
) {
  if (denominator === null || denominator <= 0) {
    return fallbackRate;
  }

  if (numerator === null) {
    return fallbackRate;
  }

  return (numerator + baselineRate * sampleWeight) / (denominator + sampleWeight);
}

function inferRawRate(
  weight: PlayerMetricWeightRow,
  raw: RawStatsRecord,
): number | null {
  const getSourceValue = buildSourceValueResolver(weight.modelType, raw);
  const sources = weight.sourceColumnsRequired.map((source) => getSourceValue(source));

  if (weight.metricKey === "corsi_for_pct_adj" || weight.metricKey === "fenwick_for_pct_adj") {
    const forEvents = sources[0];
    const againstEvents = sources[1];
    const fallbackPct = sources[2] ?? null;
    return safeDivide(forEvents, forEvents !== null && againstEvents !== null ? forEvents + againstEvents : null) ??
      fallbackPct;
  }

  if (weight.normalization === "adjusted_percentage") {
    const fallbackRate = sources.at(-1) ?? null;
    const denominator = sources[0] ?? null;
    const numerator = sources[1] ?? null;
    return safeDivide(numerator, denominator) ?? fallbackRate;
  }

  if (weight.metricKey === "shootout_save_pct_adj") {
    const saves = sources[0] ?? null;
    const attempts = sources[1] ?? sources[2] ?? null;
    return safeDivide(saves, attempts);
  }

  return null;
}

function buildAdjustedRateBaselines(
  rows: EntityInputRow[],
  weights: PlayerMetricWeightRow[],
) {
  const baselines = new Map<string, number>();

  for (const weight of weights.filter(
    (item) => item.normalization === "adjusted_percentage",
  )) {
    const key = `${weight.modelType}:${weight.metricKey}`;
    const values = rows
      .filter((row) => row.modelType === weight.modelType)
      .map((row) => inferRawRate(weight, row.raw))
      .filter((value): value is number => value !== null && Number.isFinite(value));

    const baseline =
      values.length > 0
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : defaultAdjustedRateBaseline(weight.metricKey);

    baselines.set(key, baseline);
  }

  return baselines;
}

function calculateCompositeMetric(
  weight: PlayerMetricWeightRow,
  row: EntityInputRow,
): number | null {
  const getSourceValue = buildSourceValueResolver(weight.modelType, row.raw);
  const retrievals = getSourceValue("EV DZ retrievals");
  const losses =
    getSourceValue("Puck losses DZ") ??
    getSourceValue("DZ losses") ??
    getSourceValue("Puck losses in DZ");
  const opponentXg =
    getSourceValue("Opponent's xG when on ice") ??
    getSourceValue("Opp xG") ??
    getSourceValue("Opponent's xG");

  const retrievalRate = per60(retrievals, row.toiSeconds);
  const lossesRate = per60(losses, row.toiSeconds);
  const opponentXgRate = per60(opponentXg, row.toiSeconds) ?? opponentXg;

  if (retrievalRate === null) {
    return null;
  }

  return retrievalRate - (lossesRate ?? 0) * 0.75 - (opponentXgRate ?? 0) * 0.35;
}

function calculateMetricValue(
  weight: PlayerMetricWeightRow,
  row: EntityInputRow,
  adjustedBaselines: Map<string, number>,
) {
  const getSourceValue = buildSourceValueResolver(weight.modelType, row.raw);
  const sources = weight.sourceColumnsRequired.map((source) => getSourceValue(source));
  const adjustedBaseline =
    adjustedBaselines.get(`${weight.modelType}:${weight.metricKey}`) ??
    defaultAdjustedRateBaseline(weight.metricKey);
  const fallbackRate = sources.at(-1) ?? null;

  switch (weight.metricKey) {
    case "corsi_for_pct_adj": {
      const forEvents = sources[0] ?? null;
      const againstEvents = sources[1] ?? null;
      const denominator =
        forEvents !== null && againstEvents !== null ? forEvents + againstEvents : null;
      return adjustedRate(
        forEvents,
        denominator,
        adjustedBaseline,
        ADJUSTED_RATE_SAMPLE_WEIGHTS.corsi_for_pct_adj,
        fallbackRate,
      );
    }
    case "fenwick_for_pct_adj": {
      const forEvents = sources[0] ?? null;
      const againstEvents = sources[1] ?? null;
      const denominator =
        forEvents !== null && againstEvents !== null ? forEvents + againstEvents : null;
      return adjustedRate(
        forEvents,
        denominator,
        adjustedBaseline,
        ADJUSTED_RATE_SAMPLE_WEIGHTS.fenwick_for_pct_adj,
        fallbackRate,
      );
    }
    case "accurate_pass_pct_adj":
    case "goalie_pass_accuracy_adj":
    case "adjusted_battle_win_pct":
    case "save_pct_adj":
    case "scoring_chance_save_pct_adj":
    case "shootout_save_pct_adj": {
      const denominator =
        weight.metricKey === "shootout_save_pct_adj" ? sources[2] ?? sources[1] : sources[0];
      const numerator =
        weight.metricKey === "shootout_save_pct_adj" ? sources[0] : sources[1];
      return adjustedRate(
        numerator,
        denominator,
        adjustedBaseline,
        ADJUSTED_RATE_SAMPLE_WEIGHTS[weight.metricKey] ?? 20,
        fallbackRate,
      );
    }
    case "gsae_per60": {
      const xgConceded = sources[0] ?? null;
      const goalsAgainst = sources[1] ?? null;
      const difference =
        xgConceded !== null && goalsAgainst !== null ? xgConceded - goalsAgainst : null;
      return per60(difference, row.toiSeconds);
    }
    case "ga_vs_xg_index": {
      const goalsAgainst = sources[0] ?? null;
      const xgConceded = sources[1] ?? null;
      return xgConceded !== null && goalsAgainst !== null
        ? xgConceded - goalsAgainst
        : null;
    }
    case "scoring_chance_goals_against_per60_inv": {
      const total = sources[0] ?? null;
      const saves = sources[1] ?? null;
      return per60(
        total !== null && saves !== null ? total - saves : null,
        row.toiSeconds,
      );
    }
    case "toi_minutes_reliability":
      return toMinutes(row.toiSeconds);
    case "games_played_reliability":
      return row.gamesPlayed;
    case "ev_dz_retrievals_context_adj":
      return calculateCompositeMetric(weight, row);
    default:
      break;
  }

  if (
    weight.normalization === "per_60" ||
    weight.normalization === "per_60_context" ||
    weight.normalization === "per_60_inverted"
  ) {
    return per60(sources[0], row.toiSeconds);
  }

  if (weight.normalization === "difference") {
    return sources[0] !== null && sources[1] !== null ? sources[0] - sources[1] : null;
  }

  if (
    weight.normalization === "rate" ||
    weight.normalization === "rate_context" ||
    weight.normalization === "context" ||
    weight.normalization === "usage"
  ) {
      return sources[0] ?? null;
  }

  if (
    weight.normalization === "composite" ||
    weight.normalization === "custom_composite"
  ) {
    return calculateCompositeMetric(weight, row);
  }

  return sources[0] ?? null;
}

function percentile(values: number[], target: number) {
  const less = values.filter((value) => value < target).length;
  const equal = values.filter((value) => value === target).length;
  return ((less + equal / 2) / values.length) * 100;
}

function resolveMetricScore(
  weight: PlayerMetricWeightRow,
  value: number | null,
  comparableValues: number[],
) {
  if (value === null || comparableValues.length < 2) {
    return null;
  }

  const percentileScore = percentile(comparableValues, value);

  if (weight.direction === "lower_is_better") {
    return clamp(100 - percentileScore, 0, 100);
  }

  if (weight.direction === "higher_is_better") {
    return clamp(percentileScore, 0, 100);
  }

  return null;
}

function resolveReliability(row: EntityInputRow) {
  const minutes = toMinutes(row.toiSeconds);
  const minuteThreshold = row.modelType === "Goalie" ? 400 : 300;
  const gameThreshold = row.modelType === "Goalie" ? 8 : 10;
  const components = [
    minutes === null ? null : clamp((minutes / minuteThreshold) * 100, 0, 100),
    row.gamesPlayed === null
      ? null
      : clamp((row.gamesPlayed / gameThreshold) * 100, 0, 100),
  ].filter((value): value is number => value !== null);

  if (!components.length) {
    return {
      score: null,
      flag: "Limited sample",
    };
  }

  const score = components.reduce((sum, value) => sum + value, 0) / components.length;
  const flag =
    score >= 80 ? "Established sample" : score >= 50 ? "Developing sample" : "Limited sample";

  return {
    score: round(score, 1),
    flag,
  };
}

function buildCategoryScores(
  modelType: PlayerGoalieModelType,
  metrics: CalculatedPlayerMetricRow[],
  weights: PlayerMetricWeightRow[],
): CategoryScoreSummary[] {
  const applicableWeights = weights.filter(
    (weight) => weight.modelType === modelType && weight.includeInV1Score,
  );
  const categories = new Map<string, PlayerMetricWeightRow[]>();

  for (const weight of applicableWeights) {
    const current = categories.get(weight.category) ?? [];
    current.push(weight);
    categories.set(weight.category, current);
  }

  return Array.from(categories.entries()).map(([category, categoryWeights]) => {
    const metricMap = new Map(metrics.map((metric) => [metric.metricKey, metric]));
    const available = categoryWeights
      .map((weight) => ({
        weight,
        metric: metricMap.get(weight.metricKey) ?? null,
      }))
      .filter(
        (entry): entry is { weight: PlayerMetricWeightRow; metric: CalculatedPlayerMetricRow } =>
          Boolean(entry.metric && entry.metric.score0100 !== null),
      );

    const totalWeight = available.reduce(
      (sum, entry) => sum + entry.weight.metricWeightInCategoryPct,
      0,
    );

    const score =
      totalWeight > 0
        ? available.reduce((sum, entry) => {
            return sum + (entry.metric.score0100 ?? 0) * entry.weight.metricWeightInCategoryPct;
          }, 0) / totalWeight
        : null;

    return {
      category,
      score: score === null ? null : round(score, 1),
      weightPct: categoryWeights[0]?.categoryWeightPct ?? 0,
      availableMetricCount: available.length,
      totalMetricCount: categoryWeights.length,
    };
  });
}

function buildOverallScore(categoryScores: CategoryScoreSummary[]) {
  const available = categoryScores.filter((category) => category.score !== null);
  if (!available.length) {
    return null;
  }

  const totalWeight = available.reduce((sum, category) => sum + category.weightPct, 0);
  if (totalWeight <= 0) {
    return null;
  }

  const overall =
    available.reduce(
      (sum, category) => sum + (category.score ?? 0) * category.weightPct,
      0,
    ) / totalWeight;

  return round(overall, 1);
}

function sortMetricsForHighlights(metrics: CalculatedPlayerMetricRow[]) {
  return metrics
    .filter((metric) => metric.includeInScore && metric.score0100 !== null)
    .sort((left, right) => (right.score0100 ?? 0) - (left.score0100 ?? 0));
}

function buildEntityScore(
  row: EntityInputRow,
  metrics: CalculatedPlayerMetricRow[],
  weights: PlayerMetricWeightRow[],
): PlayerGoalieScoreRow {
  const categoryScores = buildCategoryScores(row.modelType, metrics, weights);
  const sortedMetrics = sortMetricsForHighlights(metrics);
  const reliability = resolveReliability(row);

  return {
    season: row.season,
    entityName: row.entityName,
    modelType: row.modelType,
    overallScore: buildOverallScore(categoryScores),
    categoryScores,
    strongestKpis: sortedMetrics.slice(0, 5),
    developmentKpis: [...sortedMetrics].reverse().slice(0, 5),
    reliabilityScore: reliability.score,
    reliabilityFlag: reliability.flag,
    contextFlags: {
      trackedMetricCount: metrics.filter((metric) => metric.includeInScore).length,
      scoredMetricCount: metrics.filter(
        (metric) => metric.includeInScore && metric.score0100 !== null,
      ).length,
      position: row.position,
    },
  };
}

function buildRowsFromPlayerStats(stats: ParsedPlayerSeasonStat[]): EntityInputRow[] {
  return stats.map((row) => ({
    season: row.season,
    entityName: row.playerName,
    modelType: row.position === "D" ? "Defense" : "Forward",
    position: row.position,
    gamesPlayed: row.gamesPlayed,
    toiSeconds: row.toiSeconds,
    raw: row.raw,
  }));
}

function buildRowsFromGoalieStats(stats: ParsedGoalieSeasonStat[]): EntityInputRow[] {
  return stats.map((row) => ({
    season: row.season,
    entityName: row.playerName,
    modelType: "Goalie",
    position: "G",
    gamesPlayed: row.gamesPlayed,
    toiSeconds: row.toiSeconds,
    raw: row.raw,
  }));
}

function buildScoresForRows(
  rows: EntityInputRow[],
  weights: PlayerMetricWeightRow[],
): EntityCalculationResult[] {
  const adjustedBaselines = buildAdjustedRateBaselines(rows, weights);
  const rawMetricValues = new Map<string, number | null>();

  for (const row of rows) {
    const applicableWeights = weights.filter((weight) => weight.modelType === row.modelType);
    for (const weight of applicableWeights) {
      const calculatedValue = calculateMetricValue(weight, row, adjustedBaselines);
      rawMetricValues.set(
        `${row.modelType}:${row.entityName}:${weight.metricKey}`,
        calculatedValue,
      );
    }
  }

  const comparableValues = new Map<string, number[]>();
  for (const weight of weights.filter((item) => item.includeInV1Score)) {
    const values = rows
      .filter((row) => row.modelType === weight.modelType)
      .map((row) => rawMetricValues.get(`${row.modelType}:${row.entityName}:${weight.metricKey}`))
      .filter((value): value is number => value !== null && Number.isFinite(value));

    comparableValues.set(`${weight.modelType}:${weight.metricKey}`, values);
  }

  return rows.map((row) => {
    const metrics = weights
      .filter((weight) => weight.modelType === row.modelType)
      .map((weight) => {
        const calculatedValue =
          rawMetricValues.get(`${row.modelType}:${row.entityName}:${weight.metricKey}`) ?? null;
        const score0100 = weight.includeInV1Score
          ? resolveMetricScore(
              weight,
              calculatedValue,
              comparableValues.get(`${weight.modelType}:${weight.metricKey}`) ?? [],
            )
          : null;

        return {
          season: row.season,
          entityName: row.entityName,
          modelType: row.modelType,
          metricKey: weight.metricKey,
          displayName: weight.displayName,
          category: weight.category,
          rawValue:
            weight.sourceColumnsRequired.length > 0
              ? buildSourceValueResolver(weight.modelType, row.raw)(
                  weight.sourceColumnsRequired[0],
                )
              : null,
          calculatedValue: calculatedValue === null ? null : round(calculatedValue, 4),
          score0100: score0100 === null ? null : round(score0100, 1),
          includeInScore: weight.includeInV1Score,
          reliabilityFlag: resolveReliability(row).flag,
          context: {
            normalization: weight.normalization,
            scoreMethod: weight.scoreMethod,
            direction: weight.direction,
            finalWeightPct: weight.finalWeightPct,
          },
        } satisfies CalculatedPlayerMetricRow;
      });

    return {
      metrics,
      score: buildEntityScore(row, metrics, weights),
    };
  });
}

export function buildPlayerScores(
  stats: ParsedPlayerSeasonStat[],
  weights: PlayerMetricWeightRow[],
) {
  const rows = buildRowsFromPlayerStats(stats);
  return buildScoresForRows(rows, weights.filter((weight) => weight.modelType !== "Goalie"));
}

export function buildGoalieScores(
  stats: ParsedGoalieSeasonStat[],
  weights: PlayerMetricWeightRow[],
) {
  const rows = buildRowsFromGoalieStats(stats);
  return buildScoresForRows(rows, weights.filter((weight) => weight.modelType === "Goalie"));
}
