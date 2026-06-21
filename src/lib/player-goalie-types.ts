import type { KpiDirection } from "@/lib/types";

export type PlayerModelType = "Forward" | "Defense";
export type GoalieModelType = "Goalie";
export type PlayerGoalieModelType = PlayerModelType | GoalieModelType;
export type PositionBucket = "F" | "D" | "G" | "Unknown";

export interface ExtractionPlanRow {
  group: string;
  sourceColumn: string;
  metricKey: string;
  action: string;
  extract: boolean;
  storeRaw: boolean;
  showOnDashboard: boolean;
  useInMainScore: boolean;
  module: string;
  reason: string;
}

export interface PlayerMetricWeightRow {
  modelType: PlayerGoalieModelType;
  category: string;
  categoryWeightPct: number;
  metricKey: string;
  displayName: string;
  sourceColumnsRequired: string[];
  calculation: string;
  direction: KpiDirection | "context_dependent";
  normalization: string;
  scoreMethod: string;
  metricWeightInCategoryPct: number;
  finalWeightPct: number;
  includeInV1Score: boolean;
  sampleRule: string | null;
  teamSuccessLink: string | null;
  notes: string | null;
}

export interface PlayerGoalieWeightEditorRow extends PlayerMetricWeightRow {
  id: string;
  sourceTable: "player_metric_weights" | "goalie_metric_weights";
}

export interface CategoryWeightRow {
  modelType: PlayerGoalieModelType;
  category: string;
  categoryWeightPct: number;
  description: string | null;
}

export interface TeamToPlayerMappingRow {
  teamRank: number | null;
  teamStatistic: string;
  teamCategory: string | null;
  signalTier: string | null;
  direction: string | null;
  teamWeightPct: number | null;
  teamCodexKey: string | null;
  skaterMetricOrProxy: string | null;
  goalieMetricOrProxy: string | null;
  mappingType: string | null;
  teamDashboardNote: string | null;
}

export interface PlayerGoalieUploadPreview {
  rows: Array<Record<string, string | number | null>>;
  previewColumns: string[];
  matchedColumnCount: number;
  missingRequiredColumns: string[];
}

export interface ParsedPlayerSeasonStat {
  season: string;
  playerName: string;
  jerseyNumber: number | null;
  position: PositionBucket;
  toiSeconds: number | null;
  gamesPlayed: number | null;
  raw: Record<string, string | number | null>;
}

export interface ParsedGoalieSeasonStat {
  season: string;
  playerName: string;
  jerseyNumber: number | null;
  toiSeconds: number | null;
  gamesPlayed: number | null;
  raw: Record<string, string | number | null>;
}

export interface CalculatedPlayerMetricRow {
  season: string;
  entityName: string;
  modelType: PlayerGoalieModelType;
  metricKey: string;
  displayName: string;
  category: string;
  rawValue: number | null;
  calculatedValue: number | null;
  score0100: number | null;
  includeInScore: boolean;
  reliabilityFlag: string | null;
  context: Record<string, string | number | boolean | null>;
}

export interface CategoryScoreSummary {
  category: string;
  score: number | null;
  weightPct: number;
  availableMetricCount: number;
  totalMetricCount: number;
}

export interface PlayerGoalieScoreRow {
  season: string;
  entityName: string;
  modelType: PlayerGoalieModelType;
  overallScore: number | null;
  categoryScores: CategoryScoreSummary[];
  strongestKpis: CalculatedPlayerMetricRow[];
  developmentKpis: CalculatedPlayerMetricRow[];
  reliabilityScore: number | null;
  reliabilityFlag: string | null;
  contextFlags: Record<string, string | number | boolean | null>;
}

export interface PlayerScoreSnapshot {
  id: string;
  uploadId: string | null;
  season: string;
  snapshotDate: string;
  playerId: string;
  playerName: string;
  position: PositionBucket;
  modelType: PlayerModelType;
  gamesPlayed: number | null;
  toiMinutes: number | null;
  overallScore: number | null;
  offensiveScore: number | null;
  defensiveScore: number | null;
  transitionScore: number | null;
  puckManagementScore: number | null;
  battleCompeteScore: number | null;
  possessionScore: number | null;
  specialTeamsScore: number | null;
  disciplineRiskScore: number | null;
  reliabilityScore: number | null;
  reliabilityLabel: string | null;
  roleTags: string[];
}

export interface GoalieScoreSnapshot {
  id: string;
  uploadId: string | null;
  season: string;
  snapshotDate: string;
  goalieId: string;
  goalieName: string;
  gamesPlayed: number | null;
  toiMinutes: number | null;
  overallScore: number | null;
  defensiveScore: number | null;
  puckManagementScore: number | null;
  battleCompeteScore: number | null;
  possessionScore: number | null;
  specialTeamsScore: number | null;
  disciplineRiskScore: number | null;
  reliabilityScore: number | null;
  reliabilityLabel: string | null;
  roleTags: string[];
}

export interface PlayerIntervalScore {
  id: string;
  currentUploadId: string | null;
  previousUploadId: string | null;
  season: string;
  playerId: string;
  playerName: string;
  position: PositionBucket;
  intervalStartDate: string | null;
  intervalEndDate: string | null;
  gamesAdded: number | null;
  toiAddedMinutes: number | null;
  overallIntervalScore: number | null;
  offensiveIntervalScore: number | null;
  defensiveIntervalScore: number | null;
  transitionIntervalScore: number | null;
  puckManagementIntervalScore: number | null;
  battleCompeteIntervalScore: number | null;
  possessionIntervalScore: number | null;
  specialTeamsIntervalScore: number | null;
  disciplineRiskIntervalScore: number | null;
  overallScoreChange: number | null;
  reliabilityChange: number | null;
  strongestImprovement: string | null;
  biggestDecline: string | null;
  trendLabel: string | null;
}

export interface PlayerGoalieDataAvailability {
  available: boolean;
  reason?: string;
}

export interface PlayerOverviewRow {
  id: string;
  name: string;
  season: string;
  modelType: PlayerModelType;
  position: PositionBucket;
  jerseyNumber: number | null;
  gamesPlayed: number | null;
  toiMinutes: number | null;
  overallScore: number | null;
  reliabilityFlag: string | null;
  topCategory: string | null;
  developmentCategory: string | null;
}

export interface GoalieOverviewRow {
  id: string;
  name: string;
  season: string;
  jerseyNumber: number | null;
  gamesPlayed: number | null;
  toiMinutes: number | null;
  overallScore: number | null;
  reliabilityFlag: string | null;
  topCategory: string | null;
  developmentCategory: string | null;
}

export interface PlayerBreakdown {
  id: string;
  name: string;
  season: string;
  modelType: PlayerModelType;
  position: PositionBucket;
  jerseyNumber: number | null;
  gamesPlayed: number | null;
  toiMinutes: number | null;
  overallScore: number | null;
  reliabilityScore: number | null;
  reliabilityFlag: string | null;
  categoryScores: CategoryScoreSummary[];
  strongestKpis: CalculatedPlayerMetricRow[];
  developmentKpis: CalculatedPlayerMetricRow[];
  metrics: CalculatedPlayerMetricRow[];
  rawStats: Record<string, string | number | null>;
  roleTags: string[];
  snapshots: PlayerScoreSnapshot[];
  latestInterval: PlayerIntervalScore | null;
}

export interface GoalieBreakdown {
  id: string;
  name: string;
  season: string;
  jerseyNumber: number | null;
  gamesPlayed: number | null;
  toiMinutes: number | null;
  overallScore: number | null;
  reliabilityScore: number | null;
  reliabilityFlag: string | null;
  categoryScores: CategoryScoreSummary[];
  strongestKpis: CalculatedPlayerMetricRow[];
  developmentKpis: CalculatedPlayerMetricRow[];
  metrics: CalculatedPlayerMetricRow[];
  snapshots: GoalieScoreSnapshot[];
}
