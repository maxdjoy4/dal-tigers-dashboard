import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isCurrentUserAdmin } from "@/lib/auth";
import { hasSupabaseServiceRole } from "@/lib/env";
import {
  getGoalieMetricWeightsSeed,
  getSkaterMetricWeightsSeed,
} from "@/lib/player-goalie-reference";
import {
  getPlayerGoalieSeasonAliases,
  normalizePlayerGoalieSeasonLabel,
} from "@/lib/player-goalie-season";
import {
  buildGoalieScores,
  buildPlayerScores,
} from "@/lib/player-goalie-scoring";
import {
  buildGoalieSnapshotRow,
  buildPlayerIntervalRow,
  buildPlayerIntervalStats,
  buildPlayerSnapshotRow,
  type PreviousPlayerSeasonState,
} from "@/lib/player-goalie-snapshot-scoring";
import {
  buildGoalieSeasonStatsFromWorkbook,
  buildPlayerSeasonStatsFromWorkbook,
  parsePlayerGoalieWeightsWorkbook,
} from "@/lib/player-goalie-upload";
import type { PlayerMetricWeightRow } from "@/lib/player-goalie-types";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

const INSERT_BATCH_SIZE = 500;

interface StoredMetricWeightRow {
  model_type: "Forward" | "Defense" | "Goalie";
  category: string;
  category_weight_pct: number;
  metric_key: string;
  display_name: string;
  source_columns_required: string | null;
  calculation: string | null;
  direction: string;
  normalization: string;
  score_method: string;
  metric_weight_in_category_pct: number;
  final_weight_pct: number;
  include_in_v1_score: boolean;
  sample_rule: string | null;
  team_success_link: string | null;
  notes: string | null;
}

interface UploadedFileMetadata {
  id: string;
  createdAt: string;
}

interface PreviousPlayerSeasonDbRow {
  player_id: string;
  uploaded_file_id: string | null;
  raw: Record<string, string | number | null>;
  position: string | null;
  toi_seconds: number | null;
  games_played: number | null;
  created_at: string | null;
}

function revalidatePlayerGoaliePages() {
  revalidatePath("/admin/upload");
  revalidatePath("/player-overview");
  revalidatePath("/player-breakdown");
  revalidatePath("/goalie-breakdown");
}

function isMissingRelationError(error: unknown) {
  return (
    error !== null &&
    typeof error === "object" &&
    (("code" in error &&
      ["42P01", "PGRST205"].includes(String((error as { code?: unknown }).code))) ||
      ("message" in error &&
        String((error as { message?: unknown }).message).includes(
          "Could not find the table",
        )))
  );
}

async function requireAdminPlayerGoalieAccess() {
  if (!hasSupabaseServiceRole()) {
    return NextResponse.json(
      {
        message:
          "Demo mode does not support importing or deleting player-goalie data.",
      },
      { status: 400 },
    );
  }

  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) {
    return NextResponse.json(
      { message: "Only admin users can manage player-goalie data." },
      { status: 401 },
    );
  }

  return null;
}

async function insertInBatches(table: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) {
    return null;
  }

  const supabase = createServiceSupabaseClient();
  for (let index = 0; index < rows.length; index += INSERT_BATCH_SIZE) {
    const batch = rows.slice(index, index + INSERT_BATCH_SIZE);
    const { error } = await supabase.from(table).insert(batch);

    if (error) {
      return error;
    }
  }

  return null;
}

async function deleteAllRowsIfTableExists(table: string, keyColumn = "id") {
  const supabase = createServiceSupabaseClient();
  const { error } = await supabase.from(table).delete().not(keyColumn, "is", null);

  if (error && !isMissingRelationError(error)) {
    throw error;
  }
}

async function cleanupPlayerGoalieUploadedFiles(uploadedFileIds: string[]) {
  const ids = [...new Set(uploadedFileIds.filter(Boolean))];
  if (!ids.length) {
    return;
  }

  const supabase = createServiceSupabaseClient();
  const [gameRefs, playerRefs, goalieRefs] = await Promise.all([
    supabase.from("games").select("uploaded_file_id").in("uploaded_file_id", ids),
    supabase
      .from("player_season_stats")
      .select("uploaded_file_id")
      .in("uploaded_file_id", ids),
    supabase
      .from("goalie_season_stats")
      .select("uploaded_file_id")
      .in("uploaded_file_id", ids),
  ]);

  if (gameRefs.error) {
    throw gameRefs.error;
  }
  if (playerRefs.error) {
    throw playerRefs.error;
  }
  if (goalieRefs.error) {
    throw goalieRefs.error;
  }

  const stillReferenced = new Set(
    [
      ...(gameRefs.data || []),
      ...(playerRefs.data || []),
      ...(goalieRefs.data || []),
    ]
      .map((row) => row.uploaded_file_id)
      .filter((value): value is string => Boolean(value)),
  );

  const orphanIds = ids.filter((id) => !stillReferenced.has(id));
  if (!orphanIds.length) {
    return;
  }

  const { error } = await supabase.from("uploaded_files").delete().in("id", orphanIds);
  if (error) {
    throw error;
  }
}

async function storeUploadedFileMetadata(file: File, insertedCount: number) {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("uploaded_files")
    .insert({
      original_filename: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      storage_path: null,
      inserted_count: insertedCount,
    })
    .select("id, created_at")
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id as string,
    createdAt: String(data.created_at),
  } satisfies UploadedFileMetadata;
}

function normalizeStoredWeightRow(row: StoredMetricWeightRow): PlayerMetricWeightRow {
  return {
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
    direction: row.direction as PlayerMetricWeightRow["direction"],
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

async function loadStoredPlayerGoalieWeights() {
  const supabase = createServiceSupabaseClient();
  const [{ data: playerWeights, error: playerError }, { data: goalieWeights, error: goalieError }] =
    await Promise.all([
      supabase.from("player_metric_weights").select("*"),
      supabase.from("goalie_metric_weights").select("*"),
    ]);

  if (playerError) {
    throw playerError;
  }

  if (goalieError) {
    throw goalieError;
  }

  return {
    skaterWeights:
      (playerWeights as StoredMetricWeightRow[] | null)?.map(normalizeStoredWeightRow) ??
      getSkaterMetricWeightsSeed(),
    goalieWeights:
      (goalieWeights as StoredMetricWeightRow[] | null)?.map(normalizeStoredWeightRow) ??
      getGoalieMetricWeightsSeed(),
  };
}

async function importMetricWorkbook(file: File) {
  const buffer = await file.arrayBuffer();
  const parsed = parsePlayerGoalieWeightsWorkbook(buffer);
  const supabase = createServiceSupabaseClient();

  await supabase.from("team_to_player_metric_mapping").delete().neq("id", "");
  await supabase.from("player_metric_weights").delete().neq("metric_key", "");
  await supabase.from("goalie_metric_weights").delete().neq("metric_key", "");

  const playerWeightRows = parsed.skaterWeights.map((weight) => ({
    model_type: weight.modelType,
    category: weight.category,
    category_weight_pct: weight.categoryWeightPct,
    metric_key: weight.metricKey,
    display_name: weight.displayName,
    source_columns_required: weight.sourceColumnsRequired.join("; "),
    calculation: weight.calculation,
    direction: weight.direction,
    normalization: weight.normalization,
    score_method: weight.scoreMethod,
    metric_weight_in_category_pct: weight.metricWeightInCategoryPct,
    final_weight_pct: weight.finalWeightPct,
    include_in_v1_score: weight.includeInV1Score,
    sample_rule: weight.sampleRule,
    team_success_link: weight.teamSuccessLink,
    notes: weight.notes,
  }));
  const goalieWeightRows = parsed.goalieWeights.map((weight) => ({
    model_type: weight.modelType,
    category: weight.category,
    category_weight_pct: weight.categoryWeightPct,
    metric_key: weight.metricKey,
    display_name: weight.displayName,
    source_columns_required: weight.sourceColumnsRequired.join("; "),
    calculation: weight.calculation,
    direction: weight.direction,
    normalization: weight.normalization,
    score_method: weight.scoreMethod,
    metric_weight_in_category_pct: weight.metricWeightInCategoryPct,
    final_weight_pct: weight.finalWeightPct,
    include_in_v1_score: weight.includeInV1Score,
    sample_rule: weight.sampleRule,
    team_success_link: weight.teamSuccessLink,
    notes: weight.notes,
  }));
  const mappingRows = parsed.teamMapping.map((row) => ({
    team_rank: row.teamRank,
    team_statistic: row.teamStatistic,
    team_category: row.teamCategory,
    signal_tier: row.signalTier,
    direction: row.direction,
    team_weight_pct: row.teamWeightPct,
    team_codex_key: row.teamCodexKey,
    skater_metric_or_proxy: row.skaterMetricOrProxy,
    goalie_metric_or_proxy: row.goalieMetricOrProxy,
    mapping_type: row.mappingType,
    team_dashboard_note: row.teamDashboardNote,
  }));

  const playerError = await insertInBatches("player_metric_weights", playerWeightRows);
  if (playerError) {
    throw playerError;
  }

  const goalieError = await insertInBatches("goalie_metric_weights", goalieWeightRows);
  if (goalieError) {
    throw goalieError;
  }

  const mappingError = await insertInBatches("team_to_player_metric_mapping", mappingRows);
  if (mappingError) {
    throw mappingError;
  }

  await storeUploadedFileMetadata(
    file,
    playerWeightRows.length + goalieWeightRows.length + mappingRows.length,
  );

  revalidatePlayerGoaliePages();
  return {
    message: `Imported ${playerWeightRows.length} skater weights, ${goalieWeightRows.length} goalie weights, and ${mappingRows.length} mapping rows.`,
  };
}

async function importSkaterSeason(file: File, season: string) {
  const normalizedSeason = normalizePlayerGoalieSeasonLabel(season);
  const seasonAliases = getPlayerGoalieSeasonAliases(season);
  const buffer = await file.arrayBuffer();
  const parsed = buildPlayerSeasonStatsFromWorkbook(buffer, normalizedSeason);

  if (parsed.preview.missingRequiredColumns.length > 0) {
    return NextResponse.json(
      {
        message: `Missing required columns: ${parsed.preview.missingRequiredColumns.join(", ")}`,
      },
      { status: 400 },
    );
  }

  if (!parsed.stats.length) {
    return NextResponse.json(
      { message: "No skater rows were found in the uploaded workbook." },
      { status: 400 },
    );
  }

  const uploadedFile = await storeUploadedFileMetadata(file, parsed.stats.length);
  const { skaterWeights } = await loadStoredPlayerGoalieWeights();
  const scoreResults = buildPlayerScores(parsed.stats, skaterWeights);
  const supabase = createServiceSupabaseClient();

  await supabase.from("player_calculated_metrics").delete().in("season", seasonAliases);
  await supabase.from("player_scores").delete().in("season", seasonAliases);
  await supabase.from("player_season_stats").delete().in("season", seasonAliases);

  const upsertPlayersPayload = parsed.stats.map((row) => ({
    instat_player_name: row.playerName,
    jersey_number: row.jerseyNumber,
    position: row.position,
    active: true,
  }));

  const { error: playerUpsertError } = await supabase
    .from("players")
    .upsert(upsertPlayersPayload, { onConflict: "instat_player_name" });

  if (playerUpsertError) {
    return NextResponse.json({ message: playerUpsertError.message }, { status: 500 });
  }

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("player_id, instat_player_name");

  if (playersError) {
    return NextResponse.json({ message: playersError.message }, { status: 500 });
  }

  const playerIdByName = new Map(
    ((players || []) as Array<{ player_id: string; instat_player_name: string }>).map((row) => [
      row.instat_player_name,
      row.player_id,
    ]),
  );
  const playerNameById = new Map(
    ((players || []) as Array<{ player_id: string; instat_player_name: string }>).map((row) => [
      row.player_id,
      row.instat_player_name,
    ]),
  );
  const previousSeasonByName = await loadPreviousPlayerSeasonState(
    seasonAliases,
    playerNameById,
  );
  const intervalStats = buildPlayerIntervalStats(parsed.stats, previousSeasonByName);
  const intervalScoreResults = intervalStats.length
    ? buildPlayerScores(intervalStats, skaterWeights)
    : [];

  const seasonRows = parsed.stats
    .map((row) => {
      const playerId = playerIdByName.get(row.playerName);
      if (!playerId) {
        return null;
      }

      return {
        season: normalizedSeason,
        player_id: playerId,
        uploaded_file_id: uploadedFile.id,
        raw: row.raw,
        position: row.position,
        toi_seconds: row.toiSeconds,
        games_played: row.gamesPlayed,
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  const seasonInsertError = await insertInBatches("player_season_stats", seasonRows);
  if (seasonInsertError) {
    return NextResponse.json({ message: seasonInsertError.message }, { status: 500 });
  }

  const metricRows = scoreResults.flatMap((result) => {
    const playerId = playerIdByName.get(result.score.entityName);
    if (!playerId) {
      return [];
    }

    return result.metrics.map((metric) => ({
      season: normalizedSeason,
      player_id: playerId,
      model_type: result.score.modelType,
      metric_key: metric.metricKey,
      raw_value: metric.rawValue,
      calculated_value: metric.calculatedValue,
      score_0_100: metric.score0100,
      reliability_flag: metric.reliabilityFlag,
      context: {
        ...metric.context,
        displayName: metric.displayName,
        category: metric.category,
      },
    }));
  });

  const metricInsertError = await insertInBatches("player_calculated_metrics", metricRows);
  if (metricInsertError) {
    return NextResponse.json({ message: metricInsertError.message }, { status: 500 });
  }

  const scoreRows = scoreResults
    .map((result) => {
      const playerId = playerIdByName.get(result.score.entityName);
      if (!playerId) {
        return null;
      }

      return {
        season: normalizedSeason,
        player_id: playerId,
        model_type: result.score.modelType,
        overall_score: result.score.overallScore,
        category_scores: result.score.categoryScores,
        strongest_kpis: result.score.strongestKpis,
        development_kpis: result.score.developmentKpis,
        reliability_score: result.score.reliabilityScore,
        reliability_flag: result.score.reliabilityFlag,
        context_flags: result.score.contextFlags,
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  const scoreInsertError = await insertInBatches("player_scores", scoreRows);
  if (scoreInsertError) {
    return NextResponse.json({ message: scoreInsertError.message }, { status: 500 });
  }

  await savePlayerSnapshotsAndIntervals({
    normalizedSeason,
    uploadedFile,
    parsedStats: parsed.stats,
    scoreResults,
    intervalScoreResults,
    playerIdByName,
    previousSeasonByName,
  });

  revalidatePlayerGoaliePages();
  return NextResponse.json({
    message: `Saved ${parsed.stats.length} skater season rows and recalculated player scores for ${normalizedSeason}.`,
  });
}

async function importGoalieSeason(file: File, season: string) {
  const normalizedSeason = normalizePlayerGoalieSeasonLabel(season);
  const seasonAliases = getPlayerGoalieSeasonAliases(season);
  const buffer = await file.arrayBuffer();
  const parsed = buildGoalieSeasonStatsFromWorkbook(buffer, normalizedSeason);

  if (parsed.preview.missingRequiredColumns.length > 0) {
    return NextResponse.json(
      {
        message: `Missing required columns: ${parsed.preview.missingRequiredColumns.join(", ")}`,
      },
      { status: 400 },
    );
  }

  if (!parsed.stats.length) {
    return NextResponse.json(
      { message: "No goalie rows were found in the uploaded workbook." },
      { status: 400 },
    );
  }

  const uploadedFile = await storeUploadedFileMetadata(file, parsed.stats.length);
  const { goalieWeights } = await loadStoredPlayerGoalieWeights();
  const scoreResults = buildGoalieScores(parsed.stats, goalieWeights);
  const supabase = createServiceSupabaseClient();

  await supabase.from("goalie_calculated_metrics").delete().in("season", seasonAliases);
  await supabase.from("goalie_scores").delete().in("season", seasonAliases);
  await supabase.from("goalie_season_stats").delete().in("season", seasonAliases);

  const upsertGoaliesPayload = parsed.stats.map((row) => ({
    instat_player_name: row.playerName,
    jersey_number: row.jerseyNumber,
    active: true,
  }));

  const { error: goalieUpsertError } = await supabase
    .from("goalies")
    .upsert(upsertGoaliesPayload, { onConflict: "instat_player_name" });

  if (goalieUpsertError) {
    return NextResponse.json({ message: goalieUpsertError.message }, { status: 500 });
  }

  const { data: goalies, error: goaliesError } = await supabase
    .from("goalies")
    .select("goalie_id, instat_player_name");

  if (goaliesError) {
    return NextResponse.json({ message: goaliesError.message }, { status: 500 });
  }

  const goalieIdByName = new Map(
    ((goalies || []) as Array<{ goalie_id: string; instat_player_name: string }>).map((row) => [
      row.instat_player_name,
      row.goalie_id,
    ]),
  );
  const seasonRows = parsed.stats
    .map((row) => {
      const goalieId = goalieIdByName.get(row.playerName);
      if (!goalieId) {
        return null;
      }

      return {
        season: normalizedSeason,
        goalie_id: goalieId,
        uploaded_file_id: uploadedFile.id,
        raw: row.raw,
        toi_seconds: row.toiSeconds,
        games_played: row.gamesPlayed,
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  const seasonInsertError = await insertInBatches("goalie_season_stats", seasonRows);
  if (seasonInsertError) {
    return NextResponse.json({ message: seasonInsertError.message }, { status: 500 });
  }

  const metricRows = scoreResults.flatMap((result) => {
    const goalieId = goalieIdByName.get(result.score.entityName);
    if (!goalieId) {
      return [];
    }

    return result.metrics.map((metric) => ({
      season: normalizedSeason,
      goalie_id: goalieId,
      metric_key: metric.metricKey,
      raw_value: metric.rawValue,
      calculated_value: metric.calculatedValue,
      score_0_100: metric.score0100,
      reliability_flag: metric.reliabilityFlag,
      context: {
        ...metric.context,
        displayName: metric.displayName,
        category: metric.category,
      },
    }));
  });

  const metricInsertError = await insertInBatches("goalie_calculated_metrics", metricRows);
  if (metricInsertError) {
    return NextResponse.json({ message: metricInsertError.message }, { status: 500 });
  }

  const scoreRows = scoreResults
    .map((result) => {
      const goalieId = goalieIdByName.get(result.score.entityName);
      if (!goalieId) {
        return null;
      }

      return {
        season: normalizedSeason,
        goalie_id: goalieId,
        overall_score: result.score.overallScore,
        category_scores: result.score.categoryScores,
        strongest_kpis: result.score.strongestKpis,
        development_kpis: result.score.developmentKpis,
        reliability_score: result.score.reliabilityScore,
        reliability_flag: result.score.reliabilityFlag,
        context_flags: result.score.contextFlags,
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  const scoreInsertError = await insertInBatches("goalie_scores", scoreRows);
  if (scoreInsertError) {
    return NextResponse.json({ message: scoreInsertError.message }, { status: 500 });
  }

  await saveGoalieSnapshots({
      uploadedFile,
      parsedStats: parsed.stats,
      scoreResults,
      goalieIdByName,
  });

  revalidatePlayerGoaliePages();
  return NextResponse.json({
    message: `Saved ${parsed.stats.length} goalie season rows and recalculated goalie scores for ${normalizedSeason}.`,
  });
}

async function clearPlayerGoalieData(target: "skaters" | "goalies") {
  const supabase = createServiceSupabaseClient();

  if (target === "skaters") {
    const { data: seasonRows, error: seasonRowsError } = await supabase
      .from("player_season_stats")
      .select("uploaded_file_id");
    if (seasonRowsError) {
      throw seasonRowsError;
    }

    const uploadedFileIds = (seasonRows || [])
      .map((row) => row.uploaded_file_id)
      .filter((value): value is string => Boolean(value));

    await deleteAllRowsIfTableExists("player_interval_scores");
    await deleteAllRowsIfTableExists("player_score_snapshots");
    await deleteAllRowsIfTableExists("player_calculated_metrics");
    await deleteAllRowsIfTableExists("player_scores");
    await deleteAllRowsIfTableExists("player_season_stats");
    await deleteAllRowsIfTableExists("players", "player_id");

    await cleanupPlayerGoalieUploadedFiles(uploadedFileIds);
    revalidatePlayerGoaliePages();

    return NextResponse.json({
      message:
        "Cleared all stored skater season data, calculated metrics, scores, snapshots, intervals, and player identities.",
    });
  }

  const { data: seasonRows, error: seasonRowsError } = await supabase
    .from("goalie_season_stats")
    .select("uploaded_file_id");
  if (seasonRowsError) {
    throw seasonRowsError;
  }

  const uploadedFileIds = (seasonRows || [])
    .map((row) => row.uploaded_file_id)
    .filter((value): value is string => Boolean(value));

  await deleteAllRowsIfTableExists("goalie_interval_scores");
  await deleteAllRowsIfTableExists("goalie_score_snapshots");
  await deleteAllRowsIfTableExists("goalie_calculated_metrics");
  await deleteAllRowsIfTableExists("goalie_scores");
  await deleteAllRowsIfTableExists("goalie_season_stats");
  await deleteAllRowsIfTableExists("goalies", "goalie_id");

  await cleanupPlayerGoalieUploadedFiles(uploadedFileIds);
  revalidatePlayerGoaliePages();

  return NextResponse.json({
    message:
      "Cleared all stored goalie season data, calculated metrics, scores, snapshots, intervals, and goalie identities.",
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const kind = String(formData.get("kind") ?? "");
  const season = String(formData.get("season") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Please attach a workbook file." }, { status: 400 });
  }

  const accessError = await requireAdminPlayerGoalieAccess();
  if (accessError) {
    return accessError;
  }

  try {
    if (kind === "metric_workbook") {
      const payload = await importMetricWorkbook(file);
      return NextResponse.json(payload);
    }

    if (!season) {
      return NextResponse.json(
        { message: "Season is required for player and goalie stat imports." },
        { status: 400 },
      );
    }

    if (kind === "skater_stats") {
      return importSkaterSeason(file, season);
    }

    if (kind === "goalie_stats") {
      return importGoalieSeason(file, season);
    }

    return NextResponse.json({ message: "Unknown import type." }, { status: 400 });
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "Player-goalie import failed.";

    return NextResponse.json({ message }, { status: 500 });
  }
}

async function loadPreviousPlayerSeasonState(
  seasonAliases: string[],
  playerNameById: Map<string, string>,
): Promise<Map<string, PreviousPlayerSeasonState>> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("player_season_stats")
    .select("player_id, uploaded_file_id, raw, position, toi_seconds, games_played, created_at")
    .in("season", seasonAliases);

  if (error) {
    throw error;
  }

  const byName = new Map<string, PreviousPlayerSeasonState>();

  for (const row of (data || []) as PreviousPlayerSeasonDbRow[]) {
    const playerName = playerNameById.get(row.player_id);
    if (!playerName) {
      continue;
    }

    byName.set(playerName, {
      uploadId: row.uploaded_file_id,
      createdAt: row.created_at,
      playerName,
      position:
        row.position === "D" ? "D" : row.position === "F" ? "F" : "Unknown",
      gamesPlayed: row.games_played,
      toiSeconds: row.toi_seconds,
      raw: row.raw ?? {},
    });
  }

  return byName;
}

async function savePlayerSnapshotsAndIntervals(params: {
  normalizedSeason: string;
  uploadedFile: UploadedFileMetadata;
  parsedStats: ReturnType<typeof buildPlayerSeasonStatsFromWorkbook>["stats"];
  scoreResults: ReturnType<typeof buildPlayerScores>;
  intervalScoreResults: ReturnType<typeof buildPlayerScores>;
  playerIdByName: Map<string, string>;
  previousSeasonByName: Map<string, PreviousPlayerSeasonState>;
}) {
  const supabase = createServiceSupabaseClient();
  const snapshotDate = params.uploadedFile.createdAt;
  const intervalScoreByName = new Map(
    params.intervalScoreResults.map((result) => [result.score.entityName, result.score] as const),
  );
  const currentSnapshotByName = new Map<string, ReturnType<typeof buildPlayerSnapshotRow>>();
  type StoredPlayerSnapshotLookupRow = {
    upload_id: string | null;
    snapshot_date: string;
    player_id: string;
    season: string;
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
  };
  const previousSnapshotsData = await supabase
    .from("player_score_snapshots")
    .select("*")
    .eq("season", params.normalizedSeason);

  if (previousSnapshotsData.error) {
    if (!isMissingRelationError(previousSnapshotsData.error)) {
      throw previousSnapshotsData.error;
    }
    return;
  }

  const previousSnapshotByKey = new Map<string, StoredPlayerSnapshotLookupRow>();

  for (const row of (previousSnapshotsData.data || []) as StoredPlayerSnapshotLookupRow[]) {
    const current = previousSnapshotByKey.get(`${row.player_id}:${row.season}`);
    if (!current || current.snapshot_date < row.snapshot_date) {
      previousSnapshotByKey.set(`${row.player_id}:${row.season}`, row);
    }
  }

  const snapshotRows = params.scoreResults
    .map((result) => {
      const matchingStat = params.parsedStats.find(
        (row) => row.playerName === result.score.entityName,
      );
      const playerId = params.playerIdByName.get(result.score.entityName);
      if (!matchingStat || !playerId) {
        return null;
      }

      const snapshotRow = buildPlayerSnapshotRow({
        uploadId: params.uploadedFile.id,
        snapshotDate,
        playerId,
        position: matchingStat.position,
        score: result.score,
        gamesPlayed: matchingStat.gamesPlayed,
        toiMinutes:
          matchingStat.toiSeconds === null ? null : matchingStat.toiSeconds / 60,
      });

      currentSnapshotByName.set(result.score.entityName, snapshotRow);
      return {
        upload_id: snapshotRow.uploadId,
        season: snapshotRow.season,
        snapshot_date: snapshotRow.snapshotDate,
        player_id: snapshotRow.playerId,
        player_name: snapshotRow.playerName,
        position: snapshotRow.position,
        model_type: snapshotRow.modelType,
        games_played: snapshotRow.gamesPlayed,
        toi_minutes: snapshotRow.toiMinutes,
        overall_score: snapshotRow.overallScore,
        offensive_score: snapshotRow.offensiveScore,
        defensive_score: snapshotRow.defensiveScore,
        transition_score: snapshotRow.transitionScore,
        puck_management_score: snapshotRow.puckManagementScore,
        battle_compete_score: snapshotRow.battleCompeteScore,
        possession_score: snapshotRow.possessionScore,
        special_teams_score: snapshotRow.specialTeamsScore,
        discipline_risk_score: snapshotRow.disciplineRiskScore,
        reliability_score: snapshotRow.reliabilityScore,
        reliability_label: snapshotRow.reliabilityLabel,
        role_tags: snapshotRow.roleTags,
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  const snapshotInsertError = await insertInBatches("player_score_snapshots", snapshotRows);
  if (snapshotInsertError) {
    if (!isMissingRelationError(snapshotInsertError)) {
      throw snapshotInsertError;
    }
    return;
  }

  const intervalRows = params.parsedStats
    .map((row) => {
      const playerId = params.playerIdByName.get(row.playerName);
      const previousSeason = params.previousSeasonByName.get(row.playerName);
      const currentSnapshot = currentSnapshotByName.get(row.playerName);
      const previousSnapshot = playerId
        ? previousSnapshotByKey.get(`${playerId}:${params.normalizedSeason}`)
        : null;

      if (!playerId || !previousSeason || !currentSnapshot || !previousSnapshot) {
        return null;
      }

      const intervalScore = intervalScoreByName.get(row.playerName) ?? null;
      const intervalRow = buildPlayerIntervalRow({
        currentUploadId: params.uploadedFile.id,
        previousUploadId: previousSeason.uploadId,
        intervalStartDate: previousSeason.createdAt,
        intervalEndDate: snapshotDate,
        playerId,
        playerName: row.playerName,
        position: row.position,
        gamesAdded:
          row.gamesPlayed !== null &&
          previousSeason.gamesPlayed !== null &&
          row.gamesPlayed >= previousSeason.gamesPlayed
            ? row.gamesPlayed - previousSeason.gamesPlayed
            : null,
        toiAddedMinutes:
          row.toiSeconds !== null &&
          previousSeason.toiSeconds !== null &&
          row.toiSeconds >= previousSeason.toiSeconds
            ? (row.toiSeconds - previousSeason.toiSeconds) / 60
            : null,
        currentSnapshot,
        previousSnapshot: {
          uploadId: previousSnapshot.upload_id,
          season: previousSnapshot.season,
          snapshotDate: previousSnapshot.snapshot_date,
          playerId,
          playerName: row.playerName,
          position: row.position,
          modelType: currentSnapshot.modelType,
          gamesPlayed: previousSeason.gamesPlayed,
          toiMinutes:
            previousSeason.toiSeconds === null ? null : previousSeason.toiSeconds / 60,
          overallScore: previousSnapshot.overall_score,
          offensiveScore: previousSnapshot.offensive_score,
          defensiveScore: previousSnapshot.defensive_score,
          transitionScore: previousSnapshot.transition_score,
          puckManagementScore: previousSnapshot.puck_management_score,
          battleCompeteScore: previousSnapshot.battle_compete_score,
          possessionScore: previousSnapshot.possession_score,
          specialTeamsScore: previousSnapshot.special_teams_score,
          disciplineRiskScore: previousSnapshot.discipline_risk_score,
          reliabilityScore: previousSnapshot.reliability_score,
          reliabilityLabel: null,
          roleTags: [],
        },
        intervalScore,
      });

      return {
        current_upload_id: intervalRow.currentUploadId,
        previous_upload_id: intervalRow.previousUploadId,
        season: intervalRow.season,
        player_id: intervalRow.playerId,
        player_name: intervalRow.playerName,
        position: intervalRow.position,
        interval_start_date: intervalRow.intervalStartDate,
        interval_end_date: intervalRow.intervalEndDate,
        games_added: intervalRow.gamesAdded,
        toi_added_minutes: intervalRow.toiAddedMinutes,
        overall_interval_score: intervalRow.overallIntervalScore,
        offensive_interval_score: intervalRow.offensiveIntervalScore,
        defensive_interval_score: intervalRow.defensiveIntervalScore,
        transition_interval_score: intervalRow.transitionIntervalScore,
        puck_management_interval_score: intervalRow.puckManagementIntervalScore,
        battle_compete_interval_score: intervalRow.battleCompeteIntervalScore,
        possession_interval_score: intervalRow.possessionIntervalScore,
        special_teams_interval_score: intervalRow.specialTeamsIntervalScore,
        discipline_risk_interval_score: intervalRow.disciplineRiskIntervalScore,
        overall_score_change: intervalRow.overallScoreChange,
        reliability_change: intervalRow.reliabilityChange,
        strongest_improvement: intervalRow.strongestImprovement,
        biggest_decline: intervalRow.biggestDecline,
        trend_label: intervalRow.trendLabel,
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  if (intervalRows.length) {
    const intervalInsertError = await insertInBatches("player_interval_scores", intervalRows);
    if (intervalInsertError && !isMissingRelationError(intervalInsertError)) {
      throw intervalInsertError;
    }
  }
}

async function saveGoalieSnapshots(params: {
  uploadedFile: UploadedFileMetadata;
  parsedStats: ReturnType<typeof buildGoalieSeasonStatsFromWorkbook>["stats"];
  scoreResults: ReturnType<typeof buildGoalieScores>;
  goalieIdByName: Map<string, string>;
}) {
  const snapshotDate = params.uploadedFile.createdAt;

  const snapshotRows = params.scoreResults
    .map((result) => {
      const matchingStat = params.parsedStats.find(
        (row) => row.playerName === result.score.entityName,
      );
      const goalieId = params.goalieIdByName.get(result.score.entityName);
      if (!matchingStat || !goalieId) {
        return null;
      }

      const snapshot = buildGoalieSnapshotRow({
        uploadId: params.uploadedFile.id,
        snapshotDate,
        goalieId,
        score: result.score,
        gamesPlayed: matchingStat.gamesPlayed,
        toiMinutes:
          matchingStat.toiSeconds === null ? null : matchingStat.toiSeconds / 60,
      });

      return {
        upload_id: snapshot.uploadId,
        season: snapshot.season,
        snapshot_date: snapshot.snapshotDate,
        goalie_id: snapshot.goalieId,
        goalie_name: snapshot.goalieName,
        games_played: snapshot.gamesPlayed,
        toi_minutes: snapshot.toiMinutes,
        overall_score: snapshot.overallScore,
        defensive_score: snapshot.defensiveScore,
        puck_management_score: snapshot.puckManagementScore,
        battle_compete_score: snapshot.battleCompeteScore,
        possession_score: snapshot.possessionScore,
        special_teams_score: snapshot.specialTeamsScore,
        discipline_risk_score: snapshot.disciplineRiskScore,
        reliability_score: snapshot.reliabilityScore,
        reliability_label: snapshot.reliabilityLabel,
        role_tags: snapshot.roleTags,
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  const snapshotInsertError = await insertInBatches("goalie_score_snapshots", snapshotRows);
  if (snapshotInsertError && !isMissingRelationError(snapshotInsertError)) {
    throw snapshotInsertError;
  }
}

export async function DELETE(request: Request) {
  const accessError = await requireAdminPlayerGoalieAccess();
  if (accessError) {
    return accessError;
  }

  const payload = (await request.json().catch(() => null)) as
    | { action?: string }
    | null;

  try {
    if (payload?.action === "clear_skaters") {
      return clearPlayerGoalieData("skaters");
    }

    if (payload?.action === "clear_goalies") {
      return clearPlayerGoalieData("goalies");
    }

    return NextResponse.json(
      { message: "Unsupported player-goalie delete action." },
      { status: 400 },
    );
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "Unable to clear player-goalie data right now.";

    return NextResponse.json({ message }, { status: 500 });
  }
}
