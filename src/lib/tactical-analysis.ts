import {
  averageNullable,
  effectiveWeight,
  hasValue,
} from "@/lib/calculations";
import {
  getVisibleTacticalGroups,
  TACTICAL_GROUP_METADATA,
} from "@/lib/category-metadata";
import { resolveTacticalGroup } from "@/lib/tactical-groups";
import type {
  KpiWeight,
  ScoredGame,
  TacticalDriverRow,
  TacticalDriverStatus,
} from "@/lib/types";
import { round } from "@/lib/utils";

const TACTICAL_DELTA_THRESHOLD = 2.5;
const TACTICAL_COVERAGE_THRESHOLD = 0.6;

function averageGroupCoverage(games: ScoredGame[], group: TacticalDriverRow["group"]) {
  return averageNullable(games.map((game) => game.tacticalGroupScores[group].coverage));
}

function statusFromGroupScores(
  score: number | null,
  baselineScore: number | null,
  coverage: number | null,
) {
  if (!hasValue(score) || (coverage !== null && coverage < TACTICAL_COVERAGE_THRESHOLD)) {
    return "insufficient_data" as TacticalDriverStatus;
  }

  if (!hasValue(baselineScore)) {
    return "neutral" as TacticalDriverStatus;
  }

  const delta = score - baselineScore;
  if (delta >= TACTICAL_DELTA_THRESHOLD) {
    return "strength" as TacticalDriverStatus;
  }

  if (delta <= -TACTICAL_DELTA_THRESHOLD) {
    return "concern" as TacticalDriverStatus;
  }

  return "neutral" as TacticalDriverStatus;
}

function buildTakeaway(
  row: Omit<TacticalDriverRow, "takeaway">,
) {
  if (row.status === "insufficient_data") {
    return "Insufficient data to trust this tactical group yet.";
  }

  if (row.status === "strength") {
    return `${row.label} is outperforming baseline${row.strongestKpi ? `, led by ${row.strongestKpi}` : ""}.`;
  }

  if (row.status === "concern") {
    return `${row.label} is lagging baseline${row.weakestKpi ? `, with ${row.weakestKpi} standing out most` : ""}.`;
  }

  return `${row.label} is tracking close to baseline${row.strongestKpi ? `, with ${row.strongestKpi} as the clearest positive signal` : ""}.`;
}

export function buildTacticalDriverRows(
  focusedGames: ScoredGame[],
  baselineGames: ScoredGame[],
  weights: KpiWeight[],
) {
  const activeWeights = weights.filter((weight) => weight.includeInScore);
  const totalActiveWeight = activeWeights.reduce(
    (sum, weight) => sum + effectiveWeight(weight),
    0,
  );

  return getVisibleTacticalGroups().map((group) => {
    const groupWeights = activeWeights.filter(
      (weight) => resolveTacticalGroup(weight) === group,
    );
    const groupWeightShare = new Map(
      groupWeights.map((weight) => [
        weight.name,
        totalActiveWeight > 0 ? effectiveWeight(weight) / totalActiveWeight : 0,
      ]),
    );
    const focusedScore = averageNullable(
      focusedGames.map((game) => game.tacticalGroupScores[group].score),
    );
    const baselineScore = averageNullable(
      baselineGames.map((game) => game.tacticalGroupScores[group].score),
    );
    const delta =
      hasValue(focusedScore) && hasValue(baselineScore)
        ? round(focusedScore - baselineScore, 1)
        : null;
    const coverage = averageGroupCoverage(focusedGames, group);

    const kpiRows = groupWeights.map((weight) => {
      const focusedNormalizedAverage = averageNullable(
        focusedGames.map((game) => {
          const kpi = game.kpis.find((entry) => entry.name === weight.name);
          return kpi?.available ? kpi.normalizedScore : null;
        }),
      );
      const baselineNormalizedAverage = averageNullable(
        baselineGames.map((game) => {
          const kpi = game.kpis.find((entry) => entry.name === weight.name);
          return kpi?.available ? kpi.normalizedScore : null;
        }),
      );
      const weightedDelta =
        hasValue(focusedNormalizedAverage) && hasValue(baselineNormalizedAverage)
          ? round(
              (focusedNormalizedAverage - baselineNormalizedAverage) *
                (groupWeightShare.get(weight.name) ?? 0),
              2,
            )
          : null;

      return {
        name: weight.name,
        weightedDelta,
        availableInFocus: focusedGames.some((game) =>
          game.kpis.some((kpi) => kpi.name === weight.name && kpi.available),
        ),
      };
    });

    const strongestKpi =
      [...kpiRows]
        .filter((row) => hasValue(row.weightedDelta))
        .sort((left, right) => (right.weightedDelta ?? 0) - (left.weightedDelta ?? 0))[0]
        ?.name ?? null;
    const weakestKpi =
      [...kpiRows]
        .filter((row) => hasValue(row.weightedDelta))
        .sort((left, right) => (left.weightedDelta ?? 0) - (right.weightedDelta ?? 0))[0]
        ?.name ?? null;
    const validKpis = kpiRows.filter((row) => row.availableInFocus).length;
    const totalKpis = groupWeights.length;
    const excludedKpis = totalKpis - validKpis;
    const warnings: string[] = [];

    if (!totalKpis) {
      warnings.push("No KPI weights map to this tactical group.");
    } else if (validKpis === 0) {
      warnings.push("No valid KPI values were available for this tactical group.");
    } else if (coverage !== null && coverage < TACTICAL_COVERAGE_THRESHOLD) {
      warnings.push(
        `This tactical group is based on partial KPI coverage (${Math.round(coverage * 100)}%).`,
      );
    }

    const baseRow = {
      group,
        label: TACTICAL_GROUP_METADATA[group].label,
      score: focusedScore,
      baselineScore,
      delta,
      validKpis,
      totalKpis,
      excludedKpis,
      coverage,
      strongestKpi,
      weakestKpi,
      status: statusFromGroupScores(focusedScore, baselineScore, coverage),
      warnings,
    };

    return {
      ...baseRow,
      takeaway: buildTakeaway(baseRow),
    } satisfies TacticalDriverRow;
  });
}
