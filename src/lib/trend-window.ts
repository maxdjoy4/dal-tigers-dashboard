export const TREND_WINDOW_GAMES = 4;
export const FALLBACK_TREND_WINDOW_GAMES = 3;
export const MIN_GAMES_FOR_TREND_WINDOW = TREND_WINDOW_GAMES * 2;
export const MIN_GAMES_FOR_FALLBACK_TREND_WINDOW = FALLBACK_TREND_WINDOW_GAMES * 2;

// Kept for URL/query compatibility even though the live window is now 4 games.
export const RECENT_RANGE_FILTER_VALUE = "last5";

export function getTrendComparisonWindow(count: number) {
  if (count >= MIN_GAMES_FOR_TREND_WINDOW) {
    return TREND_WINDOW_GAMES;
  }

  if (count >= MIN_GAMES_FOR_FALLBACK_TREND_WINDOW) {
    return FALLBACK_TREND_WINDOW_GAMES;
  }

  return 0;
}
