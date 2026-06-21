import { format } from "date-fns";

import type {
  KpiDirection,
  KpiWeight,
  ScoredGame,
  ScoreCategory,
} from "@/lib/types";
import {
  getTrendComparisonWindow,
  TREND_WINDOW_GAMES,
} from "@/lib/trend-window";

export type KpiTrendLabel = "Improving" | "Stable" | "Worsening" | "Limited data";
export type KpiTrendSignal = "positive" | "negative" | "neutral";

export interface KpiTrendOption {
  key: string;
  name: string;
  category: ScoreCategory;
  direction: KpiDirection;
  availableGames: number;
  weight: number;
}

export interface KpiTrendPoint {
  id: string;
  date: string;
  label: string;
  opponent: string;
  result: string;
  rawValue: number | null;
  displayValue: number | null;
  rollingAverage: number | null;
  signal: KpiTrendSignal;
}

export interface KpiTrendSummary {
  kpiKey: string;
  kpiName: string;
  direction: KpiDirection;
  trend: KpiTrendLabel;
  recentAverage: number | null;
  previousAverage: number | null;
  change: number | null;
  bestGame: KpiTrendPoint | null;
  worstGame: KpiTrendPoint | null;
  highestValue: number | null;
  lowestValue: number | null;
  missingCount: number;
  validCount: number;
  rollingWindow: number;
  explanation: string;
  isPercent: boolean;
}

function average(values: number[]) {
  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function isPercentLikeKpi(weight: KpiWeight) {
  const combined = `${weight.key} ${weight.name}`.toLowerCase();
  return combined.includes("%") || combined.includes(" pct") || combined.includes("_pct") || combined.includes("percent");
}

export function formatKpiDisplayValue(value: number | null, isPercent: boolean) {
  if (value === null || Number.isNaN(value)) {
    return "n/a";
  }

  const displayValue = isPercent && Math.abs(value) <= 1.5 ? value * 100 : value;
  return `${displayValue.toFixed(1)}${isPercent ? "%" : ""}`;
}

function toDisplayValue(rawValue: number | null, isPercent: boolean) {
  if (rawValue === null || Number.isNaN(rawValue)) {
    return null;
  }

  return isPercent && Math.abs(rawValue) <= 1.5 ? rawValue * 100 : rawValue;
}

function buildSignal(value: number | null, referenceAverage: number | null, direction: KpiDirection) {
  if (value === null || referenceAverage === null) {
    return "neutral" as const;
  }

  const spread = Math.abs(value - referenceAverage);
  const threshold = Math.max(0.5, Math.abs(referenceAverage) * 0.03);

  if (spread <= threshold) {
    return "neutral" as const;
  }

  if (direction === "higher_is_better") {
    return value > referenceAverage ? "positive" : "negative";
  }

  return value < referenceAverage ? "positive" : "negative";
}

function compareWindow(values: number[], direction: KpiDirection, isPercent: boolean) {
  const windowSize = getTrendComparisonWindow(values.length);
  if (windowSize) {
    return summarizeWindows(values, windowSize, direction, isPercent);
  }

  return {
    trend: "Limited data" as const,
    recentAverage: null,
    previousAverage: null,
    change: null,
    rollingWindow: 0,
    explanation: "Not enough valid game values yet to compare recent and prior form.",
  };
}

function summarizeWindows(
  values: number[],
  windowSize: number,
  direction: KpiDirection,
  isPercent: boolean,
) {
  const recentValues = values.slice(-windowSize);
  const previousValues = values.slice(-windowSize * 2, -windowSize);
  const recentAverage = average(recentValues);
  const previousAverage = average(previousValues);

  if (recentAverage === null || previousAverage === null) {
    return {
      trend: "Limited data" as const,
      recentAverage,
      previousAverage,
      change: null,
      rollingWindow: windowSize,
      explanation: "Not enough valid game values yet to compare recent and prior form.",
    };
  }

  const change = recentAverage - previousAverage;
  const directionalChange = direction === "higher_is_better" ? change : -change;
  const spread = Math.max(...values) - Math.min(...values);
  const threshold = Math.max(
    isPercent ? 2 : 0.75,
    spread * 0.08,
  );

  const trend: KpiTrendLabel =
    directionalChange >= threshold
      ? "Improving"
      : directionalChange <= -threshold
        ? "Worsening"
        : "Stable";

  const directionWord =
    direction === "higher_is_better"
      ? change >= 0
        ? "up"
        : "down"
      : change <= 0
        ? "down"
        : "up";

  const explanation =
    `${trend === "Improving" ? "Recent form is improving." : trend === "Worsening" ? "Recent form is worsening." : "Recent form is holding steady."} The last ${windowSize}-game average is ${directionWord} ${Math.abs(change).toFixed(1)} compared with the previous ${windowSize} games.`;

  return {
    trend,
    recentAverage,
    previousAverage,
    change,
    rollingWindow: windowSize,
    explanation,
  };
}

export function buildKpiTrendOptions(games: ScoredGame[], weights: KpiWeight[]) {
  return weights
    .map((weight) => {
      const availableGames = games.filter((game) => {
        const kpi = game.kpis.find((entry) => entry.key === weight.key);
        return Boolean(kpi && kpi.rawValue !== null && !Number.isNaN(kpi.rawValue));
      }).length;

      return {
        key: weight.key,
        name: weight.name,
        category: weight.category,
        direction: weight.direction,
        availableGames,
        weight: weight.weight,
      } satisfies KpiTrendOption;
    })
    .filter((option) => option.availableGames > 0)
    .sort((left, right) => {
      if (left.category !== right.category) {
        return left.category.localeCompare(right.category);
      }

      if (right.weight !== left.weight) {
        return right.weight - left.weight;
      }

      return left.name.localeCompare(right.name);
    });
}

export function buildKpiTrendData(
  games: ScoredGame[],
  weight: KpiWeight,
) {
  const isPercent = isPercentLikeKpi(weight);
  const basePoints = [...games]
    .sort((left, right) => new Date(left.game.date).getTime() - new Date(right.game.date).getTime())
    .map((game) => {
      const kpi = game.kpis.find((entry) => entry.key === weight.key) ?? null;
      return {
        id: game.game.id,
        date: game.game.date,
        label: format(new Date(game.game.date), "MMM d"),
        opponent: game.game.opponent,
        result: game.game.result,
        rawValue: kpi?.rawValue ?? null,
        displayValue: toDisplayValue(kpi?.rawValue ?? null, isPercent),
      };
    });

  const validValues = basePoints
    .map((point) => point.displayValue)
    .filter((value): value is number => value !== null && !Number.isNaN(value));
  const overallAverage = average(validValues);

  const points: KpiTrendPoint[] = basePoints.map((point, index) => {
    const windowValues = basePoints
      .slice(0, index + 1)
      .map((entry) => entry.displayValue)
      .filter((value): value is number => value !== null && !Number.isNaN(value))
      .slice(-TREND_WINDOW_GAMES);

    return {
      ...point,
      rollingAverage: average(windowValues),
      signal: buildSignal(point.displayValue, overallAverage, weight.direction),
    };
  });

  const summaryWindow = compareWindow(validValues, weight.direction, isPercent);
  const validPoints = points.filter((point) => point.displayValue !== null);
  const sortForBest = [...validPoints].sort((left, right) => {
    if (weight.direction === "higher_is_better") {
      return (right.displayValue ?? 0) - (left.displayValue ?? 0);
    }

    return (left.displayValue ?? 0) - (right.displayValue ?? 0);
  });
  const sortForWorst = [...validPoints].sort((left, right) => {
    if (weight.direction === "higher_is_better") {
      return (left.displayValue ?? 0) - (right.displayValue ?? 0);
    }

    return (right.displayValue ?? 0) - (left.displayValue ?? 0);
  });

  return {
    points,
    summary: {
      kpiKey: weight.key,
      kpiName: weight.name,
      direction: weight.direction,
      trend: summaryWindow.trend,
      recentAverage: summaryWindow.recentAverage,
      previousAverage: summaryWindow.previousAverage,
      change: summaryWindow.change,
      bestGame: sortForBest[0] ?? null,
      worstGame: sortForWorst[0] ?? null,
      highestValue: validValues.length ? Math.max(...validValues) : null,
      lowestValue: validValues.length ? Math.min(...validValues) : null,
      missingCount: points.filter((point) => point.displayValue === null).length,
      validCount: validPoints.length,
      rollingWindow: summaryWindow.rollingWindow,
      explanation: summaryWindow.explanation,
      isPercent,
    } satisfies KpiTrendSummary,
  };
}
