import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isCurrentUserAdmin } from "@/lib/auth";
import { hasSupabaseServiceRole } from "@/lib/env";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

const PAGE_SIZE = 1000;

interface StoredGameRow {
  id: string;
  uploaded_file_id: string | null;
}

interface UploadedFileRow {
  id: string;
  storage_path: string | null;
}

async function requireAdminDeleteAccess() {
  if (!hasSupabaseServiceRole()) {
    return NextResponse.json(
      { message: "Demo mode does not support deleting stored games." },
      { status: 400 },
    );
  }

  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) {
    return NextResponse.json(
      { message: "Only admin users can manage saved games." },
      { status: 401 },
    );
  }

  return null;
}

async function selectAllRows<T>(table: string, columns = "*"): Promise<T[]> {
  const supabase = createServiceSupabaseClient();
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const batch = (data || []) as T[];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return rows;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function cleanupOrphanedUploads(uploadedFileIds: string[]) {
  const uniqueIds = [...new Set(uploadedFileIds.filter(Boolean))];
  if (!uniqueIds.length) {
    return;
  }

  const supabase = createServiceSupabaseClient();
  const { data: remainingGames, error: remainingGamesError } = await supabase
    .from("games")
    .select("uploaded_file_id")
    .in("uploaded_file_id", uniqueIds);

  if (remainingGamesError) {
    throw remainingGamesError;
  }

  const stillReferenced = new Set(
    (remainingGames || [])
      .map((row) => row.uploaded_file_id)
      .filter((value): value is string => Boolean(value)),
  );

  const orphanIds = uniqueIds.filter((id) => !stillReferenced.has(id));
  if (!orphanIds.length) {
    return;
  }

  const { data: orphanFiles, error: orphanFilesError } = await supabase
    .from("uploaded_files")
    .select("id, storage_path")
    .in("id", orphanIds);

  if (orphanFilesError) {
    throw orphanFilesError;
  }

  const typedFiles = (orphanFiles || []) as UploadedFileRow[];
  const storagePaths = typedFiles
    .map((file) => file.storage_path)
    .filter((path): path is string => Boolean(path));

  if (storagePaths.length) {
    await supabase.storage.from("game-uploads").remove(storagePaths);
  }

  const { error: deleteFilesError } = await supabase
    .from("uploaded_files")
    .delete()
    .in("id", orphanIds);

  if (deleteFilesError) {
    throw deleteFilesError;
  }
}

async function deleteGamesByIds(gameIds: string[], uploadedFileIds: string[]) {
  const supabase = createServiceSupabaseClient();

  for (const batch of chunk(gameIds, 500)) {
    const { error: statsError } = await supabase
      .from("game_stats")
      .delete()
      .in("game_id", batch);

    if (statsError) {
      throw statsError;
    }

    const { error: gamesError } = await supabase.from("games").delete().in("id", batch);

    if (gamesError) {
      throw gamesError;
    }
  }

  await cleanupOrphanedUploads(uploadedFileIds);
}

function revalidateDashboardPaths() {
  revalidatePath("/");
  revalidatePath("/game-analyzer");
  revalidatePath("/trends-history");
  revalidatePath("/team-comparison");
  revalidatePath("/admin/upload");
  revalidatePath("/calculation-audit");
}

export async function DELETE(request: Request) {
  const accessError = await requireAdminDeleteAccess();
  if (accessError) {
    return accessError;
  }

  const payload = (await request.json().catch(() => null)) as
    | { action?: string; gameId?: string }
    | null;
  const action = payload?.action;

  try {
    if (action === "delete_game") {
      if (!payload?.gameId) {
        return NextResponse.json(
          { message: "Select a saved game before deleting it." },
          { status: 400 },
        );
      }

      const supabase = createServiceSupabaseClient();
      const { data: gameRow, error: gameError } = await supabase
        .from("games")
        .select("id, uploaded_file_id")
        .eq("id", payload.gameId)
        .maybeSingle();

      if (gameError) {
        return NextResponse.json({ message: gameError.message }, { status: 500 });
      }

      if (!gameRow) {
        return NextResponse.json(
          { message: "That saved game could not be found." },
          { status: 404 },
        );
      }

      const typedRow = gameRow as StoredGameRow;
      await deleteGamesByIds([typedRow.id], typedRow.uploaded_file_id ? [typedRow.uploaded_file_id] : []);
      revalidateDashboardPaths();

      return NextResponse.json({ message: "Deleted the saved game and its stored stats." });
    }

    if (action === "clear_all") {
      const games = await selectAllRows<StoredGameRow>("games", "id, uploaded_file_id");

      if (!games.length) {
        return NextResponse.json({ message: "There are no saved games to clear." });
      }

      await deleteGamesByIds(
        games.map((game) => game.id),
        games
          .map((game) => game.uploaded_file_id)
          .filter((value): value is string => Boolean(value)),
      );
      revalidateDashboardPaths();

      return NextResponse.json({
        message: `Cleared ${games.length} saved game${games.length === 1 ? "" : "s"} and their stat rows.`,
      });
    }

    return NextResponse.json(
      { message: "Unsupported delete action." },
      { status: 400 },
    );
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "Unable to manage saved games right now.";

    return NextResponse.json({ message }, { status: 500 });
  }
}
