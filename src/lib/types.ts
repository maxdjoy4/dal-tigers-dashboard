export type ScoreCategory = "offense" | "defense" | "special_teams";
export type TacticalGroup =
  | "offensive_creation"
  | "transition_offense"
  | "puck_management"
  | "defensive_zone_play"
  | "transition_defense"
  | "possession_territory"
  | "special_teams"
  | "battle_compete"
  | "other_context";
export type KpiDirection = "higher_is_better" | "lower_is_better";
export type HomeAway = "home" | "away" | "neutral" | "unknown";
export type ResultBucket = "win" | "loss" | "tie";
export type RangeFilter = "all" | "last5";
export type TrendDirection = "improving" | "stable" | "declining";
export type TacticalDriverStatus =
  | "strength"
  | "neutral"
  | "concern"
  | "insufficient_data";

export interface KpiWeight {
  id: string;
  key: string;
  name: string;
  category: ScoreCategory;
  rawCategory: string;
  weight: number;
  rValue: number;
  direction: KpiDirection;
  includeInScore: boolean;
  cluster?: string | null;
  notes?: string | null;
  currentValue?: string | null;
  coachingAdjustment?: number | null;
  sortOrder: number;
}

export interface CalculationWarning {
  code: string;
  message: string;
  scope: "dataset" | "game" | "category" | "kpi";
  severity: "info" | "warning";
  gameId?: string;
  kpiKey?: string;
  category?: ScoreCategory;
}

export interface GameRecord {
  id: string;
  date: string;
  opponent: string;
  result: string;
  resultBucket: ResultBucket;
  season: string;
  homeAway: HomeAway;
  goalsFor: number | null;
  goalsAgainst: number | null;
  summary: string | null;
  source: "seed" | "supabase";
  uploadedFileId?: string | null;
  stats: Record<string, number | null>;
}

export interface KpiScore {
  key: string;
  name: string;
  category: ScoreCategory;
  weight: number;
  rValue: number;
  direction: KpiDirection;
  rawValue: number | null;
  normalizedScore: number | null;
  weightedScore: number | null;
  impact: number | null;
  available: boolean;
  exclusionReason?: string | null;
}

export interface CategoryScoreDetail {
  score: number | null;
  validKpis: number;
  missingKpis: number;
  validWeight: number;
  totalWeight: number;
  coverage: number | null;
  warnings: CalculationWarning[];
}

export interface TacticalGroupScoreDetail {
  score: number | null;
  validKpis: number;
  missingKpis: number;
  validWeight: number;
  totalWeight: number;
  coverage: number | null;
  strongestKpi: string | null;
  weakestKpi: string | null;
  warnings: CalculationWarning[];
}

export interface ScoredGame {
  game: GameRecord;
  overallScore: number | null;
  totalWeightUsed: number;
  totalWeightAvailable: number;
  coverage: number | null;
  validKpiCount: number;
  missingKpiCount: number;
  warnings: CalculationWarning[];
  categoryScores: Record<ScoreCategory, CategoryScoreDetail>;
  tacticalGroupScores: Record<TacticalGroup, TacticalGroupScoreDetail>;
  kpis: KpiScore[];
}

export interface TacticalDriverRow {
  group: TacticalGroup;
  label: string;
  score: number | null;
  baselineScore: number | null;
  delta: number | null;
  validKpis: number;
  totalKpis: number;
  excludedKpis: number;
  coverage: number | null;
  strongestKpi: string | null;
  weakestKpi: string | null;
  status: TacticalDriverStatus;
  takeaway: string;
  warnings: string[];
}

export interface DashboardFilters {
  season: string;
  range: RangeFilter;
  opponent: string;
  homeAway: HomeAway | "all";
  result: ResultBucket | "all";
}

export interface FilterOptions {
  seasons: string[];
  opponents: string[];
}

export interface DriverInsight {
  key: string;
  name: string;
  category: ScoreCategory;
  impact: number;
  rawValue: number | null;
  normalizedScore: number;
  weightedScore: number;
}

export interface CategoryOverviewRow {
  category: ScoreCategory;
  label: string;
  score: number | null;
  baselineScore: number | null;
  delta: number | null;
  status: "strength" | "stable" | "concern" | "insufficient_data";
  trend: "improving" | "stable" | "declining" | "limited_data";
  trendDelta: number | null;
  sparkline: number[];
  descriptor: string;
}

export type CategoryVisualTone =
  | "strength"
  | "stable"
  | "concern"
  | "neutral"
  | "limited_data";

export interface CategoryVisualRow {
  category: ScoreCategory;
  label: string;
  descriptor: string;
  score: number | null;
  statusLabel?: string | null;
  statusTone?: CategoryVisualTone;
  trendLabel?: string | null;
  trendTone?: CategoryVisualTone;
  detail?: string | null;
}

export interface AnalyticsBundle {
  filters: DashboardFilters;
  filterOptions: FilterOptions;
  isDemoMode: boolean;
  weights: KpiWeight[];
  allGamesCount: number;
  filteredGamesCount: number;
  scoredGames: ScoredGame[];
  filteredContextGames: ScoredGame[];
  latestGame: ScoredGame | null;
  lastGameScore: number | null;
  recentWindowAverage: number | null;
  seasonAverage: number | null;
  trendDirection: TrendDirection;
  trendDelta: number;
  recordLabel: string;
  categoryAverages: Record<ScoreCategory, number | null>;
  categoryOverview: CategoryOverviewRow[];
  seasonBaselineScoredGames: ScoredGame[];
  tacticalDrivers: TacticalDriverRow[];
  tacticalUnassignedKpis: string[];
  quickSummary: string[];
  tacticalSummary: {
    strongest: string | null;
    concern: string | null;
    summary: string;
  };
  topDrivers: DriverInsight[];
  improvementAreas: DriverInsight[];
  calculationWarnings: string[];
  dataWarnings: string[];
  calculationAudit: {
    gamesLoaded: number;
    statsLoaded: number;
    matchedWeights: number;
    unmatchedStatKeys: string[];
    missingWeightNames: string[];
    invalidStatCount: number;
    excludedKpis: string[];
  };
  trendSeries: Array<{
    id: string;
    date: string;
    label: string;
    score: number | null;
    rollingAverage: number | null;
    opponent: string;
    result: string;
    trendDirection: TrendDirection;
    trendDelta: number;
    strongestCategory?: string | null;
    weakestCategory?: string | null;
    warnings: string[];
  }>;
  recentGames: Array<{
    id: string;
    date: string;
    opponent: string;
    result: string;
    homeAway: HomeAway;
    score: number | null;
    season: string;
    warnings: string[];
  }>;
  kpiSummary: Array<{
    key: string;
    name: string;
    category: ScoreCategory;
    weight: number;
    rValue: number;
    direction: KpiDirection;
    latestRaw: number | null;
    latestNormalized: number | null;
    latestWeighted: number | null;
    averageNormalized: number | null;
    availableGames: number;
  }>;
  summary: string;
}
