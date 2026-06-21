import * as XLSX from "xlsx";

import {
  canonicalizePlayerGoalieColumn,
  getGoalieExtractionPlan,
  getSkaterExtractionPlan,
  goalieSourceColumnMap,
  skaterSourceColumnMap,
} from "@/lib/player-goalie-reference";
import type {
  ExtractionPlanRow,
  ParsedGoalieSeasonStat,
  ParsedPlayerSeasonStat,
  PlayerMetricWeightRow,
  PlayerGoalieUploadPreview,
  PositionBucket,
  TeamToPlayerMappingRow,
} from "@/lib/player-goalie-types";

type UploadRow = Record<string, string | number | null>;

type AggregateUploadKind = "skater" | "goalie";

const SKATER_REQUIRED_COLUMN_GROUPS = [
  ["Player", "Player name", "Name"],
  ["Position", "Pos"],
  ["Time on ice", "TOI", "TOI min", "Time On Ice"],
  ["Games played", "Games", "GP"],
];
const GOALIE_REQUIRED_COLUMN_GROUPS = [
  ["Player", "Player name", "Name"],
  ["Time on ice", "TOI", "TOI min", "Time On Ice"],
  ["Games played", "Games", "GP"],
];

function isPercentLike(columnName: string) {
  const normalized = columnName.toLowerCase();
  return (
    normalized.includes("%") ||
    normalized.includes("percent") ||
    normalized.includes(" pct") ||
    /\bpct\b/.test(normalized)
  );
}

function parseTimeOnIceToSeconds(raw: string | number | null) {
  if (raw === null || raw === "") {
    return null;
  }

  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw > 100 ? Math.round(raw) : Math.round(raw * 24 * 60 * 60);
  }

  const value = String(raw).trim();
  const match = value.match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.round(numeric) : null;
  }

  if (match[3] !== undefined) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    return hours * 3600 + minutes * 60 + seconds;
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  return minutes * 60 + seconds;
}

function parseUploadNumericValue(columnName: string, value: string | number | null) {
  if (value === null || value === "") {
    return null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }

    return isPercentLike(columnName) && Math.abs(value) > 1 ? value / 100 : value;
  }

  const raw = String(value).trim();
  if (!raw || raw === "-" || raw === "—") {
    return null;
  }

  const numeric = Number(raw.replace(/,/g, "").replace(/%/g, "").trim());
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return isPercentLike(columnName) || raw.includes("%")
    ? (Math.abs(numeric) > 1 ? numeric / 100 : numeric)
    : numeric;
}

function resolvePositionBucket(value: string | number | null): PositionBucket {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();

  if (!normalized) {
    return "Unknown";
  }

  if (normalized === "D" || normalized.includes("DEF")) {
    return "D";
  }

  if (normalized === "G" || normalized.includes("GOAL")) {
    return "G";
  }

  if (
    normalized === "F" ||
    normalized === "C" ||
    normalized.includes("LW") ||
    normalized.includes("RW") ||
    normalized.includes("FOR")
  ) {
    return "F";
  }

  return "Unknown";
}

function parseWorkbookRows(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!firstSheet) {
    return [] as UploadRow[];
  }

  return XLSX.utils.sheet_to_json<UploadRow>(firstSheet, {
    defval: null,
    raw: false,
  });
}

function buildPreview(
  rows: UploadRow[],
  plan: ExtractionPlanRow[],
  requiredColumnGroups: string[][],
  metricMap: Map<string, string>,
): PlayerGoalieUploadPreview {
  const previewColumns = Object.keys(rows[0] ?? {});
  const canonicalColumns = new Set(
    previewColumns.map((column) => canonicalizePlayerGoalieColumn(column)),
  );
  const missingRequiredColumns = requiredColumnGroups
    .filter(
      (group) =>
        !group.some((column) =>
          canonicalColumns.has(canonicalizePlayerGoalieColumn(column)),
        ),
    )
    .map((group) => group[0]);
  const matchedColumnCount = new Set(
    previewColumns
      .map((column) => metricMap.get(canonicalizePlayerGoalieColumn(column)))
      .filter((value): value is string => Boolean(value)),
  ).size;

  return {
    rows: rows.slice(0, 5),
    previewColumns,
    matchedColumnCount,
    missingRequiredColumns,
  };
}

export function parsePlayerGoalieWorkbookPreview(
  buffer: ArrayBuffer,
  kind: AggregateUploadKind,
): PlayerGoalieUploadPreview {
  const rows = parseWorkbookRows(buffer);

  if (kind === "skater") {
    return buildPreview(
      rows,
      getSkaterExtractionPlan(),
      SKATER_REQUIRED_COLUMN_GROUPS,
      skaterSourceColumnMap,
    );
  }

  return buildPreview(
    rows,
    getGoalieExtractionPlan(),
    GOALIE_REQUIRED_COLUMN_GROUPS,
    goalieSourceColumnMap,
  );
}

function extractRawMetricsFromRow(
  row: UploadRow,
  plan: ExtractionPlanRow[],
  sourceMap: Map<string, string>,
) {
  const raw: Record<string, string | number | null> = {};

  for (const [columnName, value] of Object.entries(row)) {
    const metricKey = sourceMap.get(canonicalizePlayerGoalieColumn(columnName));
    if (!metricKey) {
      continue;
    }

    if (metricKey === "player" || metricKey === "position") {
      raw[metricKey] = value === null ? null : String(value).trim();
      continue;
    }

    if (metricKey === "time_on_ice") {
      raw[metricKey] = parseTimeOnIceToSeconds(value);
      continue;
    }

    raw[metricKey] = parseUploadNumericValue(columnName, value);
  }

  for (const planRow of plan) {
    if (!(planRow.metricKey in raw) && planRow.storeRaw) {
      raw[planRow.metricKey] = null;
    }
  }

  return raw;
}

export function buildPlayerSeasonStatsFromWorkbook(
  buffer: ArrayBuffer,
  season: string,
): { preview: PlayerGoalieUploadPreview; stats: ParsedPlayerSeasonStat[] } {
  const rows = parseWorkbookRows(buffer);
  const preview = buildPreview(
    rows,
    getSkaterExtractionPlan(),
    SKATER_REQUIRED_COLUMN_GROUPS,
    skaterSourceColumnMap,
  );

  const stats = rows
    .map((row) => {
      const raw = extractRawMetricsFromRow(
        row,
        getSkaterExtractionPlan(),
        skaterSourceColumnMap,
      );
      const playerName = String(raw.player ?? "").trim();
      if (!playerName) {
        return null;
      }

      return {
        season,
        playerName,
        jerseyNumber: parseUploadNumericValue(
          "Shirt number",
          row["Shirt number"] ?? row["shirt_number"] ?? null,
        ),
        position: resolvePositionBucket(raw.position ?? row.Position ?? null),
        toiSeconds:
          typeof raw.time_on_ice === "number" ? raw.time_on_ice : null,
        gamesPlayed:
          typeof raw.games_played === "number" ? raw.games_played : null,
        raw,
      } satisfies ParsedPlayerSeasonStat;
    })
    .filter((row): row is ParsedPlayerSeasonStat => Boolean(row));

  return { preview, stats };
}

export function buildGoalieSeasonStatsFromWorkbook(
  buffer: ArrayBuffer,
  season: string,
): { preview: PlayerGoalieUploadPreview; stats: ParsedGoalieSeasonStat[] } {
  const rows = parseWorkbookRows(buffer);
  const preview = buildPreview(
    rows,
    getGoalieExtractionPlan(),
    GOALIE_REQUIRED_COLUMN_GROUPS,
    goalieSourceColumnMap,
  );

  const stats = rows
    .map((row) => {
      const raw = extractRawMetricsFromRow(
        row,
        getGoalieExtractionPlan(),
        goalieSourceColumnMap,
      );
      const playerName = String(raw.player ?? "").trim();
      if (!playerName) {
        return null;
      }

      return {
        season,
        playerName,
        jerseyNumber: parseUploadNumericValue(
          "Shirt number",
          row["Shirt number"] ?? row["shirt_number"] ?? null,
        ),
        toiSeconds:
          typeof raw.time_on_ice === "number" ? raw.time_on_ice : null,
        gamesPlayed:
          typeof raw.games_played === "number" ? raw.games_played : null,
        raw,
      } satisfies ParsedGoalieSeasonStat;
    })
    .filter((row): row is ParsedGoalieSeasonStat => Boolean(row));

  return { preview, stats };
}

function parseWorksheetRows(workbook: XLSX.WorkBook, sheetName: string) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return [] as Array<Record<string, string>>;
  }

  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
    raw: false,
  });
}

function parseMetricWeightsFromSheet(
  rows: Array<Record<string, string>>,
): PlayerMetricWeightRow[] {
  return rows
    .filter((row) => row.metric_key)
    .map((row) => ({
      modelType: row.model_type as PlayerMetricWeightRow["modelType"],
      category: row.category,
      categoryWeightPct: Number(row.category_weight_pct || 0),
      metricKey: row.metric_key,
      displayName: row.display_name,
      sourceColumnsRequired: String(row.source_columns_required || "")
        .split(";")
        .map((entry) => entry.trim())
        .filter(Boolean),
      calculation: row.calculation,
      direction: row.direction as PlayerMetricWeightRow["direction"],
      normalization: row.normalization,
      scoreMethod: row.score_method,
      metricWeightInCategoryPct: Number(row.metric_weight_in_category_pct || 0),
      finalWeightPct: Number(row.final_weight_pct || 0),
      includeInV1Score: String(row.include_in_v1_score || "").trim() === "1",
      sampleRule: row.sample_rule?.trim() || null,
      teamSuccessLink: row.team_success_link?.trim() || null,
      notes: row.notes?.trim() || null,
    }));
}

function parseTeamMappingRows(
  rows: Array<Record<string, string>>,
): TeamToPlayerMappingRow[] {
  return rows
    .filter((row) => row.team_statistic)
    .map((row) => ({
      teamRank: row.team_rank ? Number(row.team_rank) : null,
      teamStatistic: row.team_statistic,
      teamCategory: row.team_category?.trim() || null,
      signalTier: row.signal_tier?.trim() || null,
      direction: row.direction?.trim() || null,
      teamWeightPct: row.team_weight_pct ? Number(row.team_weight_pct) : null,
      teamCodexKey: row.team_codex_key?.trim() || null,
      skaterMetricOrProxy: row.skater_metric_or_proxy?.trim() || null,
      goalieMetricOrProxy: row.goalie_metric_or_proxy?.trim() || null,
      mappingType: row.mapping_type?.trim() || null,
      teamDashboardNote: row.team_dashboard_note?.trim() || null,
    }));
}

export function parsePlayerGoalieWeightsWorkbook(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: "array" });
  const requiredSheets = [
    "Skater_Metric_Weights",
    "Goalie_Metric_Weights",
    "Team_To_Player_Mapping",
  ] as const;
  const missingSheets = requiredSheets.filter((sheetName) => !workbook.Sheets[sheetName]);

  if (missingSheets.length > 0) {
    throw new Error(
      `Metric workbook is missing required sheets: ${missingSheets.join(", ")}.`,
    );
  }

  const skaterRows = parseWorksheetRows(workbook, "Skater_Metric_Weights");
  const goalieRows = parseWorksheetRows(workbook, "Goalie_Metric_Weights");
  const mappingRows = parseWorksheetRows(workbook, "Team_To_Player_Mapping");

  const skaterWeights = parseMetricWeightsFromSheet(skaterRows);
  const goalieWeights = parseMetricWeightsFromSheet(goalieRows);
  const teamMapping = parseTeamMappingRows(mappingRows);

  if (!skaterWeights.length || !goalieWeights.length || !teamMapping.length) {
    throw new Error(
      "Metric workbook could not be imported because one or more required sheets did not contain valid model rows.",
    );
  }

  return {
    skaterWeights,
    goalieWeights,
    teamMapping,
  };
}
