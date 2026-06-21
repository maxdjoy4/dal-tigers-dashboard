export function normalizePlayerGoalieSeasonLabel(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }

  const match = raw.match(/^(\d{4})\s*[-/]\s*(\d{2}|\d{4})$/);
  if (!match) {
    return raw;
  }

  const startYear = Number(match[1]);
  const endRaw = match[2];
  const endYear =
    endRaw.length === 2 ? Number(`${String(startYear).slice(0, 2)}${endRaw}`) : Number(endRaw);

  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) {
    return raw;
  }

  return `${startYear}-${endYear}`;
}

export function getPlayerGoalieSeasonAliases(value: string | null | undefined) {
  const normalized = normalizePlayerGoalieSeasonLabel(value);
  if (!normalized) {
    return [];
  }

  const match = normalized.match(/^(\d{4})-(\d{4})$/);
  if (!match) {
    return [normalized];
  }

  const short = `${match[1]}-${match[2].slice(2)}`;
  return Array.from(new Set([normalized, short]));
}
