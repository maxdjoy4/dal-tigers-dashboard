import type {
  CategoryScoreSummary,
  PositionBucket,
} from "@/lib/player-goalie-types";

export type SnapshotScoreKey =
  | "overallScore"
  | "offensiveScore"
  | "defensiveScore"
  | "transitionScore"
  | "puckManagementScore"
  | "battleCompeteScore"
  | "possessionScore"
  | "specialTeamsScore"
  | "disciplineRiskScore";

export interface SnapshotCategoryDefinition {
  key: Exclude<SnapshotScoreKey, "overallScore">;
  label: string;
  match: RegExp;
}

export const SNAPSHOT_CATEGORY_DEFINITIONS: SnapshotCategoryDefinition[] = [
  {
    key: "offensiveScore",
    label: "Offensive Creation",
    match: /offensive creation/i,
  },
  {
    key: "defensiveScore",
    label: "Defensive Impact",
    match: /defensive impact/i,
  },
  {
    key: "transitionScore",
    label: "Transition",
    match: /transition/i,
  },
  {
    key: "puckManagementScore",
    label: "Puck Management",
    match: /puck management/i,
  },
  {
    key: "battleCompeteScore",
    label: "Battle \/ Compete",
    match: /battle|compete|recover/i,
  },
  {
    key: "possessionScore",
    label: "Possession / On-Ice Impact",
    match: /possession|on-ice impact/i,
  },
  {
    key: "specialTeamsScore",
    label: "Special Teams",
    match: /special teams/i,
  },
  {
    key: "disciplineRiskScore",
    label: "Discipline / Risk",
    match: /discipline|risk/i,
  },
];

const ROLE_TAGS_BY_KEY: Record<
  Exclude<SnapshotScoreKey, "overallScore">,
  string[]
> = {
  offensiveScore: ["Top-six driver", "Finisher", "Offense driver"],
  defensiveScore: ["Defensive defenceman", "Two-way forward", "Shutdown option"],
  transitionScore: ["Transition-forward", "Puck mover", "Rush support player"],
  puckManagementScore: ["Puck mover", "Puck-support forward", "Possession stabilizer"],
  battleCompeteScore: ["Retrieval / battle player", "Forecheck worker", "Second-puck driver"],
  possessionScore: ["Possession driver", "Two-way forward", "Two-way defenceman"],
  specialTeamsScore: ["Special-teams option"],
  disciplineRiskScore: ["Risk-control player"],
};

export interface SnapshotCategoryValueMap {
  offensiveScore: number | null;
  defensiveScore: number | null;
  transitionScore: number | null;
  puckManagementScore: number | null;
  battleCompeteScore: number | null;
  possessionScore: number | null;
  specialTeamsScore: number | null;
  disciplineRiskScore: number | null;
}

export interface SnapshotDeltaSummary {
  strongestImprovement: string | null;
  biggestDecline: string | null;
  topDelta: number | null;
  bottomDelta: number | null;
}

function emptySnapshotCategoryValueMap(): SnapshotCategoryValueMap {
  return {
    offensiveScore: null,
    defensiveScore: null,
    transitionScore: null,
    puckManagementScore: null,
    battleCompeteScore: null,
    possessionScore: null,
    specialTeamsScore: null,
    disciplineRiskScore: null,
  };
}

function findCategoryDefinition(category: string) {
  return SNAPSHOT_CATEGORY_DEFINITIONS.find((entry) => entry.match.test(category));
}

export function buildSnapshotCategoryValueMap(
  categoryScores: CategoryScoreSummary[],
): SnapshotCategoryValueMap {
  const values = emptySnapshotCategoryValueMap();

  for (const category of categoryScores) {
    const definition = findCategoryDefinition(category.category);
    if (!definition) {
      continue;
    }

    values[definition.key] = category.score;
  }

  return values;
}

export function scoreKeyLabel(key: SnapshotScoreKey) {
  if (key === "overallScore") {
    return "Overall Score";
  }

  return (
    SNAPSHOT_CATEGORY_DEFINITIONS.find((entry) => entry.key === key)?.label ?? key
  );
}

export function inferPlayerRoleTagsFromCategoryScores(
  position: PositionBucket,
  categoryScores: CategoryScoreSummary[],
) {
  const ranked = categoryScores
    .map((category) => ({
      category,
      definition: findCategoryDefinition(category.category),
    }))
    .filter(
      (
        row,
      ): row is {
        category: CategoryScoreSummary;
        definition: SnapshotCategoryDefinition;
      } => row.definition !== undefined && row.category.score !== null,
    )
    .sort((left, right) => (right.category.score ?? -1) - (left.category.score ?? -1));

  const tags: string[] = [];

  for (const row of ranked) {
    const options = ROLE_TAGS_BY_KEY[row.definition.key];
    const preferredTag =
      position === "D"
        ? options.find((tag) => /defenceman|puck mover|shutdown|two-way/i.test(tag)) ??
          options[0]
        : options.find((tag) => /forward|driver|finisher|battle/i.test(tag)) ??
          options[0];

    if (preferredTag && !tags.includes(preferredTag)) {
      tags.push(preferredTag);
    }

    if (tags.length >= 2) {
      break;
    }
  }

  if (!tags.length) {
    tags.push(position === "D" ? "Blue-line contributor" : "Lineup contributor");
  }

  return tags;
}

export function buildSnapshotDeltaSummary(
  current: SnapshotCategoryValueMap,
  previous: SnapshotCategoryValueMap,
): SnapshotDeltaSummary {
  const deltas = SNAPSHOT_CATEGORY_DEFINITIONS.map((definition) => ({
    label: definition.label,
    delta:
      current[definition.key] === null || previous[definition.key] === null
        ? null
        : (current[definition.key] ?? 0) - (previous[definition.key] ?? 0),
  })).filter((row): row is { label: string; delta: number } => row.delta !== null);

  if (!deltas.length) {
    return {
      strongestImprovement: null,
      biggestDecline: null,
      topDelta: null,
      bottomDelta: null,
    };
  }

  const strongestImprovement = [...deltas].sort((a, b) => b.delta - a.delta)[0];
  const biggestDecline = [...deltas].sort((a, b) => a.delta - b.delta)[0];

  return {
    strongestImprovement:
      strongestImprovement.delta > 0 ? strongestImprovement.label : null,
    biggestDecline: biggestDecline.delta < 0 ? biggestDecline.label : null,
    topDelta: strongestImprovement.delta,
    bottomDelta: biggestDecline.delta,
  };
}

export function buildTrendLabelFromChange(change: number | null) {
  if (change === null || Number.isNaN(change)) {
    return "Limited data";
  }

  if (change >= 3) {
    return "Improving";
  }

  if (change <= -3) {
    return "Declining";
  }

  return "Stable";
}

export function isLikelyRateMetricKey(metricKey: string) {
  return /(?:pct|percentage|accuracy|ratio|pershot|per_shot|rate)$/i.test(metricKey);
}

export function isIntervalDeltaSafe(
  metricKey: string,
  currentValue: string | number | null,
  previousValue: string | number | null,
) {
  if (typeof currentValue !== "number" || typeof previousValue !== "number") {
    return false;
  }

  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) {
    return false;
  }

  if (isLikelyRateMetricKey(metricKey)) {
    return false;
  }

  return currentValue >= previousValue;
}
