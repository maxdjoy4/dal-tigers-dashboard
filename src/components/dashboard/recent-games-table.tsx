import { format } from "date-fns";

import type { AnalyticsBundle } from "@/lib/types";
import { getOpponentDisplayName, getOpponentFullName } from "@/lib/opponents";
import { ScoreBadge } from "@/components/ui/score-badge";

interface RecentGamesTableProps {
  games: AnalyticsBundle["recentGames"];
}

export function RecentGamesTable({ games }: RecentGamesTableProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10">
      <table className="min-w-full divide-y divide-white/10 text-left text-sm">
        <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-slate-400">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Opponent</th>
            <th className="px-4 py-3">Result</th>
            <th className="px-4 py-3">Venue</th>
            <th className="px-4 py-3">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {games.map((game) => (
            <tr key={game.id} className="bg-white/[0.02]">
              <td className="px-4 py-3 text-slate-200">
                {format(new Date(game.date), "MMM d, yyyy")}
              </td>
              <td
                className="px-4 py-3 font-medium text-white"
                title={getOpponentFullName(game.opponent)}
              >
                {getOpponentDisplayName(game.opponent)}
              </td>
              <td className="px-4 py-3 text-slate-200">{game.result}</td>
              <td className="px-4 py-3 capitalize text-slate-200">{game.homeAway}</td>
              <td className="px-4 py-3">
                <ScoreBadge score={game.score} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
