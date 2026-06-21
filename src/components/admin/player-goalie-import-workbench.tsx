"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, UploadCloud } from "lucide-react";

import { parsePlayerGoalieWorkbookPreview } from "@/lib/player-goalie-upload";
import type { PlayerGoalieUploadPreview } from "@/lib/player-goalie-types";

interface PlayerGoalieImportWorkbenchProps {
  isDemoMode: boolean;
  storedPlayerCount: number;
  storedGoalieCount: number;
  storedSeasons: string[];
}

type ImportKind = "skater_stats" | "goalie_stats";

type ImportState =
  | { status: "idle" }
  | { status: "saving"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

interface UploadCardState {
  file: File | null;
  season: string;
  preview: PlayerGoalieUploadPreview | null;
  state: ImportState;
}

function EmptyPreview() {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-400">
      Add a workbook to preview the first few rows and validate the required columns.
    </div>
  );
}

export function PlayerGoalieImportWorkbench({
  isDemoMode,
  storedPlayerCount,
  storedGoalieCount,
  storedSeasons,
}: PlayerGoalieImportWorkbenchProps) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [manageState, setManageState] = useState<ImportState>({ status: "idle" });
  const [skaterWorkbook, setSkaterWorkbook] = useState<UploadCardState>({
    file: null,
    season: storedSeasons.at(-1) ?? "",
    preview: null,
    state: { status: "idle" },
  });
  const [goalieWorkbook, setGoalieWorkbook] = useState<UploadCardState>({
    file: null,
    season: storedSeasons.at(-1) ?? "",
    preview: null,
    state: { status: "idle" },
  });

  async function handleFileChange(
    kind: ImportKind,
    file: File | null,
  ) {
    const updateState =
      kind === "skater_stats" ? setSkaterWorkbook : setGoalieWorkbook;

    if (!file) {
      updateState((current) => ({
        ...current,
        file: null,
        preview: null,
        state: { status: "idle" },
      }));
      return;
    }

    const buffer = await file.arrayBuffer();
    const preview = parsePlayerGoalieWorkbookPreview(
      buffer,
      kind === "skater_stats" ? "skater" : "goalie",
    );

    updateState((current) => ({
      ...current,
      file,
      preview,
      state: { status: "idle" },
    }));
  }

  async function submit(kind: ImportKind) {
    const current =
      kind === "skater_stats" ? skaterWorkbook : goalieWorkbook;
    const setState =
      kind === "skater_stats" ? setSkaterWorkbook : setGoalieWorkbook;

    if (!current.file) {
      return;
    }

    if (!current.season.trim()) {
      setState((state) => ({
        ...state,
        state: { status: "error", message: "Season is required for stat imports." },
      }));
      return;
    }

    setState((state) => ({
        ...state,
        state: {
          status: "saving",
          message: "Saving season aggregate data...",
      },
    }));

    const formData = new FormData();
    formData.append("kind", kind);
    formData.append("file", current.file);
    formData.append("season", current.season.trim());

    const response = await fetch("/api/admin/player-goalie/import", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as { message: string };

    if (!response.ok) {
      setState((state) => ({
        ...state,
        state: { status: "error", message: payload.message },
      }));
      return;
    }

    setState((state) => ({
      ...state,
      state: { status: "success", message: payload.message },
    }));
    startRefresh(() => {
      router.refresh();
    });
  }

  async function clearStoredData(target: "skaters" | "goalies") {
    const label = target === "skaters" ? "skater" : "goalie";
    if (
      !window.confirm(
        `Delete all stored ${label} season data, calculated metrics, and scores? The metric weight tables will stay in place.`,
      )
    ) {
      return;
    }

    setManageState({
      status: "saving",
      message: `Clearing stored ${label} data...`,
    });

    const response = await fetch("/api/admin/player-goalie/import", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: target === "skaters" ? "clear_skaters" : "clear_goalies",
      }),
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

  function renderPreview(preview: PlayerGoalieUploadPreview | null) {
    if (!preview) {
      return <EmptyPreview />;
    }

    if (!preview.previewColumns.length) {
      return (
        <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-400">
          No preview rows were found in the workbook.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <p className="section-title">Recognized columns</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {preview.matchedColumnCount}
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <p className="section-title">Preview rows</p>
            <p className="mt-2 text-2xl font-semibold text-white">{preview.rows.length}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <p className="section-title">Validation</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {preview.missingRequiredColumns.length === 0 ? "Ready" : "Needs fixes"}
            </p>
          </div>
        </div>

        {preview.missingRequiredColumns.length > 0 ? (
          <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            Missing required columns: {preview.missingRequiredColumns.join(", ")}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-3xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/5">
              <tr>
                {preview.previewColumns.map((column) => (
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
              {preview.rows.map((row, index) => (
                <tr key={`${index}-${row.Player ?? "row"}`} className="bg-white/[0.02]">
                  {preview.previewColumns.map((column) => (
                    <td key={`${index}-${column}`} className="px-4 py-3 text-slate-200">
                      {String(row[column] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderUploadCard(options: {
    eyebrow: string;
    title: string;
    description: string;
    kind: ImportKind;
    state: UploadCardState;
    requireSeason?: boolean;
  }) {
    const missingColumns = options.state.preview?.missingRequiredColumns ?? [];
    const disabledReason = !options.state.file
      ? "Attach a workbook file first."
      : options.requireSeason && !options.state.season.trim()
        ? "Enter a season before saving."
        : missingColumns.length > 0
          ? `Fix required columns: ${missingColumns.join(", ")}.`
          : isDemoMode
            ? "Saving is disabled in demo mode."
            : null;
    const canSubmit =
      Boolean(options.state.file) &&
      (!options.requireSeason || Boolean(options.state.season.trim())) &&
      missingColumns.length === 0;

    return (
      <div className="rounded-4xl border border-white/10 bg-white/[0.03] p-5">
        <p className="section-title">{options.eyebrow}</p>
        <h3 className="mt-2 text-xl font-semibold text-white">{options.title}</h3>
        <p className="mt-2 text-sm text-slate-300">{options.description}</p>

        <div className="mt-5 rounded-3xl border border-dashed border-gold-300/25 bg-gold-300/5 p-4">
          <div className="flex items-center gap-3 text-gold-100">
            <UploadCloud className="h-5 w-5" />
            <p className="text-sm font-semibold">Upload workbook</p>
          </div>
          <input
            className="mt-4 block w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-gold-300/20 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-gold-100"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(event) =>
              handleFileChange(options.kind, event.target.files?.[0] ?? null)
            }
          />

          {options.requireSeason ? (
            <input
              className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
              placeholder="Season, e.g. 2025-2026"
              value={options.state.season}
              onChange={(event) => {
                const nextSeason = event.target.value;
                const setter =
                  options.kind === "skater_stats" ? setSkaterWorkbook : setGoalieWorkbook;
                setter((current) => ({
                  ...current,
                  season: nextSeason,
                }));
              }}
            />
          ) : null}
        </div>

        <div className="mt-5">{renderPreview(options.state.preview)}</div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-gold-300/35 bg-gold-300/15 px-5 py-3 text-sm font-semibold text-gold-50 transition hover:bg-gold-300/20 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => submit(options.kind)}
            disabled={
              !canSubmit ||
              options.state.state.status === "saving" ||
              isRefreshing ||
              isDemoMode
            }
          >
            {options.state.state.status === "saving" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : null}
            Save season data
          </button>
          {disabledReason && options.state.state.status === "idle" ? (
            <p className="text-sm text-slate-400">{disabledReason}</p>
          ) : null}
          {options.state.state.status !== "idle" ? (
            <p
              className={`text-sm ${
                options.state.state.status === "error"
                  ? "text-rose-200"
                  : "text-emerald-200"
              }`}
            >
              {options.state.state.message}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="section-title">Stored skaters</p>
          <p className="mt-3 text-3xl font-semibold text-white">{storedPlayerCount}</p>
          <p className="mt-2 text-sm text-slate-300">
            Stored skater records across season, score, metric, snapshot, and player tables.
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="section-title">Stored goalies</p>
          <p className="mt-3 text-3xl font-semibold text-white">{storedGoalieCount}</p>
          <p className="mt-2 text-sm text-slate-300">
            Stored goalie records across season, score, metric, snapshot, and goalie tables.
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="section-title">Seasons on file</p>
          <p className="mt-3 text-xl font-semibold text-white">
            {storedSeasons.length ? storedSeasons.join(", ") : "None yet"}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Season strings available in the player-goalie tables.
          </p>
        </div>
      </div>

      <div className="rounded-4xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-title">Stored Player + Goalie Data</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Clear saved aggregate data</h3>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Remove stored skater or goalie season data, calculated metrics, and scores without touching the saved metric weight model.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                isDemoMode ||
                storedPlayerCount === 0 ||
                manageState.status === "saving" ||
                isRefreshing
              }
              onClick={() => clearStoredData("skaters")}
            >
              {manageState.status === "saving" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : null}
              Clear skater data
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                isDemoMode ||
                storedGoalieCount === 0 ||
                manageState.status === "saving" ||
                isRefreshing
              }
              onClick={() => clearStoredData("goalies")}
            >
              {manageState.status === "saving" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : null}
              Clear goalie data
            </button>
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
      </div>

      {isDemoMode ? (
        <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.03] px-4 py-4 text-sm text-slate-400">
          Demo mode: previews work now, but player-goalie imports persist only after the Supabase schema is installed.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {renderUploadCard({
          eyebrow: "Skater Aggregate",
          title: "Upload season skater stats",
          description:
            "Save broad Instat skater data, then calculate player scores only from the weighted Forward and Defense KPI tables.",
          kind: "skater_stats",
          state: skaterWorkbook,
          requireSeason: true,
        })}
        {renderUploadCard({
          eyebrow: "Goalie Aggregate",
          title: "Upload season goalie stats",
          description:
            "Save broad Instat goalie data, then calculate goalie scores only from the weighted goalie KPI table.",
          kind: "goalie_stats",
          state: goalieWorkbook,
          requireSeason: true,
        })}
      </div>
    </div>
  );
}
