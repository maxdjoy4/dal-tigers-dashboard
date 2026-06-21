"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { getOpponentShortName } from "@/lib/opponents";
import { RECENT_RANGE_FILTER_VALUE, TREND_WINDOW_GAMES } from "@/lib/trend-window";
import type { DashboardFilters, FilterOptions } from "@/lib/types";

interface FilterBarProps {
  filters: DashboardFilters;
  options: FilterOptions;
  variant?: "default" | "opponent-first";
  requireOpponentSelection?: boolean;
}

const baseSelectClassName = "select-gold";

export function FilterBar({
  filters,
  options,
  variant = "default",
  requireOpponentSelection = false,
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    router.push(`${pathname}?${params.toString()}`);
  }

  const configs =
    variant === "opponent-first"
      ? [
          {
            key: "opponent",
            value: filters.opponent,
            className: "md:col-span-2 xl:col-span-2",
            options: [
              ...(requireOpponentSelection
                ? []
                : [
                    <option key="all-opponents" value="all">
                      All opponents
                    </option>,
                  ]),
              ...options.opponents.map((opponent) => (
                <option key={opponent} value={opponent}>
                  {getOpponentShortName(opponent)}
                </option>
              )),
            ],
          },
          {
            key: "season",
            value: filters.season,
            options: [
              <option key="all-seasons" value="all">
                All seasons
              </option>,
              ...options.seasons.map((season) => (
                <option key={season} value={season}>
                  {season}
                </option>
              )),
            ],
          },
          {
            key: "range",
            value: filters.range,
            options: [
              <option key="all-range" value="all">
                Full range
              </option>,
              <option key={RECENT_RANGE_FILTER_VALUE} value={RECENT_RANGE_FILTER_VALUE}>
                Last {TREND_WINDOW_GAMES} games
              </option>,
            ],
          },
          {
            key: "homeAway",
            value: filters.homeAway,
            options: [
              <option key="all-home-away" value="all">
                Home and away
              </option>,
              <option key="home" value="home">
                Home
              </option>,
              <option key="away" value="away">
                Away
              </option>,
              <option key="neutral" value="neutral">
                Neutral
              </option>,
              <option key="unknown" value="unknown">
                Unknown
              </option>,
            ],
          },
          {
            key: "result",
            value: filters.result,
            options: [
              <option key="all-results" value="all">
                All results
              </option>,
              <option key="win" value="win">
                Wins
              </option>,
              <option key="loss" value="loss">
                Losses
              </option>,
              <option key="tie" value="tie">
                Ties
              </option>,
            ],
          },
        ]
      : [
          {
            key: "season",
            value: filters.season,
            options: [
              <option key="all-seasons" value="all">
                All seasons
              </option>,
              ...options.seasons.map((season) => (
                <option key={season} value={season}>
                  {season}
                </option>
              )),
            ],
          },
          {
            key: "range",
            value: filters.range,
            options: [
              <option key="all-range" value="all">
                Full range
              </option>,
              <option key={RECENT_RANGE_FILTER_VALUE} value={RECENT_RANGE_FILTER_VALUE}>
                Last {TREND_WINDOW_GAMES} games
              </option>,
            ],
          },
          {
            key: "opponent",
            value: filters.opponent,
            options: [
              <option key="all-opponents" value="all">
                All opponents
              </option>,
              ...options.opponents.map((opponent) => (
                <option key={opponent} value={opponent}>
                  {getOpponentShortName(opponent)}
                </option>
              )),
            ],
          },
          {
            key: "homeAway",
            value: filters.homeAway,
            options: [
              <option key="all-home-away" value="all">
                Home and away
              </option>,
              <option key="home" value="home">
                Home
              </option>,
              <option key="away" value="away">
                Away
              </option>,
              <option key="neutral" value="neutral">
                Neutral
              </option>,
              <option key="unknown" value="unknown">
                Unknown
              </option>,
            ],
          },
          {
            key: "result",
            value: filters.result,
            options: [
              <option key="all-results" value="all">
                All results
              </option>,
              <option key="win" value="win">
                Wins
              </option>,
              <option key="loss" value="loss">
                Losses
              </option>,
              <option key="tie" value="tie">
                Ties
              </option>,
            ],
          },
        ];

  return (
    <div
      className={
        variant === "opponent-first"
          ? "grid gap-3 md:grid-cols-2 xl:grid-cols-6"
          : "grid gap-3 md:grid-cols-5"
      }
    >
      {configs.map((config) => (
        <div key={config.key} className={config.className}>
          <select
            className={baseSelectClassName}
            value={String(config.value)}
            onChange={(event) => updateParam(config.key, event.target.value)}
          >
            {config.options}
          </select>
        </div>
      ))}
    </div>
  );
}
