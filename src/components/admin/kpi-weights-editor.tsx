"use client";

import { useMemo, useState } from "react";
import { LoaderCircle, RotateCcw, Save } from "lucide-react";

import type { KpiWeight } from "@/lib/types";
import { round } from "@/lib/utils";

interface KpiWeightsEditorProps {
  weights: KpiWeight[];
  isDemoMode: boolean;
}

type EditorState =
  | { status: "idle" }
  | { status: "saving"; message: string }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

export function KpiWeightsEditor({
  weights,
  isDemoMode,
}: KpiWeightsEditorProps) {
  const [draftWeights, setDraftWeights] = useState(weights);
  const [editorState, setEditorState] = useState<EditorState>({ status: "idle" });

  const totalWeight = useMemo(
    () => round(draftWeights.reduce((sum, weight) => sum + weight.weight, 0), 2),
    [draftWeights],
  );

  function updateWeight(id: string, patch: Partial<KpiWeight>) {
    setDraftWeights((current) =>
      current.map((weight) =>
        weight.id === id
          ? {
              ...weight,
              ...patch,
            }
          : weight,
      ),
    );
  }

  async function saveWeights() {
    setEditorState({ status: "saving", message: "Saving KPI weights..." });

    const response = await fetch("/api/admin/kpi-weights", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        weights: draftWeights.map((weight) => ({
          id: weight.id,
          category: weight.category,
          direction: weight.direction,
          weight: weight.weight,
          rValue: weight.rValue,
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
          <p className="section-title">Configured KPIs</p>
          <p className="mt-3 text-3xl font-semibold text-white">{draftWeights.length}</p>
          <p className="mt-2 text-sm text-slate-300">Live in the scoring model.</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="section-title">Weight total</p>
          <p className="mt-3 text-3xl font-semibold text-white">{totalWeight}</p>
          <p className="mt-2 text-sm text-slate-300">
            We normalize these weights into the 0-100 performance score.
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="section-title">Persistence</p>
          <p className="mt-3 text-xl font-semibold text-white">
            {isDemoMode ? "Demo only" : "Supabase connected"}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            {isDemoMode
              ? "You can adjust locally now, then save once the database is connected."
              : "Changes save directly to the kpi_weights table."}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {draftWeights.map((weight) => (
          <div
            key={weight.id}
            className="grid gap-4 rounded-4xl border border-white/10 bg-white/[0.03] p-5 lg:grid-cols-[1.4fr,1fr,1fr,1fr]"
          >
            <div>
              <p className="text-base font-semibold text-white">{weight.name}</p>
              <p className="mt-1 text-sm text-slate-300">{weight.notes}</p>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Weight
              </label>
              <input
                className="w-full accent-[#F7CF2F]"
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={weight.weight}
                onChange={(event) =>
                  updateWeight(weight.id, { weight: Number(event.target.value) })
                }
              />
              <p className="mt-2 text-sm text-white">{weight.weight.toFixed(2)}</p>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                R value
              </label>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                type="number"
                step="0.01"
                value={weight.rValue}
                onChange={(event) =>
                  updateWeight(weight.id, { rValue: Number(event.target.value) })
                }
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Category
                </label>
                <select
                  className="select-gold"
                  value={weight.category}
                  onChange={(event) =>
                    updateWeight(weight.id, {
                      category: event.target.value as KpiWeight["category"],
                    })
                  }
                >
                  <option value="offense">Offense</option>
                  <option value="defense">Defense</option>
                  <option value="special_teams">Special Teams</option>
                </select>
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
                      direction: event.target.value as KpiWeight["direction"],
                    })
                  }
                >
                  <option value="higher_is_better">Higher is better</option>
                  <option value="lower_is_better">Lower is better</option>
                </select>
              </div>
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
          Save KPI weights
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
