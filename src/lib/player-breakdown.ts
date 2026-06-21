import type { CategoryScoreSummary, PlayerBreakdown } from "@/lib/player-goalie-types";

export interface PlayerComparisonCategoryRow {
  category: string;
  shortLabel: string;
  score: number | null;
  teamAverage: number | null;
  positionAverage: number | null;
  deltaVsTeam: number | null;
  deltaVsPosition: number | null;
}

export interface PlayerComparisonSummary {
  overallTeamAverage: number | null;
  overallPositionAverage: number | null;
  categoryRows: PlayerComparisonCategoryRow[];
}

export interface PlayerInsightItem {
  title: string;
  evidence: string;
  focus?: string;
}

export interface PlayerSnapshotTrendPoint {
  label: string;
  snapshotDate: string;
  overallScore: number | null;
  offensiveScore: number | null;
  defensiveScore: number | null;
  transitionScore: number | null;
  puckManagementScore: number | null;
  battleCompeteScore: number | null;
  possessionScore: number | null;
  specialTeamsScore: number | null;
  disciplineRiskScore: number | null;
}

export interface PlayerSinceLastUploadSummary {
  overallChange: number | null;
  biggestImprovement: string | null;
  biggestDecline: string | null;
  gamesAdded: number | null;
  toiAddedMinutes: number | null;
  trendLabel: "Improving" | "Stable" | "Declining" | "Limited data";
  tone: "up" | "flat" | "down" | "slate";
  detail: string;
}

const CATEGORY_META = [
  {
    match: /offensive creation/i,
    shortLabel: "Offensive Creation",
    strengthTitle: "Drives chance creation",
    strengthFocus: "Keep feeding the habits that create inside looks before release points.",
    developmentTitle: "Needs more dangerous offense",
    developmentFocus: "Push for cleaner slot access, shot quality, and second-touch offense.",
    roleTags: ["Top-six driver", "Finisher", "Offense driver"],
  },
  {
    match: /possession|on-ice impact/i,
    shortLabel: "Possession / Impact",
    strengthTitle: "Tilts play in Dal's favor",
    strengthFocus: "Protect the territorial habits that keep this player on the front foot.",
    developmentTitle: "Needs stronger territorial control",
    developmentFocus: "Build more repeatable ozone time, puck support, and front-foot shifts.",
    roleTags: ["Possession driver", "Two-way forward", "Two-way defenceman"],
  },
  {
    match: /transition/i,
    shortLabel: "Transition",
    strengthTitle: "Moves play through transition",
    strengthFocus: "Keep turning first touches and exits into controlled attack speed.",
    developmentTitle: "Needs cleaner transition execution",
    developmentFocus: "Clean up entry support, exits, and attack connections through the middle.",
    roleTags: ["Transition-forward", "Puck mover", "Rush support player"],
  },
  {
    match: /puck management/i,
    shortLabel: "Puck Management",
    strengthTitle: "Protects the puck well",
    strengthFocus: "Keep leaning into simple first touches and strong support around the puck.",
    developmentTitle: "Needs cleaner puck decisions",
    developmentFocus: "Review turnovers, pressured exits, and support options under pressure.",
    roleTags: ["Puck mover", "Puck-support forward", "Possession stabilizer"],
  },
  {
    match: /defensive impact/i,
    shortLabel: "Defensive Impact",
    strengthTitle: "Helps suppress opponent quality",
    strengthFocus: "Protect the defensive habits that keep the player reliable without the puck.",
    developmentTitle: "Needs stronger defensive detail",
    developmentFocus: "Prioritize middle-ice protection, kill plays earlier, and reduce quality against.",
    roleTags: ["Defensive defenceman", "Two-way forward", "Shutdown option"],
  },
  {
    match: /battle|compete|recover/i,
    shortLabel: "Battle / Compete",
    strengthTitle: "Wins second-puck sequences",
    strengthFocus: "Keep using retrieval, recovery, and battle wins to extend possessions.",
    developmentTitle: "Needs more second-puck wins",
    developmentFocus: "Push retrieval pressure and contested-puck habits harder.",
    roleTags: ["Retrieval / battle player", "Forecheck worker", "Second-puck driver"],
  },
  {
    match: /special teams/i,
    shortLabel: "Special Teams",
    strengthTitle: "Contributes on special teams",
    strengthFocus: "Protect the special-teams habits that are translating right now.",
    developmentTitle: "Special teams need attention",
    developmentFocus: "Review special-teams structure, decision-making, and retrieval detail.",
    roleTags: ["Special-teams option"],
  },
  {
    match: /discipline|risk/i,
    shortLabel: "Discipline / Risk",
    strengthTitle: "Keeps risk under control",
    strengthFocus: "Maintain the decision quality that limits unnecessary swings against.",
    developmentTitle: "Risk management can improve",
    developmentFocus: "Reduce preventable penalties and puck-risk moments.",
    roleTags: ["Risk-control player"],
  },
];

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!valid.length) {
    return null;
  }

  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function delta(value: number | null, baseline: number | null) {
  if (value === null || baseline === null) {
    return null;
  }

  return value - baseline;
}

function categoryMeta(category: string) {
  return CATEGORY_META.find((entry) => entry.match.test(category));
}

function shortCategoryLabel(category: string) {
  return categoryMeta(category)?.shortLabel ?? category;
}

function formatSigned(value: number | null, digits = 1) {
  if (value === null || Number.isNaN(value)) {
    return "n/a";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function metricEvidence(metricNames: string[]) {
  const cleaned = metricNames.filter(Boolean).slice(0, 3);
  if (!cleaned.length) {
    return "No supporting KPI signal stood out clearly.";
  }

  if (cleaned.length === 1) {
    return `Supported most clearly by ${cleaned[0]}.`;
  }

  if (cleaned.length === 2) {
    return `Supported most clearly by ${cleaned[0]} and ${cleaned[1]}.`;
  }

  return `Supported most clearly by ${cleaned[0]}, ${cleaned[1]}, and ${cleaned[2]}.`;
}

function buildCategoryLookup(categoryScores: CategoryScoreSummary[]) {
  return new Map(categoryScores.map((category) => [category.category, category] as const));
}

export function buildPlayerComparisonSummary(
  breakdown: PlayerBreakdown,
  seasonRows: PlayerBreakdown[],
): PlayerComparisonSummary {
  const positionRows = seasonRows.filter((row) => row.modelType === breakdown.modelType);
  const allCategories = breakdown.categoryScores.map((category) => category.category);

  const categoryRows = allCategories.map((category) => {
    const teamValues = seasonRows
      .map((row) => buildCategoryLookup(row.categoryScores).get(category)?.score ?? null);
    const positionValues = positionRows
      .map((row) => buildCategoryLookup(row.categoryScores).get(category)?.score ?? null);
    const score = buildCategoryLookup(breakdown.categoryScores).get(category)?.score ?? null;
    const teamAverage = average(teamValues);
    const positionAverage = average(positionValues);

    return {
      category,
      shortLabel: shortCategoryLabel(category),
      score,
      teamAverage,
      positionAverage,
      deltaVsTeam: delta(score, teamAverage),
      deltaVsPosition: delta(score, positionAverage),
    } satisfies PlayerComparisonCategoryRow;
  });

  return {
    overallTeamAverage: average(seasonRows.map((row) => row.overallScore)),
    overallPositionAverage: average(positionRows.map((row) => row.overallScore)),
    categoryRows,
  };
}

export function inferPlayerRoleTags(
  breakdown: PlayerBreakdown,
  comparison: PlayerComparisonSummary,
) {
  if (breakdown.roleTags.length > 0) {
    return breakdown.roleTags;
  }

  const tags: string[] = [];
  const sortedCategories = [...comparison.categoryRows]
    .filter((row) => row.score !== null)
    .sort((left, right) => (right.score ?? -1) - (left.score ?? -1));

  for (const row of sortedCategories) {
    const meta = categoryMeta(row.category);
    if (!meta) {
      continue;
    }

    const preferredTag =
      breakdown.position === "D"
        ? meta.roleTags.find((tag) => /defenceman|puck mover|shutdown|two-way/i.test(tag))
        : meta.roleTags.find((tag) => /forward|driver|finisher|battle/i.test(tag)) ??
          meta.roleTags[0];

    if (preferredTag && !tags.includes(preferredTag)) {
      tags.push(preferredTag);
    }

    if (tags.length >= 2) {
      break;
    }
  }

  if (!tags.length) {
    tags.push(breakdown.position === "D" ? "Blue-line contributor" : "Lineup contributor");
  }

  return tags;
}

export function buildPlayerSnapshotTrendPoints(breakdown: PlayerBreakdown) {
  return breakdown.snapshots.map((snapshot) => ({
    label: new Intl.DateTimeFormat("en-CA", {
      month: "short",
      day: "numeric",
    }).format(new Date(snapshot.snapshotDate)),
    snapshotDate: snapshot.snapshotDate,
    overallScore: snapshot.overallScore,
    offensiveScore: snapshot.offensiveScore,
    defensiveScore: snapshot.defensiveScore,
    transitionScore: snapshot.transitionScore,
    puckManagementScore: snapshot.puckManagementScore,
    battleCompeteScore: snapshot.battleCompeteScore,
    possessionScore: snapshot.possessionScore,
    specialTeamsScore: snapshot.specialTeamsScore,
    disciplineRiskScore: snapshot.disciplineRiskScore,
  }));
}

export function buildPlayerTrendLabel(breakdown: PlayerBreakdown) {
  const latestInterval = breakdown.latestInterval;

  if (!latestInterval) {
    return {
      label: "Limited data",
      tone: "slate" as const,
      detail: "Upload another Instat file later to unlock player trend tracking.",
    };
  }

  if (latestInterval.trendLabel === "Improving") {
    return {
      label: "Improving",
      tone: "up" as const,
      detail: "The latest upload block is trending upward versus the previous snapshot.",
    };
  }

  if (latestInterval.trendLabel === "Declining") {
    return {
      label: "Declining",
      tone: "down" as const,
      detail: "The latest upload block slipped versus the previous saved snapshot.",
    };
  }

  if (latestInterval.trendLabel === "Stable") {
    return {
      label: "Stable",
      tone: "flat" as const,
      detail: "The latest upload block is holding close to the prior snapshot level.",
    };
  }

  return {
    label: "Limited data",
    tone: "slate" as const,
    detail: "The latest upload does not have enough interval context yet.",
  };
}

export function buildSinceLastUploadSummary(
  breakdown: PlayerBreakdown,
): PlayerSinceLastUploadSummary {
  const interval = breakdown.latestInterval;

  if (!interval) {
    return {
      overallChange: null,
      biggestImprovement: null,
      biggestDecline: null,
      gamesAdded: null,
      toiAddedMinutes: null,
      trendLabel: "Limited data",
      tone: "slate",
      detail: "No trend yet. Upload another Instat export later in the season to compare player progress.",
    };
  }

  return {
    overallChange: interval.overallScoreChange,
    biggestImprovement: interval.strongestImprovement,
    biggestDecline: interval.biggestDecline,
    gamesAdded: interval.gamesAdded,
    toiAddedMinutes: interval.toiAddedMinutes,
    trendLabel:
      interval.trendLabel === "Improving" ||
      interval.trendLabel === "Stable" ||
      interval.trendLabel === "Declining"
        ? interval.trendLabel
        : "Limited data",
    tone:
      interval.trendLabel === "Improving"
        ? "up"
        : interval.trendLabel === "Declining"
          ? "down"
          : interval.trendLabel === "Stable"
            ? "flat"
            : "slate",
    detail:
      interval.trendLabel === "Improving"
        ? "The latest upload block improved relative to the previous saved export."
        : interval.trendLabel === "Declining"
          ? "The latest upload block slipped relative to the previous saved export."
          : interval.trendLabel === "Stable"
            ? "The latest upload block held near the prior saved export."
            : "The latest upload block does not have enough context yet.",
  };
}

export function buildPlayerStrengths(
  breakdown: PlayerBreakdown,
  comparison: PlayerComparisonSummary,
) {
  const categoryLeaders = [...comparison.categoryRows]
    .filter((row) => row.score !== null)
    .sort((left, right) => (right.deltaVsPosition ?? -999) - (left.deltaVsPosition ?? -999));

  const strongestMetrics = breakdown.strongestKpis
    .filter((metric) => metric.score0100 !== null)
    .slice(0, 4);

  const items: PlayerInsightItem[] = [];

  const topCategory = categoryLeaders[0];
  if (topCategory) {
    const meta = categoryMeta(topCategory.category);
    items.push({
      title: meta?.strengthTitle ?? `${topCategory.shortLabel} is a clear plus`,
      evidence: `${topCategory.shortLabel} sits ${formatSigned(topCategory.deltaVsPosition)} vs position average and ${formatSigned(topCategory.deltaVsTeam)} vs team average.`,
      focus: meta?.strengthFocus,
    });
  }

  if (strongestMetrics.length) {
    items.push({
      title: "Most of the positive lift is coming from repeatable habits",
      evidence: metricEvidence(strongestMetrics.map((metric) => metric.displayName)),
      focus: "Keep the same habits in the role areas that are already translating into score impact.",
    });
  }

  const stableCategory = categoryLeaders.find(
    (row) => row !== topCategory && row.deltaVsTeam !== null && row.deltaVsTeam >= -1.5,
  );
  if (stableCategory) {
    items.push({
      title: `${stableCategory.shortLabel} is giving the player a stable base`,
      evidence: `${stableCategory.shortLabel} is holding near team level at ${stableCategory.score?.toFixed(1) ?? "n/a"}/100.`,
      focus: "Avoid overcoaching away from the parts of the profile that are already holding up.",
    });
  }

  if (!items.length) {
    items.push({
      title: "No clear positive KPI edge stood out",
      evidence: "This profile is being carried more by balance than by one standout scoring area right now.",
      focus: "Use the cleaner categories as the base and build from there.",
    });
  }

  return items.slice(0, 3);
}

export function buildPlayerDevelopmentAreas(
  breakdown: PlayerBreakdown,
  comparison: PlayerComparisonSummary,
) {
  const weakestCategories = [...comparison.categoryRows]
    .filter((row) => row.score !== null)
    .sort((left, right) => (left.deltaVsPosition ?? 999) - (right.deltaVsPosition ?? 999));

  const weakestMetrics = breakdown.developmentKpis
    .filter((metric) => metric.score0100 !== null)
    .slice(0, 4);

  const items: PlayerInsightItem[] = [];

  const weakestCategory = weakestCategories[0];
  if (weakestCategory) {
    const meta = categoryMeta(weakestCategory.category);
    items.push({
      title: meta?.developmentTitle ?? `${weakestCategory.shortLabel} needs attention`,
      evidence: `${weakestCategory.shortLabel} is ${formatSigned(weakestCategory.deltaVsPosition)} vs position average and ${formatSigned(weakestCategory.deltaVsTeam)} vs team average.`,
      focus: meta?.developmentFocus,
    });
  }

  if (weakestMetrics.length) {
    items.push({
      title: "The lowest signals are concentrated in a few specific habits",
      evidence: metricEvidence(weakestMetrics.map((metric) => metric.displayName)),
      focus: "Review the touches and situations attached to these weaker drivers before the next block of games.",
    });
  }

  const riskCategory = weakestCategories.find(
    (row) =>
      row !== weakestCategory &&
      /risk|discipline|puck management|defensive/i.test(row.category),
  );
  if (riskCategory) {
    items.push({
      title: `${riskCategory.shortLabel} is the next area to tighten`,
      evidence: `${riskCategory.shortLabel} is trailing the player's position group at ${riskCategory.score?.toFixed(1) ?? "n/a"}/100.`,
      focus: "Clean up the preventable habits here before chasing lower-impact details elsewhere.",
    });
  }

  if (!items.length) {
    items.push({
      title: "No major drag stood out in the current profile",
      evidence: "There is not one obvious weak category separating from the rest of the scorecard right now.",
      focus: "Monitor for consistency rather than forcing a single development theme.",
    });
  }

  return items.slice(0, 3);
}

export function buildPlayerCoachSummary(
  breakdown: PlayerBreakdown,
  comparison: PlayerComparisonSummary,
  roleTags: string[],
) {
  const sortedCategories = [...comparison.categoryRows]
    .filter((row) => row.score !== null)
    .sort((left, right) => (right.score ?? -1) - (left.score ?? -1));
  const strongest = sortedCategories[0];
  const weakest = [...sortedCategories].reverse()[0];
  const overallTeamAverage = comparison.overallTeamAverage;
  const overallPositionAverage = comparison.overallPositionAverage;
  const trend = buildPlayerTrendLabel(breakdown);

  return [
    `${breakdown.name} currently profiles most like a ${roleTags[0].toLowerCase()}.`,
    strongest
      ? `The clearest carrying area is ${strongest.shortLabel.toLowerCase()}, where the score sits at ${strongest.score?.toFixed(1) ?? "n/a"}/100.`
      : "No clear top category is available yet.",
    overallPositionAverage === null || breakdown.overallScore === null
      ? "Position-group comparison is limited until more scored rows are available."
      : `Against the ${breakdown.modelType.toLowerCase()} group average, the overall score is ${formatSigned(breakdown.overallScore - overallPositionAverage)}.`,
    weakest
      ? `Next coaching attention should go toward ${weakest.shortLabel.toLowerCase()} before it drags the rest of the profile down.`
      : "No single development area separates sharply from the rest of the profile.",
    trend.detail,
    overallTeamAverage === null || breakdown.overallScore === null
      ? "Team-average context is limited right now."
      : breakdown.overallScore >= overallTeamAverage
        ? "Overall, this player is helping the team score profile more than the average skater in the current season view."
        : "Overall, this player is trailing the current team-average score and needs a clearer carrying area to separate.",
  ].slice(0, 5);
}
