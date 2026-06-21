import * as XLSX from "xlsx";
import { z } from "zod";

import { SUPPORT_STAT_NAMES } from "@/lib/support-stats";
import type { GameRecord, HomeAway, KpiWeight, ResultBucket } from "@/lib/types";
import { slugify } from "@/lib/utils";

const uploadMetaSchema = z.object({
  season: z.string().optional(),
  homeAway: z.enum(["home", "away", "neutral", "unknown"]).optional(),
  summary: z.string().optional(),
});

type UploadRow = Record<string, string | number | null>;

export interface ParsedUpload {
  rows: UploadRow[];
  previewColumns: string[];
  matchedKpiCount: number;
  missingRequiredColumns: string[];
}

const metricColumnAliases: Record<string, string> = {
  accuratepasses: "Accurate Passes (Total)",
  accuratepassespct: "Accurate Pass %",
  blockedshots: "Blocked Shots (For)",
  breakouts: "Total Breakouts",
  counterattackwithshots: "Counter-Attacks with Shots",
  counterattacks: "Total Counterattacks",
  corsi: "CORSI% (5-on-5 Shot Share)",
  corsipct: "CORSI% (5-on-5 Shot Share)",
  dekes: "Total Dekes",
  dekessuccessfulpct: "Deke Success %",
  evdzretrievals: "EV DZ Retrievals",
  evozretrievals: "EV OZ Retrievals",
  entries: "Total Zone Entries",
  entriesviadumpin: "Entries via Dump-In",
  entriesviapass: "Entries via Pass",
  faceoffs: "Total Faceoffs",
  faceoffswon: "Faceoffs Won (Total)",
  goals: "Goals For",
  hits: "Hits (For)",
  missedshots: "Missed Shots",
  netxgxgopponentsxg: "Net xG Differential",
  ozplay: "OZ Play (Zone Possession)",
  ozplaywithshots: "OZ Play with Shots",
  passestotal: "Total Passes",
  penalties: "Penalties (Against)",
  penaltykillretrievals: "PK Retrievals",
  penaltykilling: "Penalty Kills (Count)",
  powerplay: "Power Play Opportunities",
  powerplayretrievals: "PP Retrievals",
  powerplayshots: "PP Shots",
  powerplaypct: "PP% (Season-Wide)",
  preshotspasses: "Pre-Shot Passes",
  puckbattles: "Total Puck Battles",
  puckbattlesindz: "Puck Battles in DZ",
  puckbattleswon: "Puck Battles Won (Total)",
  puckbattleswonpct: "Puck Battles Won %",
  pucklosses: "Total Puck Losses",
  pucklossesindz: "Puck Losses in DZ",
  pucklossesinnz: "Puck Losses in NZ",
  retrievals: "Total Retrievals",
  scoringchances: "Scoring Chances",
  shotsblocking: "Shots Blocked Against",
  shorthandedpct: "PK% (Season-Wide)",
  shorthanded: "Short-Handed Situations",
  pctshotsongoal: "Shot Accuracy %",
  shots: "Total Shots (Attempts)",
  shotsongoal: "Shots on Goal",
  slapshot: "Slapshots",
  successfulpowerplay: "Successful Power Plays",
  takeaways: "Total Takeaways",
  totalbreakouts: "Total Breakouts",
  totalcounterattacks: "Total Counterattacks",
  totaldekes: "Total Dekes",
  totalfaceoffs: "Total Faceoffs",
  totalpasses: "Total Passes",
  totalpuckbattles: "Total Puck Battles",
  totalpucklosses: "Total Puck Losses",
  totaltakeaways: "Total Takeaways",
  totalretrievals: "Total Retrievals",
  totalzoneentries: "Total Zone Entries",
  wristshot: "Wrist Shots",
  xgconversion: "xG Conversion Rate",
  xgexpectedgoals: "xG For (Expected Goals)",
};

function canonicalizeColumnName(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u2018\u2019']/g, "")
    .replace(/%/g, "pct")
    .replace(/[^a-z0-9]+/g, "");
}

function isPercentMetric(columnName: string, metricName: string) {
  const combined = `${columnName} ${metricName}`.toLowerCase();
  return (
    combined.includes("%") ||
    combined.includes(" pct") ||
    combined.includes("percent") ||
    /\bpct\b/.test(combined)
  );
}

function isDurationMetric(columnName: string, metricName: string) {
  const combined = `${columnName} ${metricName}`.toLowerCase();
  return (
    combined.includes("time") ||
    combined.includes("possession") ||
    combined.includes("play")
  );
}

function parseDurationToSeconds(raw: string) {
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return null;
  }

  if (match[3] !== undefined) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    return hours * 3600 + minutes * 60 + seconds;
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  return minutes * 60 + seconds;
}

function parseNumericValue(
  columnName: string,
  metricName: string,
  value: string | number | null,
) {
  if (value === null || value === "") {
    return null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }

    if (isPercentMetric(columnName, metricName) && Math.abs(value) <= 1) {
      return value * 100;
    }

    return value;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  if (isDurationMetric(columnName, metricName)) {
    const durationSeconds = parseDurationToSeconds(raw);
    if (durationSeconds !== null) {
      return durationSeconds;
    }
  }

  const percentLike = isPercentMetric(columnName, metricName) || raw.includes("%");
  const cleaned = raw.replace(/,/g, "").replace(/%/g, "").trim();
  const numeric = Number(cleaned);

  if (!Number.isFinite(numeric)) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[upload] invalid numeric value", {
        columnName,
        metricName,
        raw,
      });
    }
    return null;
  }

  if (percentLike && Math.abs(numeric) <= 1) {
    return numeric * 100;
  }

  return numeric;
}

function getParsedRowNumber(row: UploadRow, columnName: string) {
  if (!(columnName in row)) {
    return null;
  }

  return parseNumericValue(columnName, columnName, row[columnName] ?? null);
}

function deriveRateValue(
  numerator: number | null,
  denominator: number | null,
) {
  if (numerator === null || denominator === null || denominator <= 0) {
    return null;
  }

  return (numerator / denominator) * 100;
}

function applyDerivedStats(row: UploadRow, stats: Record<string, number | null>) {
  const ppOpportunities = getParsedRowNumber(row, "Power play");
  const ppGoals = getParsedRowNumber(row, "Successful power play");
  const shOpportunities = getParsedRowNumber(row, "Short-handed");
  const penaltyKills = getParsedRowNumber(row, "Penalty killing");
  const shotsTotal = getParsedRowNumber(row, "Shots");
  const shotsOnGoal = getParsedRowNumber(row, "Shots on goal");
  const counterattacks = getParsedRowNumber(row, "Counterattacks");
  const counterattackShots = getParsedRowNumber(row, "Counter-attack with shots");
  const ozPlay = getParsedRowNumber(row, "OZ play");
  const ozPlayWithShots = getParsedRowNumber(row, "OZ play with shots");
  const passesTotal = getParsedRowNumber(row, "Passes total");
  const accuratePasses = getParsedRowNumber(row, "Accurate passes");
  const puckBattles = getParsedRowNumber(row, "Puck battles");
  const puckBattlesWon = getParsedRowNumber(row, "Puck battles won");
  const faceoffs = getParsedRowNumber(row, "Faceoffs");
  const faceoffsWon = getParsedRowNumber(row, "Faceoffs won");
  const faceoffsDz = getParsedRowNumber(row, "Faceoffs in DZ");
  const faceoffsWonDz = getParsedRowNumber(row, "Faceoffs won in DZ");
  const faceoffsNz = getParsedRowNumber(row, "Faceoffs in NZ");
  const faceoffsWonNz = getParsedRowNumber(row, "Faceoffs won in NZ");
  const faceoffsOz = getParsedRowNumber(row, "Faceoffs in OZ");
  const faceoffsWonOz = getParsedRowNumber(row, "Faceoffs won in OZ");

  const ppPct = deriveRateValue(ppGoals, ppOpportunities);
  if (stats["Power play, %"] === null) {
    stats["Power play, %"] =
      ppOpportunities !== null && ppOpportunities > 0 && ppGoals !== null
        ? ppPct
        : null;
  }

  const pkPct = deriveRateValue(penaltyKills, shOpportunities);
  if (stats["Short-handed, %"] === null) {
    stats["Short-handed, %"] =
      shOpportunities !== null && shOpportunities > 0 && penaltyKills !== null
        ? pkPct
        : null;
  }

  if (stats["% shots on goal"] === null) {
    stats["% shots on goal"] = deriveRateValue(shotsOnGoal, shotsTotal);
  }

  if (stats["Counter-attack with shots, %"] === null) {
    stats["Counter-attack with shots, %"] = deriveRateValue(
      counterattackShots,
      counterattacks,
    );
  }

  if (stats["OZ play with shots, %"] === null) {
    stats["OZ play with shots, %"] = deriveRateValue(ozPlayWithShots, ozPlay);
  }

  if (stats["Accurate passes, %"] === null) {
    stats["Accurate passes, %"] = deriveRateValue(accuratePasses, passesTotal);
  }

  if (stats["Puck battles won, %"] === null) {
    stats["Puck battles won, %"] = deriveRateValue(puckBattlesWon, puckBattles);
  }

  if (stats["Faceoffs won, %"] === null) {
    stats["Faceoffs won, %"] = deriveRateValue(faceoffsWon, faceoffs);
  }

  if (stats["Faceoffs won in DZ, %"] === null) {
    stats["Faceoffs won in DZ, %"] = deriveRateValue(faceoffsWonDz, faceoffsDz);
  }

  if (stats["Faceoffs won in NZ, %"] === null) {
    stats["Faceoffs won in NZ, %"] = deriveRateValue(faceoffsWonNz, faceoffsNz);
  }

  if (stats["Faceoffs won in OZ, %"] === null) {
    stats["Faceoffs won in OZ, %"] = deriveRateValue(faceoffsWonOz, faceoffsOz);
  }
}

function createMetricResolver(weights: KpiWeight[]) {
  const metricMap = new Map<string, string>();
  const metricNames = new Set(weights.map((weight) => weight.name));

  for (const weight of weights) {
    metricMap.set(canonicalizeColumnName(weight.name), weight.name);
  }

  for (const [alias, metricName] of Object.entries(metricColumnAliases)) {
    if (metricNames.has(metricName) && !metricMap.has(alias)) {
      metricMap.set(alias, metricName);
    }
  }

  return (columnName: string) => metricMap.get(canonicalizeColumnName(columnName));
}

const NON_STAT_UPLOAD_COLUMNS = new Set([
  canonicalizeColumnName("Date"),
  canonicalizeColumnName("Opponent"),
  canonicalizeColumnName("Result"),
  canonicalizeColumnName("Score"),
  canonicalizeColumnName("Home/Away"),
  canonicalizeColumnName("home_away"),
  canonicalizeColumnName("homeAway"),
  canonicalizeColumnName("Venue"),
  canonicalizeColumnName("Season"),
  canonicalizeColumnName("Summary"),
]);

function isNonStatUploadColumn(columnName: string) {
  return NON_STAT_UPLOAD_COLUMNS.has(canonicalizeColumnName(columnName));
}

export function parseWorkbook(
  buffer: ArrayBuffer,
  weights: KpiWeight[],
): ParsedUpload {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!firstSheet) {
    return {
      rows: [],
      previewColumns: [],
      matchedKpiCount: 0,
      missingRequiredColumns: ["Date", "Opponent", "Result or Score"],
    };
  }

  const rows = XLSX.utils.sheet_to_json<UploadRow>(firstSheet, {
    defval: null,
    raw: false,
  });
  const previewColumns = Object.keys(rows[0] ?? {});
  const missingRequiredColumns = [
    !previewColumns.includes("Date") ? "Date" : null,
    !previewColumns.includes("Opponent") ? "Opponent" : null,
    !previewColumns.includes("Result") && !previewColumns.includes("Score")
      ? "Result or Score"
      : null,
  ].filter((column): column is string => Boolean(column));
  const resolveMetricName = createMetricResolver(weights);
  const matchedKpiCount = new Set(
    previewColumns
      .map((column) => resolveMetricName(column))
      .filter((column): column is string => Boolean(column)),
  ).size;

  return {
    rows,
    previewColumns,
    matchedKpiCount,
    missingRequiredColumns,
  };
}

function inferResultBucket(
  goalsFor: number | null,
  goalsAgainst: number | null,
): ResultBucket {
  if (goalsFor === null || goalsAgainst === null) {
    return "tie";
  }

  if (goalsFor > goalsAgainst) {
    return "win";
  }

  if (goalsFor < goalsAgainst) {
    return "loss";
  }

  return "tie";
}

function parseScoreLine(scoreText: string) {
  const match = scoreText.trim().match(/(\d+)\s*[:\-]\s*(\d+)/);

  return {
    goalsFor: match ? Number(match[1]) : null,
    goalsAgainst: match ? Number(match[2]) : null,
  };
}

function formatResult(
  resultBucket: ResultBucket,
  goalsFor: number | null,
  goalsAgainst: number | null,
  fallback: string,
) {
  if (goalsFor === null || goalsAgainst === null) {
    return fallback.trim();
  }

  const prefix =
    resultBucket === "win" ? "W" : resultBucket === "loss" ? "L" : "T";

  return `${prefix} ${goalsFor}-${goalsAgainst}`;
}

function parseOutcome(row: UploadRow) {
  const resultValue = String(row.Result ?? "").trim();
  const scoreValue = String(row.Score ?? "").trim();
  const source = resultValue || scoreValue;
  const { goalsFor, goalsAgainst } = parseScoreLine(source);

  let resultBucket: ResultBucket;
  if (/^w/i.test(resultValue)) {
    resultBucket = "win";
  } else if (/^l/i.test(resultValue)) {
    resultBucket = "loss";
  } else if (/^t/i.test(resultValue)) {
    resultBucket = "tie";
  } else {
    resultBucket = inferResultBucket(goalsFor, goalsAgainst);
  }

  return {
    result: formatResult(resultBucket, goalsFor, goalsAgainst, source),
    resultBucket,
    goalsFor,
    goalsAgainst,
  };
}

function inferSeasonYear(month: number, season?: string) {
  if (season) {
    const match = season.match(/(\d{4})\D+(\d{4})/);
    if (match) {
      return month >= 7 ? Number(match[1]) : Number(match[2]);
    }
  }

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentSeasonStartYear = now.getUTCMonth() >= 6 ? currentYear : currentYear - 1;

  return month >= 7 ? currentSeasonStartYear : currentSeasonStartYear + 1;
}

function normalizeUploadDate(value: string | number | null, season?: string) {
  if (value === null || value === "") {
    return null;
  }

  const raw = String(value).trim();
  const dayMonthYearMatch = raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);

  if (dayMonthYearMatch) {
    const day = Number(dayMonthYearMatch[1]);
    const month = Number(dayMonthYearMatch[2]);
    const rawYear = dayMonthYearMatch[3];
    const year = rawYear
      ? rawYear.length === 2
        ? 2000 + Number(rawYear)
        : Number(rawYear)
      : inferSeasonYear(month, season);

    return new Date(Date.UTC(year, month - 1, day)).toISOString();
  }

  const parsedDate = new Date(raw);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
}

function seasonFromDate(dateValue: string) {
  const date = new Date(dateValue);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const startYear = month >= 6 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

function parseOpponentAndVenue(opponentValue: string) {
  const cleaned = opponentValue.trim();

  if (cleaned.startsWith("@")) {
    return {
      opponent: cleaned.replace(/^@\s*/, "").trim(),
      homeAway: "away" as const,
    };
  }

  if (/^vs\.?\s+/i.test(cleaned)) {
    return {
      opponent: cleaned.replace(/^vs\.?\s+/i, "").trim(),
      homeAway: "home" as const,
    };
  }

  return {
    opponent: cleaned,
    homeAway: "unknown" as const,
  };
}

function parseHomeAway(row: UploadRow, fallback: HomeAway) {
  const rawValue =
    row["Home/Away"] ??
    row.home_away ??
    row.homeAway ??
    row.Venue ??
    fallback;
  const normalized = String(rawValue ?? fallback).toLowerCase();

  if (normalized.includes("home") || /^vs\.?\b/.test(normalized)) {
    return "home" as const;
  }

  if (normalized.includes("away") || normalized.includes("@")) {
    return "away" as const;
  }

  if (normalized.includes("neutral")) {
    return "neutral" as const;
  }

  return fallback;
}

export function buildGamesFromUpload(
  rows: UploadRow[],
  weights: KpiWeight[],
  metaInput?: unknown,
): GameRecord[] {
  const meta = uploadMetaSchema.parse(metaInput ?? {});
  const resolveMetricName = createMetricResolver(weights);
  const candidateStatColumns = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter(
    (column) => {
      if (isNonStatUploadColumn(column)) {
        return false;
      }

      if (SUPPORT_STAT_NAMES.includes(column as (typeof SUPPORT_STAT_NAMES)[number])) {
        return true;
      }

      if (resolveMetricName(column)) {
        return true;
      }

      return rows.some((row) => {
        const numeric = parseNumericValue(column, column, row[column] ?? null);
        return numeric !== null;
      });
    },
  );

  return rows
    .filter((row) => row.Date && row.Opponent && (row.Result || row.Score))
    .map((row, index) => {
      const normalizedDate =
        normalizeUploadDate(row.Date, meta.season) ??
        new Date().toISOString();
      const parsedOpponent = parseOpponentAndVenue(String(row.Opponent));
      const outcome = parseOutcome(row);
      const stats = {
        ...Object.fromEntries(
          candidateStatColumns.map((column) => {
            const metricName = resolveMetricName(column) ?? column;
            const numeric = parseNumericValue(column, metricName, row[column] ?? null);

            return [metricName, Number.isFinite(numeric ?? NaN) ? numeric : null];
          }),
        ),
      };
      applyDerivedStats(row, stats);
      const rowHomeAway = parseHomeAway(row, "unknown");
      const homeAway =
        meta.homeAway && meta.homeAway !== "unknown"
          ? meta.homeAway
          : parsedOpponent.homeAway !== "unknown"
            ? parsedOpponent.homeAway
            : rowHomeAway;

      return {
        id: `${slugify(parsedOpponent.opponent)}-${normalizedDate}-${index}`,
        date: normalizedDate,
        opponent: parsedOpponent.opponent,
        result: outcome.result,
        resultBucket: outcome.resultBucket,
        season: meta.season || seasonFromDate(normalizedDate),
        homeAway,
        goalsFor: outcome.goalsFor,
        goalsAgainst: outcome.goalsAgainst,
        summary: meta.summary || null,
        source: "seed",
        stats,
      } satisfies GameRecord;
    });
}
