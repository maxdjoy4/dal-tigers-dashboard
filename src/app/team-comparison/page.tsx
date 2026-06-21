"use server";

import { CategoryScoreRows } from "@/components/dashboard/category-score-rows";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { MatchupTacticalRadarChart } from "@/components/charts/matchup-tactical-radar-chart";
import { DemoBanner } from "@/components/ui/demo-banner";
import { PageHero } from "@/components/ui/page-hero";
import { Panel } from "@/components/ui/panel";
import { CATEGORY_METADATA } from "@/lib/category-metadata";
import { getDashboardData } from "@/lib/data";
import {
  buildMatchupProfile,
  type MatchupStatus,
} from "@/lib/matchup-profile";
import { getOpponentDisplayName, getOpponentFullName } from "@/lib/opponents";
import type { CategoryVisualRow, DashboardFilters, TacticalDriverRow } from "@/lib/types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const formatSigned = (value: number | null, digits = 1) => {
  if (value === null || Number.isNaN(value)) {
    return "n/a";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
};

const formatScore = (value: number | null) => {
  if (value === null || Number.isNaN(value)) {
    return "Insufficient data";
  }

  return `${value.toFixed(1)}/100`;
};

const formatGameDate = (value: string) =>
  new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    timeZone: "America/Toronto",
  }).format(new Date(value));

const toneClass = (status: MatchupStatus) => {
  switch (status) {
    case "strength":
      return "border-emerald-400/25 bg-emerald-500/12 text-emerald-100";
    case "concern":
      return "border-rose-400/25 bg-rose-500/12 text-rose-100";
    default:
      return "border-white/10 bg-white/5 text-slate-200";
  }
};

function StatusPill({ status, label }: { status: MatchupStatus; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.22em] ${toneClass(status)}`}
    >
      {label}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-white/4 p-5">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-slate-400">
        {label}
      </p>
      <p className="mt-4 text-4xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-300">{caption}</p>
    </div>
  );
}

function SignalPanel({
  title,
  emptyText,
  kind,
  items,
}: {
  title: string;
  emptyText: string;
  kind: "positive" | "concern";
  items: Array<{
    title: string;
    takeaway: string;
    supportingData: string;
    impactLevel: string;
    focus?: string;
  }>;
}) {
  const badgeLabel = (value: string) => {
    if (kind === "positive") {
      if (value === "high") {
        return "Strength";
      }

      if (value === "medium") {
        return "Reliable";
      }

      return "Stable";
    }

    if (value === "high") {
      return "High priority";
    }

    if (value === "medium") {
      return "Medium priority";
    }

    return "Monitor";
  };

  const badgeTone =
    kind === "positive"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
      : "border-rose-400/20 bg-rose-500/10 text-rose-100";

  return (
    <Panel
      title={title}
      description="Coach-facing signals generated from category, tactical, and KPI matchup evidence."
      className="h-full"
    >
      {items.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-white/12 bg-white/3 p-5 text-sm text-slate-400">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item, index) => (
            <div
              key={`${item.title}-${index}`}
              className="rounded-[22px] border border-white/10 bg-white/4 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <span
                  className={`rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] ${badgeTone}`}
                >
                  {badgeLabel(item.impactLevel)}
                </span>
              </div>
              <p className="mt-3 text-sm font-medium text-slate-200">Coaching meaning</p>
              <p className="mt-2 text-sm leading-7 text-slate-300">{item.takeaway}</p>
              <p className="mt-4 text-sm font-medium text-slate-200">Supporting evidence</p>
              <p className="mt-2 text-sm leading-7 text-slate-400">{item.supportingData}</p>
              {item.focus ? (
                <>
                  <p className="mt-4 text-sm font-medium text-slate-200">Coaching focus</p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{item.focus}</p>
                </>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function CompactTacticalTable({ rows }: { rows: TacticalDriverRow[] }) {
  const ordered = [...rows].sort((a, b) => {
    const deltaDiff = Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0);
    if (deltaDiff !== 0) {
      return deltaDiff;
    }
    return (b.score ?? Number.NEGATIVE_INFINITY) - (a.score ?? Number.NEGATIVE_INFINITY);
  });

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="pb-3 pr-4 font-medium">Driver</th>
            <th className="pb-3 pr-4 font-medium">Vs Opponent</th>
            <th className="pb-3 pr-4 font-medium">Baseline</th>
            <th className="pb-3 pr-4 font-medium">Delta</th>
            <th className="pb-3 pr-4 font-medium">Status</th>
            <th className="pb-3 pr-4 font-medium">Coaching implication</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-slate-200">
          {ordered.map((row) => (
            <tr key={row.group}>
              <td className="py-3 pr-4">
                <div className="font-medium text-white">{row.label}</div>
                <div className="text-xs text-slate-400">
                  {row.validKpis}/{row.totalKpis} KPI with valid data
                </div>
              </td>
              <td className="py-3 pr-4">{formatScore(row.score)}</td>
              <td className="py-3 pr-4">{formatScore(row.baselineScore)}</td>
              <td className="py-3 pr-4">{formatSigned(row.delta)}</td>
              <td className="py-3 pr-4">
                <StatusPill
                  status={
                    row.status === "insufficient_data"
                      ? "neutral"
                      : row.status === "strength"
                        ? "strength"
                        : row.status === "concern"
                          ? "concern"
                          : "neutral"
                  }
                  label={
                    row.status === "strength"
                      ? "Edge"
                      : row.status === "concern"
                        ? "Concern"
                        : row.status === "insufficient_data"
                          ? "Limited"
                          : "Stable"
                  }
                />
              </td>
              <td className="py-3 pr-4 text-slate-300">{row.takeaway}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PracticePriorityCard({
  item,
}: {
  item: ReturnType<typeof buildMatchupProfile>["priorities"][number];
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Emphasis area
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">{item.title}</h3>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-200">
          {item.priorityLevel === "high"
            ? "High priority"
            : item.priorityLevel === "medium"
              ? "Medium priority"
              : "Monitor"}
        </span>
      </div>
      <div className="mt-4 grid gap-4 text-sm text-slate-300 md:grid-cols-2">
        <div>
          <p className="font-semibold text-white">Why it matters</p>
          <p className="mt-2 leading-7">{item.reason}</p>
        </div>
        <div>
          <p className="font-semibold text-white">Supporting data</p>
          <p className="mt-2 leading-7">{item.supportingData}</p>
        </div>
        <div>
          <p className="font-semibold text-white">Coaching focus</p>
          <p className="mt-2 leading-7">{item.coachingFocus}</p>
        </div>
        <div>
          <p className="font-semibold text-white">Bench cues</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.benchCues.map((cue) => (
              <span
                key={cue}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-100"
              >
                {cue}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function TeamComparisonPage(props: { searchParams?: SearchParams }) {
  const searchParams = (await props.searchParams) ?? {};
  const requestedFilters: DashboardFilters = {
    season: typeof searchParams.season === "string" ? searchParams.season : "all",
    range:
      typeof searchParams.range === "string"
        ? (searchParams.range as DashboardFilters["range"])
        : "all",
    opponent: typeof searchParams.opponent === "string" ? searchParams.opponent : "all",
    homeAway: typeof searchParams.homeAway === "string" ? searchParams.homeAway as DashboardFilters["homeAway"] : "all",
    result: typeof searchParams.result === "string" ? searchParams.result as DashboardFilters["result"] : "all",
  };

  const data = await getDashboardData();
  const availableOpponents = [
    ...new Set(
      data.games
        .filter((game) =>
          requestedFilters.season === "all" ? true : game.season === requestedFilters.season,
        )
        .map((game) => game.opponent),
    ),
  ].sort();
  const fallbackOpponent = availableOpponents[0] ?? "all";
  const filters: DashboardFilters =
    requestedFilters.opponent === "all" && fallbackOpponent !== "all"
      ? { ...requestedFilters, opponent: fallbackOpponent }
      : requestedFilters;

  const profile = buildMatchupProfile(data.games, data.weights, filters, data.demoMode);

  const selectedOpponentDisplay =
    profile.selectedOpponent === null ? "All Opponents" : getOpponentDisplayName(profile.selectedOpponent);
  const selectedOpponentFull =
    profile.selectedOpponent === null ? "All Opponents" : getOpponentFullName(profile.selectedOpponent);

  const categoryVisualRows: CategoryVisualRow[] = profile.categoryRows.map((row) => ({
    category: row.category,
    label: row.label,
    descriptor: CATEGORY_METADATA[row.category].shortDescription,
    score: row.focusedScore,
    statusLabel:
      row.status === "strength" ? "Edge" : row.status === "concern" ? "Concern" : "Stable",
    statusTone:
      row.status === "strength" ? "strength" : row.status === "concern" ? "concern" : "stable",
    detail:
      row.delta === null
        ? "Baseline unavailable"
        : `${formatSigned(row.delta)} vs baseline`,
  }));

  const heroChips = (
    <>
      <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100">
        Opponent: {selectedOpponentDisplay}
      </span>
      <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100">
        {profile.summary.gamesInFocus} game{profile.summary.gamesInFocus === 1 ? "" : "s"} in focus
      </span>
      <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100">
        {profile.summary.baselineGames} baseline game{profile.summary.baselineGames === 1 ? "" : "s"}
      </span>
    </>
  );

  const strongestTacticalArea =
    [...profile.tacticalDrivers]
      .filter((row) => row.score !== null && row.baselineScore !== null && row.delta !== null)
      .sort((left, right) => (right.delta ?? 0) - (left.delta ?? 0))[0] ?? null;
  const biggestTacticalConcern =
    [...profile.tacticalDrivers]
      .filter((row) => row.score !== null && row.baselineScore !== null && row.delta !== null)
      .sort((left, right) => (left.delta ?? 0) - (right.delta ?? 0))[0] ?? null;
  const tacticalNarrative =
    strongestTacticalArea && biggestTacticalConcern
      ? `${strongestTacticalArea.label} is holding closest to or above baseline, while ${biggestTacticalConcern.label} is being dragged down most in this matchup.`
      : "Not enough tactical matchup data is available to identify the clearest swing areas yet.";

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Opponent Matchup"
        title="Opponent Game Plan"
        description="See what has worked, what has hurt us, and what to prioritize before the next matchup."
        chips={heroChips}
      />

      <DemoBanner isDemoMode={profile.isDemoMode} />

      {profile.warnings.length > 0 ? (
        <div className="space-y-3">
          {profile.warnings.slice(0, 4).map((warning) => (
            <div
              key={warning}
              className="rounded-[22px] border border-amber-400/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-50"
            >
              {warning}
            </div>
          ))}
        </div>
      ) : null}

      <Panel
        title="Filters"
        description="Choose the matchup context you want to scout. Opponent is the most important filter here."
      >
        <FilterBar
          filters={profile.filters}
          options={profile.filterOptions}
          variant="opponent-first"
          requireOpponentSelection
        />
      </Panel>

      {profile.focusedGames.length === 0 ? (
        <Panel
          title="No Matchup Data"
          description="No games matched the current filter stack. Try widening the season or opponent filters."
        >
          <div className="rounded-[24px] border border-dashed border-white/12 bg-white/3 p-6 text-sm text-slate-300">
            We could not build an opponent plan from the current filter combination.
          </div>
        </Panel>
      ) : (
        <>
          <Panel
            title="Matchup Snapshot"
            description="A concise summary of how Dalhousie has fared in this opponent context."
          >
            <div className="rounded-[28px] border border-[#d6b25e]/15 bg-[linear-gradient(135deg,rgba(214,178,94,0.12),rgba(255,255,255,0.04))] p-6">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[#d6b25e]">
                    Matchup
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold text-white" title={selectedOpponentFull}>
                    {profile.selectedOpponent
                      ? `Dalhousie vs ${selectedOpponentDisplay}`
                      : profile.summary.headline}
                  </h2>
                  <p className="mt-4 max-w-4xl text-base leading-8 text-slate-200">
                    {profile.summary.narrative}
                  </p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/6 px-5 py-4 text-right">
                  <p className="text-[0.72rem] uppercase tracking-[0.24em] text-slate-400">Record</p>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    {profile.summary.focusedRecordLabel}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SummaryCard
                label="Matchup Score"
                value={formatScore(profile.summary.matchupScore)}
                caption="Average team score in the focused opponent sample."
              />
              <SummaryCard
                label="Season Baseline"
                value={formatScore(profile.summary.seasonBaselineScore)}
                caption="Average team score across the broader season context."
              />
              <SummaryCard
                label="Difference vs Baseline"
                value={formatSigned(profile.summary.differenceVsBaseline)}
                caption="How far this matchup sits above or below season standard."
              />
              <SummaryCard
                label="Games vs Opponent"
                value={`${profile.summary.gamesInFocus}`}
                caption={`${profile.summary.focusedRecordLabel} record in the selected matchup sample.`}
              />
              <SummaryCard
                label="Strongest Category"
                value={profile.summary.bestCategory ? profile.summary.bestCategory.label : "n/a"}
                caption={
                  profile.summary.bestCategory
                    ? `${formatSigned(profile.summary.bestCategory.delta)} vs baseline`
                    : "No scorable category edge found."
                }
              />
              <SummaryCard
                label="Biggest Concern"
                value={profile.summary.biggestConcern ? profile.summary.biggestConcern.label : "n/a"}
                caption={
                  profile.summary.biggestConcern
                    ? `${formatSigned(profile.summary.biggestConcern.delta)} vs baseline`
                    : "No major category concern found."
                }
              />
            </div>
          </Panel>

          <Panel
            title="Tactical Matchup Profile"
            description="How this opponent changes our tactical shape relative to the season baseline."
          >
            <div className="grid gap-6 xl:grid-cols-[1.55fr,0.95fr]">
              <MatchupTacticalRadarChart rows={profile.tacticalDrivers} />

              <div className="space-y-4">
                <div className="rounded-[24px] border border-white/10 bg-white/4 p-5">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#d6b25e]">
                    What this means
                  </p>
                  <p className="mt-4 text-sm leading-7 text-slate-200">{tacticalNarrative}</p>
                </div>
                <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-500/10 p-5">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-emerald-200">
                    Strongest tactical area
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-white">
                    {strongestTacticalArea?.label ?? "n/a"}
                  </p>
                  <p className="mt-2 text-sm text-emerald-100/90">
                    {strongestTacticalArea?.delta !== null && strongestTacticalArea?.delta !== undefined
                      ? `${formatSigned(strongestTacticalArea.delta)} vs baseline`
                      : "Insufficient data"}
                  </p>
                </div>
                <div className="rounded-[24px] border border-rose-400/20 bg-rose-500/10 p-5">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-rose-200">
                    Biggest tactical concern
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-white">
                    {biggestTacticalConcern?.label ?? "n/a"}
                  </p>
                  <p className="mt-2 text-sm text-rose-100/90">
                    {biggestTacticalConcern?.delta !== null && biggestTacticalConcern?.delta !== undefined
                      ? `${formatSigned(biggestTacticalConcern.delta)} vs baseline`
                      : "Insufficient data"}
                  </p>
                </div>
              </div>
            </div>
          </Panel>

          <div className="grid gap-6 xl:grid-cols-2">
            <SignalPanel
              title="What We Can Lean On"
              emptyText="No reliable matchup areas were identified in the current data."
              kind="positive"
              items={profile.workedSignals}
            />
            <SignalPanel
              title="What Needs Attention"
              emptyText="No clear matchup concerns were identified in the current data."
              kind="concern"
              items={profile.struggledSignals}
            />
          </div>

          <Panel
            title="Matchup Driver Summary"
            description="A compact read on the category and tactical areas that most swing this matchup."
          >
            <div className="space-y-8">
              <CategoryScoreRows rows={categoryVisualRows} layout="expanded" />

              {profile.tacticalDrivers.length > 0 ? (
                <div className="rounded-[24px] border border-white/10 bg-[#1a2234]/70 p-5">
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold text-white">Tactical swing areas</h3>
                    <p className="mt-2 text-sm text-slate-400">
                      These are the tactical groups creating the biggest matchup separation.
                    </p>
                  </div>
                  <CompactTacticalTable rows={profile.tacticalDrivers} />
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-white/12 bg-white/3 p-5 text-sm text-slate-400">
                  No tactical driver comparison was available for this opponent sample.
                </div>
              )}
            </div>
          </Panel>

          <Panel
            title="Coaching Notes for Next Matchup"
            description="Opponent-specific emphasis areas generated from matchup trends, KPI drags, and tactical concerns."
          >
            {profile.recommendationNotes.length > 0 ? (
              <div className="mb-4 space-y-2">
                {profile.recommendationNotes.map((note) => (
                  <div
                    key={note}
                    className="rounded-[18px] border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-50"
                  >
                    {note}
                  </div>
                ))}
              </div>
            ) : null}
            {profile.priorities.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-white/12 bg-white/3 p-6 text-sm text-slate-400">
                No clear coaching emphasis areas emerged from the current matchup sample.
              </div>
            ) : (
              <div className="space-y-4">
                {profile.priorities.map((item) => (
                  <PracticePriorityCard key={`${item.key}-${item.title}`} item={item} />
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Game Plan Reminders"
            description="Short bench cues generated from the top matchup emphasis areas."
          >
            {profile.gamePlanReminders.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-white/12 bg-white/3 p-6 text-sm text-slate-400">
                No game-plan reminders were generated from the current data.
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {profile.gamePlanReminders.map((theme) => (
                  <div
                    key={theme}
                    className="rounded-full border border-white/10 bg-white/4 px-4 py-2.5 text-sm text-slate-200"
                  >
                    {theme}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Game-by-Game Matchup History"
            description="Use this to see whether one game is skewing the overall opponent profile."
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  <tr>
                    <th className="pb-3 pr-4 font-medium">Date</th>
                    <th className="pb-3 pr-4 font-medium">Opponent</th>
                    <th className="pb-3 pr-4 font-medium">Result</th>
                    <th className="pb-3 pr-4 font-medium">Matchup Score</th>
                    <th className="pb-3 pr-4 font-medium">Offense</th>
                    <th className="pb-3 pr-4 font-medium">Defense</th>
                    <th className="pb-3 pr-4 font-medium">Special Teams</th>
                    <th className="pb-3 pr-4 font-medium">Strongest KPI</th>
                    <th className="pb-3 pr-4 font-medium">Biggest Concern</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {profile.gameRows.map((row) => (
                    <tr key={row.id}>
                      <td className="py-3 pr-4">{formatGameDate(row.date)}</td>
                      <td className="py-3 pr-4" title={getOpponentFullName(row.opponent)}>
                        {getOpponentDisplayName(row.opponent)}
                      </td>
                      <td className="py-3 pr-4">{row.result}</td>
                      <td className="py-3 pr-4">{formatScore(row.teamScore)}</td>
                      <td className="py-3 pr-4">{formatScore(row.offenseScore)}</td>
                      <td className="py-3 pr-4">{formatScore(row.defenseScore)}</td>
                      <td className="py-3 pr-4">{formatScore(row.specialTeamsScore)}</td>
                      <td className="py-3 pr-4">{row.topPositiveKpi ?? "n/a"}</td>
                      <td className="py-3 pr-4">{row.topNegativeKpi ?? "n/a"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

        </>
      )}
    </div>
  );
}
