import type {
  CalculationWarning,
  CategoryScoreDetail,
  GameRecord,
  KpiScore,
  KpiWeight,
  ScoredGame,
  ScoreCategory,
  TacticalGroup,
  TacticalGroupScoreDetail,
} from "@/lib/types";
import {
  isSupportStatName,
  PENALTY_KILL_DEPENDENT_KPI_KEYS,
  POWER_PLAY_DEPENDENT_KPI_KEYS,
} from "@/lib/support-stats";
import { TACTICAL_GROUP_ORDER } from "@/lib/category-metadata";
import { resolveTacticalGroup } from "@/lib/tactical-groups";
import { average, clamp, round } from "@/lib/utils";

const COVERAGE_WARNING_THRESHOLD = 0.6;

interface WeightRange {
  min: number;
  max: number;
}

export interface ScoringContext {
  referenceGames: GameRecord[];
  includedWeights: KpiWeight[];
  activeWeights: KpiWeight[];
  activeWeightByName: Map<string, KpiWeight>;
  ranges: Record<string, WeightRange>;
  referenceWeightShareByName: Map<string, number>;
  warnings: CalculationWarning[];
  excludedKpis: string[];
}

export interface DatasetAuditSummary {
  gamesLoaded: number;
  statsLoaded: number;
  matchedWeights: number;
  unmatchedStatKeys: string[];
  missingWeightNames: string[];
  invalidStatCount: number;
  excludedKpis: string[];
}

function createWarning(
  warning: Omit<CalculationWarning, "severity"> & {
    severity?: CalculationWarning["severity"];
  },
): CalculationWarning {
  return {
    severity: warning.severity ?? "warning",
    ...warning,
  };
}

export function hasValue(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && !Number.isNaN(value);
}

export function formatGameDateLabel(dateValue: string) {
  return dateValue.slice(0, 10);
}

export function effectiveWeight(weight: KpiWeight) {
  const coachingFactor =
    weight.coachingAdjustment && weight.coachingAdjustment > 0
      ? weight.coachingAdjustment
      : 1;

  return weight.weight * coachingFactor;
}

export function normalizeValue(
  value: number | null,
  range: WeightRange | undefined,
  higherIsBetter: boolean,
) {
  if (!hasValue(value) || !range) {
    return null;
  }

  if (!Number.isFinite(range.min) || !Number.isFinite(range.max) || range.min === range.max) {
    return null;
  }

  const raw = ((value - range.min) / (range.max - range.min)) * 100;
  const normalized = higherIsBetter ? raw : 100 - raw;
  return round(clamp(normalized, 0, 100), 1);
}

function buildCategoryScore(
  category: ScoreCategory,
  scoredKpis: KpiScore[],
  activeWeightByName: Map<string, KpiWeight>,
  gameId: string,
): CategoryScoreDetail {
  const notApplicableKpis = new Set(
    scoredKpis
      .filter((kpi) => kpi.exclusionReason?.startsWith("not_applicable"))
      .map((kpi) => kpi.name),
  );
  const categoryWeights = [...activeWeightByName.values()].filter(
    (weight) => weight.category === category && !notApplicableKpis.has(weight.name),
  );
  const totalWeight = categoryWeights.reduce(
    (sum, weight) => sum + effectiveWeight(weight),
    0,
  );
  const availableKpis = scoredKpis.filter(
    (kpi) =>
      kpi.category === category &&
      kpi.available &&
      hasValue(kpi.normalizedScore) &&
      activeWeightByName.has(kpi.name),
  );
  const validWeight = availableKpis.reduce((sum, kpi) => {
    const weight = activeWeightByName.get(kpi.name);
    return sum + (weight ? effectiveWeight(weight) : 0);
  }, 0);
  const coverage = totalWeight > 0 ? round(validWeight / totalWeight, 2) : null;
  const warnings: CalculationWarning[] = [];

  if (!availableKpis.length || validWeight === 0) {
    warnings.push(
      createWarning({
        code: "category_insufficient_data",
        scope: "category",
        category,
        gameId,
        message: `${category} score is unavailable because no weighted KPI values were available.`,
      }),
    );

    return {
      score: null,
      validKpis: 0,
      missingKpis: categoryWeights.length,
      validWeight,
      totalWeight,
      coverage,
      warnings,
    };
  }

  const score = round(
    availableKpis.reduce((sum, kpi) => {
      const weight = activeWeightByName.get(kpi.name);
      if (!weight || !hasValue(kpi.normalizedScore)) {
        return sum;
      }

      return sum + kpi.normalizedScore * (effectiveWeight(weight) / validWeight);
    }, 0),
    1,
  );

  if (coverage !== null && coverage < COVERAGE_WARNING_THRESHOLD) {
    warnings.push(
      createWarning({
        code: "category_low_coverage",
        scope: "category",
        category,
        gameId,
        message: `${category} score uses limited KPI coverage (${Math.round(coverage * 100)}% of weighted inputs).`,
      }),
    );
  }

  return {
    score,
    validKpis: availableKpis.length,
    missingKpis: categoryWeights.length - availableKpis.length,
    validWeight,
    totalWeight,
    coverage,
    warnings,
  };
}

function buildTacticalGroupScore(
  group: TacticalGroup,
  scoredKpis: KpiScore[],
  activeWeightByName: Map<string, KpiWeight>,
  gameId: string,
): TacticalGroupScoreDetail {
  const notApplicableKpis = new Set(
    scoredKpis
      .filter((kpi) => kpi.exclusionReason?.startsWith("not_applicable"))
      .map((kpi) => kpi.name),
  );
  const groupWeights = [...activeWeightByName.values()].filter(
    (weight) => resolveTacticalGroup(weight) === group && !notApplicableKpis.has(weight.name),
  );
  const totalWeight = groupWeights.reduce(
    (sum, weight) => sum + effectiveWeight(weight),
    0,
  );
  const availableKpis = scoredKpis.filter((kpi) => {
    const weight = activeWeightByName.get(kpi.name);
    if (!weight) {
      return false;
    }

    return (
      resolveTacticalGroup(weight) === group &&
      kpi.available &&
      hasValue(kpi.normalizedScore)
    );
  });
  const validWeight = availableKpis.reduce((sum, kpi) => {
    const weight = activeWeightByName.get(kpi.name);
    return sum + (weight ? effectiveWeight(weight) : 0);
  }, 0);
  const coverage = totalWeight > 0 ? round(validWeight / totalWeight, 2) : null;
  const warnings: CalculationWarning[] = [];

  if (!groupWeights.length) {
    return {
      score: null,
      validKpis: 0,
      missingKpis: 0,
      validWeight: 0,
      totalWeight: 0,
      coverage: null,
      strongestKpi: null,
      weakestKpi: null,
      warnings,
    };
  }

  if (!availableKpis.length || validWeight === 0) {
    warnings.push(
      createWarning({
        code: "tactical_group_insufficient_data",
        scope: "category",
        gameId,
        message: `${group} is unavailable because no weighted KPI values were available.`,
      }),
    );

    return {
      score: null,
      validKpis: 0,
      missingKpis: groupWeights.length,
      validWeight,
      totalWeight,
      coverage,
      strongestKpi: null,
      weakestKpi: null,
      warnings,
    };
  }

  const score = round(
    availableKpis.reduce((sum, kpi) => {
      const weight = activeWeightByName.get(kpi.name);
      if (!weight || !hasValue(kpi.normalizedScore)) {
        return sum;
      }

      return sum + kpi.normalizedScore * (effectiveWeight(weight) / validWeight);
    }, 0),
    1,
  );
  const strongestKpi =
    [...availableKpis].sort(
      (left, right) => (right.normalizedScore ?? 0) - (left.normalizedScore ?? 0),
    )[0]?.name ?? null;
  const weakestKpi =
    [...availableKpis].sort(
      (left, right) => (left.normalizedScore ?? 0) - (right.normalizedScore ?? 0),
    )[0]?.name ?? null;

  if (coverage !== null && coverage < COVERAGE_WARNING_THRESHOLD) {
    warnings.push(
      createWarning({
        code: "tactical_group_low_coverage",
        scope: "category",
        gameId,
        message: `${group} uses limited KPI coverage (${Math.round(coverage * 100)}% of weighted inputs).`,
      }),
    );
  }

  return {
    score,
    validKpis: availableKpis.length,
    missingKpis: groupWeights.length - availableKpis.length,
    validWeight,
    totalWeight,
    coverage,
    strongestKpi,
    weakestKpi,
    warnings,
  };
}

export function buildScoringContext(
  referenceGames: GameRecord[],
  weights: KpiWeight[],
): ScoringContext {
  const includedWeights = weights.filter((weight) => weight.includeInScore);
  const warnings: CalculationWarning[] = [];
  const ranges: Record<string, WeightRange> = {};
  const activeWeights: KpiWeight[] = [];
  const excludedKpis: string[] = [];

  for (const weight of includedWeights) {
    const values = referenceGames
      .map((game) => game.stats[weight.name])
      .filter(hasValue);

    if (!values.length) {
      excludedKpis.push(weight.name);
      warnings.push(
        createWarning({
          code: "kpi_missing_reference_values",
          scope: "kpi",
          kpiKey: weight.key,
          message: `${weight.name} was excluded because no valid reference values were found.`,
        }),
      );
      continue;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);

    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
      excludedKpis.push(weight.name);
      warnings.push(
        createWarning({
          code: "kpi_flat_reference_range",
          scope: "kpi",
          kpiKey: weight.key,
          message: `${weight.name} was excluded because its reference range is flat and cannot be normalized reliably.`,
        }),
      );
      continue;
    }

    activeWeights.push(weight);
    ranges[weight.name] = { min, max };
  }

  const totalReferenceWeight = activeWeights.reduce(
    (sum, weight) => sum + effectiveWeight(weight),
    0,
  );
  const referenceWeightShareByName = new Map(
    activeWeights.map((weight) => [
      weight.name,
      totalReferenceWeight > 0 ? effectiveWeight(weight) / totalReferenceWeight : 0,
    ]),
  );
  const activeWeightByName = new Map(
    activeWeights.map((weight) => [weight.name, weight] as const),
  );

  return {
    referenceGames,
    includedWeights,
    activeWeights,
    activeWeightByName,
    ranges,
    referenceWeightShareByName,
    warnings,
    excludedKpis,
  };
}

function getOpportunityAwareExclusionReason(
  game: GameRecord,
  weight: KpiWeight,
) {
  const powerPlayOpportunities = hasValue(game.stats["Power play"])
    ? game.stats["Power play"]
    : null;
  if (
    POWER_PLAY_DEPENDENT_KPI_KEYS.has(weight.key) &&
    powerPlayOpportunities !== null &&
    powerPlayOpportunities <= 0
  ) {
    return "not_applicable_no_power_play";
  }

  const shortHandedSituations = hasValue(game.stats["Short-handed"])
    ? game.stats["Short-handed"]
    : null;
  if (
    PENALTY_KILL_DEPENDENT_KPI_KEYS.has(weight.key) &&
    shortHandedSituations !== null &&
    shortHandedSituations <= 0
  ) {
    return "not_applicable_no_penalty_kill";
  }

  return null;
}

export function scoreGamesWithContext(
  targetGames: GameRecord[],
  context: ScoringContext,
): ScoredGame[] {
  return targetGames.map((game) => {
    const activeApplicableWeights = context.activeWeights.filter(
      (weight) => !getOpportunityAwareExclusionReason(game, weight),
    );
    const activeGameWeights = activeApplicableWeights.filter((weight) =>
      hasValue(game.stats[weight.name]),
    );
    const totalWeightUsed = activeGameWeights.reduce(
      (sum, weight) => sum + effectiveWeight(weight),
      0,
    );
    const totalWeightAvailable = activeApplicableWeights.reduce(
      (sum, weight) => sum + effectiveWeight(weight),
      0,
    );

    const kpis: KpiScore[] = context.includedWeights.map((weight) => {
      const rawValue = hasValue(game.stats[weight.name]) ? game.stats[weight.name]! : null;
      const opportunityAwareExclusion = getOpportunityAwareExclusionReason(game, weight);

      if (!context.activeWeightByName.has(weight.name)) {
        return {
          key: weight.key,
          name: weight.name,
          category: weight.category,
          weight: weight.weight,
          rValue: weight.rValue,
          direction: weight.direction,
          rawValue,
          normalizedScore: null,
          weightedScore: null,
          impact: null,
          available: false,
          exclusionReason: "reference_unavailable",
        };
      }

      if (opportunityAwareExclusion) {
        return {
          key: weight.key,
          name: weight.name,
          category: weight.category,
          weight: weight.weight,
          rValue: weight.rValue,
          direction: weight.direction,
          rawValue,
          normalizedScore: null,
          weightedScore: null,
          impact: null,
          available: false,
          exclusionReason: opportunityAwareExclusion,
        };
      }

      if (!hasValue(rawValue)) {
        return {
          key: weight.key,
          name: weight.name,
          category: weight.category,
          weight: weight.weight,
          rValue: weight.rValue,
          direction: weight.direction,
          rawValue: null,
          normalizedScore: null,
          weightedScore: null,
          impact: null,
          available: false,
          exclusionReason: "missing_value",
        };
      }

      const normalizedScore = normalizeValue(
        rawValue,
        context.ranges[weight.name],
        weight.direction === "higher_is_better",
      );

      if (!hasValue(normalizedScore) || totalWeightUsed === 0) {
        return {
          key: weight.key,
          name: weight.name,
          category: weight.category,
          weight: weight.weight,
          rValue: weight.rValue,
          direction: weight.direction,
          rawValue,
          normalizedScore: null,
          weightedScore: null,
          impact: null,
          available: false,
          exclusionReason: "normalization_unavailable",
        };
      }

      const normalizedWeight = effectiveWeight(weight) / totalWeightUsed;
      const weightedScore = round(normalizedScore * normalizedWeight, 2);
      const impact = round((normalizedScore - 50) * normalizedWeight, 2);

      return {
        key: weight.key,
        name: weight.name,
        category: weight.category,
        weight: weight.weight,
        rValue: weight.rValue,
        direction: weight.direction,
        rawValue,
        normalizedScore,
        weightedScore,
        impact,
        available: true,
        exclusionReason: null,
      };
    });

    const coverage =
      totalWeightAvailable > 0 ? round(totalWeightUsed / totalWeightAvailable, 2) : null;
    const validKpiCount = kpis.filter((kpi) => kpi.available).length;
    const warnings: CalculationWarning[] = [];

    if (!validKpiCount || totalWeightUsed === 0) {
      warnings.push(
        createWarning({
          code: "game_insufficient_data",
          scope: "game",
          gameId: game.id,
          message: `No valid KPI values were available to score ${game.opponent} on ${formatGameDateLabel(game.date)}.`,
        }),
      );
    } else if (coverage !== null && coverage < COVERAGE_WARNING_THRESHOLD) {
      warnings.push(
        createWarning({
          code: "game_low_coverage",
          scope: "game",
          gameId: game.id,
          message: `This game score uses limited KPI coverage (${Math.round(coverage * 100)}% of weighted inputs).`,
        }),
      );
    }

    const categoryScores = {
      offense: buildCategoryScore("offense", kpis, context.activeWeightByName, game.id),
      defense: buildCategoryScore("defense", kpis, context.activeWeightByName, game.id),
      special_teams: buildCategoryScore(
        "special_teams",
        kpis,
        context.activeWeightByName,
        game.id,
      ),
    };
    const tacticalGroupScores = Object.fromEntries(
      TACTICAL_GROUP_ORDER.map((group) => [
        group,
        buildTacticalGroupScore(group, kpis, context.activeWeightByName, game.id),
      ]),
    ) as Record<TacticalGroup, TacticalGroupScoreDetail>;

    warnings.push(
      ...categoryScores.offense.warnings,
      ...categoryScores.defense.warnings,
      ...categoryScores.special_teams.warnings,
    );

    return {
      game,
      overallScore:
        totalWeightUsed > 0
          ? round(
              kpis.reduce((sum, kpi) => sum + (kpi.weightedScore ?? 0), 0),
              1,
            )
          : null,
      totalWeightUsed,
      totalWeightAvailable,
      coverage,
      validKpiCount,
      missingKpiCount: context.activeWeights.length - validKpiCount,
      warnings,
      categoryScores,
      tacticalGroupScores,
      kpis,
    } satisfies ScoredGame;
  });
}

export function averageNullable(values: Array<number | null>) {
  const presentValues = values.filter(hasValue);
  return presentValues.length ? round(average(presentValues), 1) : null;
}

export function calculateDirectionalDelta(
  focusedValue: number | null,
  baselineValue: number | null,
  higherIsBetter: boolean,
) {
  if (!hasValue(focusedValue) || !hasValue(baselineValue)) {
    return null;
  }

  return higherIsBetter ? focusedValue - baselineValue : baselineValue - focusedValue;
}

export function buildDatasetAuditSummary(
  games: GameRecord[],
  weights: KpiWeight[],
): DatasetAuditSummary {
  const weightNames = new Set(weights.map((weight) => weight.name));
  const statKeys = new Set<string>();
  let statsLoaded = 0;
  let invalidStatCount = 0;

  for (const game of games) {
    for (const [key, value] of Object.entries(game.stats)) {
      statKeys.add(key);
      statsLoaded += 1;

      if (value !== null && value !== undefined && Number.isNaN(value)) {
        invalidStatCount += 1;
      }
    }
  }

  const unmatchedStatKeys = [...statKeys]
    .filter((key) => !weightNames.has(key) && !isSupportStatName(key))
    .sort();
  const missingWeightNames = weights
    .filter((weight) => !games.some((game) => hasValue(game.stats[weight.name])))
    .map((weight) => weight.name)
    .sort();
  const matchedWeights = weights.length - missingWeightNames.length;
  const context = buildScoringContext(games, weights);

  return {
    gamesLoaded: games.length,
    statsLoaded,
    matchedWeights,
    unmatchedStatKeys,
    missingWeightNames,
    invalidStatCount,
    excludedKpis: context.excludedKpis,
  };
}

export function formatWarnings(warnings: CalculationWarning[]) {
  return [...new Set(warnings.map((warning) => warning.message))];
}

export function logCalculationDebug(
  label: string,
  payload: Record<string, unknown>,
) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.info(`[calc] ${label}`, payload);
}
