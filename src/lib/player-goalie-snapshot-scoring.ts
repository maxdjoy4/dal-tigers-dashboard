import {
  buildSnapshotCategoryValueMap,
  buildSnapshotDeltaSummary,
  buildTrendLabelFromChange,
  inferPlayerRoleTagsFromCategoryScores,
  isIntervalDeltaSafe,
} from "@/lib/player-goalie-snapshots";
import type {
  GoalieScoreSnapshot,
  ParsedGoalieSeasonStat,
  ParsedPlayerSeasonStat,
  PlayerGoalieScoreRow,
  PlayerIntervalScore,
  PlayerScoreSnapshot,
  PositionBucket,
} from "@/lib/player-goalie-types";

type RawStatsRecord = Record<string, string | number | null>;

export interface PreviousPlayerSeasonState {
  uploadId: string | null;
  createdAt: string | null;
  playerName: string;
  position: PositionBucket;
  gamesPlayed: number | null;
  toiSeconds: number | null;
  raw: RawStatsRecord;
}

export interface PreviousGoalieSeasonState {
  uploadId: string | null;
  createdAt: string | null;
  goalieName: string;
  gamesPlayed: number | null;
  toiSeconds: number | null;
  raw: RawStatsRecord;
}

function diffNumber(current: number | null, previous: number | null) {
  if (
    current === null ||
    previous === null ||
    !Number.isFinite(current) ||
    !Number.isFinite(previous) ||
    current < previous
  ) {
    return null;
  }

  return current - previous;
}

function buildIntervalRawRecord(
  currentRaw: RawStatsRecord,
  previousRaw: RawStatsRecord,
) {
  const keys = new Set([...Object.keys(currentRaw), ...Object.keys(previousRaw)]);
  const intervalRaw: RawStatsRecord = {
    player: currentRaw.player ?? null,
    position: currentRaw.position ?? null,
  };

  for (const key of keys) {
    if (key === "player" || key === "position") {
      continue;
    }

    const currentValue = currentRaw[key];
    const previousValue = previousRaw[key];

    if (isIntervalDeltaSafe(key, currentValue, previousValue)) {
      intervalRaw[key] = (currentValue as number) - (previousValue as number);
      continue;
    }

    intervalRaw[key] = null;
  }

  return intervalRaw;
}

function hasIntervalSignal(
  raw: RawStatsRecord,
  toiSeconds: number | null,
  gamesPlayed: number | null,
) {
  if ((toiSeconds ?? 0) > 0 || (gamesPlayed ?? 0) > 0) {
    return true;
  }

  return Object.values(raw).some(
    (value) => typeof value === "number" && Number.isFinite(value) && value !== 0,
  );
}

export function buildPlayerIntervalStats(
  currentStats: ParsedPlayerSeasonStat[],
  previousRowsByName: Map<string, PreviousPlayerSeasonState>,
) {
  return currentStats
    .map((row) => {
      const previous = previousRowsByName.get(row.playerName);
      if (!previous) {
        return null;
      }

      const toiSeconds = diffNumber(row.toiSeconds, previous.toiSeconds);
      const gamesPlayed = diffNumber(row.gamesPlayed, previous.gamesPlayed);
      const raw = buildIntervalRawRecord(row.raw, previous.raw);

      if (!hasIntervalSignal(raw, toiSeconds, gamesPlayed)) {
        return null;
      }

      return {
        season: row.season,
        playerName: row.playerName,
        jerseyNumber: row.jerseyNumber,
        position: row.position,
        toiSeconds,
        gamesPlayed,
        raw,
      } satisfies ParsedPlayerSeasonStat;
    })
    .filter((row): row is ParsedPlayerSeasonStat => Boolean(row));
}

export function buildGoalieIntervalStats(
  currentStats: ParsedGoalieSeasonStat[],
  previousRowsByName: Map<string, PreviousGoalieSeasonState>,
) {
  return currentStats
    .map((row) => {
      const previous = previousRowsByName.get(row.playerName);
      if (!previous) {
        return null;
      }

      const toiSeconds = diffNumber(row.toiSeconds, previous.toiSeconds);
      const gamesPlayed = diffNumber(row.gamesPlayed, previous.gamesPlayed);
      const raw = buildIntervalRawRecord(row.raw, previous.raw);

      if (!hasIntervalSignal(raw, toiSeconds, gamesPlayed)) {
        return null;
      }

      return {
        season: row.season,
        playerName: row.playerName,
        jerseyNumber: row.jerseyNumber,
        toiSeconds,
        gamesPlayed,
        raw,
      } satisfies ParsedGoalieSeasonStat;
    })
    .filter((row): row is ParsedGoalieSeasonStat => Boolean(row));
}

export function buildPlayerSnapshotRow(params: {
  uploadId: string | null;
  snapshotDate: string;
  playerId: string;
  position: PositionBucket;
  score: PlayerGoalieScoreRow;
  gamesPlayed: number | null;
  toiMinutes: number | null;
}): Omit<PlayerScoreSnapshot, "id" | "playerName"> & { playerName: string } {
  const categoryValues = buildSnapshotCategoryValueMap(params.score.categoryScores);

  return {
    uploadId: params.uploadId,
    season: params.score.season,
    snapshotDate: params.snapshotDate,
    playerId: params.playerId,
    playerName: params.score.entityName,
    position: params.position,
    modelType: params.score.modelType as PlayerScoreSnapshot["modelType"],
    gamesPlayed: params.gamesPlayed,
    toiMinutes: params.toiMinutes,
    overallScore: params.score.overallScore,
    offensiveScore: categoryValues.offensiveScore,
    defensiveScore: categoryValues.defensiveScore,
    transitionScore: categoryValues.transitionScore,
    puckManagementScore: categoryValues.puckManagementScore,
    battleCompeteScore: categoryValues.battleCompeteScore,
    possessionScore: categoryValues.possessionScore,
    specialTeamsScore: categoryValues.specialTeamsScore,
    disciplineRiskScore: categoryValues.disciplineRiskScore,
    reliabilityScore: params.score.reliabilityScore,
    reliabilityLabel: params.score.reliabilityFlag,
    roleTags: inferPlayerRoleTagsFromCategoryScores(
      params.position,
      params.score.categoryScores,
    ),
  };
}

export function buildGoalieSnapshotRow(params: {
  uploadId: string | null;
  snapshotDate: string;
  goalieId: string;
  score: PlayerGoalieScoreRow;
  gamesPlayed: number | null;
  toiMinutes: number | null;
}): Omit<GoalieScoreSnapshot, "id" | "goalieName"> & { goalieName: string } {
  const categoryValues = buildSnapshotCategoryValueMap(params.score.categoryScores);

  return {
    uploadId: params.uploadId,
    season: params.score.season,
    snapshotDate: params.snapshotDate,
    goalieId: params.goalieId,
    goalieName: params.score.entityName,
    gamesPlayed: params.gamesPlayed,
    toiMinutes: params.toiMinutes,
    overallScore: params.score.overallScore,
    defensiveScore: categoryValues.defensiveScore,
    puckManagementScore: categoryValues.puckManagementScore,
    battleCompeteScore: categoryValues.battleCompeteScore,
    possessionScore: categoryValues.possessionScore,
    specialTeamsScore: categoryValues.specialTeamsScore,
    disciplineRiskScore: categoryValues.disciplineRiskScore,
    reliabilityScore: params.score.reliabilityScore,
    reliabilityLabel: params.score.reliabilityFlag,
    roleTags: [],
  };
}

export function buildPlayerIntervalRow(params: {
  currentUploadId: string | null;
  previousUploadId: string | null;
  intervalStartDate: string | null;
  intervalEndDate: string | null;
  playerId: string;
  playerName: string;
  position: PositionBucket;
  gamesAdded: number | null;
  toiAddedMinutes: number | null;
  currentSnapshot: Omit<PlayerScoreSnapshot, "id">;
  previousSnapshot: Omit<PlayerScoreSnapshot, "id">;
  intervalScore: PlayerGoalieScoreRow | null;
}): Omit<PlayerIntervalScore, "id"> {
  const intervalCategoryValues = params.intervalScore
    ? buildSnapshotCategoryValueMap(params.intervalScore.categoryScores)
    : buildSnapshotCategoryValueMap([]);
  const currentCategoryValues = buildSnapshotCategoryValueMap(
    params.currentSnapshot
      ? [
          {
            category: "Offensive Creation",
            score: params.currentSnapshot.offensiveScore,
            weightPct: 0,
            availableMetricCount: 0,
            totalMetricCount: 0,
          },
          {
            category: "Defensive Impact",
            score: params.currentSnapshot.defensiveScore,
            weightPct: 0,
            availableMetricCount: 0,
            totalMetricCount: 0,
          },
          {
            category: "Transition",
            score: params.currentSnapshot.transitionScore,
            weightPct: 0,
            availableMetricCount: 0,
            totalMetricCount: 0,
          },
          {
            category: "Puck Management",
            score: params.currentSnapshot.puckManagementScore,
            weightPct: 0,
            availableMetricCount: 0,
            totalMetricCount: 0,
          },
          {
            category: "Battle / Compete",
            score: params.currentSnapshot.battleCompeteScore,
            weightPct: 0,
            availableMetricCount: 0,
            totalMetricCount: 0,
          },
          {
            category: "Possession / On-Ice Impact",
            score: params.currentSnapshot.possessionScore,
            weightPct: 0,
            availableMetricCount: 0,
            totalMetricCount: 0,
          },
          {
            category: "Special Teams",
            score: params.currentSnapshot.specialTeamsScore,
            weightPct: 0,
            availableMetricCount: 0,
            totalMetricCount: 0,
          },
          {
            category: "Discipline / Risk",
            score: params.currentSnapshot.disciplineRiskScore,
            weightPct: 0,
            availableMetricCount: 0,
            totalMetricCount: 0,
          },
        ]
      : [],
  );
  const previousCategoryValues = buildSnapshotCategoryValueMap(
    params.previousSnapshot
      ? [
          {
            category: "Offensive Creation",
            score: params.previousSnapshot.offensiveScore,
            weightPct: 0,
            availableMetricCount: 0,
            totalMetricCount: 0,
          },
          {
            category: "Defensive Impact",
            score: params.previousSnapshot.defensiveScore,
            weightPct: 0,
            availableMetricCount: 0,
            totalMetricCount: 0,
          },
          {
            category: "Transition",
            score: params.previousSnapshot.transitionScore,
            weightPct: 0,
            availableMetricCount: 0,
            totalMetricCount: 0,
          },
          {
            category: "Puck Management",
            score: params.previousSnapshot.puckManagementScore,
            weightPct: 0,
            availableMetricCount: 0,
            totalMetricCount: 0,
          },
          {
            category: "Battle / Compete",
            score: params.previousSnapshot.battleCompeteScore,
            weightPct: 0,
            availableMetricCount: 0,
            totalMetricCount: 0,
          },
          {
            category: "Possession / On-Ice Impact",
            score: params.previousSnapshot.possessionScore,
            weightPct: 0,
            availableMetricCount: 0,
            totalMetricCount: 0,
          },
          {
            category: "Special Teams",
            score: params.previousSnapshot.specialTeamsScore,
            weightPct: 0,
            availableMetricCount: 0,
            totalMetricCount: 0,
          },
          {
            category: "Discipline / Risk",
            score: params.previousSnapshot.disciplineRiskScore,
            weightPct: 0,
            availableMetricCount: 0,
            totalMetricCount: 0,
          },
        ]
      : [],
  );
  const deltaSummary = buildSnapshotDeltaSummary(
    currentCategoryValues,
    previousCategoryValues,
  );
  const overallScoreChange =
    params.currentSnapshot.overallScore === null ||
    params.previousSnapshot.overallScore === null
      ? null
      : params.currentSnapshot.overallScore - params.previousSnapshot.overallScore;
  const reliabilityChange =
    params.currentSnapshot.reliabilityScore === null ||
    params.previousSnapshot.reliabilityScore === null
      ? null
      : params.currentSnapshot.reliabilityScore - params.previousSnapshot.reliabilityScore;

  return {
    currentUploadId: params.currentUploadId,
    previousUploadId: params.previousUploadId,
    season: params.currentSnapshot.season,
    playerId: params.playerId,
    playerName: params.playerName,
    position: params.position,
    intervalStartDate: params.intervalStartDate,
    intervalEndDate: params.intervalEndDate,
    gamesAdded: params.gamesAdded,
    toiAddedMinutes: params.toiAddedMinutes,
    overallIntervalScore: params.intervalScore?.overallScore ?? null,
    offensiveIntervalScore: intervalCategoryValues.offensiveScore,
    defensiveIntervalScore: intervalCategoryValues.defensiveScore,
    transitionIntervalScore: intervalCategoryValues.transitionScore,
    puckManagementIntervalScore: intervalCategoryValues.puckManagementScore,
    battleCompeteIntervalScore: intervalCategoryValues.battleCompeteScore,
    possessionIntervalScore: intervalCategoryValues.possessionScore,
    specialTeamsIntervalScore: intervalCategoryValues.specialTeamsScore,
    disciplineRiskIntervalScore: intervalCategoryValues.disciplineRiskScore,
    overallScoreChange,
    reliabilityChange,
    strongestImprovement: deltaSummary.strongestImprovement,
    biggestDecline: deltaSummary.biggestDecline,
    trendLabel: buildTrendLabelFromChange(overallScoreChange),
  };
}
