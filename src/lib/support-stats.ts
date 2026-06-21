export const SUPPORT_STAT_NAMES = [
  "Power play",
  "Short-handed",
  "Penalty killing",
  "Penalties",
] as const;

export type SupportStatName = (typeof SUPPORT_STAT_NAMES)[number];

export const POWER_PLAY_DEPENDENT_KPI_KEYS = new Set([
  "pp_goals",
  "pp_pct",
  "pp_retrievals",
]);

export const PENALTY_KILL_DEPENDENT_KPI_KEYS = new Set([
  "pk_pct",
  "pk_retrievals",
  "shorthanded_time",
]);

export function isSupportStatName(value: string) {
  return SUPPORT_STAT_NAMES.includes(value as SupportStatName);
}
