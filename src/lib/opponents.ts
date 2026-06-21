interface OpponentAlias {
  short: string;
  full: string;
  matchers: string[];
}

const OPPONENT_ALIASES: OpponentAlias[] = [
  {
    short: "MTA",
    full: "Mount Allison Mounties",
    matchers: ["mount allison", "mounties", "mta"],
  },
  {
    short: "STU",
    full: "St. Thomas University",
    matchers: ["st thomas", "saint thomas", "tommies", "stu"],
  },
  {
    short: "SMU",
    full: "Saint Mary's Huskies",
    matchers: ["saint mary", "st mary", "huskies", "smu"],
  },
  {
    short: "STFX",
    full: "St. Francis Xavier University",
    matchers: ["st francis xavier", "saint francis xavier", "stfx", "x-women", "x women"],
  },
  {
    short: "UNB",
    full: "University of New Brunswick Reds",
    matchers: ["new brunswick", "unb", "reds"],
  },
  {
    short: "UPEI",
    full: "UPEI Panthers",
    matchers: ["prince edward island", "upei", "panthers"],
  },
  {
    short: "UdM",
    full: "Université de Moncton",
    matchers: ["universite de moncton", "université de moncton", "university of moncton", "moncton aigles bleues", "aigles bleues", "udm"],
  },
];

function normalizeOpponentName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findOpponentAlias(opponentName: string) {
  const normalized = normalizeOpponentName(opponentName);
  return OPPONENT_ALIASES.find((alias) =>
    alias.matchers.some((matcher) => normalized.includes(normalizeOpponentName(matcher))),
  );
}

export function getOpponentShortName(opponentName: string) {
  return findOpponentAlias(opponentName)?.short ?? opponentName;
}

export function getOpponentFullName(opponentName: string) {
  return findOpponentAlias(opponentName)?.full ?? opponentName;
}

export function getOpponentDisplayName(opponentName: string) {
  return getOpponentShortName(opponentName);
}

export function formatOpponentWithFullName(opponentName: string) {
  const shortName = getOpponentShortName(opponentName);
  const fullName = getOpponentFullName(opponentName);

  return shortName === fullName ? fullName : `${shortName} — ${fullName}`;
}

