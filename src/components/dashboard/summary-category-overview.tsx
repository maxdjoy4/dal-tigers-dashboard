import { CategoryScoreRows } from "@/components/dashboard/category-score-rows";
import type { CategoryOverviewRow, CategoryVisualRow } from "@/lib/types";

function trendLabel(trend: CategoryOverviewRow["trend"]) {
  if (trend === "improving") {
    return "Improving";
  }

  if (trend === "declining") {
    return "Declining";
  }

  if (trend === "limited_data") {
    return "Limited data";
  }

  return "Stable";
}

function trendTone(trend: CategoryOverviewRow["trend"]) {
  if (trend === "improving") {
    return "strength";
  }

  if (trend === "declining") {
    return "concern";
  }

  if (trend === "limited_data") {
    return "limited_data";
  }

  return "stable";
}

export function SummaryCategoryOverview({
  rows,
}: {
  rows: CategoryOverviewRow[];
}) {
  const visualRows: CategoryVisualRow[] = rows.map((row) => ({
    category: row.category,
    label: row.label,
    descriptor: row.descriptor,
    score: row.score,
    statusLabel: null,
    statusTone: undefined,
    trendLabel: trendLabel(row.trend),
    trendTone: trendTone(row.trend),
    detail:
      row.trendDelta === null
        ? "Trend context unavailable."
        : `${row.trendDelta >= 0 ? "+" : ""}${row.trendDelta.toFixed(1)} vs prior block`,
  }));

  return <CategoryScoreRows rows={visualRows} showSummary />;
}
