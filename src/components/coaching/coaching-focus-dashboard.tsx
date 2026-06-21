import type { ReactNode } from "react";

import type {
  CoachingFocusMicroRecommendation,
  CoachingFocusPageModel,
  CoachingFocusTeamRecommendation,
  TeamPriorityCandidate,
} from "@/lib/coaching-focus";

type SnapshotView = "latest" | "compare";

interface CoachingFocusDashboardProps {
  seasons: string[];
  selectedSeason: string;
  snapshotView: SnapshotView;
  includeSpecialTeams: boolean;
  model: CoachingFocusPageModel;
}

function levelTone(level: TeamPriorityCandidate["priorityLevel"]) {
  switch (level) {
    case "critical":
      return "border-rose-300/30 bg-rose-300/10 text-rose-100";
    case "high":
      return "border-amber-300/30 bg-amber-300/10 text-amber-100";
    case "medium":
      return "border-sky-300/30 bg-sky-300/10 text-sky-100";
    case "monitor":
      return "border-white/10 bg-white/[0.06] text-slate-200";
  }
}

function confidenceTone(confidence: string) {
  switch (confidence) {
    case "High confidence":
      return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
    case "Moderate confidence":
      return "border-sky-300/25 bg-sky-300/10 text-sky-100";
    case "Low confidence":
      return "border-amber-300/25 bg-amber-300/10 text-amber-100";
    case "Data limited":
      return "border-white/10 bg-white/[0.06] text-slate-200";
    default:
      return "border-white/10 bg-white/[0.06] text-slate-200";
  }
}

function rankLabel(index: number) {
  return String(index + 1).padStart(2, "0");
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      {children}
    </div>
  );
}

function LineList({ items }: { items: string[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <p key={item} className="text-sm leading-6 text-slate-200">
          {item}
        </p>
      ))}
    </div>
  );
}

function ChipRow({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-medium text-slate-100"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function TeamPriorityCard({
  priority,
  index,
  snapshotView,
}: {
  priority: CoachingFocusTeamRecommendation;
  index: number;
  snapshotView: SnapshotView;
}) {
  return (
    <article className="glass-panel gold-ring rounded-[2rem] px-6 py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-gold-100">
              {rankLabel(index)}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${levelTone(priority.priorityLevel.toLowerCase() as TeamPriorityCandidate["priorityLevel"])}`}
            >
              {priority.priorityLevel}
            </span>
          </div>
          <h2 className="max-w-4xl text-2xl font-semibold leading-tight text-white">
            {priority.title}
          </h2>
          {snapshotView === "compare" && priority.compareNote ? (
            <p className="max-w-3xl text-sm leading-6 text-slate-400">{priority.compareNote}</p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Data confidence
          </p>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-100">{priority.dataConfidence}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <Field label="Team Focus Title">
          <p className="text-sm leading-7 text-slate-200">{priority.title}</p>
        </Field>
        <Field label="Priority Level">
          <p className="text-sm leading-7 text-slate-200">{priority.priorityLevel}</p>
        </Field>
        <Field label="Macro Diagnosis">
          <p className="text-sm leading-7 text-slate-200">{priority.coachingDiagnosis}</p>
        </Field>
        <Field label="Why It Matters">
          <p className="text-sm leading-7 text-slate-200">{priority.whyItMatters}</p>
        </Field>
        <Field label="Key Numbers">
          <LineList items={priority.keyNumbers} />
        </Field>
        <Field label="Players / Groups Connected">
          <ChipRow items={priority.playersGroupsConnected} />
        </Field>
        <Field label="Team Practice Theme">
          <p className="text-sm leading-7 text-slate-200">{priority.teamPracticeTheme}</p>
        </Field>
        <Field label="Team Video Cue">
          <p className="text-sm leading-7 text-slate-200">{priority.teamVideoCue}</p>
        </Field>
        <Field label="KPI Follow-Up">
          <ChipRow items={priority.kpiFollowUp} />
        </Field>
        <Field label="Data Confidence">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${confidenceTone(priority.dataConfidence)}`}
            >
              {priority.dataConfidence}
            </span>
          </div>
        </Field>
      </div>
    </article>
  );
}

function IndividualPriorityCard({
  priority,
  index,
  snapshotView,
}: {
  priority: CoachingFocusMicroRecommendation;
  index: number;
  snapshotView: SnapshotView;
}) {
  return (
    <article className="glass-panel gold-ring rounded-[2rem] px-6 py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-gold-100">
              {rankLabel(index)}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${levelTone(priority.priorityLevel.toLowerCase() as TeamPriorityCandidate["priorityLevel"])}`}
            >
              {priority.priorityLevel}
            </span>
          </div>
          <h3 className="max-w-4xl text-2xl font-semibold leading-tight text-white">
            {priority.title}
          </h3>
          {snapshotView === "compare" && priority.compareNote ? (
            <p className="max-w-3xl text-sm leading-6 text-slate-400">{priority.compareNote}</p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Data confidence
          </p>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-100">{priority.dataConfidence}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <Field label="Micro Skill Focus">
          <p className="text-sm leading-7 text-slate-200">{priority.title}</p>
        </Field>
        <Field label="Priority Level">
          <p className="text-sm leading-7 text-slate-200">{priority.priorityLevel}</p>
        </Field>
        <Field label="Individual Tactic Diagnosis">
          <p className="text-sm leading-7 text-slate-200">{priority.individualTacticDiagnosis}</p>
        </Field>
        <Field label="Why It Matters">
          <p className="text-sm leading-7 text-slate-200">{priority.whyItMatters}</p>
        </Field>
        <Field label="Key Numbers">
          <LineList items={priority.keyNumbers} />
        </Field>
        <Field label="Skill Detail to Coach">
          <LineList items={priority.skillDetailToCoach} />
        </Field>
        <Field label="Video Clips to Pull">
          <p className="text-sm leading-7 text-slate-200">{priority.videoClipsToPull}</p>
        </Field>
        <Field label="Practice Rep Idea">
          <p className="text-sm leading-7 text-slate-200">{priority.practiceRepIdea}</p>
        </Field>
        <Field label="KPI Follow-Up">
          <ChipRow items={priority.kpiFollowUp} />
        </Field>
        <Field label="Data Confidence">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${confidenceTone(priority.dataConfidence)}`}
          >
            {priority.dataConfidence}
          </span>
        </Field>
      </div>
    </article>
  );
}

function DiagnosticsBlock({ model }: { model: CoachingFocusPageModel }) {
  return (
    <details className="glass-panel gold-ring rounded-[2rem] px-6 py-5">
      <summary className="cursor-pointer list-none text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">
        Advanced Diagnostics
      </summary>
      <div className="mt-6 space-y-6">
        <p className="text-sm leading-7 text-slate-400">
          Underlying evidence and player-level links.
        </p>
        {model.warnings.length ? (
          <div className="flex flex-wrap gap-2">
            {model.warnings.map((warning) => (
              <span
                key={warning}
                className="rounded-full border border-gold-300/20 bg-gold-300/10 px-3 py-2 text-xs text-gold-100"
              >
                {warning}
              </span>
            ))}
          </div>
        ) : null}

        <div className="grid gap-3 text-sm text-slate-400 md:grid-cols-2">
          <p>
            Evidence hash:{" "}
            <span className="font-mono text-slate-300">
              {model.aiDiagnostics.evidenceHash ?? "n/a"}
            </span>
          </p>
          <p>
            AI status:{" "}
            <span className="text-slate-300">
              {model.aiGenerated
                ? `generated${model.aiDiagnostics.modelUsed ? ` with ${model.aiDiagnostics.modelUsed}` : ""}`
                : "deterministic fallback"}
            </span>
          </p>
          {model.aiDiagnostics.generatedAt ? (
            <p>Generated at: <span className="text-slate-300">{model.aiDiagnostics.generatedAt}</span></p>
          ) : null}
          {model.aiDiagnostics.note ? (
            <p>{model.aiDiagnostics.note}</p>
          ) : null}
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Team priority scoring
            </p>
            {model.teamCandidates.slice(0, 6).map((priority) => (
              <div
                key={priority.key}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm font-semibold text-white">{priority.title}</p>
                  <span className="text-sm font-semibold text-slate-200">
                    {priority.priorityScore.toFixed(1)}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                  <p>Model weight: {priority.diagnostics.teamModelImportance.toFixed(1)}</p>
                  <p>Weakness severity: {priority.diagnostics.weaknessSeverity.toFixed(1)}</p>
                  <p>Player pattern support: {priority.diagnostics.playerPatternSupport.toFixed(1)}</p>
                  <p>High-usage relevance: {priority.diagnostics.highUsageGroupRelevance.toFixed(1)}</p>
                  <p>xG / chance link: {priority.diagnostics.xgOrChanceConnection.toFixed(1)}</p>
                  <p>Trend direction: {priority.diagnostics.trendDirection.toFixed(1)}</p>
                  <p>Goalie context: {priority.diagnostics.goalieContextFactor.toFixed(1)}</p>
                  <p>Reliability: {priority.diagnostics.reliabilityScore.toFixed(1)}</p>
                </div>
                <div className="mt-3 space-y-2 text-sm text-slate-400">
                  <p>Linked team KPIs: {priority.diagnostics.linkedTeamKpis.join(", ") || "n/a"}</p>
                  <p>
                    Linked player evidence:{" "}
                    {priority.diagnostics.linkedPlayerMetrics.join(", ") || "n/a"}
                  </p>
                  {priority.diagnostics.linkedGoalieEvidence.length ? (
                    <p>
                      Goalie context: {priority.diagnostics.linkedGoalieEvidence.join(", ")}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Micro priority scoring
            </p>
            {model.individualCandidates.slice(0, 6).map((priority) => (
              <div
                key={priority.key}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm font-semibold text-white">{priority.microSkillFocus}</p>
                  <span className="text-sm font-semibold text-slate-200">
                    {priority.priorityScore.toFixed(1)}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                  <p>Gap severity: {priority.diagnostics.developmentGapSeverity.toFixed(1)}</p>
                  <p>Team priority link: {priority.diagnostics.teamPriorityConnection.toFixed(1)}</p>
                  <p>Pattern frequency: {priority.diagnostics.playerPatternFrequency.toFixed(1)}</p>
                  <p>Skill specificity: {priority.diagnostics.skillSpecificity.toFixed(1)}</p>
                  <p>Usage relevance: {priority.diagnostics.usageRelevance.toFixed(1)}</p>
                  <p>Fixability: {priority.diagnostics.fixability.toFixed(1)}</p>
                  <p>Reliability: {priority.diagnostics.reliabilityScore.toFixed(1)}</p>
                  <p>Trend / change: {priority.diagnostics.trendOrSnapshotChange.toFixed(1)}</p>
                </div>
                <p className="mt-3 text-sm text-slate-400">
                  Linked groups: {priority.linkedGroups.join(", ") || "n/a"}
                </p>
              </div>
            ))}
          </div>
        </div>

        {model.aiDiagnostics.evidenceBundle ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Evidence bundle sent to AI
            </p>
            <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-6 text-slate-300">
              {JSON.stringify(model.aiDiagnostics.evidenceBundle, null, 2)}
            </pre>
          </div>
        ) : null}

        {model.aiDiagnostics.aiOutput ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              AI output JSON
            </p>
            <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-6 text-slate-300">
              {JSON.stringify(model.aiDiagnostics.aiOutput, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
    </details>
  );
}

export function CoachingFocusDashboard({
  seasons,
  selectedSeason,
  snapshotView,
  includeSpecialTeams,
  model,
}: CoachingFocusDashboardProps) {
  const teamPriorities = model.renderedTeamPriorities;
  const individualPriorities = model.renderedMicroPriorities;

  return (
    <div className="space-y-8">
      <header className="glass-panel gold-ring rounded-[2rem] px-6 py-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold-100">
              Coaching Focus
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-white">
              This week&apos;s staff brief
            </h1>
            <p className="max-w-3xl text-base leading-7 text-slate-300">
              Turn team and player analytics into this week&apos;s practice and video plan.
            </p>
            <p className="text-sm text-slate-400">{model.updatedLabel}</p>
          </div>

          <form action="/coaching-focus" method="get" className="grid gap-3 md:grid-cols-4">
            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Season
              </span>
              <select name="season" defaultValue={selectedSeason} className="select-gold h-12 min-w-[170px]">
                {seasons.map((season) => (
                  <option key={season} value={season}>
                    {season}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Snapshot
              </span>
              <select
                name="snapshot"
                defaultValue={snapshotView}
                className="select-gold h-12 min-w-[190px]"
              >
                <option value="latest">Latest snapshot</option>
                {model.compareAvailable ? (
                  <option value="compare">Current vs previous upload</option>
                ) : null}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Special teams
              </span>
              <select
                name="specialTeams"
                defaultValue={includeSpecialTeams ? "include" : "exclude"}
                className="select-gold h-12 min-w-[170px]"
              >
                <option value="include">Include</option>
                <option value="exclude">Exclude</option>
              </select>
            </label>

            <button
              type="submit"
              name="regenerate"
              value="1"
              className="mt-auto h-12 rounded-2xl border border-gold-300/30 bg-gold-300/15 px-5 text-sm font-semibold text-gold-100 transition hover:bg-gold-300/20"
            >
              Update brief
            </button>
          </form>
        </div>

        {model.warnings.length ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {model.warnings.map((warning) => (
              <span
                key={warning}
                className="rounded-full border border-gold-300/20 bg-gold-300/10 px-3 py-2 text-xs text-gold-100"
              >
                {warning}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      <section className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            This Week&apos;s Team Priorities
          </p>
          <h2 className="text-2xl font-semibold text-white">Macro team themes for full-group practice and video.</h2>
        </div>
        <div className="space-y-5">
          {teamPriorities.map((priority, index) => (
            <TeamPriorityCard
              key={`${priority.rank}-${priority.title}`}
              priority={priority}
              index={index}
              snapshotView={snapshotView}
            />
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Micro Priorities
          </p>
          <h2 className="text-2xl font-semibold text-white">Individual tactics and skill details that support the team plan.</h2>
        </div>
        <div className="space-y-5">
          {individualPriorities.map((priority, index) => (
            <IndividualPriorityCard
              key={`${priority.rank}-${priority.title}`}
              priority={priority}
              index={index}
              snapshotView={snapshotView}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Staff Note
          </p>
          <h2 className="text-2xl font-semibold text-white">What the staff should lead with next</h2>
        </div>
        <div className="glass-panel gold-ring rounded-[2rem] px-6 py-6">
          <p className="text-base leading-8 text-slate-200">{model.renderedStaffNote.body}</p>
        </div>
      </section>

      <DiagnosticsBlock model={model} />
    </div>
  );
}
