import { NextResponse } from "next/server";

import { isCurrentUserAdmin } from "@/lib/auth";
import { getDashboardData } from "@/lib/data";
import { hasSupabaseServiceRole } from "@/lib/env";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { buildGamesFromUpload, parseWorkbook } from "@/lib/upload";
import { slugify } from "@/lib/utils";

const GAME_STATS_INSERT_BATCH_SIZE = 500;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { message: "Please attach a CSV or Excel file." },
      { status: 400 },
    );
  }

  const source = await getDashboardData();
  const buffer = await file.arrayBuffer();
  const parsed = parseWorkbook(buffer, source.weights);

  if (parsed.missingRequiredColumns.length > 0) {
    return NextResponse.json(
      {
        message: `Missing required columns: ${parsed.missingRequiredColumns.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const parsedGames = buildGamesFromUpload(parsed.rows, source.weights, {
    season: formData.get("season"),
    homeAway: formData.get("homeAway"),
    summary: formData.get("summary"),
  });

  if (!parsedGames.length) {
    return NextResponse.json(
      { message: "No valid game rows were found in the uploaded file." },
      { status: 400 },
    );
  }

  if (!hasSupabaseServiceRole()) {
    return NextResponse.json({
      message:
        "Demo mode: the file parsed successfully, but it was not persisted because Supabase is not configured yet.",
    });
  }

  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) {
    return NextResponse.json(
      { message: "Only admin users can save game uploads." },
      { status: 401 },
    );
  }

  const supabase = createServiceSupabaseClient();
  const safeFilename = `${Date.now()}-${slugify(file.name) || "game-upload"}`;
  const storagePath = `game-files/${safeFilename}`;
  let storedPath: string | null = null;

  const storageResponse = await supabase.storage
    .from("game-uploads")
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });

  if (!storageResponse.error) {
    storedPath = storagePath;
  }

  const {
    data: uploadedFile,
    error: uploadedFileError,
  } = await supabase
    .from("uploaded_files")
    .insert({
      original_filename: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      storage_path: storedPath,
      inserted_count: parsedGames.length,
    })
    .select("id")
    .single();

  if (uploadedFileError) {
    return NextResponse.json(
      { message: uploadedFileError.message },
      { status: 500 },
    );
  }

  const weightByName = new Map(source.weights.map((weight) => [weight.name, weight]));
  const gamesPayload = parsedGames.map((game) => ({
    id: crypto.randomUUID(),
    season: game.season,
    game_date: game.date,
    opponent: game.opponent,
    result: game.result,
    result_bucket: game.resultBucket,
    home_away: game.homeAway,
    goals_for: game.goalsFor,
    goals_against: game.goalsAgainst,
    summary: game.summary,
    uploaded_file_id: uploadedFile.id,
  }));

  const { error: gamesError } = await supabase.from("games").insert(gamesPayload);
  if (gamesError) {
    return NextResponse.json({ message: gamesError.message }, { status: 500 });
  }

  const gameStatsPayload = parsedGames.flatMap((game, index) =>
    Object.entries(game.stats).map(([name, rawValue]) => {
      const weight = weightByName.get(name);

      return {
        id: crypto.randomUUID(),
        game_id: gamesPayload[index].id,
        kpi_key: weight?.key || slugify(name),
        kpi_name: name,
        category: weight?.category || "offense",
        raw_value: rawValue,
      };
    }),
  );

  if (gameStatsPayload.length > 0) {
    for (let index = 0; index < gameStatsPayload.length; index += GAME_STATS_INSERT_BATCH_SIZE) {
      const batch = gameStatsPayload.slice(
        index,
        index + GAME_STATS_INSERT_BATCH_SIZE,
      );
      const { error: statsError } = await supabase
        .from("game_stats")
        .insert(batch);

      if (statsError) {
        return NextResponse.json(
          { message: statsError.message },
          { status: 500 },
        );
      }
    }
  }

  return NextResponse.json({
    message: `Saved ${parsedGames.length} game${parsedGames.length === 1 ? "" : "s"} to Supabase.`,
  });
}
