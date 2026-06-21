"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Search,
  Sparkles,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Panel } from "@/components/ui/panel";
import { cn, clamp, round } from "@/lib/utils";

export interface SquadOverviewRow {
  id: string;
  name: string;
  season: string;
  modelType: "Forward" | "Defense";
  position: "F" | "D" | "Unknown";
  gamesPlayed: number | null;
  toiMinutes: number | null;
  overallScore: number | null;
  reliabilityScore: number | null;
  reliabilityFlag: string | null;
  topCategory: string | null;
  developmentCategory: string | null;
  archetype: string;
  archetypeColor: string;
  secondaryArchetype: string | null;
  archetypeConfidence: string;
  styleTags: string[];
  latestTrendLabel: string | null;
  latestOverallChange: number | null;
  categoryScores: Array<{
    category: string;
    score: number | null;
  }>;
  diagnostics: {
    adjustedByContradiction: boolean;
    scoreGap: number | null;
    topSignals: string[];
    cautionSignals: string[];
    scoreSummary: string[];
  };
  rawStats: Record<string, string | number | null>;
}

export interface GoalieSeasonSummary {
  id: string;
  season: string;
}

interface SquadOverviewDashboardProps {
  seasons: string[];
  initialSeason: string;
  rows: SquadOverviewRow[];
  goalieRows: GoalieSeasonSummary[];
}

type ScatterMode = "usageImpact" | "offenseDefense";
type SortKey =
  | "name"
  | "position"
  | "archetype"
  | "overallScore"
  | "toiMinutes"
  | "gamesPlayed"
  | "topCategory"
  | "developmentCategory"
  | "reliability";
type SortDirection = "asc" | "desc";

interface CoachingInsight {
  headline: string;
  whyItMatters: string;
  specificQuestion: string;
  relatedPlayers?: string[];
  tag: string;
}

const METRIC_ALIASES: Record<string, string[]> = {
  goals: ["goals"],
  xg_expected: ["xg", "xg_expected"],
  net_xg: ["net_xg_xg_player_on_minus_opp_teams_xg", "net_xg"],
  passes_to_slot: ["passes_to_the_slot", "passes_to_slot"],
  pre_shots_passes: ["preminusshots_passes", "pre_shots_passes"],
  assists: ["assists"],
  first_assist: ["first_assist"],
  shots_on_goal: ["shots_on_goal"],
  inner_slot_shots: ["inner_slot_shots_minus_total", "inner_slot_shots"],
  entries_stickhandling: ["entries_via_stickhandling", "entries_stickhandling"],
  breakouts_stickhandling: ["breakouts_via_stickhandling", "breakouts_stickhandling"],
  puck_control_time: ["puck_control_time"],
  puck_battle_win_pct: ["puck_battles_won_pct", "puck_battle_win_pct"],
  ev_oz_retrievals: ["ev_oz_retrievals"],
  takeaways_oz: ["takeaways_in_oz", "takeaways_oz"],
  puck_losses_dz: ["puck_losses_in_dz", "puck_losses_dz"],
  error_leading_to_goal: ["error_leading_to_goal"],
  corsi_pct: ["corsi_for_pct", "corsi_pct"],
  fenwick_pct: ["fenwick_for_pct", "fenwick_pct"],
  pp_time: ["pp_time"],
  sh_time: ["sh_time"],
};

const PERCENT_METRICS = new Set([
  "puck_battle_win_pct",
  "corsi_pct",
  "fenwick_pct",
]);

function formatScore(value: number | null) {
  return value === null ? "n/a" : value.toFixed(1);
}

function formatMinutes(value: number | null) {
  return value === null ? "n/a" : `${Math.round(value)} min`;
}

function formatDelta(value: number | null) {
  if (value === null) {
    return "n/a";
  }

  const rounded = round(value, 1);
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}`;
}

function formatReliability(value: number | null) {
  return value === null ? "n/a" : `${value.toFixed(0)}`;
}

function getToiPerGame(row: SquadOverviewRow) {
  if (
    row.toiMinutes === null ||
    row.gamesPlayed === null ||
    row.gamesPlayed <= 0
  ) {
    return null;
  }

  return row.toiMinutes / row.gamesPlayed;
}

function getReliabilityBucket(row: SquadOverviewRow) {
  if (row.gamesPlayed !== null && row.gamesPlayed < 5) {
    return "Limited Sample";
  }

  if (row.reliabilityScore === null) {
    return "Unknown";
  }

  if (row.reliabilityScore >= 80) {
    return "Established";
  }

  if (row.reliabilityScore >= 60) {
    return "Developing";
  }

  return "Fragile";
}

function getStatusTag(row: SquadOverviewRow, averageScore: number | null) {
  if (row.gamesPlayed !== null && row.gamesPlayed < 5) {
    return "Limited Sample";
  }

  if (row.overallScore === null || averageScore === null) {
    return "Watch";
  }

  if (row.overallScore >= averageScore + 8) {
    return "Driver";
  }

  if (row.archetype.includes("Two-Way")) {
    return "Balanced";
  }

  if (row.overallScore <= averageScore - 6) {
    return "Needs Support";
  }

  if (row.secondaryArchetype) {
    return "Specialist";
  }

  return "Watch";
}

function describeArchetypeLean(archetype: string) {
  if (archetype.includes("Power / Forechecking")) {
    return "pressure, battles, and recoveries";
  }

  if (archetype.includes("Playmaker")) {
    return "distribution, setup, and chance creation";
  }

  if (archetype.includes("Scorer")) {
    return "finishing touches and inside-ice threat";
  }

  if (archetype.includes("Two-Way")) {
    return "balanced impact at both ends";
  }

  if (archetype.includes("Puck-Moving")) {
    return "breakouts, support, and clean puck movement";
  }

  if (archetype.includes("Offensive")) {
    return "blue-line attack and offensive support";
  }

  if (archetype.includes("Shutdown")) {
    return "defensive detail and hard-minute suppression";
  }

  return "a repeatable team role";
}

function coerceMetricValue(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.includes(":")) {
      const [minutesPart, secondsPart] = trimmed.split(":");
      const minutes = Number(minutesPart);
      const seconds = Number(secondsPart);
      if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
        return minutes + seconds / 60;
      }
    }

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  return null;
}

function getMetricValue(row: SquadOverviewRow, metricKey: string) {
  const aliases = METRIC_ALIASES[metricKey] ?? [metricKey];

  for (const alias of aliases) {
    const raw = row.rawStats[alias];
    const numeric = coerceMetricValue(raw);
    if (numeric === null) {
      continue;
    }

    if (PERCENT_METRICS.has(metricKey)) {
      return Math.abs(numeric) > 1 ? numeric / 100 : numeric;
    }

    return numeric;
  }

  return null;
}

function buildTeamMetricAverages(rows: SquadOverviewRow[]) {
  const totals = new Map<string, { sum: number; count: number }>();

  for (const row of rows) {
    for (const [key, rawValue] of Object.entries(row.rawStats)) {
      const numeric = coerceMetricValue(rawValue);
      if (numeric === null) {
        continue;
      }

      const current = totals.get(key) ?? { sum: 0, count: 0 };
      totals.set(key, { sum: current.sum + numeric, count: current.count + 1 });
    }
  }

  const averages = new Map<string, number>();
  for (const [key, value] of totals.entries()) {
    averages.set(key, value.sum / value.count);
  }

  return averages;
}

function getMetricAverage(averages: Map<string, number>, metricKey: string) {
  const aliases = METRIC_ALIASES[metricKey] ?? [metricKey];

  for (const alias of aliases) {
    const average = averages.get(alias);
    if (average === undefined) {
      continue;
    }

    if (PERCENT_METRICS.has(metricKey)) {
      return Math.abs(average) > 1 ? average / 100 : average;
    }

    return average;
  }

  return null;
}

function relativeToTeamAverage(
  value: number | null,
  average: number | null,
  { digits = 0, absoluteFloor = 0.05 }: { digits?: number; absoluteFloor?: number } = {},
) {
  if (value === null || average === null) {
    return null;
  }

  if (Math.abs(average) <= absoluteFloor) {
    return value >= average ? "above the team average" : "below the team average";
  }

  const delta = ((value - average) / Math.abs(average)) * 100;
  const rounded = round(Math.abs(delta), digits);

  if (rounded < 1) {
    return "around the team average";
  }

  return `${rounded.toFixed(digits)}% ${delta >= 0 ? "above" : "below"} the team average`;
}

function mapDevelopmentTheme(category: string) {
  if (category.includes("Special Teams")) {
    return "power-play / penalty-kill execution";
  }
  if (category.includes("Puck Management")) {
    return "puck security under pressure";
  }
  if (category.includes("Defensive")) {
    return "defensive-zone detail and chance suppression";
  }
  if (category.includes("Transition")) {
    return "entries, exits, and middle-lane support";
  }
  if (category.includes("Offensive")) {
    return "creating more dangerous offense";
  }
  if (category.includes("Battle")) {
    return "recoveries and second-touch battles";
  }
  if (category.includes("Possession")) {
    return "turning touches into sustained control";
  }
  if (category.includes("Discipline")) {
    return "penalties and high-cost risk";
  }

  return "the repeat area that needs the most attention";
}

function getBadgeTone(label: string | null) {
  if (!label) {
    return "border-white/10 bg-white/5 text-slate-300";
  }

  if (
    label.includes("Driver") ||
    label.includes("Established") ||
    label.includes("Strength")
  ) {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
  }

  if (
    label.includes("Need") ||
    label.includes("Fragile") ||
    label.includes("Limited")
  ) {
    return "border-rose-400/25 bg-rose-400/10 text-rose-200";
  }

  if (label.includes("Balanced") || label.includes("Developing")) {
    return "border-sky-400/25 bg-sky-400/10 text-sky-200";
  }

  return "border-gold-300/25 bg-gold-300/10 text-gold-100";
}

function averageNullable(values: Array<number | null>) {
  const filtered = values.filter((value): value is number => value !== null);
  if (!filtered.length) {
    return null;
  }

  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function getOffensiveImpact(row: SquadOverviewRow) {
  return averageNullable(
    row.categoryScores
      .filter(
        (entry) =>
          entry.category.includes("Offensive") ||
          entry.category.includes("Creation"),
      )
      .map((entry) => entry.score),
  );
}

function getDefensiveImpact(row: SquadOverviewRow) {
  return averageNullable(
    row.categoryScores
      .filter(
        (entry) =>
          entry.category.includes("Defensive") ||
          entry.category.includes("Defense"),
      )
      .map((entry) => entry.score),
  );
}

function sortRows(
  rows: SquadOverviewRow[],
  sortKey: SortKey,
  sortDirection: SortDirection,
  averageScore: number | null,
) {
  const direction = sortDirection === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    const leftStatus = getStatusTag(left, averageScore);
    const rightStatus = getStatusTag(right, averageScore);

    const compareStrings = (a: string, b: string) =>
      a.localeCompare(b, undefined, { sensitivity: "base" });
    const compareNumbers = (a: number | null, b: number | null) =>
      (a ?? -Infinity) - (b ?? -Infinity);

    let value = 0;

    switch (sortKey) {
      case "name":
        value = compareStrings(left.name, right.name);
        break;
      case "position":
        value = compareStrings(left.position, right.position);
        break;
      case "archetype":
        value = compareStrings(left.archetype, right.archetype);
        break;
      case "overallScore":
        value = compareNumbers(left.overallScore, right.overallScore);
        break;
      case "toiMinutes":
        value = compareNumbers(left.toiMinutes, right.toiMinutes);
        break;
      case "gamesPlayed":
        value = compareNumbers(left.gamesPlayed, right.gamesPlayed);
        break;
      case "topCategory":
        value = compareStrings(left.topCategory ?? "", right.topCategory ?? "");
        break;
      case "developmentCategory":
        value = compareStrings(
          left.developmentCategory ?? "",
          right.developmentCategory ?? "",
        );
        break;
      case "reliability":
        value = compareStrings(leftStatus, rightStatus);
        break;
    }

    return value * direction;
  });
}

function ScatterTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ScatterPoint }>;
}) {
  const point = active ? payload?.[0]?.payload : null;

  if (!point) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-[#08101a]/95 p-4 text-sm shadow-2xl backdrop-blur-sm">
      <p className="font-semibold text-white">{point.name}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
        {point.position} • {point.archetype}
      </p>
      <div className="mt-3 space-y-1 text-slate-200">
        <p>{point.xLabel}: {point.x.toFixed(1)}</p>
        <p>{point.yLabel}: {point.y.toFixed(1)}</p>
        <p>Reliability: {point.reliability === null ? "n/a" : point.reliability.toFixed(0)}</p>
        <p>Best: {point.bestCategory ?? "n/a"}</p>
        <p>Need: {point.developmentCategory ?? "n/a"}</p>
      </div>
    </div>
  );
}

function DistributionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#08101a]/95 px-3 py-2 text-sm text-slate-100 shadow-xl">
      <p className="font-semibold text-white">{label}</p>
      <p className="text-slate-300">{payload[0]?.value ?? 0} players</p>
    </div>
  );
}

interface ScatterPoint {
  id: string;
  name: string;
  position: "F" | "D" | "Unknown";
  archetype: string;
  color: string;
  bestCategory: string | null;
  developmentCategory: string | null;
  reliability: number | null;
  x: number;
  y: number;
  size: number;
  xLabel: string;
  yLabel: string;
}

function ScatterDot(props: {
  cx?: number;
  cy?: number;
  payload?: ScatterPoint;
}) {
  const cx = props.cx ?? 0;
  const cy = props.cy ?? 0;
  const payload = props.payload;

  if (!payload) {
    return null;
  }

  return (
    <circle
      cx={cx}
      cy={cy}
      r={payload.size}
      fill={payload.color}
      fillOpacity={0.82}
      stroke="rgba(255,255,255,0.65)"
      strokeWidth={1.5}
    />
  );
}

export function SquadOverviewDashboard({
  seasons,
  initialSeason,
  rows,
  goalieRows,
}: SquadOverviewDashboardProps) {
  const [selectedSeason, setSelectedSeason] = useState(initialSeason);
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("all");
  const [archetypeFilter, setArchetypeFilter] = useState("all");
  const [bestCategoryFilter, setBestCategoryFilter] = useState("all");
  const [developmentFilter, setDevelopmentFilter] = useState("all");
  const [reliabilityFilter, setReliabilityFilter] = useState("all");
  const [scatterMode, setScatterMode] = useState<ScatterMode>("usageImpact");
  const [sortKey, setSortKey] = useState<SortKey>("overallScore");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const seasonRows =
    selectedSeason === "all"
      ? rows
      : rows.filter((row) => row.season === selectedSeason);
  const seasonGoalies =
    selectedSeason === "all"
      ? goalieRows
      : goalieRows.filter((row) => row.season === selectedSeason);

  const availableArchetypes = Array.from(
    new Set(seasonRows.map((row) => row.archetype).filter(Boolean)),
  ).sort();
  const availableBestCategories = Array.from(
    new Set(
      seasonRows
        .map((row) => row.topCategory)
        .filter((category): category is string => Boolean(category)),
    ),
  ).sort();
  const availableDevelopmentAreas = Array.from(
    new Set(
      seasonRows
        .map((row) => row.developmentCategory)
        .filter((category): category is string => Boolean(category)),
    ),
  ).sort();

  const filteredRows = seasonRows.filter((row) => {
    const matchesSearch =
      !search ||
      row.name.toLowerCase().includes(search.toLowerCase()) ||
      row.archetype.toLowerCase().includes(search.toLowerCase());
    const matchesPosition =
      positionFilter === "all" || row.position === positionFilter;
    const matchesArchetype =
      archetypeFilter === "all" || row.archetype === archetypeFilter;
    const matchesBest =
      bestCategoryFilter === "all" || row.topCategory === bestCategoryFilter;
    const matchesDevelopment =
      developmentFilter === "all" ||
      row.developmentCategory === developmentFilter;
    const matchesReliability =
      reliabilityFilter === "all" ||
      getReliabilityBucket(row) === reliabilityFilter;

    return (
      matchesSearch &&
      matchesPosition &&
      matchesArchetype &&
      matchesBest &&
      matchesDevelopment &&
      matchesReliability
    );
  });

  const averageScore = averageNullable(filteredRows.map((row) => row.overallScore));
  const topPlayer =
    [...filteredRows]
      .filter((row): row is SquadOverviewRow & { overallScore: number } => row.overallScore !== null)
      .sort((left, right) => right.overallScore - left.overallScore)[0] ?? null;

  const mostCommonArchetypeEntry =
    Object.entries(
      filteredRows.reduce<Record<string, number>>((counts, row) => {
        counts[row.archetype] = (counts[row.archetype] ?? 0) + 1;
        return counts;
      }, {}),
    ).sort((left, right) => right[1] - left[1])[0] ?? null;

  const mostCommonDevelopmentNeed =
    Object.entries(
      filteredRows.reduce<Record<string, number>>((counts, row) => {
        if (!row.developmentCategory) {
          return counts;
        }
        counts[row.developmentCategory] = (counts[row.developmentCategory] ?? 0) + 1;
        return counts;
      }, {}),
    ).sort((left, right) => right[1] - left[1])[0] ?? null;
  const teamToiPerGameAverage = averageNullable(
    filteredRows.map((row) => getToiPerGame(row)),
  );
  const positionToiPerGameAverage = {
    F: averageNullable(
      filteredRows
        .filter((row) => row.position === "F")
        .map((row) => getToiPerGame(row)),
    ),
    D: averageNullable(
      filteredRows
        .filter((row) => row.position === "D")
        .map((row) => getToiPerGame(row)),
    ),
  };

  const sortedRows = sortRows(filteredRows, sortKey, sortDirection, averageScore);

  const topDriver = topPlayer;

  const opportunityCandidates = filteredRows
    .map((row) => {
      const toiPerGame = getToiPerGame(row);
      const positionAverage =
        row.position === "F"
          ? positionToiPerGameAverage.F
          : row.position === "D"
            ? positionToiPerGameAverage.D
            : null;

      if (
        row.overallScore === null ||
        averageScore === null ||
        toiPerGame === null ||
        teamToiPerGameAverage === null ||
        positionAverage === null
      ) {
        return null;
      }

      const reliabilityBucket = getReliabilityBucket(row);
      if (!["Established", "Developing"].includes(reliabilityBucket)) {
        return null;
      }

      const impactDelta = row.overallScore - averageScore;
      const usageDelta = Math.min(
        teamToiPerGameAverage - toiPerGame,
        positionAverage - toiPerGame,
      );

      if (impactDelta <= 0 || usageDelta <= 0) {
        return null;
      }

      return {
        row,
        impactDelta,
        usageDelta,
        signal: impactDelta * 1.4 + usageDelta,
      };
    })
    .filter(
      (
        candidate,
      ): candidate is {
        row: SquadOverviewRow;
        impactDelta: number;
        usageDelta: number;
        signal: number;
      } => candidate !== null,
    )
    .sort((left, right) => right.signal - left.signal);
  const opportunityCandidate = opportunityCandidates[0] ?? null;

  const usageWatchPlayers = filteredRows.filter((row) => {
    const toiPerGame = getToiPerGame(row);
    const positionAverage =
      row.position === "F"
        ? positionToiPerGameAverage.F
        : row.position === "D"
          ? positionToiPerGameAverage.D
          : null;

    if (
      row.overallScore === null ||
      averageScore === null ||
      toiPerGame === null ||
      teamToiPerGameAverage === null ||
      positionAverage === null
    ) {
      return false;
    }

    return (
      toiPerGame > teamToiPerGameAverage &&
      toiPerGame > positionAverage &&
      row.overallScore < averageScore
    );
  });

  const scatterPoints =
    scatterMode === "usageImpact"
      ? filteredRows
          .map((row) => {
            const toiPerGame = getToiPerGame(row);
            if (toiPerGame === null || row.overallScore === null) {
              return null;
            }

            return {
              id: row.id,
              name: row.name,
              position: row.position,
              archetype: row.archetype,
              color: row.archetypeColor,
              bestCategory: row.topCategory,
              developmentCategory: row.developmentCategory,
              reliability: row.reliabilityScore,
              x: round(toiPerGame, 1),
              y: row.overallScore,
              size: clamp(((row.reliabilityScore ?? row.gamesPlayed ?? 30) / 12), 7, 15),
              xLabel: "TOI / game",
              yLabel: "Impact",
            } satisfies ScatterPoint;
          })
          .filter((row): row is ScatterPoint => row !== null)
      : filteredRows
          .map((row) => {
            const offensiveImpact = getOffensiveImpact(row);
            const defensiveImpact = getDefensiveImpact(row);
            if (offensiveImpact === null || defensiveImpact === null) {
              return null;
            }

            return {
              id: row.id,
              name: row.name,
              position: row.position,
              archetype: row.archetype,
              color: row.archetypeColor,
              bestCategory: row.topCategory,
              developmentCategory: row.developmentCategory,
              reliability: row.reliabilityScore,
              x: defensiveImpact,
              y: offensiveImpact,
              size: clamp(((row.toiMinutes ?? 0) / 55), 7, 16),
              xLabel: "Defensive impact",
              yLabel: "Offensive impact",
            } satisfies ScatterPoint;
          })
          .filter((row): row is ScatterPoint => row !== null);

  const archetypeDistribution = availableArchetypes.map((archetype) => ({
    label: archetype,
    count: filteredRows.filter((row) => row.archetype === archetype).length,
    color:
      filteredRows.find((row) => row.archetype === archetype)?.archetypeColor ??
      "#94A3B8",
  }));

  const developmentDistribution = availableDevelopmentAreas
    .map((area) => ({
      label: area,
      count: filteredRows.filter((row) => row.developmentCategory === area).length,
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);

  const rosterSplit = {
    forwards: filteredRows.filter((row) => row.position === "F").length,
    defense: filteredRows.filter((row) => row.position === "D").length,
    goalies: seasonGoalies.length,
  };

  const teamMetricAverages = buildTeamMetricAverages(filteredRows);

  const categoryDistribution = Object.fromEntries(
    Array.from(
      new Set(filteredRows.flatMap((row) => row.categoryScores.map((entry) => entry.category))),
    ).map((category) => {
      const scores = filteredRows
        .flatMap((row) => row.categoryScores)
        .filter((entry) => entry.category === category && entry.score !== null)
        .map((entry) => entry.score)
        .filter((score): score is number => score !== null);

      return [
        category,
        {
          high: scores.filter((score) => score >= 70).length,
          above: scores.filter((score) => score >= 60 && score < 70).length,
          average: scores.filter((score) => score >= 45 && score < 60).length,
          concern: scores.filter((score) => score < 45).length,
          total: scores.length,
        },
      ];
    }),
  ) as Record<
    string,
    { high: number; above: number; average: number; concern: number; total: number }
  >;

  const strongestDepthCategory =
    Object.entries(categoryDistribution).sort(
      (left, right) =>
        right[1].high +
        right[1].above -
        (left[1].high + left[1].above) ||
        right[1].high - left[1].high,
    )[0] ?? null;

  const biggestConcernCategory =
    Object.entries(categoryDistribution).sort(
      (left, right) => right[1].concern - left[1].concern,
    )[0] ?? null;

  const specialTeamsCoverage = filteredRows.filter((row) =>
    row.categoryScores.some(
      (category) => category.category.includes("Special Teams") && category.score !== null,
    ),
  ).length;

  const highImpactDrivers = filteredRows
    .filter((row): row is SquadOverviewRow & { overallScore: number } => row.overallScore !== null)
    .filter((row) => row.overallScore >= 70)
    .sort((left, right) => right.overallScore - left.overallScore);

  const buildRelatedPlayers = (rows: SquadOverviewRow[], count = 3) =>
    rows.slice(0, count).map((row) => row.name);

  const rosterIdentityInsight: CoachingInsight | null = mostCommonArchetypeEntry
    ? (() => {
        const archetypePlayers = filteredRows
          .filter((row) => row.archetype === mostCommonArchetypeEntry[0])
          .sort((left, right) => (right.overallScore ?? -1) - (left.overallScore ?? -1));

        if (mostCommonArchetypeEntry[0].includes("Power / Forechecking")) {
          const pressurePlayers = archetypePlayers.filter((row) => {
            const retrievals = getMetricValue(row, "ev_oz_retrievals");
            const battles = getMetricValue(row, "puck_battle_win_pct");
            const retrievalAvg = getMetricAverage(teamMetricAverages, "ev_oz_retrievals");
            const battleAvg = getMetricAverage(teamMetricAverages, "puck_battle_win_pct");
            return (
              retrievals !== null &&
              battles !== null &&
              retrievalAvg !== null &&
              battleAvg !== null &&
              retrievals > retrievalAvg &&
              battles > battleAvg
            );
          });
          const conversionPlayers = pressurePlayers.filter((row) => {
            const netXg = getMetricValue(row, "net_xg");
            const netXgAvg = getMetricAverage(teamMetricAverages, "net_xg");
            return netXg !== null && netXgAvg !== null && netXg > netXgAvg;
          });

          return {
            headline: `${pressurePlayers.length} skaters are above the team average in offensive-zone retrievals and puck-battle win rate, but only ${conversionPlayers.length} of them are also above the team net-xG baseline.`,
            whyItMatters:
              "This changes line construction, because pressure without conversion can leave you winning pucks without turning those touches into lasting offense.",
            specificQuestion:
              "Do Falk and Penner need a higher-skill third piece to cash in their pressure touches, or are those lines already creating enough after the first recovery?",
            relatedPlayers: buildRelatedPlayers(pressurePlayers.length ? pressurePlayers : archetypePlayers),
            tag: "Roster Identity",
          };
        }

        if (mostCommonArchetypeEntry[0].includes("Playmaker")) {
          const creationPlayers = archetypePlayers.filter((row) => {
            const slotPass = getMetricValue(row, "passes_to_slot");
            const preShot = getMetricValue(row, "pre_shots_passes");
            const slotAvg = getMetricAverage(teamMetricAverages, "passes_to_slot");
            const preShotAvg = getMetricAverage(teamMetricAverages, "pre_shots_passes");
            return (
              slotPass !== null &&
              preShot !== null &&
              slotAvg !== null &&
              preShotAvg !== null &&
              slotPass > slotAvg &&
              preShot > preShotAvg
            );
          });
          const finishSupport = creationPlayers.filter((row) => {
            const onNet = getMetricValue(row, "net_xg");
            const average = getMetricAverage(teamMetricAverages, "net_xg");
            return onNet !== null && average !== null && onNet > average;
          });

          return {
            headline: `${creationPlayers.length} skaters are above the team average in slot passing and pre-shot movement, and ${finishSupport.length} of them also sit above the team net-xG baseline.`,
            whyItMatters:
              "This changes matchup planning, because creators only tilt a game if their touches are actually turning teammates into dangerous looks.",
            specificQuestion:
              "Are your best distributors being paired with finishers who can cash those touches, or are those passing sequences dying without a second threat?",
            relatedPlayers: buildRelatedPlayers(creationPlayers.length ? creationPlayers : archetypePlayers),
            tag: "Roster Identity",
          };
        }

        const supportPlayers = archetypePlayers.filter((row) => (row.overallScore ?? 0) > (averageScore ?? 0));
        return {
          headline: `${mostCommonArchetypeEntry[1]} skaters share the most common roster profile, but only ${supportPlayers.length} of them are currently above the team impact average.`,
          whyItMatters:
            "This changes deployment, because a repeated style only helps if enough of those players are winning their minutes rather than just fitting the same label.",
          specificQuestion:
            "Is this identity actually helping you win more minutes, or do some of those same-profile players need a different role around them?",
          relatedPlayers: buildRelatedPlayers(archetypePlayers),
          tag: "Roster Identity",
        };
      })()
    : null;

  const playDriverInsight: CoachingInsight | null =
    topDriver && averageScore !== null
      ? (() => {
          const driverGroup = highImpactDrivers.length ? highImpactDrivers : sortedRows.slice(0, 2);
          const first = driverGroup[0];
          const second = driverGroup[1] ?? null;

          return {
            headline: second
              ? `${first.name} is ${relativeToTeamAverage(first.overallScore, averageScore)} in impact, while ${second.name} is ${relativeToTeamAverage(second.overallScore, averageScore)} and gets there differently.`
              : `${first.name} is ${relativeToTeamAverage(first.overallScore, averageScore)} in impact and is the clearest driver in this roster slice.`,
            whyItMatters:
              "This changes line matching and support assignments, because your top players are not all solving the same problem for the team.",
            specificQuestion: second
              ? `Should ${first.name} and ${second.name} be used the same way, or do their different strengths call for different linemates and zone starts this week?`
              : `Does ${first.name} need to be protected and featured more heavily, or is the rest of the lineup giving enough secondary support behind that impact?`,
            relatedPlayers: [first.name, ...(second ? [second.name] : [])],
            tag: "Play Drivers",
          };
        })()
      : null;

  const usageInsight: CoachingInsight | null =
    opportunityCandidate || usageWatchPlayers.length
      ? {
          headline: `${opportunityCandidate
            ? `${opportunityCandidate.row.name} is ${relativeToTeamAverage(opportunityCandidate.row.overallScore, averageScore)} in impact on ${relativeToTeamAverage(
                getToiPerGame(opportunityCandidate.row),
                teamToiPerGameAverage,
              )} TOI per game`
            : "The usage curve has players above the team impact baseline on lower usage"
          }${usageWatchPlayers.length ? `, and ${usageWatchPlayers.length} higher-usage skaters are below the team impact average.` : "."}`,
          whyItMatters:
            "This changes deployment decisions, because minutes can be redistributed or specialized without needing a full line overhaul.",
          specificQuestion: opportunityCandidate && usageWatchPlayers[0]
            ? `Does ${opportunityCandidate.row.name} deserve a bigger five-on-five role, or is ${usageWatchPlayers[0].name}'s usage carrying matchup difficulty that explains the lower impact read?`
            : opportunityCandidate
              ? `Does ${opportunityCandidate.row.name} deserve a bigger role next week, or is the current impact spike still too situational to trust?`
              : `Are the current heavy-minute skaters being used in the right matchups, or is there a deployment tweak that would flatten those below-baseline impact reads?`,
          relatedPlayers: Array.from(
            new Set([
              ...(opportunityCandidate ? [opportunityCandidate.row.name] : []),
              ...buildRelatedPlayers(usageWatchPlayers),
            ]),
          ).slice(0, 4),
          tag: "Usage Review",
        }
      : null;

  const categoryDepthInsight: CoachingInsight | null =
    strongestDepthCategory || biggestConcernCategory
      ? {
          headline: `${
            strongestDepthCategory
              ? `${strongestDepthCategory[1].high + strongestDepthCategory[1].above} skaters are above average in ${mapDevelopmentTheme(
                  strongestDepthCategory[0],
                )}`
              : "There is no single deep strength cluster in the current roster slice"
          }${
            biggestConcernCategory && biggestConcernCategory[1].concern > 0
              ? `, while ${biggestConcernCategory[1].concern} skaters are below the baseline in ${mapDevelopmentTheme(
                  biggestConcernCategory[0],
                )}.`
              : "."
          }`,
          whyItMatters:
            "This changes practice design, because depth matters differently than star power when you are trying to build line-to-line repeatability.",
          specificQuestion:
            "Do the middle-six and lower pairs have enough support in the areas that drive your game model, or are a few top players carrying too much of that work?",
          relatedPlayers: strongestDepthCategory
            ? buildRelatedPlayers(
                filteredRows
                  .filter((row) =>
                    row.categoryScores.some(
                      (category) =>
                        category.category === strongestDepthCategory[0] &&
                        category.score !== null &&
                        category.score >= 60,
                    ),
                  )
                  .sort((left, right) => (right.overallScore ?? -1) - (left.overallScore ?? -1)),
              )
            : undefined,
          tag: "Depth Shape",
        }
      : null;

  const developmentInsight: CoachingInsight | null = mostCommonDevelopmentNeed
    ? {
        headline: `${mostCommonDevelopmentNeed[1]} skaters are below their own team baseline in ${mapDevelopmentTheme(
          mostCommonDevelopmentNeed[0],
        )}.`,
        whyItMatters:
          "This changes the weekly focus, because a repeated weak habit across the roster usually needs a shared practice solution instead of one-off individual correction.",
        specificQuestion: mostCommonDevelopmentNeed[0].includes("Special Teams")
          ? specialTeamsCoverage < Math.ceil(filteredRows.length * 0.6)
            ? `Is special-teams detail actually the problem, or is the player-level coverage too thin to separate entries, retrievals, and puck losses cleanly yet?`
            : `Is the special-teams problem being driven more by entries, retrievals, puck losses, or shot generation this week?`
          : `What is the one repeat habit behind ${mapDevelopmentTheme(
              mostCommonDevelopmentNeed[0],
            )} that you want the full group to rehearse this week?`,
        relatedPlayers: buildRelatedPlayers(
          filteredRows.filter(
            (row) => row.developmentCategory === mostCommonDevelopmentNeed[0],
          ),
        ),
        tag: "Development Theme",
      }
    : null;

  const riskPlayers = filteredRows
    .filter((row) => (row.overallScore ?? Infinity) < (averageScore ?? -Infinity))
    .filter((row) => {
      const dzLosses = getMetricValue(row, "puck_losses_dz");
      const dzLossAverage = getMetricAverage(teamMetricAverages, "puck_losses_dz");
      return dzLosses !== null && dzLossAverage !== null && dzLosses > dzLossAverage;
    })
    .sort((left, right) => (right.overallScore ?? -1) - (left.overallScore ?? -1));

  const riskInsight: CoachingInsight | null =
    riskPlayers.length > 0
      ? {
          headline: `${riskPlayers.length} below-impact skaters are also above the team average in defensive-zone puck losses.`,
          whyItMatters:
            "This changes practice emphasis and matchup trust, because cleaner first decisions under pressure can move a player from surviving shifts to helping drive them.",
          specificQuestion:
            riskPlayers[0]
              ? `Do Beisel and Falk belong on the same shift, or does that double your defensive-zone turnover exposure when pressure rises?`.replace("Beisel and Falk", buildRelatedPlayers(riskPlayers, 2).join(" and "))
              : "Are the current turnover-prone shifts a skill issue, a support issue, or a role issue?",
          relatedPlayers: buildRelatedPlayers(riskPlayers, 4),
          tag: "Risk / Puck Detail",
        }
      : null;

  const coachingTakeaways = [
    rosterIdentityInsight,
    playDriverInsight,
    usageInsight,
    categoryDepthInsight,
    developmentInsight,
    riskInsight,
  ]
    .filter((insight): insight is CoachingInsight => insight !== null)
    .slice(0, 6);

  function updateSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === "name" ? "asc" : "desc");
  }

  return (
    <div className="space-y-6">
      <Panel className="p-4 md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-100">
              Roster Filters
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Narrow the squad view by season, role, and development theme.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedSeason(initialSeason);
              setSearch("");
              setPositionFilter("all");
              setArchetypeFilter("all");
              setBestCategoryFilter("all");
              setDevelopmentFilter("all");
              setReliabilityFilter("all");
            }}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-gold-300/30 hover:text-white"
          >
            Reset filters
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Season
            </span>
            <select
              value={selectedSeason}
              onChange={(event) => setSelectedSeason(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-gold-300/30"
            >
              <option value="all">All seasons</option>
              {seasons.map((season) => (
                <option key={season} value={season}>
                  {season}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 xl:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Search
            </span>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search player or archetype"
                className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
            </div>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Position
            </span>
            <select
              value={positionFilter}
              onChange={(event) => setPositionFilter(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-gold-300/30"
            >
              <option value="all">All</option>
              <option value="F">Forwards</option>
              <option value="D">Defense</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Archetype
            </span>
            <select
              value={archetypeFilter}
              onChange={(event) => setArchetypeFilter(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-gold-300/30"
            >
              <option value="all">All</option>
              {availableArchetypes.map((archetype) => (
                <option key={archetype} value={archetype}>
                  {archetype}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Best Category
            </span>
            <select
              value={bestCategoryFilter}
              onChange={(event) => setBestCategoryFilter(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-gold-300/30"
            >
              <option value="all">All</option>
              {availableBestCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Main Need
            </span>
            <select
              value={developmentFilter}
              onChange={(event) => setDevelopmentFilter(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-gold-300/30"
            >
              <option value="all">All</option>
              {availableDevelopmentAreas.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Reliability
            </span>
            <select
              value={reliabilityFilter}
              onChange={(event) => setReliabilityFilter(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-gold-300/30"
            >
              {["all", "Established", "Developing", "Fragile", "Limited Sample", "Unknown"].map(
                (value) => (
                  <option key={value} value={value}>
                    {value === "all" ? "All" : value}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-6">
        <InsightCard
          label="Top Driver"
          value={topDriver ? topDriver.name : "No clear driver"}
          note={
            topDriver
              ? `${formatScore(topDriver.overallScore)}/100 • ${topDriver.archetype} • best in ${topDriver.topCategory ?? "n/a"}.`
              : "No scored skater is available in this view yet."
          }
          tone="gold"
        />
        <InsightCard
          label="Opportunity Candidate"
          value={opportunityCandidate ? opportunityCandidate.row.name : "No clear case"}
          note={
            opportunityCandidate
              ? `${formatScore(opportunityCandidate.row.overallScore)}/100 impact on ${getToiPerGame(
                  opportunityCandidate.row,
                )?.toFixed(1)} min/game. Stronger than team impact baseline with room for more usage.`
              : "No player currently stands out as a strong lower-usage opportunity case."
          }
          tone="emerald"
        />
        <InsightCard
          label="Usage Watch"
          value={String(usageWatchPlayers.length)}
          note={
            usageWatchPlayers.length
              ? `${usageWatchPlayers.length} higher-usage skaters sit below the current team impact baseline.`
              : "No higher-usage skaters are currently sitting below team impact average."
          }
          tone="amber"
        />
        <InsightCard
          label="Roster Identity"
          value={
            mostCommonArchetypeEntry
              ? `${mostCommonArchetypeEntry[0]} Lean`
              : "No clear identity"
          }
          note={
            mostCommonArchetypeEntry
              ? `${mostCommonArchetypeEntry[1]} skaters profile through ${describeArchetypeLean(
                  mostCommonArchetypeEntry[0],
                )}.`
              : "No archetype mix available."
          }
          tone="sky"
        />
        <InsightCard
          label="Development Theme"
          value={mostCommonDevelopmentNeed?.[0] ?? "No pattern"}
          note={
            mostCommonDevelopmentNeed
              ? `${mostCommonDevelopmentNeed[1]} skaters need the most work here${
                  mostCommonDevelopmentNeed[0].includes("Special Teams")
                    ? " • check coverage before leaning too hard on it."
                    : "."
                }`
              : "No recurring development theme stands out yet."
          }
          tone="rose"
        />
        <InsightCard
          label="Roster Balance"
          value={`${rosterSplit.forwards}F / ${rosterSplit.defense}D / ${rosterSplit.goalies}G`}
          note={`${filteredRows.length} skaters currently scored in this view.`}
          tone="slate"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr_1fr]">
        <Panel
          eyebrow="Player Impact Map"
          title="Who is driving play, and how hard are they being used?"
          description="Use the scatter view to spot core players, specialists, and low-sample outliers quickly."
          actions={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setScatterMode("usageImpact")}
                className={cn(
                  "rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition",
                  scatterMode === "usageImpact"
                    ? "border-gold-300/30 bg-gold-300/15 text-gold-100"
                    : "border-white/10 bg-white/5 text-slate-300",
                )}
              >
                TOI vs Impact
              </button>
              <button
                type="button"
                onClick={() => setScatterMode("offenseDefense")}
                className={cn(
                  "rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition",
                  scatterMode === "offenseDefense"
                    ? "border-gold-300/30 bg-gold-300/15 text-gold-100"
                    : "border-white/10 bg-white/5 text-slate-300",
                )}
              >
                Defense vs Offense
              </button>
            </div>
          }
        >
          {scatterPoints.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-sm text-slate-400">
              No players in the current filter set have enough score and usage data to plot this chart.
            </div>
          ) : (
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    tick={{ fill: "#94A3B8", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    name={scatterMode === "usageImpact" ? "TOI / game" : "Defensive impact"}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    tick={{ fill: "#94A3B8", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    name={scatterMode === "usageImpact" ? "Impact" : "Offensive impact"}
                  />
                  {averageScore !== null && scatterMode === "usageImpact" ? (
                    <ReferenceLine
                      y={averageScore}
                      stroke="rgba(250,204,21,0.5)"
                      strokeDasharray="4 4"
                    />
                  ) : null}
                  <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter data={scatterPoints} shape={<ScatterDot />} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel
          eyebrow="Archetype Spread"
          title="How the roster is built"
          description="Archetype distribution across the filtered skater group."
        >
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={archetypeDistribution}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
              >
                <CartesianGrid stroke="rgba(255,255,255,0.08)" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={120}
                  tick={{ fill: "#CBD5E1", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<DistributionTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="count" radius={[0, 16, 16, 0]}>
                  {archetypeDistribution.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          eyebrow="Development Breakdown"
          title="Where the roster needs help"
          description="Most common player development areas in the current view."
        >
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={developmentDistribution}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
              >
                <CartesianGrid stroke="rgba(255,255,255,0.08)" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={120}
                  tick={{ fill: "#CBD5E1", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<DistributionTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="count" fill="#F59E0B" radius={[0, 16, 16, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6">
        <Panel
          eyebrow="Coaching Takeaways"
          title="What the roster looks like in hockey terms"
          description="Short, coach-facing signals generated from the current squad slice."
        >
          <div className="space-y-3">
            {coachingTakeaways.map((takeaway) => (
              <div
                key={takeaway.headline}
                className="rounded-[26px] border border-white/8 bg-white/[0.03] px-4 py-4"
              >
                <div className="flex gap-3">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold-100" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white">{takeaway.headline}</p>
                      <span className="rounded-full border border-gold-300/20 bg-gold-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-100">
                        {takeaway.tag}
                      </span>
                    </div>
                    <div className="mt-3 space-y-3 text-sm leading-6 text-slate-200">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Why It Matters For This Team
                        </p>
                        <p className="mt-1">{takeaway.whyItMatters}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          The Specific Question To Answer
                        </p>
                        <p className="mt-1">{takeaway.specificQuestion}</p>
                      </div>
                    </div>
                    {takeaway.relatedPlayers?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="self-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Named Players
                        </span>
                        {takeaway.relatedPlayers.map((player) => (
                          <span
                            key={`${takeaway.headline}-${player}`}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300"
                          >
                            {player}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        eyebrow="Squad Table"
        title="Roster evaluation board"
        description="Use the table to compare impact, usage, role, and development needs at a glance."
      >
        {filteredRows.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-sm text-slate-400">
            No players match the current filter set.
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-white/10">
            <div className="max-h-[720px] overflow-auto">
              <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                <thead className="sticky top-0 z-10 bg-[#111827]/95 backdrop-blur-sm">
                  <tr>
                    {[
                      ["Player", "name"],
                      ["Pos", "position"],
                      ["Archetype", "archetype"],
                      ["Impact", "overallScore"],
                      ["TOI", "toiMinutes"],
                      ["Best Category", "topCategory"],
                      ["Main Need", "developmentCategory"],
                      ["Reliability", "reliability"],
                      ["Trend", "gamesPlayed"],
                      ["Status", "gamesPlayed"],
                    ].map(([label, key]) => (
                      <th
                        key={label}
                        className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-slate-400"
                      >
                        {key === "gamesPlayed" && (label === "Trend" || label === "Status") ? (
                          <span>{label}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => updateSort(key as SortKey)}
                            className="inline-flex items-center gap-2 transition hover:text-slate-200"
                          >
                            <span>{label}</span>
                            {sortKey === key ? (
                              sortDirection === "asc" ? (
                                <ArrowUp className="h-3 w-3" />
                              ) : (
                                <ArrowDown className="h-3 w-3" />
                              )
                            ) : (
                              <ChevronsUpDown className="h-3 w-3 opacity-60" />
                            )}
                          </button>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sortedRows.map((row) => {
                    const teamDelta =
                      averageScore !== null && row.overallScore !== null
                        ? row.overallScore - averageScore
                        : null;
                    const status = getStatusTag(row, averageScore);

                    return (
                      <tr
                        key={`${row.id}-${row.season}`}
                        className="bg-white/[0.02] transition hover:bg-white/[0.05]"
                      >
                        <td className="px-4 py-3 text-white">
                          <Link
                            href={`/player-breakdown?player=${encodeURIComponent(
                              row.id,
                            )}&season=${encodeURIComponent(row.season)}`}
                            className="font-semibold hover:text-gold-100"
                          >
                            {row.name}
                          </Link>
                          {row.secondaryArchetype ? (
                            <p className="mt-1 text-xs text-slate-400">
                              Lean: {row.secondaryArchetype}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-slate-200">{row.position}</td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold text-slate-100"
                            style={{
                              borderColor: `${row.archetypeColor}55`,
                              backgroundColor: `${row.archetypeColor}18`,
                            }}
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: row.archetypeColor }}
                            />
                            {row.archetype}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-100">
                          <div className="font-semibold">{formatScore(row.overallScore)}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {teamDelta === null ? "vs team n/a" : `vs team ${formatDelta(teamDelta)}`}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-200">
                          <div>{formatMinutes(row.toiMinutes)}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {getToiPerGame(row) === null
                              ? "per game n/a"
                              : `${getToiPerGame(row)?.toFixed(1)} / game`}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
                            {row.topCategory ?? "n/a"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full border border-rose-400/25 bg-rose-400/10 px-3 py-1.5 text-xs font-semibold text-rose-200">
                            {row.developmentCategory ?? "n/a"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold",
                              getBadgeTone(getReliabilityBucket(row)),
                            )}
                          >
                            {getReliabilityBucket(row)}
                          </span>
                          <p className="mt-1 text-xs text-slate-400">
                            {formatReliability(row.reliabilityScore)}/100
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-200">
                          {row.latestTrendLabel ?? "No trend yet"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold",
                              getBadgeTone(status),
                            )}
                          >
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>

      <Panel
        eyebrow="Advanced Tools"
        title="Archetype diagnostics"
        description="Keep this as a secondary audit tool when you want to sanity-check how the role engine is reading the roster."
      >
        <details className="group rounded-[28px] border border-white/10 bg-white/[0.03]">
          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-white">
            Open archetype diagnostic table
          </summary>
          <div className="border-t border-white/10 p-4">
            <div className="overflow-hidden rounded-3xl border border-white/10">
              <div className="max-h-[520px] overflow-auto">
                <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                  <thead className="sticky top-0 bg-[#111827]/95 backdrop-blur-sm">
                    <tr>
                      {[
                        "Player",
                        "Final label",
                        "Secondary",
                        "Confidence",
                        "Gap",
                        "Adjusted",
                        "Top signals",
                        "Cautions",
                        "Archetype scores",
                      ].map((header) => (
                        <th
                          key={header}
                          className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-slate-400"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {sortedRows.map((row) => (
                      <tr key={`diagnostic-${row.id}-${row.season}`} className="bg-white/[0.02]">
                        <td className="px-4 py-3 text-white">{row.name}</td>
                        <td className="px-4 py-3 text-slate-100">{row.archetype}</td>
                        <td className="px-4 py-3 text-slate-300">
                          {row.secondaryArchetype ?? "n/a"}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {row.archetypeConfidence}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {row.diagnostics.scoreGap === null
                            ? "n/a"
                            : row.diagnostics.scoreGap.toFixed(1)}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {row.diagnostics.adjustedByContradiction ? "Yes" : "No"}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {row.diagnostics.topSignals.length
                            ? row.diagnostics.topSignals.join(", ")
                            : "n/a"}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {row.diagnostics.cautionSignals.length
                            ? row.diagnostics.cautionSignals.join(", ")
                            : "n/a"}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {row.diagnostics.scoreSummary.join(" | ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </details>
      </Panel>
    </div>
  );
}

function InsightCard({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: "gold" | "emerald" | "rose" | "sky" | "amber" | "slate";
}) {
  const toneClass =
    tone === "gold"
      ? "bg-gold-300/10"
      : tone === "emerald"
        ? "bg-emerald-400/10"
        : tone === "rose"
          ? "bg-rose-400/10"
          : tone === "sky"
            ? "bg-sky-400/10"
            : tone === "amber"
              ? "bg-amber-400/10"
              : "bg-white/5";

  return (
    <article className="glass-panel gold-ring relative overflow-hidden rounded-4xl p-5">
      <div className={cn("absolute right-0 top-0 h-24 w-24 rounded-full blur-3xl", toneClass)} />
      <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <p className="relative mt-4 text-[1.85rem] font-semibold leading-[1.08] tracking-tight text-white [text-wrap:balance]">
        {value}
      </p>
      <p className="relative mt-3 text-sm leading-6 text-slate-300">{note}</p>
    </article>
  );
}
