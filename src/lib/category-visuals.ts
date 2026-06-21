import { CATEGORY_METADATA } from "@/lib/category-metadata";
import type { CategoryVisualRow, ScoreCategory } from "@/lib/types";

const CATEGORY_ORDER: ScoreCategory[] = ["offense", "defense", "special_teams"];

export function resolveScoreCategory(category: string): ScoreCategory | null {
  const normalized = category.trim().toLowerCase();

  if (normalized === "offense") {
    return "offense";
  }

  if (normalized === "defense") {
    return "defense";
  }

  if (normalized === "special teams" || normalized === "special_teams") {
    return "special_teams";
  }

  return null;
}

function rankStatus(
  score: number | null,
  highestCategory: ScoreCategory | null,
  lowestCategory: ScoreCategory | null,
  currentCategory: ScoreCategory,
) {
  if (score === null) {
    return {
      statusLabel: "Insufficient data",
      statusTone: "limited_data" as const,
      detail: "Not enough weighted KPI coverage in this view.",
    };
  }

  if (currentCategory === highestCategory) {
    return {
      statusLabel: "Strongest",
      statusTone: "strength" as const,
      detail: "Highest category score in this view.",
    };
  }

  if (currentCategory === lowestCategory) {
    return {
      statusLabel: "Concern",
      statusTone: "concern" as const,
      detail: "Lowest category score in this view.",
    };
  }

  return {
    statusLabel: "Stable",
    statusTone: "stable" as const,
    detail: "Tracking between the strongest and weakest categories.",
  };
}

export function buildRankedCategoryVisualRows(
  scores: Record<ScoreCategory, number | null>,
): CategoryVisualRow[] {
  const validRows = CATEGORY_ORDER.filter((category) => scores[category] !== null);
  const sorted = [...validRows].sort((left, right) => (scores[right] ?? 0) - (scores[left] ?? 0));
  const highestCategory = sorted[0] ?? null;
  const lowestCategory = sorted.length > 1 ? sorted[sorted.length - 1] : sorted[0] ?? null;

  return CATEGORY_ORDER.map((category) => {
    const metadata = CATEGORY_METADATA[category];
    const score = scores[category];
    const ranked = rankStatus(score, highestCategory, lowestCategory, category);

    return {
      category,
      label: metadata.label,
      descriptor: metadata.shortDescription,
      score,
      statusLabel: ranked.statusLabel,
      statusTone: ranked.statusTone,
      detail: ranked.detail,
    };
  });
}
