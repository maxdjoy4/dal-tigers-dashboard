import type { ScoreCategory, TacticalGroup } from "@/lib/types";

export const CATEGORY_METADATA: Record<
  ScoreCategory,
  { label: string; description: string; shortDescription: string }
> = {
  offense: {
    label: "Offense",
    description:
      "How effectively we create scoring chances, sustain pressure, enter the offensive zone, and turn possession into dangerous attacks.",
    shortDescription: "Chance creation and attacking pressure.",
  },
  defense: {
    label: "Defense",
    description:
      "How effectively we limit opponent chances, manage the defensive zone, prevent dangerous entries, and reduce high-quality looks against.",
    shortDescription: "Chance suppression and defensive control.",
  },
  special_teams: {
    label: "Special Teams",
    description:
      "How effectively we perform on the power play and penalty kill, including entries, retrievals, clears, chances, and special-teams scoring impact.",
    shortDescription: "Power play and penalty kill impact.",
  },
};

export const TACTICAL_GROUP_ORDER: TacticalGroup[] = [
  "offensive_creation",
  "transition_offense",
  "puck_management",
  "defensive_zone_play",
  "transition_defense",
  "possession_territory",
  "special_teams",
  "battle_compete",
  "other_context",
];

export const TACTICAL_GROUP_METADATA: Record<
  TacticalGroup,
  { label: string; description: string; examples: string; visible: boolean }
> = {
  offensive_creation: {
    label: "Offensive Creation",
    description:
      "How effectively we create dangerous offensive looks and turn possession into scoring chances.",
    examples:
      "Scoring chances, slot chances, shots on goal, xG, pre-shot movement.",
    visible: true,
  },
  transition_offense: {
    label: "Transition Offense",
    description:
      "How effectively we turn possession into attack through exits, neutral-zone speed, entries, and rush opportunities.",
    examples:
      "Controlled entries, entries, counterattacks, breakouts, passes to the slot.",
    visible: true,
  },
  puck_management: {
    label: "Puck Management",
    description:
      "How effectively we protect the puck, make clean decisions, and avoid turnovers that kill possession or create risk.",
    examples:
      "Puck losses, giveaways, pass accuracy, failed exits, failed entries.",
    visible: true,
  },
  defensive_zone_play: {
    label: "Defensive Zone Play",
    description:
      "How effectively we manage pressure inside our defensive zone and limit dangerous chances against.",
    examples:
      "DZ retrievals, DZ puck losses, slot chances against, xGA, defensive-zone time.",
    visible: true,
  },
  transition_defense: {
    label: "Transition Defense",
    description:
      "How effectively we stop the opponent's attack before it becomes dangerous.",
    examples:
      "Entries against, rush chances against, reloads, backpressure, entry denial.",
    visible: true,
  },
  possession_territory: {
    label: "Possession & Territory",
    description:
      "How effectively we control where the game is played and sustain pressure in the right areas.",
    examples:
      "OZ time, DZ time, Corsi, shot attempt share, possession time.",
    visible: true,
  },
  special_teams: {
    label: "Special Teams",
    description:
      "How effectively we perform on the power play and penalty kill.",
    examples:
      "PP success, PK success, PP entries, PP retrievals, PK clears, special-teams chances.",
    visible: true,
  },
  battle_compete: {
    label: "Battle / Compete Metrics",
    description:
      "How effectively we win contested pucks, recover loose pucks, and extend plays through pressure and effort.",
    examples:
      "Puck battles won, loose puck recoveries, takeaways in OZ, retrievals, net-front battles.",
    visible: true,
  },
  other_context: {
    label: "Other / Context",
    description: "Unassigned or context-heavy KPIs that are not shown in the visible tactical breakdown.",
    examples: "Context-heavy or unassigned KPIs excluded from the visible tactical breakdown.",
    visible: false,
  },
};

export function getVisibleTacticalGroups() {
  return TACTICAL_GROUP_ORDER.filter((group) => TACTICAL_GROUP_METADATA[group].visible);
}
