"use client";

import { useMemo, useState } from "react";
import { LoaderCircle, RotateCcw, Save } from "lucide-react";

import type { PlayerGoalieWeightEditorRow } from "@/lib/player-goalie-types";
import { round } from "@/lib/utils";

interface PlayerGoalieKpiWeightsEditorProps {
  title: string;
  description: string;
  weights: PlayerGoalieWeightEditorRow[];
  isDemoMode: boolean;
}

type EditorState =
  | { status: "idle" }
  | { status: "saving"; message: string }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

export function PlayerGoalieKpiWeightsEditor({
  title,
  description,
  weights,
  isDemoMode,
}: PlayerGoalieKpiWeightsEditorProps) {
  const [draftWeights, setDraftWeights] = useState(weights);
  const [editorState, setEditorState] = useState<EditorState>({ status: "idle" });

  const groupedWeights = useMemo(() => {
    const map = new Map<string, PlayerGoalieWeightEditorRow[]>();

    for (const weight of draftWeights) {
      const groupKey = `${weight.modelType} • ${weight.category}`;
      const current = map.get(groupKey) ?? [];
      current.push(weight);
      map.set(groupKey, current);
    }

    return Array.from(map.entries());
  }, [draftWeights]);

  const totalFinalWeight = useMemo(
    () => round(draftWeights.reduce((sum, weight) => sum + weight.finalWeightPct, 0), 2),
    [draftWeights],
  );

  function updateWeight(id: string, patch: Partial<PlayerGoalieWeightEditorRow>) {
    setDraftWeights((current) =>
      current.map((weight) => (weight.id === id ? { ...weight, ...patch } : weight)),
    );
  }

  async function saveWeights() {
    setEditorState({ status: "saving", message: `Saving ${title.toLowerCase()}...` });

    const response = await fetch("/api/admin/player-goalie-weights", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        weights: draftWeights.map((weight) => ({
          id: weight.id,
          sourceTable: weight.sourceTable,
          category: weight.category,
          direction: weight.direction,
          metricWeightInCategoryPct: weight.metricWeightInCategoryPct,
          finalWeightPct: weight.finalWeightPct,
          includeInV1Score: weight.includeInV1Score,
        })),
      }),
    });

    const payload = (await response.json()) as { message: string };

    if (!response.ok) {
      setEditorState({ status: "error", message: payload.message });
      return;
    }

    setEditorState({ status: "success", message: payload.message });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="section-title">Configured metrics</p>
          <p className="mt-3 text-3xl font-semibold text-white">{draftWeights.length}</p>
          <p className="mt-2 text-sm text-slate-300">{description}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="section-title">Final weight total</p>
          <p className="mt-3 text-3xl font-semibold text-white">{totalFinalWeight}</p>
          <p className="mt-2 text-sm text-slate-300">
            Stored as editable final-weight percentages in the player-goalie model.
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="section-title">Persistence</p>
          <p className="mt-3 text-xl font-semibold text-white">
            {isDemoMode ? "Demo only" : "Supabase connected"}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            {isDemoMode
              ? "Edits stay local until the player-goalie schema is live."
              : "Changes save directly to the player-goalie weight tables."}
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {groupedWeights.map(([group, rows]) => (
          <div
            key={group}
            className="rounded-4xl border border-white/10 bg-white/[0.03] p-5"
          >
            <h3 className="text-lg font-semibold text-white">{group}</h3>
            <div className="mt-4 space-y-4">
              {rows.map((weight) => (
                <div
                  key={weight.id}
                  className="grid gap-4 rounded-3xl border border-white/10 bg-white/[0.02] p-4 xl:grid-cols-[1.5fr,1fr,1fr,1fr,1fr]"
                >
                  <div>
                    <p className="font-semibold text-white">{weight.displayName}</p>
                    <p className="mt-1 text-sm text-slate-300">{weight.notes}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                      {weight.metricKey}
                    </p>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Category
                    </label>
                    <input
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                      value={weight.category}
                      onChange={(event) =>
                        updateWeight(weight.id, { category: event.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Direction
                    </label>
                    <select
                      className="select-gold"
                      value={weight.direction}
                      onChange={(event) =>
                        updateWeight(weight.id, {
                          direction: event.target.value as PlayerGoalieWeightEditorRow["direction"],
                        })
                      }
                    >
                      <option value="higher_is_better">Higher is better</option>
                      <option value="lower_is_better">Lower is better</option>
                      <option value="context_dependent">Context dependent</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Weight in category %
                    </label>
                    <input
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                      type="number"
                      step="0.1"
                      value={weight.metricWeightInCategoryPct}
                      onChange={(event) =>
                        updateWeight(weight.id, {
                          metricWeightInCategoryPct: Number(event.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Final weight %
                    </label>
                    <input
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                      type="number"
                      step="0.01"
                      value={weight.finalWeightPct}
                      onChange={(event) =>
                        updateWeight(weight.id, {
                          finalWeightPct: Number(event.target.value),
                        })
                      }
                    />
                    <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={weight.includeInV1Score}
                        onChange={(event) =>
                          updateWeight(weight.id, {
                            includeInV1Score: event.target.checked,
                          })
                        }
                      />
                      Include in V1 score
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white"
          onClick={() => {
            setDraftWeights(weights);
            setEditorState({ status: "idle" });
          }}
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-gold-300/35 bg-gold-300/15 px-5 py-3 text-sm font-semibold text-gold-50 disabled:opacity-50"
          onClick={saveWeights}
          disabled={editorState.status === "saving" || isDemoMode}
        >
          {editorState.status === "saving" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save {title}
        </button>
        {editorState.status !== "idle" ? (
          <p
            className={`text-sm ${
              editorState.status === "error" ? "text-rose-200" : "text-emerald-200"
            }`}
          >
            {editorState.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
