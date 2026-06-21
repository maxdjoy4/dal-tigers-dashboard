import { buildPlayerArchetypeProfile } from "@/lib/player-archetypes";
import type { GoalieBreakdown, PlayerBreakdown, PositionBucket } from "@/lib/player-goalie-types";
import type {
  AnalyticsBundle,
  KpiDirection,
  TacticalDriverRow,
} from "@/lib/types";
import { clamp, round } from "@/lib/utils";

type FocusAreaKey =
  | "dz_puck_management"
  | "controlled_entries"
  | "inner_slot_creation"
  | "oz_possession_extension"
  | "defensive_coverage"
  | "decision_quality"
  | "special_teams_entries"
  | "goalie_workload_reduction";

type TeamPriorityLevel = "critical" | "high" | "medium" | "monitor";
type FocusConfidence = "High confidence" | "Moderate confidence" | "Low confidence" | "Data limited";
type IndividualPriorityType = "Individual" | "Small Group" | "Position Group" | "Line/Unit" | "Goalie";

interface FocusMetricRule {
  key: string;
  direction: "higher_is_better" | "lower_is_better";
  weight: number;
}

interface FocusAreaConfig {
  key: FocusAreaKey;
  family: "offense" | "transition" | "defense" | "risk" | "special_teams" | "goalie";
  title: string;
  coachingDiagnosis: string;
  whyItMatters: string;
  groupLabels: string[];
  microTitle: string;
  microDiagnosis: string;
  microWhyItMatters: string;
  practiceRepIdea: string;
  drillTheme: string;
  videoCue: string;
  kpiFollowUp: string[];
  playerMetricRules: FocusMetricRule[];
  playerCategoryHints: string[];
  goalieCategoryHints: string[];
  tacticalGroups: TacticalDriverRow["group"][];
  teamMetricKeys: string[];
  teamMetricKeywords: string[];
  xgChanceConnection: number;
  coachability: number;
  focusText: string[];
  specialTeamsOnly?: boolean;
  goalieRelevant?: boolean;
}

interface FocusPlayer {
  id: string;
  name: string;
  jerseyNumber: number | null;
  position: PositionBucket;
  modelType: PlayerBreakdown["modelType"];
  gamesPlayed: number;
  toiMinutes: number | null;
  toiPerGame: number | null;
  overallScore: number | null;
  reliabilityScore: number | null;
  reliabilityFlag: string | null;
  archetype: string;
  archetypeConfidence: string;
  roleTags: string[];
  rawStats: Record<string, string | number | null>;
  categoryScores: PlayerBreakdown["categoryScores"];
  strongestKpis: PlayerBreakdown["strongestKpis"];
  developmentKpis: PlayerBreakdown["developmentKpis"];
  latestOverallChange: number | null;
  latestTrendLabel: string | null;
}

interface GoalieFocus {
  id: string;
  name: string;
  gamesPlayed: number;
  toiMinutes: number | null;
  overallScore: number | null;
  reliabilityScore: number | null;
  reliabilityFlag: string | null;
  categoryScores: GoalieBreakdown["categoryScores"];
  developmentKpis: GoalieBreakdown["developmentKpis"];
  latestOverallChange: number | null;
}

interface AffectedPlayer {
  player: FocusPlayer;
  severity: number;
  evidence: string[];
  linkedMetrics: string[];
  linkedCategories: string[];
}

interface AffectedGoalie {
  goalie: GoalieFocus;
  severity: number;
  evidence: string[];
}

interface TeamPriorityCandidate {
  key: FocusAreaKey;
  title: string;
  priorityLevel: TeamPriorityLevel;
  priorityScore: number;
  coachingDiagnosis: string;
  whyItMatters: string;
  keyNumbers: string[];
  playersGroupsConnected: string[];
  drillTheme: string;
  videoCue: string;
  kpiFollowUp: string[];
  dataConfidence: FocusConfidence;
  compareNote: string | null;
  linkedPlayers: string[];
  linkedGoalies: string[];
  linkedGroups: string[];
  diagnostics: {
    teamModelImportance: number;
    weaknessSeverity: number;
    playerPatternSupport: number;
    highUsageGroupRelevance: number;
    xgOrChanceConnection: number;
    trendDirection: number;
    goalieContextFactor: number;
    reliabilityScore: number;
    linkedTeamKpis: string[];
    linkedPlayerMetrics: string[];
    linkedGoalieEvidence: string[];
  };
}

interface IndividualPriorityCandidate {
  key: string;
  linkedTeamPriorityKey: FocusAreaKey;
  microSkillFocus: string;
  priorityType: IndividualPriorityType;
  priorityScore: number;
  tacticDiagnosis: string;
  whyItMatters: string;
  keyNumbers: string[];
  skillDetails: string[];
  practiceRepIdea: string;
  videoCue: string;
  kpiFollowUp: string[];
  dataConfidence: FocusConfidence;
  compareNote: string | null;
  linkedPlayers: string[];
  linkedGroups: string[];
  diagnostics: {
    developmentGapSeverity: number;
    teamPriorityConnection: number;
    playerPatternFrequency: number;
    fixability: number;
    skillSpecificity: number;
    usageRelevance: number;
    reliabilityScore: number;
    trendOrSnapshotChange: number;
    linkedContext: string[];
  };
}

export interface CoachingFocusPageModel {
  teamPriorities: TeamPriorityCandidate[];
  microPriorities: IndividualPriorityCandidate[];
  renderedTeamPriorities: CoachingFocusTeamRecommendation[];
  renderedMicroPriorities: CoachingFocusMicroRecommendation[];
  renderedStaffNote: CoachingFocusStaffNoteData;
  teamCandidates: TeamPriorityCandidate[];
  individualCandidates: IndividualPriorityCandidate[];
  compareAvailable: boolean;
  updatedLabel: string;
  warnings: string[];
  staffNote: string;
  aiGenerated: boolean;
  aiDiagnostics: {
    evidenceHash: string | null;
    generatedAt: string | null;
    modelUsed: string | null;
    fallbackUsed: boolean;
    note: string | null;
    evidenceBundle: Record<string, unknown> | null;
    aiOutput: Record<string, unknown> | null;
  };
}

interface TeamPriorityScoreInputs {
  teamModelImportance: number;
  weaknessSeverity: number;
  xgOrScoringChanceConnection: number;
  playerPatternSupport: number;
  highUsageGroupRelevance: number;
  trendDirection: number;
  dataReliability: number;
}

interface MicroPriorityScoreInputs {
  teamPriorityConnection: number;
  playerPatternFrequency: number;
  fixability: number;
  skillSpecificity: number;
  usageRelevance: number;
  trendDirection: number;
  dataReliability: number;
}

export interface CoachingFocusTeamRecommendation {
  rank: number;
  title: string;
  priorityLevel: string;
  coachingDiagnosis: string;
  whyItMatters: string;
  compareNote: string | null;
  keyNumbers: string[];
  playersGroupsConnected: string[];
  teamPracticeTheme: string;
  teamVideoCue: string;
  kpiFollowUp: string[];
  dataConfidence: FocusConfidence;
}

export interface CoachingFocusMicroRecommendation {
  rank: number;
  title: string;
  priorityLevel: string;
  individualTacticDiagnosis: string;
  whyItMatters: string;
  compareNote: string | null;
  keyNumbers: string[];
  skillDetailToCoach: string[];
  videoClipsToPull: string;
  practiceRepIdea: string;
  kpiFollowUp: string[];
  dataConfidence: FocusConfidence;
}

export interface CoachingFocusStaffNoteData {
  title: string;
  body: string;
}

const METRIC_ALIASES: Record<string, string[]> = {
  goals: ["goals"],
  assists: ["assists"],
  points: ["points"],
  plus_minus: ["plus_minus"],
  shots: ["shots"],
  shots_on_goal: ["shots_on_goal"],
  inner_slot_shots: ["inner_slot_shots_minus_total", "inner_slot_shots"],
  passes_to_slot: ["passes_to_the_slot", "passes_to_slot"],
  xg_expected: ["xg", "xg_expected"],
  net_xg: ["net_xg_xg_player_on_minus_opp_teams_xg", "net_xg"],
  corsi_pct: ["corsi_for_pct", "corsi_pct"],
  fenwick_pct: ["fenwick_for_pct", "fenwick_pct"],
  oz_possession: ["oz_possession"],
  dz_possession: ["dz_possession"],
  puck_losses_dz: ["puck_losses_in_dz", "puck_losses_dz"],
  puck_losses_nz: ["puck_losses_in_nz", "puck_losses_nz"],
  ev_dz_retrievals: ["ev_dz_retrievals"],
  ev_oz_retrievals: ["ev_oz_retrievals"],
  entries_stickhandling: ["entries_via_stickhandling", "entries_stickhandling"],
  entries_dump_in: ["entries_via_dump_in", "entries_dump_in"],
  dump_ins: ["dump_ins"],
  dump_outs: ["dump_outs"],
  error_leading_to_goal: ["error_leading_to_goal"],
  pp_time: ["pp_time"],
  sh_time: ["sh_time"],
  power_play_shots: ["power_play_shots"],
  blocked_shots: ["blocked_shots"],
  scoring_chances: ["scoring_chances"],
  takeaways_oz: ["takeaways_in_oz", "takeaways_oz"],
};

const PERCENT_METRICS = new Set(["corsi_pct", "fenwick_pct"]);

const TEAM_FOCUS_CONFIG: FocusAreaConfig[] = [
  {
    key: "dz_puck_management",
    family: "defense",
    title: "DZ puck management is feeding pressure back against us",
    coachingDiagnosis:
      "Too many defensive-zone and neutral-zone puck losses are turning recoveries into extended defensive shifts or rush chances against.",
    whyItMatters:
      "This affects breakouts, transition offense, opponent pressure, and how much cleanup the goaltenders are being asked to handle after live turnovers.",
    groupLabels: ["Defense retrieval group", "Centers below the puck", "Weak-side winger support"],
    microTitle: "First touch after retrievals",
    microDiagnosis:
      "The issue is not only getting to pucks. The next touch after the retrieval is where pressure is turning into turnovers, rim losses, or failed exits.",
    microWhyItMatters:
      "A cleaner first touch gives support time to arrive and turns recoveries into exits instead of more time defending in place.",
    practiceRepIdea: "Small-area retrievals with one pressure player and two support options.",
    drillTheme: "Retrieval-to-first-pass under forecheck pressure",
    videoCue:
      "Pull clips where the first touch after a retrieval becomes a turnover, rim loss, or forced middle pass.",
    kpiFollowUp: [
      "DZ losses / game",
      "successful breakouts",
      "opponent xG after turnovers",
      "accurate passes under pressure",
    ],
    playerMetricRules: [
      { key: "puck_losses_dz", direction: "lower_is_better", weight: 2.5 },
      { key: "ev_dz_retrievals", direction: "lower_is_better", weight: 1.2 },
      { key: "error_leading_to_goal", direction: "lower_is_better", weight: 1.4 },
      { key: "dump_outs", direction: "lower_is_better", weight: 0.8 },
    ],
    playerCategoryHints: ["Puck Management", "Defensive Impact", "Transition"],
    goalieCategoryHints: ["Defensive Impact", "Puck Management"],
    tacticalGroups: ["puck_management", "defensive_zone_play"],
    teamMetricKeys: ["ev_dz_retrievals", "opp_xg", "net_xg"],
    teamMetricKeywords: ["opponent", "retrieval", "puck loss", "turnover"],
    xgChanceConnection: 88,
    coachability: 96,
    focusText: [
      "retrieval scan before contact",
      "first-pass timing",
      "middle support below the puck",
      "weak-side release timing",
    ],
    goalieRelevant: true,
  },
  {
    key: "controlled_entries",
    family: "transition",
    title: "Controlled entries are not turning into enough possession",
    coachingDiagnosis:
      "Too many line gains are coming through dump-heavy choices or isolated carries that die before the next touch.",
    whyItMatters:
      "This shapes how much team offense can start with control instead of chase, and it changes which players should be driving entry reps on video and in line rush work.",
    groupLabels: ["Entry carriers", "Middle-lane support group", "Weak-side winger support"],
    microTitle: "Blue-line reads before the entry",
    microDiagnosis:
      "The touch before the line is the problem. Entry carriers are choosing carry, chip, or dump without a clear read on support and pressure.",
    microWhyItMatters:
      "A better decision at the line turns zone entries into possession instead of instant retrieval races or one-and-done rushes.",
    practiceRepIdea: "Entry reps with a live defender and required second-touch support under the puck.",
    drillTheme: "Carry-vs-dump reads with second-layer support",
    videoCue:
      "Pull entries where the puck crossed the line but no inside support or second touch showed up afterward.",
    kpiFollowUp: [
      "entries via stickhandling / game",
      "dump-in entry rate",
      "Corsi %",
      "O-zone possession after entry",
    ],
    playerMetricRules: [
      { key: "entries_stickhandling", direction: "higher_is_better", weight: 1.4 },
      { key: "entries_dump_in", direction: "lower_is_better", weight: 1.3 },
      { key: "corsi_pct", direction: "higher_is_better", weight: 1.5 },
      { key: "oz_possession", direction: "higher_is_better", weight: 1.2 },
    ],
    playerCategoryHints: ["Transition", "Offensive Creation", "Possession / On-Ice Impact"],
    goalieCategoryHints: [],
    tacticalGroups: ["transition_offense", "possession_territory"],
    teamMetricKeys: ["zone_entries", "corsi_pct", "oz_play"],
    teamMetricKeywords: ["entries", "corsi", "offensive zone"],
    xgChanceConnection: 72,
    coachability: 92,
    focusText: [
      "blue-line read before the line gain",
      "middle-lane support through the entry",
      "next touch under the puck after the line is won",
    ],
  },
  {
    key: "inner_slot_creation",
    family: "offense",
    title: "Inner-slot access is the issue, not just shot volume",
    coachingDiagnosis:
      "The team is getting pucks to the net, but too many looks are still coming from outside areas instead of touches that improve the shot before release.",
    whyItMatters:
      "Practice should attack the route into better ice, not just ask for more volume, because this is about chance quality and second-touch creation.",
    groupLabels: ["Net-front group", "Puck support group", "Low-to-high attackers"],
    microTitle: "Second touch into the middle",
    microDiagnosis:
      "Possessions are reaching the offensive zone, but the next touch after control is not moving inside often enough before the shot.",
    microWhyItMatters:
      "The quality of the chance changes when the puck touches the middle or creates a second-touch lane instead of settling for a first outside release.",
    practiceRepIdea: "Zone reps where the puck must touch the middle before the shot counts.",
    drillTheme: "Attack inside ice before the release",
    videoCue:
      "Pull rushes that ended in outside shots and zone plays where the slot never got touched before the puck was released.",
    kpiFollowUp: [
      "inner-slot shots / game",
      "passes to slot / game",
      "xG per shot",
      "scoring chances / game",
    ],
    playerMetricRules: [
      { key: "inner_slot_shots", direction: "higher_is_better", weight: 2.2 },
      { key: "passes_to_slot", direction: "higher_is_better", weight: 1.8 },
      { key: "shots_on_goal", direction: "higher_is_better", weight: 0.8 },
      { key: "scoring_chances", direction: "higher_is_better", weight: 1.7 },
    ],
    playerCategoryHints: ["Offensive Creation", "Possession / On-Ice Impact"],
    goalieCategoryHints: [],
    tacticalGroups: ["offensive_creation"],
    teamMetricKeys: ["passes_to_slot", "scoring_chances", "xg_for", "shots_on_goal"],
    teamMetricKeywords: ["slot", "xg", "scoring chance", "shots on goal"],
    xgChanceConnection: 100,
    coachability: 94,
    focusText: [
      "low-to-high plays that reopen the slot",
      "second-touch routes after point touches",
      "net-front timing before the shot",
    ],
  },
  {
    key: "oz_possession_extension",
    family: "offense",
    title: "Recoveries are not turning into sustained O-zone control",
    coachingDiagnosis:
      "The forecheck and second-puck work are creating touches, but too many of them are ending before the team can extend the shift into real offensive control.",
    whyItMatters:
      "This changes whether battle wins are actually paying off in team offense or just producing short bursts of pressure with no second play behind them.",
    groupLabels: ["Forecheck pressure group", "Second-puck support group", "Net-front route group"],
    microTitle: "Second touch after O-zone recoveries",
    microDiagnosis:
      "Winning the puck is only half the play. The issue is the next support touch after the recovery, which is not extending enough shifts into clean possession.",
    microWhyItMatters:
      "When the second touch is late or disconnected, good forecheck work ends in another low-value shot or a cleared puck instead of sustained pressure.",
    practiceRepIdea: "Recovery drills that require a second-touch play before any shot can be released.",
    drillTheme: "Recoveries into second-touch possession",
    videoCue:
      "Pull shot-and-recovery sequences where the team won the second puck but never created the next dangerous touch.",
    kpiFollowUp: [
      "EV O-zone retrievals / game",
      "O-zone possession time",
      "Corsi %",
      "takeaways in the O-zone",
    ],
    playerMetricRules: [
      { key: "ev_oz_retrievals", direction: "higher_is_better", weight: 1.7 },
      { key: "oz_possession", direction: "higher_is_better", weight: 1.5 },
      { key: "takeaways_oz", direction: "higher_is_better", weight: 1.2 },
      { key: "corsi_pct", direction: "higher_is_better", weight: 1.3 },
    ],
    playerCategoryHints: ["Battle / Compete", "Possession / On-Ice Impact", "Offensive Creation"],
    goalieCategoryHints: [],
    tacticalGroups: ["possession_territory", "battle_compete"],
    teamMetricKeys: ["ev_oz_retrievals", "oz_play", "corsi_pct"],
    teamMetricKeywords: ["oz retrieval", "oz play", "territory"],
    xgChanceConnection: 70,
    coachability: 84,
    focusText: [
      "recover above the puck",
      "create the next touch after the retrieval",
      "net-front route after the first recovery",
    ],
  },
  {
    key: "defensive_coverage",
    family: "defense",
    title: "Middle-lane coverage and second chances are staying alive too long",
    coachingDiagnosis:
      "The problem is not only the first defensive touch; the issue is how long dangerous space stays open after the first save, block, or missed clear.",
    whyItMatters:
      "This changes pair usage, net-front teaching, and how much chance quality the goalies are being asked to solve through traffic and second plays.",
    groupLabels: ["Net-front group", "Low-zone support group", "Second-chance clear group"],
    microTitle: "Net-front body position and second clears",
    microDiagnosis:
      "The first stop is not ending the play. The issue is body position, stick position, and the next clear after the initial defensive touch.",
    microWhyItMatters:
      "If the first box-out or clear does not finish the play, the goalie is still dealing with layered traffic and second chances from dangerous ice.",
    practiceRepIdea: "Low-zone coverage reps that require a clean second clear before the rep ends.",
    drillTheme: "Net-front body position and second-chance clearing",
    videoCue: "Pull inner-slot chances against after low-zone coverage breaks or failed second clears.",
    kpiFollowUp: [
      "net xG",
      "blocked shots / game",
      "EV DZ retrievals / game",
      "opponent xG on ice proxies",
    ],
    playerMetricRules: [
      { key: "net_xg", direction: "higher_is_better", weight: 1.9 },
      { key: "blocked_shots", direction: "lower_is_better", weight: 1.0 },
      { key: "ev_dz_retrievals", direction: "lower_is_better", weight: 1.3 },
      { key: "puck_losses_dz", direction: "lower_is_better", weight: 1.2 },
    ],
    playerCategoryHints: ["Defensive Impact", "Battle / Compete", "Puck Management"],
    goalieCategoryHints: ["Defensive Impact", "Puck Management"],
    tacticalGroups: ["defensive_zone_play", "transition_defense"],
    teamMetricKeys: ["opp_xg", "net_xg", "ev_dz_retrievals"],
    teamMetricKeywords: ["opponent xg", "net xg", "defensive"],
    xgChanceConnection: 97,
    coachability: 88,
    focusText: [
      "own the second chance before looking up ice",
      "protect middle ice first",
      "finish box-outs after the first save",
    ],
    goalieRelevant: true,
  },
  {
    key: "decision_quality",
    family: "risk",
    title: "Risk level is outrunning the support picture",
    coachingDiagnosis:
      "Turnovers at the blue line and forced east-west touches are creating rushes against because the puck decisions are not matching the support around them.",
    whyItMatters:
      "This changes late-possession usage, line rush teaching, and which clips should anchor the next film session because the issue is decision quality under pressure.",
    groupLabels: ["Puck support group", "Blue-line decision group", "Middle-lane support group"],
    microTitle: "First-touch decisions under pressure",
    microDiagnosis:
      "The risk decision is arriving before the support picture is there. The first touch under pressure is forcing middle ice or east-west plays without enough backup.",
    microWhyItMatters:
      "A calmer first touch under pressure protects possession and cuts down the rushes against that start from self-inflicted turnovers.",
    practiceRepIdea: "Small-area first-touch decision games with one safe option and one delayed support option.",
    drillTheme: "Simple first-touch choices before creative ones",
    videoCue:
      "Pull offensive blue-line turnovers, forced middle plays, and east-west touches where the support picture never justified the risk.",
    kpiFollowUp: [
      "errors leading to goals",
      "DZ/NZ puck losses",
      "dump-in entry rate",
      "net xG after live turnovers",
    ],
    playerMetricRules: [
      { key: "error_leading_to_goal", direction: "lower_is_better", weight: 2.0 },
      { key: "puck_losses_dz", direction: "lower_is_better", weight: 1.4 },
      { key: "puck_losses_nz", direction: "lower_is_better", weight: 1.6 },
      { key: "entries_dump_in", direction: "lower_is_better", weight: 0.8 },
    ],
    playerCategoryHints: ["Puck Management", "Discipline / Risk", "Transition"],
    goalieCategoryHints: [],
    tacticalGroups: ["puck_management", "transition_offense"],
    teamMetricKeys: ["net_xg", "corsi_pct"],
    teamMetricKeywords: ["error", "puck loss", "turnover", "risk"],
    xgChanceConnection: 76,
    coachability: 91,
    focusText: [
      "risk should match support",
      "own the simple first touch under pressure",
      "do not force the middle without a second layer",
    ],
  },
  {
    key: "special_teams_entries",
    family: "special_teams",
    title: "The power play is losing the zone before the setup starts",
    coachingDiagnosis:
      "The issue is not just finishing on the power play; the first touch at the line is often deciding whether the unit gets into its structure at all.",
    whyItMatters:
      "This changes special-teams rep design because entry shape, retrieval support, and shot generation need to be coached as separate pieces.",
    groupLabels: ["Power-play unit", "Entry support group", "Wall retrieval group"],
    microTitle: "Power-play first touch at the line",
    microDiagnosis:
      "The setup is breaking before it starts because the first touch after the line gain is not connecting the entry into the unit's structure.",
    microWhyItMatters:
      "If the entry touch dies on the wall or arrives without support, the power play never gets to the shot-generation phase it is trying to build.",
    practiceRepIdea: "Five-on-four entry reps with one forced recovery touch before the unit can set.",
    drillTheme: "PP entry shape and first-touch support routes",
    videoCue:
      "Pull failed PP entries, first touches that died on the wall, and power-play reps where the zone was established too late to build a sequence.",
    kpiFollowUp: [
      "PP shots per minute",
      "PP time distribution",
      "entry success proxies",
      "power-play shot generation",
    ],
    playerMetricRules: [
      { key: "pp_time", direction: "higher_is_better", weight: 0.6 },
      { key: "power_play_shots", direction: "higher_is_better", weight: 1.5 },
      { key: "entries_stickhandling", direction: "higher_is_better", weight: 0.8 },
    ],
    playerCategoryHints: ["Special Teams", "Transition", "Offensive Creation"],
    goalieCategoryHints: [],
    tacticalGroups: ["special_teams"],
    teamMetricKeys: ["pp_goals", "pp_pct"],
    teamMetricKeywords: ["power play", "pp", "short-handed"],
    xgChanceConnection: 58,
    coachability: 80,
    focusText: [
      "entry touch before setup touch",
      "retrieval support after the first PP shot",
      "treat entries and shot generation as separate jobs",
    ],
    specialTeamsOnly: true,
  },
  {
    key: "goalie_workload_reduction",
    family: "goalie",
    title: "Chance quality against is putting too much cleanup on the goalies",
    coachingDiagnosis:
      "The goalie review matters, but the larger problem is how often dangerous looks are reaching the net after the first layer of team defense breaks.",
    whyItMatters:
      "This changes whether the week should spend more time on rebound and traffic clips or on the team habits that are creating those looks in the first place.",
    groupLabels: ["Net-front group", "Low-zone support group", "Goalie sightline support"],
    microTitle: "Second-touch clears after the first save",
    microDiagnosis:
      "The first save is not clearing the danger. Traffic, rebounds, and the next support touch are leaving the goalie to solve the same play twice.",
    microWhyItMatters:
      "When the support layer is late after the save, the goalie workload spikes and the team keeps defending the same chance sequence instead of ending it.",
    practiceRepIdea: "Net-front scramble reps where the rep ends only after the rebound is cleared with support in place.",
    drillTheme: "Reduce second-touch danger in front of the goalie",
    videoCue:
      "Pull goals against through traffic, rebound scrambles, and east-west plays where the goalie had to solve layered breakdowns.",
    kpiFollowUp: [
      "goalie defensive score",
      "team net xG",
      "blocked shots",
      "inner-slot danger proxies",
    ],
    playerMetricRules: [
      { key: "net_xg", direction: "higher_is_better", weight: 1.5 },
      { key: "blocked_shots", direction: "lower_is_better", weight: 1.0 },
      { key: "ev_dz_retrievals", direction: "lower_is_better", weight: 1.2 },
    ],
    playerCategoryHints: ["Defensive Impact", "Battle / Compete"],
    goalieCategoryHints: ["Defensive Impact", "Puck Management", "Special Teams"],
    tacticalGroups: ["defensive_zone_play", "transition_defense"],
    teamMetricKeys: ["opp_xg", "net_xg"],
    teamMetricKeywords: ["opponent xg", "goalie", "save", "rebound"],
    xgChanceConnection: 90,
    coachability: 74,
    focusText: [
      "separate goalie execution from team chance quality",
      "kill the second touch after the first save",
      "own net-front sightlines earlier",
    ],
    goalieRelevant: true,
  },
];

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[%(),./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function metricLabel(metricKey: string) {
  switch (metricKey) {
    case "puck_losses_dz":
      return "DZ puck losses";
    case "puck_losses_nz":
      return "NZ puck losses";
    case "entries_stickhandling":
      return "controlled entries";
    case "entries_dump_in":
      return "dump-in entries";
    case "inner_slot_shots":
      return "inner-slot shots";
    case "passes_to_slot":
      return "passes to the slot";
    case "xg_per_shot":
      return "xG per shot";
    case "corsi_pct":
      return "Corsi";
    case "oz_possession":
      return "O-zone possession";
    case "net_xg":
      return "net xG";
    case "pp_time":
      return "PP time";
    case "power_play_shots":
      return "power-play shots";
    case "blocked_shots":
      return "blocked shots";
    case "ev_dz_retrievals":
      return "EV DZ retrievals";
    case "error_leading_to_goal":
      return "errors leading to goals";
    default:
      return metricKey.replace(/_/g, " ");
  }
}

function formatMetricValue(metricKey: string, value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "n/a";
  }

  if (metricKey === "xg_per_shot") {
    return round(value, 3).toFixed(3);
  }

  if (
    metricKey === "corsi_pct" ||
    metricKey === "fenwick_pct" ||
    metricKey === "controlled_entry_pct"
  ) {
    return `${round(value * 100, 1).toFixed(1)}%`;
  }

  if (metricKey === "toi_per_game") {
    return `${round(value, 1).toFixed(1)} min/gm`;
  }

  return round(value, 2).toFixed(2);
}

function getMetricValue(player: FocusPlayer, metricKey: string): number | null {
  if (metricKey === "toi_per_game") {
    return player.toiPerGame;
  }

  if (metricKey === "xg_per_shot") {
    const xg = getMetricValue(player, "xg_expected");
    const shots = getMetricValue(player, "shots");
    if (xg === null || shots === null || shots <= 0) {
      return null;
    }
    return xg / shots;
  }

  const aliases = METRIC_ALIASES[metricKey] ?? [metricKey];

  for (const alias of aliases) {
    const raw = player.rawStats[alias];
    const numeric = coerceMetricValue(raw);
    if (numeric === null) {
      continue;
    }

    return PERCENT_METRICS.has(metricKey)
      ? Math.abs(numeric) > 1
        ? numeric / 100
        : numeric
      : numeric;
  }

  return null;
}

function buildFocusPlayers(rows: PlayerBreakdown[]) {
  return rows.map((row) => {
    const peers = rows.filter(
      (peer) => peer.season === row.season && peer.modelType === row.modelType,
    );
    const profile = buildPlayerArchetypeProfile(row, peers);

    return {
      id: row.id,
      name: row.name,
      jerseyNumber: row.jerseyNumber,
      position: row.position,
      modelType: row.modelType,
      gamesPlayed: row.gamesPlayed ?? 0,
      toiMinutes: row.toiMinutes,
      toiPerGame:
        row.toiMinutes !== null && row.gamesPlayed !== null && row.gamesPlayed > 0
          ? row.toiMinutes / row.gamesPlayed
          : null,
      overallScore: row.overallScore,
      reliabilityScore: row.reliabilityScore,
      reliabilityFlag: row.reliabilityFlag,
      archetype: profile.primaryArchetype,
      archetypeConfidence: profile.confidenceLabel,
      roleTags: profile.styleTags,
      rawStats: row.rawStats,
      categoryScores: row.categoryScores,
      strongestKpis: row.strongestKpis,
      developmentKpis: row.developmentKpis,
      latestOverallChange: row.latestInterval?.overallScoreChange ?? null,
      latestTrendLabel: row.latestInterval?.trendLabel ?? null,
    } satisfies FocusPlayer;
  });
}

function buildFocusGoalies(rows: GoalieBreakdown[]) {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    gamesPlayed: row.gamesPlayed ?? 0,
    toiMinutes: row.toiMinutes,
    overallScore: row.overallScore,
    reliabilityScore: row.reliabilityScore,
    reliabilityFlag: row.reliabilityFlag,
    categoryScores: row.categoryScores,
    developmentKpis: row.developmentKpis,
    latestOverallChange:
      row.snapshots.length >= 2
        ? (row.snapshots.at(-1)?.overallScore ?? null) !== null &&
          (row.snapshots.at(-2)?.overallScore ?? null) !== null
          ? (row.snapshots.at(-1)?.overallScore ?? 0) -
            (row.snapshots.at(-2)?.overallScore ?? 0)
          : null
        : null,
  } satisfies GoalieFocus));
}

function teamAverage(players: FocusPlayer[], metricKey: string) {
  const values = players
    .map((player) => getMetricValue(player, metricKey))
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function compareByDirection(
  value: number,
  average: number,
  direction: KpiDirection | FocusMetricRule["direction"],
) {
  return direction === "higher_is_better" ? average - value : value - average;
}

function categoryScore(player: FocusPlayer, hints: string[]) {
  const matches = player.categoryScores.filter((category) =>
    hints.some((hint) =>
      normalizeKey(category.category).includes(normalizeKey(hint)),
    ),
  );

  const valid = matches
    .map((category) => category.score)
    .filter((score): score is number => score !== null && Number.isFinite(score));

  if (!valid.length) {
    return null;
  }

  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function goalieCategoryScore(goalie: GoalieFocus, hints: string[]) {
  const matches = goalie.categoryScores.filter((category) =>
    hints.some((hint) =>
      normalizeKey(category.category).includes(normalizeKey(hint)),
    ),
  );

  const valid = matches
    .map((category) => category.score)
    .filter((score): score is number => score !== null && Number.isFinite(score));

  if (!valid.length) {
    return null;
  }

  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function summarizeTrend(
  values: number[],
) {
  if (!values.length) {
    return null;
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;

  if (average >= 2) {
    return "This area is improving slightly across the latest player snapshots.";
  }

  if (average <= -2) {
    return "This area is sliding across the latest player snapshots.";
  }

  return "This area is relatively steady across the latest player snapshots.";
}

function calculateTrendDirectionScore(values: number[]) {
  if (!values.length) {
    return 50;
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;

  if (average <= -2) {
    return 85;
  }

  if (average < 0) {
    return 68;
  }

  if (average >= 2) {
    return 35;
  }

  return 50;
}

function findLinkedTeamKpis(
  analytics: AnalyticsBundle,
  config: FocusAreaConfig,
) {
  return analytics.kpiSummary.filter(
    (kpi) =>
      config.teamMetricKeys.includes(kpi.key) ||
      config.teamMetricKeys.includes(kpi.name) ||
      config.teamMetricKeywords.some((keyword) =>
        normalizeKey(`${kpi.key} ${kpi.name}`).includes(normalizeKey(keyword)),
      ),
  );
}

function tacticalSeverity(rows: TacticalDriverRow[], config: FocusAreaConfig) {
  return rows
    .filter((row) => config.tacticalGroups.includes(row.group))
    .reduce((sum, row) => {
      const delta = Math.abs(row.delta ?? 0);
      const coverage = row.coverage ?? 0.7;
      const concern = row.status === "concern" ? 1.2 : row.status === "neutral" ? 0.5 : 0.15;
      return sum + delta * 5 * coverage * concern;
    }, 0);
}

function buildAffectedPlayers(
  players: FocusPlayer[],
  config: FocusAreaConfig,
) {
  return players
    .filter((player) => player.gamesPlayed >= 5)
    .map((player) => {
      let severity = 0;
      const evidence: string[] = [];
      const linkedMetrics: string[] = [];

      for (const rule of config.playerMetricRules) {
        const value = getMetricValue(player, rule.key);
        const average = teamAverage(players, rule.key);

        if (value === null || average === null) {
          continue;
        }

        const gap = compareByDirection(value, average, rule.direction);
        if (gap > 0) {
          severity += gap * rule.weight * 35;
          evidence.push(
            `${metricLabel(rule.key)} ${formatMetricValue(rule.key, value)} vs team avg ${formatMetricValue(rule.key, average)}`,
          );
          linkedMetrics.push(metricLabel(rule.key));
        }
      }

      const category = categoryScore(player, config.playerCategoryHints);
      if (category !== null && category < 55) {
        severity += (55 - category) * 1.4;
        evidence.push(`Category support in this area is ${round(category, 1).toFixed(1)}/100`);
      }

      if (severity <= 0) {
        return null;
      }

      return {
        player,
        severity,
        evidence: evidence.slice(0, 3),
        linkedMetrics: Array.from(new Set(linkedMetrics)).slice(0, 4),
        linkedCategories: config.playerCategoryHints.slice(0, 3),
      } satisfies AffectedPlayer;
    })
    .filter((entry): entry is AffectedPlayer => Boolean(entry))
    .sort((left, right) => right.severity - left.severity);
}

function buildAffectedGoalies(
  goalies: GoalieFocus[],
  config: FocusAreaConfig,
) {
  if (!config.goalieRelevant) {
    return [];
  }

  return goalies
    .filter((goalie) => goalie.gamesPlayed >= 3)
    .map((goalie) => {
      const category = goalieCategoryScore(goalie, config.goalieCategoryHints);
      if (category === null) {
        return null;
      }

      let severity = category < 55 ? (55 - category) * 1.4 : 0;
      const evidence: string[] = [];

      if (category < 55) {
        evidence.push(`Goalie-side score in this area is ${round(category, 1).toFixed(1)}/100`);
      }

      for (const metric of goalie.developmentKpis.slice(0, 2)) {
        if (
          ["xg", "save", "rebound", "traffic", "chance"].some((keyword) =>
            normalizeKey(`${metric.metricKey} ${metric.displayName}`).includes(
              normalizeKey(keyword),
            ),
          )
        ) {
          severity += Math.max(0, 50 - (metric.score0100 ?? 50));
          evidence.push(metric.displayName);
        }
      }

      if (severity <= 0) {
        return null;
      }

      return {
        goalie,
        severity,
        evidence: evidence.slice(0, 3),
      } satisfies AffectedGoalie;
    })
    .filter((entry): entry is AffectedGoalie => Boolean(entry))
    .sort((left, right) => right.severity - left.severity);
}

function confidenceLabel({
  playerCount,
  metricCount,
  avgReliability,
  teamMetricCount,
}: {
  playerCount: number;
  metricCount: number;
  avgReliability: number | null;
  teamMetricCount: number;
}): FocusConfidence {
  if (playerCount === 0 || teamMetricCount === 0) {
    return "Data limited";
  }

  if ((avgReliability ?? 0) < 50 || metricCount <= 1) {
    return "Low confidence";
  }

  if ((avgReliability ?? 0) >= 75 && playerCount >= 3 && metricCount >= 2 && teamMetricCount >= 2) {
    return "High confidence";
  }

  return "Moderate confidence";
}

export function calculateDataConfidence(input: {
  playerCount: number;
  metricCount: number;
  avgReliability: number | null;
  teamMetricCount: number;
}) {
  return confidenceLabel(input);
}

export function scoreTeamPriority({
  teamModelImportance,
  weaknessSeverity,
  xgOrScoringChanceConnection,
  playerPatternSupport,
  highUsageGroupRelevance,
  trendDirection,
  dataReliability,
}: TeamPriorityScoreInputs) {
  return round(
    teamModelImportance * 0.25 +
      weaknessSeverity * 0.25 +
      xgOrScoringChanceConnection * 0.15 +
      playerPatternSupport * 0.15 +
      highUsageGroupRelevance * 0.1 +
      trendDirection * 0.05 +
      dataReliability * 0.05,
    1,
  );
}

export function scoreMicroPriority({
  teamPriorityConnection,
  playerPatternFrequency,
  fixability,
  skillSpecificity,
  usageRelevance,
  trendDirection,
  dataReliability,
}: MicroPriorityScoreInputs) {
  return round(
    teamPriorityConnection * 0.25 +
      playerPatternFrequency * 0.2 +
      fixability * 0.15 +
      skillSpecificity * 0.15 +
      usageRelevance * 0.1 +
      trendDirection * 0.05 +
      dataReliability * 0.1,
    1,
  );
}

function teamPriorityLevel(score: number): TeamPriorityLevel {
  if (score >= 85) {
    return "critical";
  }
  if (score >= 70) {
    return "high";
  }
  if (score >= 50) {
    return "medium";
  }
  return "monitor";
}

function teamPriorityLevelLabel(level: TeamPriorityLevel) {
  switch (level) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "monitor":
      return "Monitor";
  }
}

export function calculateTeamPriorityCandidates(
  analytics: AnalyticsBundle,
  players: FocusPlayer[],
  goalies: GoalieFocus[],
  includeSpecialTeams: boolean,
) {
  const teamToiAverage = players
    .map((player) => player.toiPerGame)
    .filter((value): value is number => value !== null)
    .reduce((sum, value, _, array) => sum + value / array.length, 0);

  return TEAM_FOCUS_CONFIG.filter(
    (config) => includeSpecialTeams || !config.specialTeamsOnly,
  ).map((config) => {
    const linkedTeamKpis = findLinkedTeamKpis(analytics, config);
    const playerLinks = buildAffectedPlayers(players, config);
    const goalieLinks = buildAffectedGoalies(goalies, config);
    const linkedPlayers = playerLinks.slice(0, 6);
    const linkedGoalies = goalieLinks.slice(0, 2);

    const teamModelImportanceRaw = linkedTeamKpis.reduce(
      (sum, kpi) => sum + kpi.weight,
      0,
    );
    const weaknessSeverityRaw =
      linkedTeamKpis.reduce(
        (sum, kpi) => sum + Math.max(0, 100 - (kpi.averageNormalized ?? 50)) * (kpi.weight / 3),
        0,
      ) +
      tacticalSeverity(analytics.tacticalDrivers, config);

    const playerPatternSupport = clamp(linkedPlayers.length * 16, 0, 100);
    const highUsageGroupRelevance = clamp(linkedPlayers.reduce((sum, link) => {
      const isHighUsage =
        link.player.toiPerGame !== null && link.player.toiPerGame > teamToiAverage;
      return sum + (isHighUsage ? 1 : 0);
    }, 0) * 20, 0, 100);
    const xgOrChanceConnection = config.xgChanceConnection;
    const goalieContextFactorRaw =
      linkedGoalies.reduce((sum, goalie) => sum + goalie.severity, 0) > 0
        ? clamp(linkedGoalies.reduce((sum, goalie) => sum + goalie.severity, 0) / 2, 0, 100)
        : 0;
    const trendDirection = calculateTrendDirectionScore(
      linkedPlayers
        .map((link) => link.player.latestOverallChange)
        .filter((value): value is number => value !== null),
    );
    const avgReliability =
      linkedPlayers.length > 0
        ? linkedPlayers
            .map((link) => link.player.reliabilityScore)
            .filter((value): value is number => value !== null)
            .reduce((sum, value, _, array) => sum + value / array.length, 0)
        : null;
    const reliabilityScore = clamp(
      ((avgReliability ?? 45) * 0.75) + clamp(analytics.filteredGamesCount * 4, 0, 25),
      0,
      100,
    );
    const teamModelImportance = clamp(teamModelImportanceRaw * 12, 0, 100);
    const weaknessSeverity = clamp(weaknessSeverityRaw, 0, 100);
    const priorityScore = scoreTeamPriority({
      teamModelImportance,
      weaknessSeverity,
      xgOrScoringChanceConnection: clamp(
        xgOrChanceConnection + goalieContextFactorRaw * 0.2,
        0,
        100,
      ),
      playerPatternSupport,
      highUsageGroupRelevance,
      trendDirection,
      dataReliability: reliabilityScore,
    });

    const compareNote = summarizeTrend(
      linkedPlayers
        .map((link) => link.player.latestOverallChange)
        .filter((value): value is number => value !== null),
    );

    const keyNumbers = [
      ...linkedTeamKpis.slice(0, 2).map((kpi) => {
        const raw = kpi.latestRaw === null ? "n/a" : round(kpi.latestRaw, 2).toFixed(2);
        const normalized = kpi.averageNormalized === null ? "n/a" : round(kpi.averageNormalized, 1).toFixed(1);
        return `${kpi.name}: ${raw} in the current team view | weighted score ${normalized}/100`;
      }),
      ...linkedPlayers.slice(0, 1).flatMap((link) => link.evidence.slice(0, 2)),
      ...linkedGoalies.slice(0, 1).flatMap((link) => link.evidence.slice(0, 1)),
    ].slice(0, 3);

    const connectedGroups = Array.from(
      new Set([
        ...config.groupLabels,
        ...(linkedPlayers.some((player) => player.player.position === "F")
          ? ["Forwards"]
          : []),
        ...(linkedPlayers.some((player) => player.player.position === "D")
          ? ["Defense"]
          : []),
        ...(linkedGoalies.length ? ["Goalie context"] : []),
      ]),
    );

    return {
      key: config.key,
      title: config.title,
      priorityLevel: teamPriorityLevel(priorityScore),
      priorityScore,
      coachingDiagnosis: compareNote
        ? `${config.coachingDiagnosis} ${compareNote}`
        : config.coachingDiagnosis,
      whyItMatters: config.whyItMatters,
      keyNumbers: keyNumbers.length ? keyNumbers : ["Data in this area is currently limited."],
      playersGroupsConnected: connectedGroups.slice(0, 4),
      drillTheme: config.drillTheme,
      videoCue: config.videoCue,
      kpiFollowUp: config.kpiFollowUp,
      dataConfidence: calculateDataConfidence({
        playerCount: linkedPlayers.length,
        metricCount: linkedPlayers.flatMap((link) => link.linkedMetrics).length,
        avgReliability,
        teamMetricCount: linkedTeamKpis.length,
      }),
      compareNote,
      linkedPlayers: linkedPlayers.map((link) => link.player.name),
      linkedGoalies: linkedGoalies.map((link) => link.goalie.name),
      linkedGroups: connectedGroups,
      diagnostics: {
        teamModelImportance: round(teamModelImportance, 1),
        weaknessSeverity: round(weaknessSeverity, 1),
        playerPatternSupport: round(playerPatternSupport, 1),
        highUsageGroupRelevance: round(highUsageGroupRelevance, 1),
        xgOrChanceConnection,
        trendDirection: round(trendDirection, 1),
        goalieContextFactor: round(goalieContextFactorRaw, 1),
        reliabilityScore: round(reliabilityScore, 1),
        linkedTeamKpis: linkedTeamKpis.map((kpi) => kpi.name),
        linkedPlayerMetrics: linkedPlayers.flatMap((link) => link.linkedMetrics).slice(0, 6),
        linkedGoalieEvidence: linkedGoalies.flatMap((link) => link.evidence).slice(0, 3),
      },
    } satisfies TeamPriorityCandidate;
  }).sort((left, right) => right.priorityScore - left.priorityScore);
}

export function mapTeamIssueToMicroHabits(config: FocusAreaConfig) {
  return {
    microTitle: config.microTitle,
    microDiagnosis: config.microDiagnosis,
    microWhyItMatters: config.microWhyItMatters,
    practiceRepIdea: config.practiceRepIdea,
    skillDetails: config.focusText,
  };
}

export function calculateMicroPriorityCandidates(
  teamCandidates: TeamPriorityCandidate[],
  _analytics: AnalyticsBundle,
  players: FocusPlayer[],
  goalies: GoalieFocus[],
) {
  const teamToiAverage = players
    .map((player) => player.toiPerGame)
    .filter((value): value is number => value !== null)
    .reduce((sum, value, _, array) => sum + value / array.length, 0);

  const candidates: IndividualPriorityCandidate[] = [];

  for (const teamCandidate of teamCandidates.slice(0, 6)) {
    const config = TEAM_FOCUS_CONFIG.find((entry) => entry.key === teamCandidate.key);
    if (!config) {
      continue;
    }

    const affectedPlayers = buildAffectedPlayers(players, config);
    const affectedGoalies = buildAffectedGoalies(goalies, config);

    const playerLinks = affectedPlayers.slice(0, 5);
    const goalieLinks = affectedGoalies.slice(0, 2);

    if (!playerLinks.length && !goalieLinks.length) {
      continue;
    }

    const defenseCount = playerLinks.filter((link) => link.player.position === "D").length;
    const forwardCount = playerLinks.filter((link) => link.player.position === "F").length;
    const priorityType: IndividualPriorityType =
      goalieLinks.length && !playerLinks.length
        ? "Goalie"
        : defenseCount >= 2 || forwardCount >= 3
          ? "Position Group"
          : "Small Group";

    const microHabit = mapTeamIssueToMicroHabits(config);
    const avgReliability =
      playerLinks.length > 0
        ? playerLinks
            .map((link) => link.player.reliabilityScore)
            .filter((value): value is number => value !== null)
            .reduce((sum, value, _, array) => sum + value / array.length, 0) || 45
        : goalieLinks
            .map((link) => link.goalie.reliabilityScore)
            .filter((value): value is number => value !== null)
            .reduce((sum, value, _, array) => sum + value / array.length, 0) || 45;
    const usageRelevance =
      playerLinks.length > 0
        ? clamp(
            playerLinks.reduce(
              (sum, link) =>
                sum + ((link.player.toiPerGame ?? 0) / Math.max(teamToiAverage, 1)) * 25,
              0,
            ),
            0,
            100,
          )
        : clamp(
            goalieLinks.reduce(
              (sum, link) => sum + ((link.goalie.gamesPlayed ?? 0) / 20) * 100,
              0,
            ) / Math.max(goalieLinks.length, 1),
            0,
            100,
          );
    const trendValues = [
      ...playerLinks
        .map((link) => link.player.latestOverallChange)
        .filter((value): value is number => value !== null),
      ...goalieLinks
        .map((link) => link.goalie.latestOverallChange)
        .filter((value): value is number => value !== null),
    ];
    const trendOrSnapshotChange = clamp(
      trendValues.reduce((sum, value, _, array) => sum + (value < 0 ? 90 : 55) / array.length, 0) ||
        45,
      0,
      100,
    );
    const developmentGapSeverity = clamp(
      (
        playerLinks.reduce((sum, link) => sum + link.severity, 0) +
        goalieLinks.reduce((sum, link) => sum + link.severity, 0)
      ) / Math.max(playerLinks.length + goalieLinks.length, 1),
      0,
      100,
    );
    const teamPriorityConnection = teamCandidate.priorityScore;
    const playerPatternFrequency = clamp(
      (playerLinks.length + goalieLinks.length) * 18,
      0,
      100,
    );
    const skillSpecificity = clamp(
      60 + Math.min(microHabit.skillDetails.length, 5) * 7,
      0,
      100,
    );
    const priorityScore = scoreMicroPriority({
      teamPriorityConnection,
      playerPatternFrequency,
      fixability: config.coachability,
      skillSpecificity,
      usageRelevance,
      trendDirection: trendOrSnapshotChange,
      dataReliability: avgReliability,
    });

    const linkedGroups = Array.from(
      new Set([
        ...config.groupLabels,
        ...(defenseCount > 0 ? ["Defense"] : []),
        ...(forwardCount > 0 ? ["Forwards"] : []),
        ...(goalieLinks.length ? ["Goalie support"] : []),
      ]),
    );

    candidates.push({
      key: `${config.key}-micro`,
      linkedTeamPriorityKey: config.key,
      microSkillFocus: microHabit.microTitle,
      priorityType,
      priorityScore,
      tacticDiagnosis: microHabit.microDiagnosis,
      whyItMatters: microHabit.microWhyItMatters,
      keyNumbers: [
        ...playerLinks.flatMap((link) => link.evidence).slice(0, 3),
        ...goalieLinks.flatMap((link) => link.evidence).slice(0, 1),
      ].slice(0, 3),
      skillDetails: microHabit.skillDetails,
      practiceRepIdea: microHabit.practiceRepIdea,
      videoCue: config.videoCue,
      kpiFollowUp: config.kpiFollowUp,
      dataConfidence: calculateDataConfidence({
        playerCount: playerLinks.length + goalieLinks.length,
        metricCount:
          playerLinks.flatMap((link) => link.linkedMetrics).length +
          goalieLinks.flatMap((link) => link.evidence).length,
        avgReliability,
        teamMetricCount: teamCandidate.diagnostics.linkedTeamKpis.length,
      }),
      compareNote: summarizeTrend(trendValues),
      linkedPlayers: [
        ...playerLinks.map((link) => link.player.name),
        ...goalieLinks.map((link) => link.goalie.name),
      ],
      linkedGroups,
      diagnostics: {
        developmentGapSeverity,
        teamPriorityConnection,
        playerPatternFrequency,
        fixability: config.coachability,
        skillSpecificity,
        usageRelevance,
        reliabilityScore: avgReliability,
        trendOrSnapshotChange,
        linkedContext: linkedGroups,
      },
    });
  }

  const seen = new Set<string>();
  return candidates
    .sort((left, right) => right.priorityScore - left.priorityScore)
    .filter((candidate) => {
      const dedupeKey = `${candidate.microSkillFocus}:${candidate.priorityType}`;
      if (seen.has(dedupeKey)) {
        return false;
      }
      seen.add(dedupeKey);
      return true;
    });
}

function buildWarnings(
  analytics: AnalyticsBundle,
  players: FocusPlayer[],
  teamCandidates: TeamPriorityCandidate[],
) {
  const warnings: string[] = [];

  if (analytics.filteredGamesCount < 5) {
    warnings.push("Limited team game sample in this view. Treat the team-side priorities as directional, not final.");
  }

  const forwardsWith10 = players.filter(
    (player) => player.position === "F" && player.gamesPlayed >= 10,
  ).length;
  const defenseWith10 = players.filter(
    (player) => player.position === "D" && player.gamesPlayed >= 10,
  ).length;

  if (forwardsWith10 < 8 || defenseWith10 < 4) {
    warnings.push("At least one position group is still light on established samples, so some player-level reads should stay tentative.");
  }

  const specialTeamsCandidate = teamCandidates.find((candidate) =>
    candidate.key === "special_teams_entries",
  );
  if (specialTeamsCandidate) {
    warnings.push("Special teams should only be emphasized if the player-level PP detail is strong enough to trust.");
  }

  return warnings;
}

export function composeStaffNote(
  teamPriorities: TeamPriorityCandidate[],
  individualPriorities: IndividualPriorityCandidate[],
  warnings: string[],
) {
  const topTeam = teamPriorities[0];
  const firstIndividual = individualPriorities[0];

  if (!topTeam || !firstIndividual) {
    return "There is not enough combined team, player, and goalie signal in the current view to draft a trustworthy staff note yet.";
  }

  const sentences = [
    `The first team focus should be ${topTeam.title.toLowerCase()} because ${topTeam.whyItMatters.charAt(0).toLowerCase()}${topTeam.whyItMatters.slice(1)}`,
    `The supporting micro habit is ${firstIndividual.microSkillFocus.toLowerCase()}: ${firstIndividual.tacticDiagnosis.charAt(0).toLowerCase()}${firstIndividual.tacticDiagnosis.slice(1)}`,
    `The first video cut should show ${firstIndividual.videoCue.charAt(0).toLowerCase()}${firstIndividual.videoCue.slice(1)}`,
    `After the next upload, monitor ${topTeam.kpiFollowUp.slice(0, 3).join(", ")} to see whether the focus is moving the right details.`,
  ];

  if (warnings.length) {
    sentences.push("Be careful not to overread the lower-confidence areas where the sample or player-level detail is still thin.");
  }

  return sentences.join(" ");
}

export function buildRecommendationEvidenceBundle({
  teamCandidates,
  individualCandidates,
}: {
  teamCandidates: TeamPriorityCandidate[];
  individualCandidates: IndividualPriorityCandidate[];
}) {
  return {
    teamPriorities: teamCandidates.map((priority) => ({
      priorityId: priority.key,
      priorityTitle: priority.title,
      priorityScore: priority.priorityScore,
      priorityLevel: priority.priorityLevel,
      teamMetricsUsed: priority.diagnostics.linkedTeamKpis,
      playerMetricsUsed: priority.diagnostics.linkedPlayerMetrics,
      goalieMetricsUsed: priority.diagnostics.linkedGoalieEvidence,
      weaknessSeverity: priority.diagnostics.weaknessSeverity,
      teamModelImportance: priority.diagnostics.teamModelImportance,
      playerPatternSupport: priority.diagnostics.playerPatternSupport,
      reliabilityScore: priority.diagnostics.reliabilityScore,
      confidenceLabel: priority.dataConfidence,
      generatedDrillTheme: priority.drillTheme,
      generatedVideoCue: priority.videoCue,
      generatedKpiFollowUp: priority.kpiFollowUp,
    })),
    microPriorities: individualCandidates.map((priority) => ({
      microPriorityId: priority.key,
      microPriorityTitle: priority.microSkillFocus,
      microPriorityScore: priority.priorityScore,
      linkedTeamPriority: priority.linkedTeamPriorityKey,
      microSkillCategory: priority.priorityType,
      playerMetricsUsed: priority.keyNumbers,
      groupPatternCount: priority.linkedPlayers.length,
      fixabilityScore: priority.diagnostics.fixability,
      skillSpecificityScore: priority.diagnostics.skillSpecificity,
      reliabilityScore: priority.diagnostics.reliabilityScore,
      confidenceLabel: priority.dataConfidence,
      generatedPracticeRep: priority.practiceRepIdea,
      generatedVideoCue: priority.videoCue,
      generatedKpiFollowUp: priority.kpiFollowUp,
    })),
  };
}

export function generateTeamPriorityCard(
  priority: TeamPriorityCandidate,
  rank: number,
): CoachingFocusTeamRecommendation {
  return {
    rank,
    title: priority.title,
    priorityLevel: teamPriorityLevelLabel(priority.priorityLevel),
    coachingDiagnosis: priority.coachingDiagnosis,
    whyItMatters: priority.whyItMatters,
    compareNote: priority.compareNote,
    keyNumbers: priority.keyNumbers,
    playersGroupsConnected: priority.playersGroupsConnected,
    teamPracticeTheme: priority.drillTheme,
    teamVideoCue: priority.videoCue,
    kpiFollowUp: priority.kpiFollowUp,
    dataConfidence: priority.dataConfidence,
  };
}

export function generateMicroPriorityCard(
  priority: IndividualPriorityCandidate,
  rank: number,
): CoachingFocusMicroRecommendation {
  return {
    rank,
    title: priority.microSkillFocus,
    priorityLevel: teamPriorityLevelLabel(teamPriorityLevel(priority.priorityScore)),
    individualTacticDiagnosis: priority.tacticDiagnosis,
    whyItMatters: priority.whyItMatters,
    compareNote: priority.compareNote,
    keyNumbers: priority.keyNumbers,
    skillDetailToCoach: priority.skillDetails,
    videoClipsToPull: priority.videoCue,
    practiceRepIdea: priority.practiceRepIdea,
    kpiFollowUp: priority.kpiFollowUp,
    dataConfidence: priority.dataConfidence,
  };
}

export function generateStaffNoteData(body: string): CoachingFocusStaffNoteData {
  return {
    title: "Staff Note",
    body,
  };
}

function configForKey(key: FocusAreaKey) {
  return TEAM_FOCUS_CONFIG.find((entry) => entry.key === key) ?? null;
}

function overlapRatio(left: string[], right: string[]) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const shared = Array.from(leftSet).filter((value) => rightSet.has(value)).length;
  const largest = Math.max(leftSet.size, rightSet.size, 1);
  return shared / largest;
}

function teamPrioritySelectionScore(
  candidate: TeamPriorityCandidate,
  selected: TeamPriorityCandidate[],
) {
  const config = configForKey(candidate.key);
  let redundancyPenalty = 0;
  let diversityBonus = 0;

  for (const existing of selected) {
    const existingConfig = configForKey(existing.key);
    if (config && existingConfig && config.family === existingConfig.family) {
      redundancyPenalty += 18;
    } else {
      diversityBonus += 8;
    }

    redundancyPenalty += overlapRatio(
      candidate.diagnostics.linkedTeamKpis,
      existing.diagnostics.linkedTeamKpis,
    ) * 20;
    redundancyPenalty += overlapRatio(candidate.kpiFollowUp, existing.kpiFollowUp) * 12;
  }

  return candidate.priorityScore - redundancyPenalty + diversityBonus;
}

function microPrioritySelectionScore(
  candidate: IndividualPriorityCandidate,
  selected: IndividualPriorityCandidate[],
) {
  let redundancyPenalty = 0;
  let diversityBonus = 0;

  for (const existing of selected) {
    if (candidate.linkedTeamPriorityKey === existing.linkedTeamPriorityKey) {
      redundancyPenalty += 20;
    } else {
      diversityBonus += 8;
    }

    redundancyPenalty += overlapRatio(candidate.kpiFollowUp, existing.kpiFollowUp) * 14;
    redundancyPenalty += overlapRatio(candidate.skillDetails, existing.skillDetails) * 18;
  }

  return candidate.priorityScore - redundancyPenalty + diversityBonus;
}

function selectDistinctTeamPriorities(candidates: TeamPriorityCandidate[], count = 3) {
  const remaining = [...candidates];
  const selected: TeamPriorityCandidate[] = [];

  while (remaining.length && selected.length < count) {
    remaining.sort(
      (left, right) =>
        teamPrioritySelectionScore(right, selected) -
        teamPrioritySelectionScore(left, selected),
    );
    selected.push(remaining.shift() as TeamPriorityCandidate);
  }

  return selected;
}

function selectDistinctMicroPriorities(
  candidates: IndividualPriorityCandidate[],
  count = 3,
) {
  const remaining = [...candidates];
  const selected: IndividualPriorityCandidate[] = [];

  while (remaining.length && selected.length < count) {
    remaining.sort(
      (left, right) =>
        microPrioritySelectionScore(right, selected) -
        microPrioritySelectionScore(left, selected),
    );
    selected.push(remaining.shift() as IndividualPriorityCandidate);
  }

  return selected;
}

export function buildCoachingFocusPageModel({
  analytics,
  playerBreakdowns,
  goalieBreakdowns,
  includeSpecialTeams = true,
}: {
  analytics: AnalyticsBundle;
  playerBreakdowns: PlayerBreakdown[];
  goalieBreakdowns: GoalieBreakdown[];
  includeSpecialTeams?: boolean;
}): CoachingFocusPageModel {
  const players = buildFocusPlayers(playerBreakdowns);
  const goalies = buildFocusGoalies(goalieBreakdowns);
  const teamCandidates = calculateTeamPriorityCandidates(
    analytics,
    players,
    goalies,
    includeSpecialTeams,
  );
  const individualCandidates = calculateMicroPriorityCandidates(
    teamCandidates,
    analytics,
    players,
    goalies,
  );
  const teamPriorities = selectDistinctTeamPriorities(teamCandidates, 3);
  const microPriorities = selectDistinctMicroPriorities(individualCandidates, 3);
  buildRecommendationEvidenceBundle({
    teamCandidates: teamPriorities,
    individualCandidates: microPriorities,
  });
  const warnings = buildWarnings(analytics, players, teamCandidates);
  const renderedTeamPriorities = teamPriorities.map((priority, index) =>
    generateTeamPriorityCard(priority, index + 1),
  );
  const renderedMicroPriorities = microPriorities.map((priority, index) =>
    generateMicroPriorityCard(priority, index + 1),
  );
  const staffNote = composeStaffNote(teamPriorities, microPriorities, warnings);

  return {
    teamPriorities,
    microPriorities,
    renderedTeamPriorities,
    renderedMicroPriorities,
    renderedStaffNote: generateStaffNoteData(staffNote),
    teamCandidates,
    individualCandidates,
    compareAvailable:
      players.some((player) => player.latestOverallChange !== null) ||
      goalies.some((goalie) => goalie.latestOverallChange !== null),
    updatedLabel: "Updated from latest team + player + goalie data",
    warnings,
    staffNote,
    aiGenerated: false,
    aiDiagnostics: {
      evidenceHash: null,
      generatedAt: null,
      modelUsed: null,
      fallbackUsed: true,
      note: null,
      evidenceBundle: null,
      aiOutput: null,
    },
  };
}

export type { TeamPriorityCandidate, IndividualPriorityCandidate, TeamPriorityLevel, FocusConfidence };
