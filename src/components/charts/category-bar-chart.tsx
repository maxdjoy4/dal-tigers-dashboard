"use client";

import { CategoryScoreRows } from "@/components/dashboard/category-score-rows";
import { buildRankedCategoryVisualRows, resolveScoreCategory } from "@/lib/category-visuals";
import type { ScoreCategory } from "@/lib/types";

interface CategoryBarChartProps {
  data: Array<{
    category: string;
    score: number | null;
  }>;
}

export function CategoryBarChart({ data }: CategoryBarChartProps) {
  const mutableScores: Record<ScoreCategory, number | null> = {
    offense: null,
    defense: null,
    special_teams: null,
  };

  for (const item of data) {
    const category = resolveScoreCategory(item.category);
    if (category) {
      mutableScores[category] = item.score;
    }
  }

  return (
    <CategoryScoreRows
      rows={buildRankedCategoryVisualRows(mutableScores)}
      showSummary
      layout="expanded"
    />
  );
}
