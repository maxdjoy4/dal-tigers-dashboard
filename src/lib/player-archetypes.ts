import type { PlayerBreakdown } from "@/lib/player-goalie-types";

export type ForwardArchetypeName =
  | "Playmaker"
  | "Scorer"
  | "Two-Way Forward"
  | "Power / Forechecking Forward";

export type DefenseArchetypeName =
  | "Shutdown Defenseman"
  | "Puck-Moving Defenseman"
  | "Two-Way Defenseman"
  | "Offensive Defenseman";

export type PlayerArchetypeName = ForwardArchetypeName | DefenseArchetypeName;
export type PlayerArchetypeConfidenceLabel =
  | "Clear archetype"
  | "Strong lean"
  | "Blended profile"
  | "Low-confidence profile"
  | "Insufficient data";

export interface PlayerArchetypeScore {
  name: PlayerArchetypeName;
  score: number | null;
  share: number;
  availableMetricCount: number;
  totalMetricCount: number;
  strongSignalCount: number;
  color: string;
}

export interface PlayerArchetypeSignal {
  key: string;
  label: string;
  description: string;
  value: number | null;
  score: number | null;
}

export interface PlayerArchetypeProfile {
  modelType: "Forward" | "Defense";
  scores: PlayerArchetypeScore[];
  primaryArchetype: string;
  secondaryArchetype: string | null;
  rawPrimaryArchetype: PlayerArchetypeName | null;
  rawSecondaryArchetype: PlayerArchetypeName | null;
  profileLabel: string;
  confidenceLabel: PlayerArchetypeConfidenceLabel;
  scoreGap: number | null;
  adjustedByContradiction: boolean;
  insufficientData: boolean;
  summary: string;
  styleTags: string[];
  statisticalDescription: string;
  coachBullets: string[];
  topSignals: PlayerArchetypeSignal[];
  cautionSignals: PlayerArchetypeSignal[];
  flags: string[];
}

type MetricDirection = "positive" | "negative";

interface ArchetypeMetricConfig {
  key: string;
  label: string;
  weight: number;
}

interface ArchetypeConfig {
  name: PlayerArchetypeName;
  color: string;
  tags: string[];
  summary: string;
  focus: string;
  metrics: ArchetypeMetricConfig[];
}

interface MetricReadout {
  key: string;
  label: string;
  description: string;
  rawValue: number | null;
  normalizedValue: number;
  direction: MetricDirection;
  orientedValue: number;
  weight: number;
  contribution: number;
}

const CLEAR_ARCHETYPE_GAP = 15;
const STRONG_LEAN_GAP = 8;
const BLENDED_PROFILE_GAP = 4;
const STRONG_SIGNAL_THRESHOLD = 65;

const PERCENT_METRICS = new Set([
  "faceoff_win_pct",
  "faceoffs_dz_win_pct",
  "faceoffs_nz_win_pct",
  "faceoffs_oz_win_pct",
  "corsi_pct",
  "fenwick_pct",
  "puck_battle_win_pct",
]);

const TIME_METRICS = new Set([
  "pp_time",
  "sh_time",
  "puck_control_time",
  "oz_possession",
  "dz_possession",
]);

const METRIC_ALIASES: Record<string, string[]> = {
  goals: ["goals"],
  first_assist: ["first_assist"],
  second_assist: ["second_assist"],
  assists: ["assists"],
  points: ["points"],
  plus_minus: ["plus_minus"],
  scoring_chances: ["scoring_chances"],
  shots: ["shots"],
  shots_on_goal: ["shots_on_goal"],
  blocked_shots: ["blocked_shots"],
  power_play_shots: ["power_play_shots"],
  shorthanded_shots: ["shorthanded_shots"],
  passes_to_slot: ["passes_to_the_slot", "passes_to_slot"],
  hits: ["hits"],
  penalties_drawn: ["penalties_drawn"],
  faceoffs: ["faceoffs"],
  faceoffs_won: ["faceoffs_won"],
  faceoff_win_pct: ["faceoffs_won_pct", "faceoff_win_pct"],
  faceoffs_dz: ["faceoffs_in_dz", "faceoffs_dz"],
  faceoffs_dz_win_pct: ["faceoffs_won_in_dz_pct", "faceoffs_dz_win_pct"],
  faceoffs_nz_win_pct: ["faceoffs_won_in_nz_pct", "faceoffs_nz_win_pct"],
  faceoffs_oz_win_pct: ["faceoffs_won_in_oz_pct", "faceoffs_oz_win_pct"],
  pp_time: ["pp_time"],
  sh_time: ["sh_time"],
  puck_control_time: ["puck_control_time"],
  puck_touches: ["puck_touches"],
  dump_ins: ["dump_ins"],
  dump_outs: ["dump_outs"],
  puck_losses_dz: ["puck_losses_in_dz", "puck_losses_dz"],
  xg_expected: ["xg", "xg_expected"],
  net_xg: ["net_xg_xg_player_on_minus_opp_teams_xg", "net_xg"],
  corsi_pct: ["corsi_for_pct", "corsi_pct"],
  fenwick_pct: ["fenwick_for_pct", "fenwick_pct"],
  oz_possession: ["oz_possession"],
  dz_possession: ["dz_possession"],
  puck_battle_win_pct: ["puck_battles_won_pct", "puck_battle_win_pct"],
  puck_battles_dz: ["puck_battles_in_dz", "puck_battles_dz"],
  puck_battles_oz: ["puck_battles_in_oz", "puck_battles_oz"],
  inner_slot_shots: ["inner_slot_shots_minus_total", "inner_slot_shots"],
  takeaways_oz: ["takeaways_in_oz", "takeaways_oz"],
  ev_dz_retrievals: ["ev_dz_retrievals"],
  ev_oz_retrievals: ["ev_oz_retrievals"],
  pre_shots_passes: ["preminusshots_passes", "pre_shots_passes"],
  entries_stickhandling: ["entries_via_stickhandling", "entries_stickhandling"],
  entries_dump_in: ["entries_via_dump_in", "entries_dump_in"],
  breakouts_stickhandling: ["breakouts_via_stickhandling", "breakouts_stickhandling"],
  breakouts_dump_out: ["breakouts_via_dump_out", "breakouts_dump_out"],
  error_leading_to_goal: ["error_leading_to_goal"],
  all_shifts: ["all_shifts"],
};

const SIGNAL_DESCRIPTIONS: Record<string, string> = {
  goals: "finishing",
  first_assist: "first-touch creation",
  assists: "chance setup",
  points: "offensive production",
  plus_minus: "goal differential support",
  scoring_chances: "chance generation",
  shots: "shot volume",
  shots_on_goal: "shot execution",
  blocked_shots: "lane denial",
  power_play_shots: "power-play shooting",
  passes_to_slot: "dangerous-area passing",
  hits: "physical engagement",
  penalties_drawn: "pressure that forces mistakes",
  faceoffs_dz_win_pct: "defensive-zone draw control",
  pp_time: "power-play usage",
  sh_time: "penalty-kill usage",
  puck_control_time: "puck possession time",
  puck_touches: "puck involvement",
  dump_ins: "direct entry pressure",
  dump_outs: "simple exit habits",
  puck_losses_dz: "defensive-zone puck security",
  xg_expected: "chance quality",
  net_xg: "net chance differential",
  corsi_pct: "territorial control",
  fenwick_pct: "shot-share control",
  oz_possession: "offensive-zone control",
  dz_possession: "time spent defending",
  puck_battle_win_pct: "battle win rate",
  puck_battles_dz: "defensive-zone battle load",
  puck_battles_oz: "offensive-zone battle pressure",
  inner_slot_shots: "inside-ice shot access",
  takeaways_oz: "forecheck takeaways",
  ev_dz_retrievals: "defensive retrieval support",
  ev_oz_retrievals: "offensive retrieval pressure",
  pre_shots_passes: "pre-shot movement",
  entries_stickhandling: "controlled entry creation",
  entries_dump_in: "dump-in pressure entries",
  breakouts_stickhandling: "controlled breakout support",
  breakouts_dump_out: "glass-and-out exits",
  error_leading_to_goal: "high-cost mistakes",
  all_shifts: "workload and trust",
  faceoffs_lost: "lost-draw burden",
};

const FORWARD_ARCHETYPES: ArchetypeConfig[] = [
  {
    name: "Playmaker",
    color: "#60A5FA",
    tags: ["Chance Creator", "Puck Distributor", "Support Touches"],
    summary:
      "creates value through puck distribution, chance setup, and connecting teammates into better attacking areas.",
    focus:
      "keep building offense through dangerous passing, support underneath the puck, and cleaner setup touches into the slot.",
    metrics: [
      { key: "first_assist", label: "First assist", weight: 3.0 },
      { key: "assists", label: "Assists", weight: 2.5 },
      { key: "passes_to_slot", label: "Passes to slot", weight: 3.0 },
      { key: "puck_touches", label: "Puck touches", weight: 2.0 },
      { key: "puck_control_time", label: "Puck control time", weight: 2.0 },
      { key: "entries_stickhandling", label: "Entries via stickhandling", weight: 2.5 },
      { key: "oz_possession", label: "OZ possession", weight: 1.5 },
      { key: "pre_shots_passes", label: "Pre-shot passes", weight: 2.0 },
      { key: "ev_oz_retrievals", label: "EV OZ retrievals", weight: 1.5 },
      { key: "dump_ins", label: "Dump-ins", weight: -1.5 },
      { key: "breakouts_dump_out", label: "Breakouts via dump-out", weight: -1.0 },
    ],
  },
  {
    name: "Scorer",
    color: "#F7CF2F",
    tags: ["Shot Threat", "Finishing Lean", "Inside Looks"],
    summary:
      "creates value through finishing threat, inside-ice shot quality, and repeatable scoring touches.",
    focus:
      "keep attacking through the middle, getting pucks off the stick cleanly, and sustaining a dangerous finishing profile.",
    metrics: [
      { key: "goals", label: "Goals", weight: 3.0 },
      { key: "shots_on_goal", label: "Shots on goal", weight: 2.5 },
      { key: "xg_expected", label: "xG", weight: 2.0 },
      { key: "scoring_chances", label: "Scoring chances", weight: 2.0 },
      { key: "inner_slot_shots", label: "Inner slot shots", weight: 2.5 },
      { key: "power_play_shots", label: "Power-play shots", weight: 2.0 },
      { key: "pp_time", label: "Power-play time", weight: 1.5 },
      { key: "net_xg", label: "Net xG", weight: 1.5 },
      { key: "dump_ins", label: "Dump-ins", weight: -0.5 },
    ],
  },
  {
    name: "Two-Way Forward",
    color: "#34D399",
    tags: ["Balanced Impact", "Defensive Detail", "Support Routes"],
    summary:
      "brings balanced value at both ends through possession, defensive support, and cleaner puck detail.",
    focus:
      "protect the balanced habits, stay above the puck, and keep the risk profile from dragging down the overall impact.",
    metrics: [
      { key: "plus_minus", label: "+/-", weight: 2.5 },
      { key: "faceoffs_dz_win_pct", label: "DZ faceoff win %", weight: 2.0 },
      { key: "blocked_shots", label: "Blocked shots", weight: 1.5 },
      { key: "ev_dz_retrievals", label: "EV DZ retrievals", weight: 2.0 },
      { key: "takeaways_oz", label: "OZ takeaways", weight: 1.5 },
      { key: "corsi_pct", label: "Corsi %", weight: 1.5 },
      { key: "puck_battle_win_pct", label: "Puck battle win %", weight: 1.5 },
      { key: "faceoffs", label: "Faceoffs", weight: 1.0 },
      { key: "puck_losses_dz", label: "DZ puck losses", weight: -2.0 },
      { key: "error_leading_to_goal", label: "Errors leading to goal", weight: -1.5 },
      { key: "dump_ins", label: "Dump-ins", weight: -0.5 },
    ],
  },
  {
    name: "Power / Forechecking Forward",
    color: "#F97316",
    tags: ["Pressure Game", "Second Pucks", "Physical Touches"],
    summary:
      "creates value through pressure, retrievals, battles, and extending shifts in hard offensive areas.",
    focus:
      "keep winning second pucks, driving pressure below the dots, and turning forecheck touches into extended-zone time.",
    metrics: [
      { key: "dump_ins", label: "Dump-ins", weight: 3.0 },
      { key: "entries_dump_in", label: "Entries via dump-in", weight: 2.5 },
      { key: "breakouts_dump_out", label: "Breakouts via dump-out", weight: 2.0 },
      { key: "sh_time", label: "Short-handed time", weight: 2.0 },
      { key: "hits", label: "Hits", weight: 1.5 },
      { key: "faceoffs_lost", label: "Faceoffs lost", weight: 1.5 },
      { key: "goals", label: "Goals", weight: -0.5 },
      { key: "points", label: "Points", weight: -0.5 },
    ],
  },
];

const DEFENSE_ARCHETYPES: ArchetypeConfig[] = [
  {
    name: "Offensive Defenseman",
    color: "#F59E0B",
    tags: ["Blue-Line Attack", "PP Threat", "Offensive Jump"],
    summary:
      "drives attack from the back end through production, power-play value, and offensive-zone shot creation.",
    focus:
      "keep activating into the attack while making sure defensive-zone puck detail supports the offense.",
    metrics: [
      { key: "points", label: "Points", weight: 3.0 },
      { key: "pp_time", label: "Power-play time", weight: 3.0 },
      { key: "power_play_shots", label: "Power-play shots", weight: 2.5 },
      { key: "first_assist", label: "First assists", weight: 2.5 },
      { key: "goals", label: "Goals", weight: 2.0 },
      { key: "scoring_chances", label: "Scoring chances", weight: 2.0 },
      { key: "passes_to_slot", label: "Passes to slot", weight: 2.0 },
      { key: "xg_expected", label: "xG", weight: 1.5 },
      { key: "inner_slot_shots", label: "Inner slot shots", weight: 1.5 },
      { key: "puck_losses_dz", label: "DZ puck losses", weight: -1.0 },
    ],
  },
  {
    name: "Puck-Moving Defenseman",
    color: "#7DD3FC",
    tags: ["Breakout Driver", "Puck Distributor", "Transition Support"],
    summary:
      "moves the puck cleanly through transition, supports breakouts, and helps push play up ice with control.",
    focus:
      "keep leaning into clean first-touch exits, controlled support, and safer breakout decisions under pressure.",
    metrics: [
      { key: "shots", label: "Shots", weight: 3.0 },
      { key: "puck_control_time", label: "Puck control time", weight: 2.5 },
      { key: "entries_stickhandling", label: "Entries via stickhandling", weight: 2.5 },
      { key: "breakouts_stickhandling", label: "Breakouts via stickhandling", weight: 2.5 },
      { key: "puck_touches", label: "Puck touches", weight: 2.0 },
      { key: "corsi_pct", label: "Corsi %", weight: 2.0 },
      { key: "fenwick_pct", label: "Fenwick %", weight: 1.5 },
      { key: "oz_possession", label: "OZ possession", weight: 1.5 },
      { key: "dump_outs", label: "Dump-outs", weight: -1.5 },
      { key: "breakouts_dump_out", label: "Breakouts via dump-out", weight: -1.5 },
      { key: "puck_losses_dz", label: "DZ puck losses", weight: -1.5 },
    ],
  },
  {
    name: "Two-Way Defenseman",
    color: "#34D399",
    tags: ["Balanced Impact", "Territory Support", "Reliable Minutes"],
    summary:
      "shows a balanced blue-line profile with useful offense, defensive support, and trusted all-situations value.",
    focus:
      "keep the profile balanced by supporting both transition and defending details without overexposing risk.",
    metrics: [
      { key: "blocked_shots", label: "Blocked shots", weight: 2.5 },
      { key: "ev_dz_retrievals", label: "EV DZ retrievals", weight: 2.0 },
      { key: "puck_losses_dz", label: "DZ puck losses", weight: -2.0 },
      { key: "puck_battle_win_pct", label: "Puck battle win %", weight: 1.5 },
      { key: "pp_time", label: "Power-play time", weight: 1.5 },
      { key: "sh_time", label: "Short-handed time", weight: 1.5 },
      { key: "points", label: "Points", weight: 1.5 },
      { key: "all_shifts", label: "All shifts", weight: 1.5 },
      { key: "corsi_pct", label: "Corsi %", weight: 1.0 },
      { key: "error_leading_to_goal", label: "Errors leading to goal", weight: -1.5 },
    ],
  },
  {
    name: "Shutdown Defenseman",
    color: "#9BD5CF",
    tags: ["Defensive Stops", "Net-Front Detail", "PK Anchor"],
    summary:
      "leans into hard defensive minutes, penalty-kill work, and limiting damage through simple defensive detail.",
    focus:
      "keep defending hard areas honestly, limit dangerous errors, and make the first simple defensive play cleanly.",
    metrics: [
      { key: "sh_time", label: "Short-handed time", weight: 3.0 },
      { key: "blocked_shots", label: "Blocked shots", weight: 2.5 },
      { key: "breakouts_dump_out", label: "Breakouts via dump-out", weight: 2.0 },
      { key: "ev_dz_retrievals", label: "EV DZ retrievals", weight: 1.5 },
      { key: "puck_battles_dz", label: "DZ puck battles", weight: 1.5 },
      { key: "puck_losses_dz", label: "DZ puck losses", weight: -2.0 },
      { key: "points", label: "Points", weight: -1.5 },
      { key: "pp_time", label: "Power-play time", weight: -1.0 },
    ],
  },
];

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
}

function parseTimeMinutes(value: unknown): number | null {
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
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
}

function normalizePercent(value: number | null) {
  if (value === null) {
    return null;
  }

  return Math.abs(value) > 1 ? value / 100 : value;
}

function getRawMetric(player: PlayerBreakdown, key: string): number | null {
  if (key === "games_played") {
    return player.gamesPlayed;
  }

  if (key === "faceoffs_lost") {
    const faceoffs = getRawMetric(player, "faceoffs") ?? 0;
    const faceoffsWon = getRawMetric(player, "faceoffs_won") ?? 0;
    return Math.max(0, faceoffs - faceoffsWon);
  }

  const aliases = METRIC_ALIASES[key] ?? [key];

  for (const alias of aliases) {
    const raw = player.rawStats[alias];
    const numeric = TIME_METRICS.has(key) ? parseTimeMinutes(raw) : coerceNumber(raw);
    if (numeric === null) {
      continue;
    }

    return PERCENT_METRICS.has(key) ? normalizePercent(numeric) : numeric;
  }

  return null;
}

function scoreMetricValue(player: PlayerBreakdown, key: string) {
  return getRawMetric(player, key) ?? 0;
}

function getConfigs(modelType: PlayerBreakdown["modelType"]) {
  return modelType === "Defense" ? DEFENSE_ARCHETYPES : FORWARD_ARCHETYPES;
}

function getPeerGroup(player: PlayerBreakdown, peers: PlayerBreakdown[]) {
  const sameModel = peers.filter((peer) => peer.modelType === player.modelType);
  return sameModel.some((peer) => peer.id === player.id) ? sameModel : [player, ...sameModel];
}

function normalizeMetric(values: number[], value: number) {
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (max === min) {
    return 0.5;
  }

  return (value - min) / (max - min);
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function buildMetricReadout(
  player: PlayerBreakdown,
  peers: PlayerBreakdown[],
  config: ArchetypeConfig,
) {
  return config.metrics.map((metric) => {
    const rawValue = getRawMetric(player, metric.key);
    const comparableValues = peers.map((peer) => scoreMetricValue(peer, metric.key));
    const normalizedValue = normalizeMetric(comparableValues, scoreMetricValue(player, metric.key));
    const direction: MetricDirection = metric.weight >= 0 ? "positive" : "negative";
    const orientedValue = direction === "positive" ? normalizedValue : 1 - normalizedValue;
    const contribution = Math.abs(metric.weight) * orientedValue;

    return {
      key: metric.key,
      label: metric.label,
      description:
        SIGNAL_DESCRIPTIONS[metric.key] ?? "the cleaner parts of the current statistical profile",
      rawValue,
      normalizedValue,
      direction,
      orientedValue,
      weight: Math.abs(metric.weight),
      contribution,
    } satisfies MetricReadout;
  });
}

function normalizeShares(scores: PlayerArchetypeScore[]) {
  const total = scores.reduce((sum, score) => sum + Math.max(score.score ?? 0, 0), 0);

  return scores.map((score) => ({
    ...score,
    share:
      total > 0 && score.score !== null ? roundOne((score.score / total) * 100) : 0,
  }));
}

function signalFromReadout(readout: MetricReadout): PlayerArchetypeSignal {
  return {
    key: readout.key,
    label: readout.label,
    description: readout.description,
    value: readout.rawValue,
    score: roundOne(readout.orientedValue * 100),
  };
}

function buildConfidenceLabel(
  gap: number | null,
  insufficientData: boolean,
): PlayerArchetypeConfidenceLabel {
  if (insufficientData || gap === null) {
    return "Insufficient data";
  }

  if (gap >= CLEAR_ARCHETYPE_GAP) {
    return "Clear archetype";
  }

  if (gap >= STRONG_LEAN_GAP) {
    return "Strong lean";
  }

  if (gap >= BLENDED_PROFILE_GAP) {
    return "Blended profile";
  }

  return "Low-confidence profile";
}

function formatSignals(signals: PlayerArchetypeSignal[]) {
  const labels = Array.from(new Set(signals.map((signal) => signal.description))).slice(0, 3);

  if (!labels.length) {
    return "balanced supporting details";
  }

  if (labels.length === 1) {
    return labels[0];
  }

  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }

  return `${labels[0]}, ${labels[1]}, and ${labels[2]}`;
}

function buildFlags(
  player: PlayerBreakdown,
  primaryArchetype: PlayerArchetypeName,
  scoreGap: number | null,
) {
  const flags: string[] = [];
  const gamesPlayed = player.gamesPlayed ?? 0;

  if (gamesPlayed < 5) {
    flags.push("Provisional — insufficient sample");
  }

  if (scoreGap !== null && scoreGap < 5) {
    flags.push(`Low confidence — margin ${scoreGap.toFixed(1)}pt`);
  }

  if (
    primaryArchetype === "Shutdown Defenseman" &&
    scoreMetricValue(player, "shots") >= 3.5
  ) {
    flags.push("Review — shot volume suggests Two-Way D");
  }

  if (scoreGap !== null && scoreGap < 1) {
    flags.push("Near tie — verify manually");
  }

  return flags;
}

function buildSummary(
  player: PlayerBreakdown,
  primaryArchetype: PlayerArchetypeName,
  secondaryArchetype: PlayerArchetypeName | null,
  confidenceLabel: PlayerArchetypeConfidenceLabel,
  flags: string[],
  config: ArchetypeConfig,
) {
  return `${player.name} currently reads as a ${confidenceLabel.toLowerCase()} ${primaryArchetype.toLowerCase()}${
    secondaryArchetype ? ` with a ${secondaryArchetype.toLowerCase()} secondary lean` : ""
  }. ${config.focus}${flags.length ? ` Flags: ${flags.join("; ")}.` : ""}`;
}

function buildStatisticalDescription(
  player: PlayerBreakdown,
  primaryArchetype: PlayerArchetypeName,
  secondaryArchetype: PlayerArchetypeName | null,
  confidenceLabel: PlayerArchetypeConfidenceLabel,
  topSignals: PlayerArchetypeSignal[],
  cautionSignals: PlayerArchetypeSignal[],
  config: ArchetypeConfig,
  flags: string[],
) {
  const signalText = formatSignals(topSignals);
  const cautionText = cautionSignals.length
    ? formatSignals(cautionSignals)
    : "the weaker details in the profile";
  const secondaryText = secondaryArchetype
    ? `, with a ${secondaryArchetype.toLowerCase()} lean`
    : "";
  const flagText = flags.length ? ` ${flags.join(" ")}.` : "";

  return `${player.name} profiles as a ${confidenceLabel.toLowerCase()} ${primaryArchetype.toLowerCase()}${secondaryText}. The label is driven by ${signalText}, which suggests this player ${config.summary} The main caution is ${cautionText}, so the coaching focus is ${config.focus}${flagText}`;
}

function buildCoachBullets(
  primaryArchetype: PlayerArchetypeName,
  secondaryArchetype: PlayerArchetypeName | null,
  confidenceLabel: PlayerArchetypeConfidenceLabel,
  topSignals: PlayerArchetypeSignal[],
  cautionSignals: PlayerArchetypeSignal[],
  config: ArchetypeConfig,
  flags: string[],
) {
  const bullets = [
    `Current read: ${primaryArchetype}${secondaryArchetype ? ` with a ${secondaryArchetype.toLowerCase()} secondary lean` : ""}.`,
    `Confidence: ${confidenceLabel}.`,
    `Strongest drivers: ${formatSignals(topSignals)}.`,
    cautionSignals.length
      ? `Main caution: ${formatSignals(cautionSignals)}.`
      : `Coaching focus: ${config.focus}`,
  ];

  if (flags.length) {
    bullets.push(`Flags: ${flags.join("; ")}.`);
  }

  return bullets.slice(0, 4);
}

export function buildPlayerArchetypeProfile(
  player: PlayerBreakdown,
  peers: PlayerBreakdown[],
): PlayerArchetypeProfile {
  const group = getPeerGroup(player, peers);
  const configs = getConfigs(player.modelType);
  const readoutByArchetype = new Map<PlayerArchetypeName, MetricReadout[]>();

  const scoreRows = configs.map((config) => {
    const readout = buildMetricReadout(player, group, config);
    readoutByArchetype.set(config.name, readout);

    const rawScore = readout.reduce((sum, row) => sum + row.contribution, 0);
    const totalWeight = readout.reduce((sum, row) => sum + row.weight, 0);
    const observedCount = readout.filter((row) => row.rawValue !== null).length;
    const score = totalWeight > 0 ? roundOne((rawScore / totalWeight) * 100) : null;

    return {
      name: config.name,
      score,
      share: 0,
      availableMetricCount: observedCount,
      totalMetricCount: readout.length,
      strongSignalCount: readout.filter((row) => row.orientedValue * 100 >= STRONG_SIGNAL_THRESHOLD)
        .length,
      color: config.color,
    } satisfies PlayerArchetypeScore;
  });

  const scores = normalizeShares(scoreRows);
  const validScores = [...scores]
    .filter((row): row is PlayerArchetypeScore & { score: number } => row.score !== null)
    .sort((left, right) => right.score - left.score);
  const top = validScores[0] ?? null;
  const second = validScores[1] ?? null;
  const insufficientData = top === null;

  if (insufficientData) {
    return {
      modelType: player.modelType,
      scores,
      primaryArchetype: "Insufficient Data",
      secondaryArchetype: null,
      rawPrimaryArchetype: null,
      rawSecondaryArchetype: null,
      profileLabel: "Insufficient Data",
      confidenceLabel: "Insufficient data",
      scoreGap: null,
      adjustedByContradiction: false,
      insufficientData: true,
      summary: `${player.name} does not have enough usable archetype data yet.`,
      styleTags: ["Profile Pending"],
      statisticalDescription: `${player.name}'s current file does not yet have enough usable player data to lock in a stable style read.`,
      coachBullets: [
        "Current sample is still too thin to give staff a stable archetype read.",
        "Keep gathering more tracked data before leaning too hard on the role profile.",
      ],
      topSignals: [],
      cautionSignals: [],
      flags: ["Provisional — insufficient sample"],
    };
  }

  const primaryArchetype = top.name;
  const secondaryArchetype = second?.name ?? null;
  const scoreGap =
    second && top.score !== null && second.score !== null
      ? roundOne(top.score - second.score)
      : null;
  const confidenceLabel = buildConfidenceLabel(scoreGap, false);
  const flags = buildFlags(player, primaryArchetype, scoreGap);
  const primaryConfig = configs.find((config) => config.name === primaryArchetype)!;
  const primaryReadout = [...(readoutByArchetype.get(primaryArchetype) ?? [])];
  const topSignals = primaryReadout
    .slice()
    .sort((left, right) => right.contribution - left.contribution)
    .slice(0, 3)
    .map(signalFromReadout);
  const cautionSignals = primaryReadout
    .slice()
    .sort((left, right) => left.orientedValue - right.orientedValue)
    .slice(0, 2)
    .map(signalFromReadout);
  const summary = buildSummary(
    player,
    primaryArchetype,
    secondaryArchetype,
    confidenceLabel,
    flags,
    primaryConfig,
  );
  const statisticalDescription = buildStatisticalDescription(
    player,
    primaryArchetype,
    secondaryArchetype,
    confidenceLabel,
    topSignals,
    cautionSignals,
    primaryConfig,
    flags,
  );
  const coachBullets = buildCoachBullets(
    primaryArchetype,
    secondaryArchetype,
    confidenceLabel,
    topSignals,
    cautionSignals,
    primaryConfig,
    flags,
  );

  return {
    modelType: player.modelType,
    scores,
    primaryArchetype,
    secondaryArchetype,
    rawPrimaryArchetype: primaryArchetype,
    rawSecondaryArchetype: secondaryArchetype,
    profileLabel: primaryArchetype,
    confidenceLabel,
    scoreGap,
    adjustedByContradiction: false,
    insufficientData: false,
    summary,
    styleTags: primaryConfig.tags,
    statisticalDescription,
    coachBullets,
    topSignals,
    cautionSignals,
    flags,
  };
}
