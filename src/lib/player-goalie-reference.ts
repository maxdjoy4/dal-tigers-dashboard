import skaterExtractJson from "@/data/player-goalie/instat-extract-skaters.json";
import goalieExtractJson from "@/data/player-goalie/instat-extract-goalies.json";
import categoryWeightsJson from "@/data/player-goalie/category-weights.json";
import skaterWeightsJson from "@/data/player-goalie/skater-metric-weights.json";
import goalieWeightsJson from "@/data/player-goalie/goalie-metric-weights.json";
import teamToPlayerMappingJson from "@/data/player-goalie/team-to-player-mapping.json";
import type {
  CategoryWeightRow,
  ExtractionPlanRow,
  PlayerGoalieModelType,
  PlayerMetricWeightRow,
  TeamToPlayerMappingRow,
} from "@/lib/player-goalie-types";

function parseFlag(value: string | undefined) {
  return ["1", "true", "yes", "y"].includes((value ?? "").toLowerCase());
}

function parseNumber(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseNullableText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function canonicalizePlayerGoalieColumn(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u2018\u2019']/g, "")
    .replace(/%/g, "pct")
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeExtractionRows(
  rows: Array<Record<string, string>>,
): ExtractionPlanRow[] {
  return rows
    .filter((row) => row["Metric Key"])
    .map((row) => ({
      group: row.Group,
      sourceColumn: row["Source Column"],
      metricKey: row["Metric Key"],
      action: row.Action,
      extract: parseFlag(row["Extract?"]),
      storeRaw: parseFlag(row["Store Raw?"]),
      showOnDashboard: parseFlag(row["Show on Dashboard?"]),
      useInMainScore: parseFlag(row["Use in Main Score?"]),
      module: row.Module,
      reason: row.Reason,
    }));
}

function normalizeWeightRows(
  rows: Array<Record<string, string>>,
): PlayerMetricWeightRow[] {
  return rows
    .filter((row) => row.metric_key)
    .map((row) => ({
      modelType: row.model_type as PlayerGoalieModelType,
      category: row.category,
      categoryWeightPct: Number(row.category_weight_pct || 0),
      metricKey: row.metric_key,
      displayName: row.display_name,
      sourceColumnsRequired: row.source_columns_required
        .split(";")
        .map((entry) => entry.trim())
        .filter(Boolean),
      calculation: row.calculation,
      direction: row.direction as PlayerMetricWeightRow["direction"],
      normalization: row.normalization,
      scoreMethod: row.score_method,
      metricWeightInCategoryPct: Number(row.metric_weight_in_category_pct || 0),
      finalWeightPct: Number(row.final_weight_pct || 0),
      includeInV1Score: parseFlag(row.include_in_v1_score),
      sampleRule: parseNullableText(row.sample_rule),
      teamSuccessLink: parseNullableText(row.team_success_link),
      notes: parseNullableText(row.notes),
    }));
}

const skaterExtractionPlan = normalizeExtractionRows(
  skaterExtractJson as Array<Record<string, string>>,
);
const goalieExtractionPlan = normalizeExtractionRows(
  goalieExtractJson as Array<Record<string, string>>,
);
const categoryWeights = (categoryWeightsJson as Array<Record<string, string>>)
  .filter((row) => row["Model Type"])
  .map(
    (row): CategoryWeightRow => ({
      modelType: row["Model Type"] as PlayerGoalieModelType,
      category: row.Category,
      categoryWeightPct: Number(row["Category Weight %"] || 0),
      description: parseNullableText(row.Description),
    }),
  );
const skaterMetricWeights = normalizeWeightRows(
  skaterWeightsJson as Array<Record<string, string>>,
);
const goalieMetricWeights = normalizeWeightRows(
  goalieWeightsJson as Array<Record<string, string>>,
);
const teamToPlayerMetricMapping = (
  teamToPlayerMappingJson as Array<Record<string, string>>
)
  .filter((row) => row.team_statistic)
  .map(
    (row): TeamToPlayerMappingRow => ({
      teamRank: parseNumber(row.team_rank),
      teamStatistic: row.team_statistic,
      teamCategory: parseNullableText(row.team_category),
      signalTier: parseNullableText(row.signal_tier),
      direction: parseNullableText(row.direction),
      teamWeightPct: parseNumber(row.team_weight_pct),
      teamCodexKey: parseNullableText(row.team_codex_key),
      skaterMetricOrProxy: parseNullableText(row.skater_metric_or_proxy),
      goalieMetricOrProxy: parseNullableText(row.goalie_metric_or_proxy),
      mappingType: parseNullableText(row.mapping_type),
      teamDashboardNote: parseNullableText(row.team_dashboard_note),
    }),
  );

function buildSourceColumnMap(plan: ExtractionPlanRow[]) {
  return new Map(
    plan.map((row) => [canonicalizePlayerGoalieColumn(row.sourceColumn), row.metricKey] as const),
  );
}

export const skaterSourceColumnMap = buildSourceColumnMap(skaterExtractionPlan);
export const goalieSourceColumnMap = buildSourceColumnMap(goalieExtractionPlan);

export function getSkaterExtractionPlan() {
  return skaterExtractionPlan;
}

export function getGoalieExtractionPlan() {
  return goalieExtractionPlan;
}

export function getPlayerCategoryWeights() {
  return categoryWeights.filter(
    (row) => row.modelType === "Forward" || row.modelType === "Defense",
  );
}

export function getGoalieCategoryWeights() {
  return categoryWeights.filter((row) => row.modelType === "Goalie");
}

export function getSkaterMetricWeightsSeed() {
  return skaterMetricWeights;
}

export function getGoalieMetricWeightsSeed() {
  return goalieMetricWeights;
}

export function getTeamToPlayerMappingSeed() {
  return teamToPlayerMetricMapping;
}
