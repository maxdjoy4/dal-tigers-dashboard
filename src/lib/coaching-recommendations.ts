import type { ScoreCategory, TacticalDriverRow } from "@/lib/types";
import { round } from "@/lib/utils";

export type CoachingTheme =
  | "offensive_zone_possession"
  | "offensive_creation"
  | "pre_shot_movement"
  | "puck_management"
  | "breakouts_exit_efficiency"
  | "transition_offense"
  | "transition_defense"
  | "defensive_quality_control"
  | "retrievals_second_puck"
  | "special_teams_execution";

export interface RecommendationKpiInput {
  key: string;
  name: string;
  category: ScoreCategory;
  focusedRawAverage: number | null;
  baselineRawAverage: number | null;
  rawDelta: number | null;
  normalizedDelta: number | null;
  weightedImpact: number | null;
  focusedCoverage: number;
}

export interface RecommendationCategoryInput {
  category: ScoreCategory;
  label: string;
  focusedScore: number | null;
  baselineScore: number | null;
  delta: number | null;
  status: "strength" | "neutral" | "concern";
}

export interface RecommendationTacticalInput {
  group: TacticalDriverRow["group"];
  label: string;
  score: number | null;
  baselineScore: number | null;
  delta: number | null;
  status: TacticalDriverRow["status"];
  coverage: number | null;
}

export interface SupportingMetric {
  name: string;
  focusedValue: number | null;
  baselineValue: number | null;
  rawDelta: number | null;
  weightedImpact: number | null;
  isPercent: boolean;
}

export interface CoachingRecommendation {
  key: CoachingTheme;
  title: string;
  reason: string;
  supportingData: string;
  coachingFocus: string;
  benchCues: string[];
  priorityLevel: "high" | "medium" | "monitor";
  themeConcernScore: number;
  sourceKpis: string[];
  supportingMetrics: SupportingMetric[];
}

export interface MatchupStrengthSignal {
  key: CoachingTheme;
  title: string;
  takeaway: string;
  supportingData: string;
  focus?: string;
  impactLevel: "high" | "medium" | "monitor";
  sourceKpis: string[];
}

export interface CoachingRecommendationResult {
  priorities: CoachingRecommendation[];
  positiveSignals: MatchupStrengthSignal[];
  concernSignals: MatchupStrengthSignal[];
  gamePlanReminders: string[];
  notes: string[];
}

interface ThemeGroup {
  theme: CoachingTheme;
  rows: RecommendationKpiInput[];
  score: number;
}

const TACTICAL_THEME_MAP: Partial<Record<TacticalDriverRow["group"], CoachingTheme>> = {
  offensive_creation: "offensive_creation",
  transition_offense: "transition_offense",
  puck_management: "puck_management",
  defensive_zone_play: "defensive_quality_control",
  transition_defense: "transition_defense",
  possession_territory: "offensive_zone_possession",
  special_teams: "special_teams_execution",
  battle_compete: "retrievals_second_puck",
};

const CATEGORY_THEME_MAP: Record<ScoreCategory, CoachingTheme> = {
  offense: "offensive_creation",
  defense: "defensive_quality_control",
  special_teams: "special_teams_execution",
};

function safeValue(value: number | null) {
  return value === null || Number.isNaN(value) ? null : value;
}

function formatValue(value: number | null, isPercent = false) {
  if (value === null || Number.isNaN(value)) {
    return "n/a";
  }

  return isPercent ? `${value.toFixed(1)}%` : value.toFixed(1);
}

export function classifyKpiToCoachingTheme(kpi: RecommendationKpiInput): CoachingTheme {
  const metric = kpi.name.toLowerCase();

  if (
    metric.includes("corsi") ||
    metric.includes("oz play") ||
    metric.includes("offensive-zone time") ||
    metric.includes("oz time")
  ) {
    return "offensive_zone_possession";
  }

  if (
    metric.includes("ev oz retrieval") ||
    metric.includes("oz retrieval") ||
    metric.includes("loose puck") ||
    metric.includes("puck battle") ||
    metric.includes("takeaways in oz")
  ) {
    return "retrievals_second_puck";
  }

  if (
    metric.includes("pre-shot") ||
    metric.includes("passes to the slot") ||
    metric.includes("pass to the slot") ||
    metric.includes("xg per shot") ||
    metric.includes("dangerous")
  ) {
    return "pre_shot_movement";
  }

  if (
    metric.includes("shots") ||
    metric.includes("scoring chance") ||
    metric.includes("slot chance") ||
    metric.includes("xg") ||
    metric.includes("shot quality") ||
    metric.includes("shots on goal")
  ) {
    return "offensive_creation";
  }

  if (
    metric.includes("failed exit") ||
    metric.includes("successful exit") ||
    metric.includes("breakout") ||
    metric.includes("first pass") ||
    metric.includes("dz retrieval")
  ) {
    return "breakouts_exit_efficiency";
  }

  if (
    metric.includes("controlled entr") ||
    metric.includes("entries") ||
    metric.includes("counterattack") ||
    metric.includes("rush chance") ||
    metric.includes("neutral-zone")
  ) {
    if (metric.includes("against")) {
      return "transition_defense";
    }

    return "transition_offense";
  }

  if (
    metric.includes("opponent xg") ||
    metric.includes("net xg") ||
    metric.includes("slot chances against") ||
    metric.includes("scoring chances against") ||
    metric.includes("dz time") ||
    metric.includes("second chances against") ||
    metric.includes("xga")
  ) {
    return "defensive_quality_control";
  }

  if (
    metric.includes("giveaway") ||
    metric.includes("puck loss") ||
    metric.includes("failed entry") ||
    metric.includes("pass accuracy") ||
    metric.includes("turnover")
  ) {
    return "puck_management";
  }

  if (
    metric.includes("power play") ||
    metric.includes("pp") ||
    metric.includes("pk") ||
    metric.includes("short-handed") ||
    metric.includes("penalty kill")
  ) {
    return "special_teams_execution";
  }

  return kpi.category === "defense" ? "defensive_quality_control" : "puck_management";
}

function actionabilityFactor(theme: CoachingTheme) {
  switch (theme) {
    case "offensive_zone_possession":
    case "pre_shot_movement":
    case "puck_management":
    case "breakouts_exit_efficiency":
    case "transition_offense":
    case "transition_defense":
    case "retrievals_second_puck":
      return 1.25;
    case "offensive_creation":
    case "defensive_quality_control":
    case "special_teams_execution":
      return 1;
  }
}

function severityFactor(kpi: RecommendationKpiInput) {
  const magnitude = Math.abs(safeValue(kpi.normalizedDelta) ?? safeValue(kpi.weightedImpact) ?? 0);

  if (magnitude >= 12) {
    return 1.35;
  }

  if (magnitude >= 6) {
    return 1.15;
  }

  return 1;
}

function confidenceFactor(kpi: RecommendationKpiInput, focusedGamesCount: number) {
  const coverage = safeValue(kpi.focusedCoverage) ?? 0;
  const sampleFactor = focusedGamesCount >= 4 ? 1 : focusedGamesCount >= 2 ? 0.9 : 0.75;

  if (coverage >= 0.8) {
    return sampleFactor;
  }

  if (coverage >= 0.55) {
    return sampleFactor * 0.9;
  }

  return sampleFactor * 0.75;
}

function themeTitle(theme: CoachingTheme) {
  switch (theme) {
    case "offensive_zone_possession":
      return "Rebuild offensive-zone possession";
    case "offensive_creation":
      return "Create more dangerous scoring looks";
    case "pre_shot_movement":
      return "Create more movement before release points";
    case "puck_management":
      return "Clean up puck decisions under pressure";
    case "breakouts_exit_efficiency":
      return "Make first exits cleaner";
    case "transition_offense":
      return "Turn possession into faster attacks";
    case "transition_defense":
      return "Slow their attack before it becomes dangerous";
    case "defensive_quality_control":
      return "Tighten defensive quality control";
    case "retrievals_second_puck":
      return "Win more second pucks";
    case "special_teams_execution":
      return "Stabilize special teams execution";
  }
}

function themeReason(theme: CoachingTheme) {
  switch (theme) {
    case "offensive_zone_possession":
      return "Dal is spending less of this matchup on the front foot territorially. Lower CORSI%, OZ play, and possession signals suggest we are not sustaining enough pressure after entries or shots.";
    case "offensive_creation":
      return "Dal is creating fewer dangerous looks than its season standard against this opponent. Shot volume, xG, and chance creation are below baseline, which limits repeatable offense.";
    case "pre_shot_movement":
      return "Dal is not generating enough east-west or setup movement before shots, which can flatten shot quality and reduce second-chance creation.";
    case "puck_management":
      return "Turnovers and failed decisions are creating pressure against and limiting our ability to build possession. Cleaner first decisions and support around the puck are needed.";
    case "breakouts_exit_efficiency":
      return "Breakout detail is not consistently getting us out cleanly, which keeps Dal pinned and makes it harder to build attack with speed.";
    case "transition_offense":
      return "Dal is not converting possession into clean attack often enough against this opponent, which is lowering rush threat and entry pressure.";
    case "transition_defense":
      return "This opponent is getting into attack too cleanly, so Dal needs to slow entries earlier and sort faster through the middle.";
    case "defensive_quality_control":
      return "The opponent is getting too much quality in dangerous areas. Opponent xG, slot chance against, or net xG signals point to middle-ice protection and second-chance control.";
    case "retrievals_second_puck":
      return "Dal is not winning enough recoveries and second pucks in this matchup, which is cutting off extended pressure and slowing transitions back into attack.";
    case "special_teams_execution":
      return "Special teams details are more costly than they should be in this matchup. Entries, retrievals, clears, and second-touch execution need to be cleaner.";
  }
}

function themeFocus(theme: CoachingTheme) {
  switch (theme) {
    case "offensive_zone_possession":
      return "Emphasize stronger puck support after entries, faster recovery pressure after shots, and more repeatable low-to-high possession sequences.";
    case "offensive_creation":
      return "Prioritize more direct interior attacks, layered net-front presence, and converting possessions into repeatable scoring looks.";
    case "pre_shot_movement":
      return "Prioritize east-west puck movement, slot-pass activation, and attacking inside ice before settling for perimeter releases.";
    case "puck_management":
      return "Emphasize cleaner first touches, better support below the puck, and safer decisions when under forecheck pressure.";
    case "breakouts_exit_efficiency":
      return "Demand cleaner first passes, better wall support, and quicker weak-side release options so exits become more predictable and controlled.";
    case "transition_offense":
      return "Push for cleaner exits into speed, earlier middle support, and controlled entries that lead directly into pressure.";
    case "transition_defense":
      return "Emphasize reload habits, backpressure, gap control, and denying controlled entries through the middle of the ice.";
    case "defensive_quality_control":
      return "Prioritize middle-ice protection, earlier defensive-zone sorting, net-front control, and limiting second-chance opportunities.";
    case "retrievals_second_puck":
      return "Drive harder puck recovery habits, faster second-touch support, and more urgency around loose pucks after pressure or shot attempts.";
    case "special_teams_execution":
      return "Clean up entry detail, retrieval urgency, and clear/second-touch execution so special teams stop leaking momentum.";
  }
}

function themeBenchCues(theme: CoachingTheme) {
  switch (theme) {
    case "offensive_zone_possession":
      return ["Win the second puck", "Recover above the puck", "Extend plays below the dots"];
    case "offensive_creation":
      return ["Attack the interior first", "Get to second chances", "Do not settle early"];
    case "pre_shot_movement":
      return ["Move it before releasing it", "Attack inside ice", "Find the second layer"];
    case "puck_management":
      return ["First touch matters", "Support the puck", "Make the next easy play"];
    case "breakouts_exit_efficiency":
      return ["First exit must be clean", "Use the weak side early", "Support under the puck"];
    case "transition_offense":
      return ["Exit with speed", "Support through the middle", "Attack with control"];
    case "transition_defense":
      return ["Reload above the puck", "Close gaps early", "Force wide"];
    case "defensive_quality_control":
      return ["Protect middle first", "Sort early", "Clear second chances"];
    case "retrievals_second_puck":
      return ["Win the race to the loose puck", "Support the recovery", "Turn retrievals into pressure"];
    case "special_teams_execution":
      return ["Win the first touch", "Be decisive on clears", "Recover the next puck fast"];
  }
}

function positiveThemeTitle(theme: CoachingTheme) {
  switch (theme) {
    case "special_teams_execution":
      return "Special teams are holding up well";
    case "transition_defense":
      return "Transition defense is staying closer to standard";
    case "retrievals_second_puck":
      return "Recovery pressure is still giving Dal life";
    case "offensive_zone_possession":
      return "Territory is not slipping as badly here";
    default:
      return `${themeTitle(theme)} remains a relative strength`;
  }
}

function positiveThemeTakeaway(theme: CoachingTheme) {
  switch (theme) {
    case "special_teams_execution":
      return "Special teams are holding up better than most other matchup areas relative to baseline.";
    case "transition_defense":
      return "Transition defense is closer to the season norm than other matchup areas, which helps reduce rush damage.";
    case "retrievals_second_puck":
      return "Dal is still finding enough second-puck and recovery moments to keep pressure alive in spots.";
    case "offensive_zone_possession":
      return "Territory and offensive-zone pressure are holding up better than the rest of the matchup profile.";
    default:
      return "This area is giving Dal one of its more reliable matchup edges.";
  }
}

function themeAreaLabel(theme: CoachingTheme) {
  switch (theme) {
    case "offensive_zone_possession":
      return "Offensive-zone possession";
    case "offensive_creation":
      return "Offensive creation";
    case "pre_shot_movement":
      return "Pre-shot movement";
    case "puck_management":
      return "Puck management";
    case "breakouts_exit_efficiency":
      return "Breakout detail";
    case "transition_offense":
      return "Transition offense";
    case "transition_defense":
      return "Transition defense";
    case "defensive_quality_control":
      return "Defensive-zone quality";
    case "retrievals_second_puck":
      return "Second-puck pressure";
    case "special_teams_execution":
      return "Special teams";
  }
}

function positiveThemeFocus(theme: CoachingTheme) {
  switch (theme) {
    case "offensive_zone_possession":
      return "Protect the possession habits that are still helping Dal stay on the front foot and avoid overcorrecting away from them.";
    case "offensive_creation":
      return "Keep feeding the creation habits that are still generating usable offense while the bigger matchup drags are addressed.";
    case "pre_shot_movement":
      return "Keep building off the puck movement and interior attacking habits that still translate against this opponent.";
    case "puck_management":
      return "Preserve the cleaner puck decisions that are still keeping pressure manageable in this matchup.";
    case "breakouts_exit_efficiency":
      return "Do not move away from the breakout details that are still getting Dal out with some control.";
    case "transition_offense":
      return "Keep leaning on the transition habits that still give Dal a path into attack.";
    case "transition_defense":
      return "Protect the reload and gap habits that are keeping this opponent from getting even cleaner attack looks.";
    case "defensive_quality_control":
      return "Do not overcorrect away from the defensive details that are still holding closest to standard.";
    case "retrievals_second_puck":
      return "Keep leaning on the recovery habits that still help Dal extend shifts and regain momentum.";
    case "special_teams_execution":
      return "Protect the special-teams details that are holding up best while the larger concerns are addressed elsewhere.";
  }
}

function supportingMetrics(rows: RecommendationKpiInput[]) {
  return rows
    .slice(0, 4)
    .map((row) => ({
      name: row.name,
      focusedValue: row.focusedRawAverage,
      baselineValue: row.baselineRawAverage,
      rawDelta: row.rawDelta,
      weightedImpact: row.weightedImpact,
      isPercent: row.name.includes("%"),
    }));
}

function supportingDataText(metrics: SupportingMetric[]) {
  return metrics
    .slice(0, 3)
    .map(
      (metric) =>
        `${metric.name}: ${formatValue(metric.focusedValue, metric.isPercent)} vs ${formatValue(metric.baselineValue, metric.isPercent)} baseline`,
    )
    .join(" | ");
}

function priorityLevel(score: number) {
  if (score >= 3.1) {
    return "high" as const;
  }

  if (score >= 1.5) {
    return "medium" as const;
  }

  return "monitor" as const;
}

function signalLevel(score: number) {
  if (score >= 2.4) {
    return "high" as const;
  }

  if (score >= 1.2) {
    return "medium" as const;
  }

  return "monitor" as const;
}

function levelFromDelta(delta: number) {
  if (delta >= 2.5) {
    return "high" as const;
  }

  if (delta >= -2.5) {
    return "medium" as const;
  }

  return "monitor" as const;
}

function buildConcernGroups(concerns: RecommendationKpiInput[], focusedGamesCount: number) {
  const groups = new Map<CoachingTheme, ThemeGroup>();

  for (const row of concerns) {
    const theme = classifyKpiToCoachingTheme(row);
    const score =
      Math.abs(row.weightedImpact ?? 0) *
      severityFactor(row) *
      actionabilityFactor(theme) *
      confidenceFactor(row, focusedGamesCount);
    const current = groups.get(theme) ?? { theme, rows: [], score: 0 };
    current.rows.push(row);
    current.score += score;
    groups.set(theme, current);
  }

  return groups;
}

function applyGroupBonuses(
  groups: Map<CoachingTheme, ThemeGroup>,
  categoryRows: RecommendationCategoryInput[],
  tacticalRows: RecommendationTacticalInput[],
  direction: "positive" | "concern",
) {
  for (const row of categoryRows) {
    const theme = CATEGORY_THEME_MAP[row.category];
    const group = groups.get(theme);
    if (!group || row.delta === null) {
      continue;
    }

    const relevant =
      direction === "concern" ? row.status === "concern" || row.delta < 0 : row.status === "strength" || row.delta > 0;

    if (relevant) {
      group.score += Math.abs(row.delta) * 0.08;
    }
  }

  for (const row of tacticalRows) {
    const theme = TACTICAL_THEME_MAP[row.group];
    if (!theme) {
      continue;
    }

    const group = groups.get(theme);
    if (!group || row.delta === null) {
      continue;
    }

    const relevant =
      direction === "concern"
        ? row.status === "concern" || row.delta < 0
        : row.status === "strength" || row.delta > 0;

    if (relevant) {
      group.score += Math.abs(row.delta) * 0.12;
    }
  }
}

function buildRecommendations(
  concerns: RecommendationKpiInput[],
  categoryRows: RecommendationCategoryInput[],
  tacticalRows: RecommendationTacticalInput[],
  focusedGamesCount: number,
) {
  const groups = buildConcernGroups(concerns, focusedGamesCount);
  applyGroupBonuses(groups, categoryRows, tacticalRows, "concern");

  return [...groups.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map((group) => {
      const metrics = supportingMetrics(
        [...group.rows].sort(
          (left, right) => Math.abs(right.weightedImpact ?? 0) - Math.abs(left.weightedImpact ?? 0),
        ),
      );

      return {
        key: group.theme,
        title: themeTitle(group.theme),
        reason: themeReason(group.theme),
        supportingData: supportingDataText(metrics),
        coachingFocus: themeFocus(group.theme),
        benchCues: themeBenchCues(group.theme),
        priorityLevel: priorityLevel(group.score),
        themeConcernScore: round(group.score, 2),
        sourceKpis: group.rows.map((row) => row.name),
        supportingMetrics: metrics,
      } satisfies CoachingRecommendation;
    });
}

function buildPositiveSignals(
  strengths: RecommendationKpiInput[],
  categoryRows: RecommendationCategoryInput[],
  tacticalRows: RecommendationTacticalInput[],
  focusedGamesCount: number,
) {
  const groups = buildConcernGroups(strengths, focusedGamesCount);
  applyGroupBonuses(groups, categoryRows, tacticalRows, "positive");

  return [...groups.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .map((group) => {
      const metrics = supportingMetrics(
        [...group.rows].sort(
          (left, right) => Math.abs(right.weightedImpact ?? 0) - Math.abs(left.weightedImpact ?? 0),
        ),
      );

      return {
        key: group.theme,
        title: positiveThemeTitle(group.theme),
        takeaway: positiveThemeTakeaway(group.theme),
        supportingData: supportingDataText(metrics),
        focus: positiveThemeFocus(group.theme),
        impactLevel: signalLevel(group.score),
        sourceKpis: group.rows.map((row) => row.name),
      } satisfies MatchupStrengthSignal;
    });
}

function buildFallbackPositiveSignals(
  categoryRows: RecommendationCategoryInput[],
  tacticalRows: RecommendationTacticalInput[],
  focusedGamesCount: number,
) {
  if (focusedGamesCount < 2) {
    return [
      {
        key: "defensive_quality_control" as const,
        title: "Limited matchup sample",
        takeaway:
          "There is not enough opponent history yet to call a real strength, so treat the most stable areas as early signals rather than firm conclusions.",
        supportingData: `Only ${focusedGamesCount} matchup game${focusedGamesCount === 1 ? "" : "s"} are in focus.`,
        focus:
          "Protect the parts of the game that look least volatile for now and avoid overreacting to a very thin sample.",
        impactLevel: "monitor" as const,
        sourceKpis: [],
      },
    ];
  }

  const groups = new Map<
    CoachingTheme,
    {
      theme: CoachingTheme;
      deltas: number[];
      supportingLines: Array<{ line: string; delta: number }>;
    }
  >();

  for (const row of categoryRows) {
    if (row.delta === null) {
      continue;
    }

    const theme = CATEGORY_THEME_MAP[row.category];
    const current = groups.get(theme) ?? { theme, deltas: [], supportingLines: [] };
    current.deltas.push(row.delta);
    current.supportingLines.push({
      line: `${row.label}: ${formatValue(row.focusedScore)} vs ${formatValue(row.baselineScore)} baseline`,
      delta: row.delta,
    });
    groups.set(theme, current);
  }

  for (const row of tacticalRows) {
    if (row.delta === null) {
      continue;
    }

    const theme = TACTICAL_THEME_MAP[row.group];
    if (!theme) {
      continue;
    }

    const current = groups.get(theme) ?? { theme, deltas: [], supportingLines: [] };
    current.deltas.push(row.delta);
    current.supportingLines.push({
      line: `${row.label}: ${formatValue(row.score)} vs ${formatValue(row.baselineScore)} baseline`,
      delta: row.delta,
    });
    groups.set(theme, current);
  }

  const candidates = [...groups.values()]
    .map((group) => {
      const bestDelta = [...group.deltas].sort((left, right) => {
        const positiveDiff = Number(right >= 0) - Number(left >= 0);
        if (positiveDiff !== 0) {
          return positiveDiff;
        }

        return Math.abs(left) - Math.abs(right);
      })[0];

      const supportingData = group.supportingLines
        .sort((left, right) => Math.abs(left.delta) - Math.abs(right.delta))
        .slice(0, 2)
        .map((entry) => entry.line)
        .join(" | ");

      return {
        theme: group.theme,
        bestDelta,
        supportingData,
      };
    })
    .sort((left, right) => {
      const positiveDiff = Number(right.bestDelta >= 0) - Number(left.bestDelta >= 0);
      if (positiveDiff !== 0) {
        return positiveDiff;
      }

      return Math.abs(left.bestDelta) - Math.abs(right.bestDelta);
    })
    .slice(0, 4);

  if (!candidates.length) {
    return [
      {
        key: "defensive_quality_control" as const,
        title: "Limited matchup sample",
        takeaway:
          "The current opponent slice does not have enough valid tactical or category evidence to identify a reliable area to lean on yet.",
        supportingData: "Not enough category or tactical comparison data was available in the current filter.",
        focus:
          "Treat the current profile as incomplete and lean more heavily on broader season context until more matchup evidence is available.",
        impactLevel: "monitor" as const,
        sourceKpis: [],
      },
    ];
  }

  return candidates.map((candidate) => {
    const area = themeAreaLabel(candidate.theme);
    const delta = candidate.bestDelta;

    let title = `${area} is closest to holding baseline`;
    let takeaway =
      `Dal does not have a clear positive edge here, but ${area.toLowerCase()} is closer to baseline than most of the current matchup profile.`;

    if (delta >= 1.5) {
      title = `${area} is one of the clearest areas to lean on`;
      takeaway =
        `${area} is one of the few matchup areas still running above baseline, so it may be the most reliable place to keep pressing.`;
    } else if (delta < -2.5) {
      title = `${area} is taking the least damage`;
      takeaway =
        `No matchup area is clearly outperforming baseline, but ${area.toLowerCase()} is holding up better than the rest of the profile.`;
    }

    return {
      key: candidate.theme,
      title,
      takeaway,
      supportingData: candidate.supportingData,
      focus:
        "Do not overcorrect away from the parts of the game that are still comparatively stable while the bigger matchup drags are addressed.",
      impactLevel: levelFromDelta(delta),
      sourceKpis: [],
    } satisfies MatchupStrengthSignal;
  });
}

function buildConcernSignals(recommendations: CoachingRecommendation[]) {
  return recommendations.slice(0, 5).map((item) => ({
    key: item.key,
    title: item.title,
    takeaway: item.reason,
    supportingData: item.supportingData,
    focus: item.coachingFocus,
    impactLevel: item.priorityLevel,
    sourceKpis: item.sourceKpis,
  }));
}

function buildGamePlanReminders(recommendations: CoachingRecommendation[]) {
  return [...new Set(recommendations.flatMap((item) => item.benchCues))].slice(0, 6);
}

export function buildCoachingRecommendations(args: {
  concerns: RecommendationKpiInput[];
  strengths: RecommendationKpiInput[];
  categoryRows: RecommendationCategoryInput[];
  tacticalRows: RecommendationTacticalInput[];
  focusedGamesCount: number;
}) {
  const priorities = buildRecommendations(
    args.concerns,
    args.categoryRows,
    args.tacticalRows,
    args.focusedGamesCount,
  );
  const positiveSignals = buildPositiveSignals(
    args.strengths,
    args.categoryRows,
    args.tacticalRows,
    args.focusedGamesCount,
  );
  const resolvedPositiveSignals = positiveSignals.length
    ? positiveSignals
    : buildFallbackPositiveSignals(
        args.categoryRows,
        args.tacticalRows,
        args.focusedGamesCount,
      );
  const concernSignals = buildConcernSignals(priorities);

  const notes: string[] = [];
  if (args.focusedGamesCount < 2) {
    notes.push("Limited matchup sample. Treat these notes as early signals.");
  }

  const coverageValues = args.concerns
    .map((row) => row.focusedCoverage)
    .filter((value) => value > 0);
  const averageCoverage = coverageValues.length
    ? coverageValues.reduce((sum, value) => sum + value, 0) / coverageValues.length
    : null;

  if (averageCoverage !== null && averageCoverage < 0.7) {
    notes.push("Some recommendations are based on partial KPI coverage.");
  }

  return {
    priorities,
    positiveSignals: resolvedPositiveSignals,
    concernSignals,
    gamePlanReminders: buildGamePlanReminders(priorities),
    notes,
  } satisfies CoachingRecommendationResult;
}
