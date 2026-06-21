import { cache } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";

import Papa from "papaparse";

import { buildDatasetAuditSummary, logCalculationDebug } from "@/lib/calculations";
import { hasSupabaseServiceRole } from "@/lib/env";
import { buildGamesFromUpload } from "@/lib/upload";
import type { GameRecord, KpiDirection, KpiWeight, ScoreCategory } from "@/lib/types";
import { slugify } from "@/lib/utils";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

type CsvRow = Record<string, string>;

interface SupabaseKpiWeightRow {
  id: string;
  kpi_key: string;
  name: string;
  category: string;
  weight: number | string;
  r_value: number | string | null;
  direction: string;
  include_in_score: boolean;
  cluster: string | null;
  notes: string | null;
  current_value: string | null;
  coaching_adjustment: number | string | null;
  display_order: number | null;
}

interface SupabaseGameRow {
  id: string;
  season: string;
  game_date: string;
  opponent: string;
  result: string;
  result_bucket: GameRecord["resultBucket"];
  home_away: GameRecord["homeAway"];
  goals_for: number | null;
  goals_against: number | null;
  summary: string | null;
  uploaded_file_id: string | null;
}

interface SupabaseGameStatRow {
  game_id: string;
  kpi_key: string;
  kpi_name: string;
  raw_value: number | string | null;
}

const SUPABASE_PAGE_SIZE = 1000;

function parseBoolean(value: string | undefined) {
  return ["true", "1", "yes", "y"].includes((value || "").toLowerCase());
}

function resolveCategory(
  appCategory: string,
  category: string,
  metricName: string,
): ScoreCategory {
  const rawValue = `${appCategory} ${category} ${metricName}`.toLowerCase();

  if (
    rawValue.includes("special") ||
    rawValue.includes("power play") ||
    rawValue.includes("penalty kill") ||
    rawValue.includes("short-handed") ||
    /\bpp\b/.test(rawValue) ||
    /\bpk\b/.test(rawValue) ||
    rawValue.includes("pp%") ||
    rawValue.includes("pk%")
  ) {
    return "special_teams";
  }

  if (
    rawValue.includes("defense") ||
    rawValue.includes("defensive") ||
    rawValue.includes("opponent")
  ) {
    return "defense";
  }

  return "offense";
}

async function readCsvFile<T extends CsvRow>(filePath: string) {
  const content = await readFile(filePath, "utf8");
  const parsed = Papa.parse<T>(content, { header: true, skipEmptyLines: true });
  return parsed.data;
}

const loadSeedWeights = cache(async (): Promise<KpiWeight[]> => {
  const filePath = path.join(process.cwd(), "src", "data", "metrics-config.csv");
  const rows = await readCsvFile(filePath);

  return rows
    .filter((row) => row.metric_name)
    .map((row, index) => ({
      id: row.metric_id || slugify(row.metric_name),
      key: row.metric_id || slugify(row.metric_name),
      name: row.metric_name,
      category: resolveCategory(
        row.app_category || "",
        row.Category || "",
        row.metric_name,
      ),
      rawCategory: row.app_category || row.Category || "Other",
      weight: Number(row.weight_pct || 0),
      rValue: Number(row.r_win || 0),
      direction: parseBoolean(row.higher_is_better)
        ? ("higher_is_better" as KpiDirection)
        : ("lower_is_better" as KpiDirection),
      includeInScore: parseBoolean(row.include_in_score),
      cluster: row.Cluster || null,
      notes: row.dal_dashboard_notes || null,
      currentValue: row.dal_current_value || null,
      coachingAdjustment: Number(row.coaching_adjustment || 0),
      sortOrder: index,
    }))
    .filter((row) => row.includeInScore);
});

const loadSeedGames = cache(async (weights: KpiWeight[]): Promise<GameRecord[]> => {
  const filePath = path.join(process.cwd(), "src", "data", "sample-games.csv");
  let content: Buffer;

  try {
    content = await readFile(filePath);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }

    throw error;
  }

  const parsed = Papa.parse<CsvRow>(content.toString("utf8"), {
    header: true,
    skipEmptyLines: true,
  });

  return buildGamesFromUpload(parsed.data, weights);
});

async function loadSupabaseWeights(): Promise<KpiWeight[]> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("kpi_weights")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data || []) as SupabaseKpiWeightRow[];

  return rows.map((row, index) => ({
    id: row.id,
    key: row.kpi_key,
    name: row.name,
    category: row.category as ScoreCategory,
    rawCategory: row.category,
    weight: Number(row.weight),
    rValue: Number(row.r_value || 0),
    direction: row.direction as KpiDirection,
    includeInScore: row.include_in_score,
    cluster: row.cluster,
    notes: row.notes,
    currentValue: row.current_value,
    coachingAdjustment:
      row.coaching_adjustment === null
        ? null
        : Number(row.coaching_adjustment),
    sortOrder: row.display_order ?? index,
  }));
}

async function selectAllRows<T>(
  table: string,
  orderBy?: { column: string; ascending?: boolean },
): Promise<T[]> {
  const supabase = createServiceSupabaseClient();
  const rows: T[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from(table)
      .select("*")
      .range(from, from + SUPABASE_PAGE_SIZE - 1);

    if (orderBy) {
      query = query.order(orderBy.column, {
        ascending: orderBy.ascending ?? true,
      });
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const batch = (data || []) as T[];
    rows.push(...batch);

    if (batch.length < SUPABASE_PAGE_SIZE) {
      break;
    }

    from += SUPABASE_PAGE_SIZE;
  }

  return rows;
}

async function loadSupabaseGames(weights: KpiWeight[]): Promise<GameRecord[]> {
  const [games, stats] = await Promise.all([
    selectAllRows<SupabaseGameRow>("games", {
      column: "game_date",
      ascending: true,
    }),
    selectAllRows<SupabaseGameStatRow>("game_stats"),
  ]);

  const statsByGame = new Map<string, Record<string, number | null>>();
  const weightNameByKey = new Map(weights.map((weight) => [weight.key, weight.name] as const));
  const weightNames = new Set(weights.map((weight) => weight.name));

  for (const row of stats) {
    const current = statsByGame.get(row.game_id) || {};
    const numeric = row.raw_value === null ? null : Number(row.raw_value);
    if (row.raw_value !== null && !Number.isFinite(numeric)) {
      logCalculationDebug("invalid-supabase-stat", {
        gameId: row.game_id,
        kpiKey: row.kpi_key,
        kpiName: row.kpi_name,
        rawValue: row.raw_value,
      });
    }

    const resolvedName =
      weightNameByKey.get(row.kpi_key) ??
      (weightNames.has(row.kpi_name) ? row.kpi_name : null) ??
      weightNameByKey.get(slugify(row.kpi_name)) ??
      row.kpi_name;

    current[resolvedName] = Number.isFinite(numeric ?? NaN) ? numeric : null;
    statsByGame.set(row.game_id, current);
  }

  return games.map((row) => {
    const statsMap = statsByGame.get(row.id) || {};

    return {
      id: row.id,
      date: new Date(row.game_date).toISOString(),
      opponent: row.opponent,
      result: row.result,
      resultBucket: row.result_bucket,
      season: row.season,
      homeAway: row.home_away,
      goalsFor: row.goals_for,
      goalsAgainst: row.goals_against,
      summary: row.summary,
      source: "supabase",
      uploadedFileId: row.uploaded_file_id,
      stats: statsMap,
    } satisfies GameRecord;
  });
}

export const getDashboardSeed = cache(async () => {
  const seedWeights = await loadSeedWeights();
  const seedGames = await loadSeedGames(seedWeights);
  return {
    weights: seedWeights,
    games: seedGames,
  };
});

export const getDashboardData = cache(async () => {
  if (!hasSupabaseServiceRole()) {
    return {
      ...(await getDashboardSeed()),
      demoMode: true,
    };
  }

  try {
    const weights = await loadSupabaseWeights();
    const games = await loadSupabaseGames(weights);
    const audit = buildDatasetAuditSummary(games, weights);

    logCalculationDebug("dashboard-data", {
      source: "supabase",
      gamesLoaded: audit.gamesLoaded,
      statsLoaded: audit.statsLoaded,
      matchedWeights: audit.matchedWeights,
      unmatchedStatKeys: audit.unmatchedStatKeys,
      missingWeightNames: audit.missingWeightNames,
      invalidStatCount: audit.invalidStatCount,
      excludedKpis: audit.excludedKpis,
    });

    if (!weights.length) {
      return {
        ...(await getDashboardSeed()),
        demoMode: true,
      };
    }

    return {
      weights,
      games,
      demoMode: false,
      audit,
    };
  } catch {
    return {
      ...(await getDashboardSeed()),
      demoMode: true,
    };
  }
});
