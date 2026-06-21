import type { KpiWeight, TacticalGroup } from "@/lib/types";

function combinedText(weight: KpiWeight) {
  return `${weight.key} ${weight.name} ${weight.rawCategory} ${weight.notes ?? ""}`.toLowerCase();
}

function includesAny(value: string, patterns: string[]) {
  return patterns.some((pattern) => value.includes(pattern));
}

export function resolveTacticalGroup(weight: KpiWeight): TacticalGroup {
  const value = combinedText(weight);

  if (
    weight.category === "special_teams" ||
    includesAny(value, [
      "power play",
      "penalty kill",
      "short-handed",
      "special team",
      "pp ",
      " pp",
      "pk ",
      " pk",
      "pp%",
      "pk%",
      "penalty time",
    ])
  ) {
    return "special_teams";
  }

  if (
    includesAny(value, [
      "battle",
      "battles",
      "hits",
      "loose puck",
      "recovery",
      "retrieval",
      "retrievals",
      "takeaways in oz",
      "compete",
    ])
  ) {
    return "battle_compete";
  }

  if (
    includesAny(value, [
      "corsi",
      "possession",
      "territory",
      "oz play",
      "shot attempt share",
      "shot share",
      "oz possession",
      "nz possession",
      "dz possession",
    ])
  ) {
    return "possession_territory";
  }

  if (
    includesAny(value, [
      "puck loss",
      "giveaway",
      "accurate passes",
      "passes total",
      "pass accuracy",
      "dump out",
      "turnover",
      "dekes",
      "xg conversion",
    ])
  ) {
    return "puck_management";
  }

  if (
    includesAny(value, [
      "entry",
      "entries",
      "breakout",
      "zone entry",
      "counterattack",
      "counter-attack",
      "rush",
      "stickhandling",
      "dump in",
      "passes to the slot",
    ])
  ) {
    if (
      weight.category === "defense" ||
      includesAny(value, ["against", "opponent", "denial", "prevent"])
    ) {
      return "transition_defense";
    }

    return "transition_offense";
  }

  if (
    includesAny(value, [
      "scoring chance",
      "shots on goal",
      "shot",
      "xg",
      "pre-shot",
      "slot",
      "goals",
      "wrist shot",
      "slapshot",
      "missed shots",
      "blocked shots",
    ])
  ) {
    if (weight.category === "defense" || includesAny(value, ["opponent's xg", "against"])) {
      return "defensive_zone_play";
    }

    return "offensive_creation";
  }

  if (
    includesAny(value, [
      "defensive play",
      "dz",
      "defensive zone",
      "shots blocking",
      "hits against",
      "faceoffs in dz",
      "puck losses in dz",
      "takeaways in dz",
      "ev dz",
      "opponent's xg",
      "xga",
    ])
  ) {
    return "defensive_zone_play";
  }

  if (
    includesAny(value, [
      "takeaways in nz",
      "puck losses in nz",
      "faceoffs in nz",
      "neutral zone",
      "nz ",
      "transition defense",
    ])
  ) {
    return "transition_defense";
  }

  if (
    includesAny(value, [
      "faceoff",
      "dump ins",
      "dump outs",
      "penalties",
      "context",
      "shootout",
    ])
  ) {
    return "other_context";
  }

  if (weight.category === "defense") {
    return "defensive_zone_play";
  }

  if (weight.category === "offense") {
    return "offensive_creation";
  }

  return "other_context";
}

export function getUnassignedTacticalKpis(weights: KpiWeight[]) {
  return weights.filter(
    (weight) => weight.includeInScore && resolveTacticalGroup(weight) === "other_context",
  );
}
