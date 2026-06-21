"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, UploadCloud } from "lucide-react";

import { parseWorkbook } from "@/lib/upload";
import type { KpiWeight } from "@/lib/types";

interface UploadWorkbenchProps {
  weights: KpiWeight[];
  isDemoMode: boolean;
  savedGames: Array<{
    id: string;
    date: string;
    opponent: string;
    result: string;
    season: string;
    homeAway: string;
  }>;
}

type UploadState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string }
  | { status: "saving"; message: string };

export function UploadWorkbench({
  weights,
  isDemoMode,
  savedGames,
}: UploadWorkbenchProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<
    Array<Record<string, string | number | null>>
  >([]);
  const [previewColumns, setPreviewColumns] = useState<string[]>([]);
  const [matchedKpiCount, setMatchedKpiCount] = useState(0);
  const [missingRequiredColumns, setMissingRequiredColumns] = useState<string[]>(
    [],
  );
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [manageState, setManageState] = useState<UploadState>({ status: "idle" });
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  const canSave = useMemo(
    () =>
      Boolean(file) &&
      missingRequiredColumns.length === 0 &&
      previewRows.length > 0 &&
      matchedKpiCount > 0,
    [file, matchedKpiCount, missingRequiredColumns.length, previewRows.length],
  );
  const orderedSavedGames = useMemo(
    () =>
      [...savedGames].sort(
        (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime(),
      ),
    [savedGames],
  );

  const formatSavedDate = (value: string) =>
    new Intl.DateTimeFormat("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "America/Toronto",
    }).format(new Date(value));

  async function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setUploadState({ status: "idle" });

    if (!nextFile) {
      setPreviewRows([]);
      setPreviewColumns([]);
      setMatchedKpiCount(0);
      setMissingRequiredColumns([]);
      return;
    }

    const buffer = await nextFile.arrayBuffer();
    const parsed = parseWorkbook(buffer, weights);

    setPreviewRows(parsed.rows.slice(0, 5));
    setPreviewColumns(parsed.previewColumns);
    setMatchedKpiCount(parsed.matchedKpiCount);
    setMissingRequiredColumns(parsed.missingRequiredColumns);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file || !canSave) {
      return;
    }

    setUploadState({ status: "saving", message: "Saving game data..." });

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/admin/games/upload", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as { message: string };

    if (!response.ok) {
      setUploadState({ status: "error", message: payload.message });
      return;
    }

    setUploadState({
      status: "success",
      message: payload.message,
    });
    startRefresh(() => {
      router.refresh();
    });
  }

  async function handleDeleteGame(gameId: string) {
    if (!window.confirm("Delete this saved game and its stored stats?")) {
      return;
    }

    setPendingDeleteId(gameId);
    setManageState({ status: "saving", message: "Deleting saved game..." });

    const response = await fetch("/api/admin/games", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "delete_game", gameId }),
    });
    const payload = (await response.json()) as { message: string };

    if (!response.ok) {
      setManageState({ status: "error", message: payload.message });
      setPendingDeleteId(null);
      return;
    }

    setManageState({ status: "success", message: payload.message });
    setPendingDeleteId(null);
    startRefresh(() => {
      router.refresh();
    });
  }

  async function handleClearAll() {
    if (
      !window.confirm(
        "Delete all saved games and stats from Supabase? This cannot be undone.",
      )
    ) {
      return;
    }

    setManageState({ status: "saving", message: "Clearing saved game data..." });

    const response = await fetch("/api/admin/games", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "clear_all" }),
    });
    const payload = (await response.json()) as { message: string };

    if (!response.ok) {
      setManageState({ status: "error", message: payload.message });
      return;
    }

    setManageState({ status: "success", message: payload.message });
    startRefresh(() => {
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="rounded-4xl border border-dashed border-gold-300/35 bg-white/[0.03] p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-gold-300/25 bg-gold-300/10 text-gold-100">
            <UploadCloud className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-white">
            Upload one game file at a time
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-300">
            Drop a CSV or Excel file, preview the rows, validate the KPI columns,
            and save the game into Supabase so the dashboard updates automatically.
            Files with `Score` plus opponent prefixes like `@ Team` and `vs Team`
            are parsed automatically.
          </p>
          <input
            className="mt-6 block w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-gold-300/20 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-gold-100"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
          />
          {isDemoMode ? (
            <p className="mt-3 text-xs text-gold-100/80">
              Demo mode: previews work now, and the save endpoint will fully persist after Supabase is connected.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="section-title">Validation</p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {missingRequiredColumns.length === 0 ? "Ready" : "Needs fixes"}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Required columns: Date, Opponent, and either Result or Score
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="section-title">Preview rows</p>
            <p className="mt-3 text-3xl font-semibold text-white">{previewRows.length}</p>
            <p className="mt-2 text-sm text-slate-300">
              Showing up to the first five rows before save.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="section-title">Matched KPIs</p>
            <p className="mt-3 text-3xl font-semibold text-white">{matchedKpiCount}</p>
            <p className="mt-2 text-sm text-slate-300">
              KPI columns recognized from the configured weight model.
            </p>
          </div>
        </div>

        {missingRequiredColumns.length > 0 ? (
          <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            Missing required columns: {missingRequiredColumns.join(", ")}
          </div>
        ) : null}

        {previewColumns.length > 0 ? (
          <div className="overflow-hidden rounded-4xl border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-white/5">
                <tr>
                  {previewColumns.map((column) => (
                    <th
                      key={column}
                      className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-slate-400"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {previewRows.map((row, index) => (
                  <tr key={`${index}-${row.Date ?? "row"}`} className="bg-white/[0.02]">
                    {previewColumns.map((column) => (
                      <td key={`${index}-${column}`} className="px-4 py-3 text-slate-200">
                        {String(row[column] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            className="inline-flex items-center gap-2 rounded-full border border-gold-300/35 bg-gold-300/15 px-5 py-3 text-sm font-semibold text-gold-50 transition hover:bg-gold-300/20 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canSave || uploadState.status === "saving"}
            type="submit"
          >
            {uploadState.status === "saving" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : null}
            Save Game
          </button>
          {uploadState.status !== "idle" ? (
            <p
              className={`text-sm ${
                uploadState.status === "error" ? "text-rose-200" : "text-emerald-200"
              }`}
            >
              {uploadState.message}
            </p>
          ) : null}
        </div>
      </form>

      <div className="rounded-4xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-title">Stored Data</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Manage saved games</h3>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Remove individual saved games or clear the full saved dataset without touching the KPI weight model.
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={
              isDemoMode ||
              orderedSavedGames.length === 0 ||
              manageState.status === "saving" ||
              isRefreshing
            }
            type="button"
            onClick={handleClearAll}
          >
            {manageState.status === "saving" && pendingDeleteId === null ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : null}
            Clear all saved games
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="section-title">Saved games</p>
            <p className="mt-3 text-3xl font-semibold text-white">{orderedSavedGames.length}</p>
            <p className="mt-2 text-sm text-slate-300">
              Game records currently stored in Supabase.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="section-title">Control</p>
            <p className="mt-3 text-lg font-semibold text-white">
              {isDemoMode ? "Disabled in demo mode" : "Admin only"}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Deletes remove the saved game row and its related stat rows.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="section-title">Safety</p>
            <p className="mt-3 text-lg font-semibold text-white">Confirmation required</p>
            <p className="mt-2 text-sm text-slate-300">
              Each delete action prompts for confirmation before anything is removed.
            </p>
          </div>
        </div>

        {manageState.status !== "idle" ? (
          <p
            className={`mt-4 text-sm ${
              manageState.status === "error" ? "text-rose-200" : "text-emerald-200"
            }`}
          >
            {manageState.message}
          </p>
        ) : null}

        {isDemoMode ? (
          <div className="mt-5 rounded-3xl border border-dashed border-white/12 bg-white/3 px-4 py-4 text-sm text-slate-400">
            Stored-data controls are disabled in demo mode because there is no live Supabase dataset to clear.
          </div>
        ) : orderedSavedGames.length === 0 ? (
          <div className="mt-5 rounded-3xl border border-dashed border-white/12 bg-white/3 px-4 py-4 text-sm text-slate-400">
            No saved games are currently stored.
          </div>
        ) : (
          <div className="mt-5 max-h-[34rem] overflow-y-auto rounded-3xl border border-white/10">
            <div className="divide-y divide-white/8">
              {orderedSavedGames.map((game) => (
                <div
                  key={game.id}
                  className="flex flex-wrap items-center justify-between gap-4 bg-white/[0.02] px-4 py-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {game.opponent} · {game.result}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      {formatSavedDate(game.date)} · {game.season} · {game.homeAway}
                    </p>
                  </div>
                  <button
                    className="rounded-full border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      manageState.status === "saving" ||
                      isRefreshing ||
                      pendingDeleteId === game.id
                    }
                    type="button"
                    onClick={() => handleDeleteGame(game.id)}
                  >
                    {pendingDeleteId === game.id ? "Deleting..." : "Delete game"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
