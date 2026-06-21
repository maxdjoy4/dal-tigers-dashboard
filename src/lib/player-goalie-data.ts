import { cache } from "react";

import { hasSupabaseServiceRole } from "@/lib/env";
import {
  getGoalieMetricWeightsSeed,
  getSkaterMetricWeightsSeed,
} from "@/lib/player-goalie-reference";
import { normalizePlayerGoalieSeasonLabel } from "@/lib/player-goalie-season";
import type {
  CalculatedPlayerMetricRow,
  GoalieBreakdown,
  GoalieOverviewRow,
  GoalieScoreSnapshot,
  PlayerBreakdown,
  PlayerGoalieDataAvailability,
  PlayerGoalieWeightEditorRow,
  PlayerIntervalScore,
  PlayerOverviewRow,
  PlayerScoreSnapshot,
} from "@/lib/player-goalie-types";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

interface PlayerRow {
  player_id: string;
  instat_player_name: string;
  jersey_number: number | null;
  position: string | null;
}

interface GoalieRow {
  goalie_id: string;
  instat_player_name: string;
  jersey_number: number | null;
}

interface PlayerSeasonStatRow {
  season: string;
  player_id: string;
  position: string | null;
  raw: Record<string, string | number | null>;
  toi_seconds: number | null;
  games_played: number | null;
}

interface GoalieSeasonStatRow {
  season: string;
  goalie_id: string;
  toi_seconds: number | null;
  games_played: number | null;
}

interface PlayerMetricRow {
  season: string;
  player_id: string;
  model_type: "Forward" | "Defense";
  metric_key: string;
  raw_value: number | null;
  calculated_value: number | null;
  score_0_100: number | null;
  reliability_flag: string | null;
  context: Record<string, unknown> | null;
}

interface GoalieMetricRow {
  season: string;
  goalie_id: string;
  metric_key: string;
  raw_value: number | null;
  calculated_value: number | null;
  score_0_100: number | null;
  reliability_flag: string | null;
  context: Record<string, unknown> | null;
}

interface PlayerScoreRow {
  season: string;
  player_id: string;
  model_type: "Forward" | "Defense";
  overall_score: number | null;
  category_scores: Array<{
    category: string;
    score: number | null;
    weightPct: number;
    availableMetricCount: number;
    totalMetricCount: number;
  }>;
  strongest_kpis: CalculatedPlayerMetricRow[];
  development_kpis: CalculatedPlayerMetricRow[];
  reliability_score: number | null;
  reliability_flag: string | null;
}

interface GoalieScoreRow {
  season: string;
  goalie_id: string;
  overall_score: number | null;
  category_scores: Array<{
    category: string;
    score: number | null;
    weightPct: number;
    availableMetricCount: number;
    totalMetricCount: number;
  }>;
  strongest_kpis: CalculatedPlayerMetricRow[];
  development_kpis: CalculatedPlayerMetricRow[];
  reliability_score: number | null;
  reliability_flag: string | null;
}

interface PlayerSnapshotRow {
  id: string;
  upload_id: string | null;
  season: string;
  snapshot_date: string;
  player_id: string;
  player_name: string;
  position: string | null;
  model_type: "Forward" | "Defense";
  games_played: number | null;
  toi_minutes: number | null;
  overall_score: number | null;
  offensive_score: number | null;
  defensive_score: number | null;
  transition_score: number | null;
  puck_management_score: number | null;
  battle_compete_score: number | null;
  possession_score: number | null;
  special_teams_score: number | null;
  discipline_risk_score: number | null;
  reliability_score: number | null;
  reliability_label: string | null;
  role_tags: string[] | null;
}

interface GoalieSnapshotRow {
  id: string;
  upload_id: string | null;
  season: string;
  snapshot_date: string;
  goalie_id: string;
  goalie_name: string;
  games_played: number | null;
  toi_minutes: number | null;
  overall_score: number | null;
  defensive_score: number | null;
  puck_management_score: number | null;
  battle_compete_score: number | null;
  possession_score: number | null;
  special_teams_score: number | null;
  discipline_risk_score: number | null;
  reliability_score: number | null;
  reliability_label: string | null;
  role_tags: string[] | null;
}

interface PlayerIntervalRow {
  id: string;
  current_upload_id: string | null;
  previous_upload_id: string | null;
  season: string;
  player_id: string;
  player_name: string;
  position: string | null;
  interval_start_date: string | null;
  interval_end_date: string | null;
  games_added: number | null;
  toi_added_minutes: number | null;
  overall_interval_score: number | null;
  offensive_interval_score: number | null;
  defensive_interval_score: number | null;
  transition_interval_score: number | null;
  puck_management_interval_score: number | null;
  battle_compete_interval_score: number | null;
  possession_interval_score: number | null;
  special_teams_interval_score: number | null;
  discipline_risk_interval_score: number | null;
  overall_score_change: number | null;
  reliability_change: number | null;
  strongest_improvement: string | null;
  biggest_decline: string | null;
  trend_label: string | null;
}

type LoadedPlayerGoalieData = PlayerGoalieDataAvailability & {
  seasons: string[];
  playerOverview: PlayerOverviewRow[];
  goalieOverview: GoalieOverviewRow[];
  playerBreakdowns: PlayerBreakdown[];
  goalieBreakdowns: GoalieBreakdown[];
  storedSkaterDataCount: number;
  storedGoalieDataCount: number;
};

interface StoredMetricWeightRow {
  metric_weight_id?: string;
  model_type: "Forward" | "Defense" | "Goalie";
  category: string;
  category_weight_pct: number | string;
  metric_key: string;
  display_name: string;
  source_columns_required: string | null;
  calculation: string | null;
  direction: string;
  normalization: string;
  score_method: string;
  metric_weight_in_category_pct: number | string;
  final_weight_pct: number | string;
  include_in_v1_score: boolean;
  sample_rule: string | null;
  team_success_link: string | null;
  notes: string | null;
}

const SUPABASE_PAGE_SIZE = 1000;

function dedupeByKey<T>(rows: T[], getKey: (row: T) => string) {
  const map = new Map<string, T>();

  for (const row of rows) {
    const key = getKey(row);
    if (!map.has(key)) {
      map.set(key, row);
    }
  }

  return Array.from(map.values());
}

async function selectAllRows<T>(table: string): Promise<T[]> {
  const supabase = createServiceSupabaseClient();
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + SUPABASE_PAGE_SIZE - 1);

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

async function selectAllRowsOptional<T>(table: string): Promise<T[]> {
  try {
    return await selectAllRows<T>(table);
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      (("code" in error &&
        ["42P01", "PGRST205"].includes(String((error as { code?: unknown }).code))) ||
        ("message" in error &&
          String((error as { message?: unknown }).message).includes(
            "Could not find the table",
          )))
    ) {
      return [];
    }

    throw error;
  }
}

function buildPlayerMetricView(
  scoreRows: PlayerScoreRow[],
  metricRows: PlayerMetricRow[],
  players: PlayerRow[],
  seasonRows: PlayerSeasonStatRow[],
  snapshotRows: PlayerSnapshotRow[],
  intervalRows: PlayerIntervalRow[],
): { overview: PlayerOverviewRow[]; breakdowns: PlayerBreakdown[] } {
  const playerById = new Map(players.map((row) => [row.player_id, row] as const));
  const seasonByKey = new Map(
    seasonRows.map((row) => [
      `${row.player_id}:${normalizePlayerGoalieSeasonLabel(row.season)}`,
      {
        ...row,
        season: normalizePlayerGoalieSeasonLabel(row.season),
      },
    ] as const),
  );
  const metricsByKey = new Map<string, CalculatedPlayerMetricRow[]>();
  const snapshotsByKey = new Map<string, PlayerScoreSnapshot[]>();
  const latestIntervalByKey = new Map<string, PlayerIntervalScore>();

  for (const row of metricRows) {
    const player = playerById.get(row.player_id);
    if (!player) {
      continue;
    }

    const normalizedSeason = normalizePlayerGoalieSeasonLabel(row.season);
    const key = `${row.player_id}:${normalizedSeason}:${row.model_type}`;
    const current = metricsByKey.get(key) ?? [];

    current.push({
      season: normalizedSeason,
      entityName: player.instat_player_name,
      modelType: row.model_type,
      metricKey: row.metric_key,
      displayName:
        String(row.context?.displayName ?? row.metric_key).replace(/_/g, " "),
      category: String(row.context?.category ?? "Context"),
      rawValue: row.raw_value,
      calculatedValue: row.calculated_value,
      score0100: row.score_0_100,
      includeInScore: true,
      reliabilityFlag: row.reliability_flag,
      context: (row.context ?? {}) as Record<string, string | number | boolean | null>,
    });
    metricsByKey.set(key, current);
  }

  for (const row of snapshotRows) {
    const normalizedSeason = normalizePlayerGoalieSeasonLabel(row.season);
    const key = `${row.player_id}:${normalizedSeason}:${row.model_type}`;
    const current = snapshotsByKey.get(key) ?? [];

    current.push({
      id: row.id,
      uploadId: row.upload_id,
      season: normalizedSeason,
      snapshotDate: row.snapshot_date,
      playerId: row.player_id,
      playerName: row.player_name,
      position:
        row.position === "D" ? "D" : row.position === "F" ? "F" : "Unknown",
      modelType: row.model_type,
      gamesPlayed: row.games_played,
      toiMinutes: row.toi_minutes,
      overallScore: row.overall_score,
      offensiveScore: row.offensive_score,
      defensiveScore: row.defensive_score,
      transitionScore: row.transition_score,
      puckManagementScore: row.puck_management_score,
      battleCompeteScore: row.battle_compete_score,
      possessionScore: row.possession_score,
      specialTeamsScore: row.special_teams_score,
      disciplineRiskScore: row.discipline_risk_score,
      reliabilityScore: row.reliability_score,
      reliabilityLabel: row.reliability_label,
      roleTags: Array.isArray(row.role_tags) ? row.role_tags : [],
    });
    snapshotsByKey.set(key, current);
  }

  for (const row of intervalRows) {
    const normalizedSeason = normalizePlayerGoalieSeasonLabel(row.season);
    const key = `${row.player_id}:${normalizedSeason}`;
    const current = latestIntervalByKey.get(key);

    if (!current || (current.intervalEndDate ?? "") < (row.interval_end_date ?? "")) {
      latestIntervalByKey.set(key, {
        id: row.id,
        currentUploadId: row.current_upload_id,
        previousUploadId: row.previous_upload_id,
        season: normalizedSeason,
        playerId: row.player_id,
        playerName: row.player_name,
        position:
          row.position === "D" ? "D" : row.position === "F" ? "F" : "Unknown",
        intervalStartDate: row.interval_start_date,
        intervalEndDate: row.interval_end_date,
        gamesAdded: row.games_added,
        toiAddedMinutes: row.toi_added_minutes,
        overallIntervalScore: row.overall_interval_score,
        offensiveIntervalScore: row.offensive_interval_score,
        defensiveIntervalScore: row.defensive_interval_score,
        transitionIntervalScore: row.transition_interval_score,
        puckManagementIntervalScore: row.puck_management_interval_score,
        battleCompeteIntervalScore: row.battle_compete_interval_score,
        possessionIntervalScore: row.possession_interval_score,
        specialTeamsIntervalScore: row.special_teams_interval_score,
        disciplineRiskIntervalScore: row.discipline_risk_interval_score,
        overallScoreChange: row.overall_score_change,
        reliabilityChange: row.reliability_change,
        strongestImprovement: row.strongest_improvement,
        biggestDecline: row.biggest_decline,
        trendLabel: row.trend_label,
      });
    }
  }

  const breakdowns = dedupeByKey(scoreRows, (row) => {
    const normalizedSeason = normalizePlayerGoalieSeasonLabel(row.season);
    return `${row.player_id}:${normalizedSeason}:${row.model_type}`;
  }).map((row) => {
    const normalizedSeason = normalizePlayerGoalieSeasonLabel(row.season);
    const player = playerById.get(row.player_id);
    const seasonRow = seasonByKey.get(`${row.player_id}:${normalizedSeason}`);
    const metrics = dedupeByKey(
      metricsByKey.get(`${row.player_id}:${normalizedSeason}:${row.model_type}`) ?? [],
      (metric) => `${metric.metricKey}:${metric.category}`,
    );
    const snapshots = [...(snapshotsByKey.get(`${row.player_id}:${normalizedSeason}:${row.model_type}`) ?? [])].sort(
      (left, right) => left.snapshotDate.localeCompare(right.snapshotDate),
    );
    const latestInterval =
      latestIntervalByKey.get(`${row.player_id}:${normalizedSeason}`) ?? null;

    return {
      id: row.player_id,
      name: player?.instat_player_name ?? "Unknown player",
      season: normalizedSeason,
      modelType: row.model_type,
      position:
        seasonRow?.position === "D"
          ? "D"
          : seasonRow?.position === "F"
            ? "F"
            : "Unknown",
      jerseyNumber: player?.jersey_number ?? null,
      gamesPlayed: seasonRow?.games_played ?? null,
      toiMinutes:
        seasonRow?.toi_seconds == null ? null : seasonRow.toi_seconds / 60,
      overallScore: row.overall_score,
      reliabilityScore: row.reliability_score,
      reliabilityFlag: row.reliability_flag,
      categoryScores: row.category_scores || [],
      strongestKpis: row.strongest_kpis || [],
      developmentKpis: row.development_kpis || [],
      metrics: metrics.sort(
        (left, right) => (right.score0100 ?? -1) - (left.score0100 ?? -1),
      ),
      rawStats: seasonRow?.raw ?? {},
      roleTags: snapshots.at(-1)?.roleTags ?? [],
      snapshots,
      latestInterval,
    } satisfies PlayerBreakdown;
  });

  const overview = breakdowns
    .map((row) => ({
      id: row.id,
      name: row.name,
      season: row.season,
      modelType: row.modelType,
      position: row.position,
      jerseyNumber: row.jerseyNumber,
      gamesPlayed: row.gamesPlayed,
      toiMinutes: row.toiMinutes,
      overallScore: row.overallScore,
      reliabilityFlag: row.reliabilityFlag,
      topCategory:
        row.categoryScores
          .filter((category) => category.score !== null)
          .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))[0]?.category ??
        null,
      developmentCategory:
        row.categoryScores
          .filter((category) => category.score !== null)
          .sort((left, right) => (left.score ?? 0) - (right.score ?? 0))[0]?.category ??
        null,
    }))
    .sort((left, right) => (right.overallScore ?? -1) - (left.overallScore ?? -1));

  return { overview, breakdowns };
}

function buildGoalieMetricView(
  scoreRows: GoalieScoreRow[],
  metricRows: GoalieMetricRow[],
  goalies: GoalieRow[],
  seasonRows: GoalieSeasonStatRow[],
  snapshotRows: GoalieSnapshotRow[],
): { overview: GoalieOverviewRow[]; breakdowns: GoalieBreakdown[] } {
  const goalieById = new Map(goalies.map((row) => [row.goalie_id, row] as const));
  const seasonByKey = new Map(
    seasonRows.map((row) => [
      `${row.goalie_id}:${normalizePlayerGoalieSeasonLabel(row.season)}`,
      {
        ...row,
        season: normalizePlayerGoalieSeasonLabel(row.season),
      },
    ] as const),
  );
  const metricsByKey = new Map<string, CalculatedPlayerMetricRow[]>();
  const snapshotsByKey = new Map<string, GoalieScoreSnapshot[]>();

  for (const row of metricRows) {
    const goalie = goalieById.get(row.goalie_id);
    if (!goalie) {
      continue;
    }

    const normalizedSeason = normalizePlayerGoalieSeasonLabel(row.season);
    const key = `${row.goalie_id}:${normalizedSeason}`;
    const current = metricsByKey.get(key) ?? [];
    current.push({
      season: normalizedSeason,
      entityName: goalie.instat_player_name,
      modelType: "Goalie",
      metricKey: row.metric_key,
      displayName:
        String(row.context?.displayName ?? row.metric_key).replace(/_/g, " "),
      category: String(row.context?.category ?? "Context"),
      rawValue: row.raw_value,
      calculatedValue: row.calculated_value,
      score0100: row.score_0_100,
      includeInScore: true,
      reliabilityFlag: row.reliability_flag,
      context: (row.context ?? {}) as Record<string, string | number | boolean | null>,
    });
    metricsByKey.set(key, current);
  }

  for (const row of snapshotRows) {
    const normalizedSeason = normalizePlayerGoalieSeasonLabel(row.season);
    const key = `${row.goalie_id}:${normalizedSeason}`;
    const current = snapshotsByKey.get(key) ?? [];
    current.push({
      id: row.id,
      uploadId: row.upload_id,
      season: normalizedSeason,
      snapshotDate: row.snapshot_date,
      goalieId: row.goalie_id,
      goalieName: row.goalie_name,
      gamesPlayed: row.games_played,
      toiMinutes: row.toi_minutes,
      overallScore: row.overall_score,
      defensiveScore: row.defensive_score,
      puckManagementScore: row.puck_management_score,
      battleCompeteScore: row.battle_compete_score,
      possessionScore: row.possession_score,
      specialTeamsScore: row.special_teams_score,
      disciplineRiskScore: row.discipline_risk_score,
      reliabilityScore: row.reliability_score,
      reliabilityLabel: row.reliability_label,
      roleTags: Array.isArray(row.role_tags) ? row.role_tags : [],
    });
    snapshotsByKey.set(key, current);
  }

  const breakdowns = dedupeByKey(scoreRows, (row) => {
    const normalizedSeason = normalizePlayerGoalieSeasonLabel(row.season);
    return `${row.goalie_id}:${normalizedSeason}`;
  }).map((row) => {
    const normalizedSeason = normalizePlayerGoalieSeasonLabel(row.season);
    const goalie = goalieById.get(row.goalie_id);
    const seasonRow = seasonByKey.get(`${row.goalie_id}:${normalizedSeason}`);
    const metrics = dedupeByKey(
      metricsByKey.get(`${row.goalie_id}:${normalizedSeason}`) ?? [],
      (metric) => `${metric.metricKey}:${metric.category}`,
    );
    const snapshots = [...(snapshotsByKey.get(`${row.goalie_id}:${normalizedSeason}`) ?? [])].sort(
      (left, right) => left.snapshotDate.localeCompare(right.snapshotDate),
    );

    return {
      id: row.goalie_id,
      name: goalie?.instat_player_name ?? "Unknown goalie",
      season: normalizedSeason,
      jerseyNumber: goalie?.jersey_number ?? null,
      gamesPlayed: seasonRow?.games_played ?? null,
      toiMinutes:
        seasonRow?.toi_seconds == null ? null : seasonRow.toi_seconds / 60,
      overallScore: row.overall_score,
      reliabilityScore: row.reliability_score,
      reliabilityFlag: row.reliability_flag,
      categoryScores: row.category_scores || [],
      strongestKpis: row.strongest_kpis || [],
      developmentKpis: row.development_kpis || [],
      metrics: metrics.sort(
        (left, right) => (right.score0100 ?? -1) - (left.score0100 ?? -1),
      ),
      snapshots,
    } satisfies GoalieBreakdown;
  });

  const overview = breakdowns
    .map((row) => ({
      id: row.id,
      name: row.name,
      season: row.season,
      jerseyNumber: row.jerseyNumber,
      gamesPlayed: row.gamesPlayed,
      toiMinutes: row.toiMinutes,
      overallScore: row.overallScore,
      reliabilityFlag: row.reliabilityFlag,
      topCategory:
        row.categoryScores
          .filter((category) => category.score !== null)
          .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))[0]?.category ??
        null,
      developmentCategory:
        row.categoryScores
          .filter((category) => category.score !== null)
          .sort((left, right) => (left.score ?? 0) - (right.score ?? 0))[0]?.category ??
        null,
    }))
    .sort((left, right) => (right.overallScore ?? -1) - (left.overallScore ?? -1));

  return { overview, breakdowns };
}

export const getPlayerGoalieData = cache(
  async (): Promise<LoadedPlayerGoalieData> => {
    if (!hasSupabaseServiceRole()) {
      return {
        available: false,
        reason: "Supabase is not configured for player and goalie analytics yet.",
        seasons: [],
        playerOverview: [],
        goalieOverview: [],
        playerBreakdowns: [],
        goalieBreakdowns: [],
        storedSkaterDataCount: 0,
        storedGoalieDataCount: 0,
      };
    }

    try {
      const [
        players,
        goalies,
        playerSeasonStats,
        goalieSeasonStats,
        playerMetrics,
        goalieMetrics,
        playerScores,
        goalieScores,
        playerSnapshots,
        goalieSnapshots,
        playerIntervals,
      ] = await Promise.all([
        selectAllRows<PlayerRow>("players"),
        selectAllRows<GoalieRow>("goalies"),
        selectAllRows<PlayerSeasonStatRow>("player_season_stats"),
        selectAllRows<GoalieSeasonStatRow>("goalie_season_stats"),
        selectAllRows<PlayerMetricRow>("player_calculated_metrics"),
        selectAllRows<GoalieMetricRow>("goalie_calculated_metrics"),
        selectAllRows<PlayerScoreRow>("player_scores"),
        selectAllRows<GoalieScoreRow>("goalie_scores"),
        selectAllRowsOptional<PlayerSnapshotRow>("player_score_snapshots"),
        selectAllRowsOptional<GoalieSnapshotRow>("goalie_score_snapshots"),
        selectAllRowsOptional<PlayerIntervalRow>("player_interval_scores"),
      ]);

      const playerView = buildPlayerMetricView(
        playerScores,
        playerMetrics,
        players,
        playerSeasonStats,
        playerSnapshots,
        playerIntervals,
      );
      const goalieView = buildGoalieMetricView(
        goalieScores,
        goalieMetrics,
        goalies,
        goalieSeasonStats,
        goalieSnapshots,
      );

      const seasons = Array.from(
        new Set(
          [
            ...playerSeasonStats.map((row) => normalizePlayerGoalieSeasonLabel(row.season)),
            ...goalieSeasonStats.map((row) => normalizePlayerGoalieSeasonLabel(row.season)),
          ].filter(Boolean),
        ),
      ).sort();

      return {
        available: true,
        seasons,
        playerOverview: playerView.overview,
        goalieOverview: goalieView.overview,
        playerBreakdowns: playerView.breakdowns,
        goalieBreakdowns: goalieView.breakdowns,
        storedSkaterDataCount:
          playerSeasonStats.length +
          playerScores.length +
          playerMetrics.length +
          playerSnapshots.length +
          playerIntervals.length +
          players.length,
        storedGoalieDataCount:
          goalieSeasonStats.length +
          goalieScores.length +
          goalieMetrics.length +
          goalieSnapshots.length +
          goalies.length,
      };
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Run the player-goalie schema before using these pages.";

      return {
        available: false,
        reason: message,
        seasons: [],
        playerOverview: [],
        goalieOverview: [],
        playerBreakdowns: [],
        goalieBreakdowns: [],
        storedSkaterDataCount: 0,
        storedGoalieDataCount: 0,
      };
    }
  },
);

function normalizeStoredWeightRow(
  row: StoredMetricWeightRow,
  sourceTable: "player_metric_weights" | "goalie_metric_weights",
): PlayerGoalieWeightEditorRow {
  return {
    id: row.metric_weight_id ?? `${row.model_type}:${row.category}:${row.metric_key}`,
    sourceTable,
    modelType: row.model_type,
    category: row.category,
    categoryWeightPct: Number(row.category_weight_pct || 0),
    metricKey: row.metric_key,
    displayName: row.display_name,
    sourceColumnsRequired: String(row.source_columns_required || "")
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean),
    calculation: row.calculation || "",
    direction: row.direction as PlayerGoalieWeightEditorRow["direction"],
    normalization: row.normalization,
    scoreMethod: row.score_method,
    metricWeightInCategoryPct: Number(row.metric_weight_in_category_pct || 0),
    finalWeightPct: Number(row.final_weight_pct || 0),
    includeInV1Score: row.include_in_v1_score,
    sampleRule: row.sample_rule,
    teamSuccessLink: row.team_success_link,
    notes: row.notes,
  };
}

export const getPlayerGoalieWeightEditorData = cache(
  async (): Promise<{
    isDemoMode: boolean;
    skaterWeights: PlayerGoalieWeightEditorRow[];
    goalieWeights: PlayerGoalieWeightEditorRow[];
  }> => {
    const demoFallback = {
      isDemoMode: true,
      skaterWeights: getSkaterMetricWeightsSeed().map((row) => ({
        ...row,
        id: `${row.modelType}:${row.category}:${row.metricKey}`,
        sourceTable: "player_metric_weights" as const,
      })),
      goalieWeights: getGoalieMetricWeightsSeed().map((row) => ({
        ...row,
        id: `${row.modelType}:${row.category}:${row.metricKey}`,
        sourceTable: "goalie_metric_weights" as const,
      })),
    };

    if (!hasSupabaseServiceRole()) {
      return demoFallback;
    }

    try {
      const supabase = createServiceSupabaseClient();
      const [{ data: playerRows, error: playerError }, { data: goalieRows, error: goalieError }] =
        await Promise.all([
          supabase
            .from("player_metric_weights")
            .select("*")
            .order("model_type", { ascending: true })
            .order("category", { ascending: true }),
          supabase
            .from("goalie_metric_weights")
            .select("*")
            .order("category", { ascending: true }),
        ]);

      if (playerError) {
        throw playerError;
      }
      if (goalieError) {
        throw goalieError;
      }

      return {
        isDemoMode: false,
        skaterWeights: ((playerRows || []) as StoredMetricWeightRow[]).map((row) =>
          normalizeStoredWeightRow(row, "player_metric_weights"),
        ),
        goalieWeights: ((goalieRows || []) as StoredMetricWeightRow[]).map((row) =>
          normalizeStoredWeightRow(row, "goalie_metric_weights"),
        ),
      };
    } catch {
      return demoFallback;
    }
  },
);
