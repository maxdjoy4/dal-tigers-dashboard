import { requireAdminUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/data";
import { getPlayerGoalieData } from "@/lib/player-goalie-data";
import { UploadWorkbench } from "@/components/admin/upload-workbench";
import { PlayerGoalieImportWorkbench } from "@/components/admin/player-goalie-import-workbench";
import { DemoBanner } from "@/components/ui/demo-banner";
import { PageHero } from "@/components/ui/page-hero";
import { Panel } from "@/components/ui/panel";

export default async function AdminUploadPage() {
  await requireAdminUser();

  const [source, playerGoalieData] = await Promise.all([
    getDashboardData(),
    getPlayerGoalieData(),
  ]);

  return (
    <>
      <PageHero
        eyebrow="Admin Upload"
        title="Preview, validate, and save one new game at a time."
        description="Game uploads are validated against the KPI model before they are saved. Once stored in Supabase, all public dashboards refresh automatically from the permanent game log."
      />
      <DemoBanner isDemoMode={source.demoMode} />
      <Panel
        eyebrow="Upload Flow"
        title="Game data ingestion"
        description="Upload a single game file, review the parsed rows, confirm the KPI matches, and save."
      >
        <UploadWorkbench
          weights={source.weights}
          isDemoMode={source.demoMode}
          savedGames={source.demoMode ? [] : source.games.map((game) => ({
            id: game.id,
            date: game.date,
            opponent: game.opponent,
            result: game.result,
            season: game.season,
            homeAway: game.homeAway,
          }))}
        />
      </Panel>
      <Panel
        eyebrow="Player + Goalie Model"
        title="Broad ingest, selective scoring"
        description="Upload aggregate skater and goalie season files. Most Instat stats are stored as context, while scores are calculated only from the weighted KPI tables already saved in Supabase."
      >
        <PlayerGoalieImportWorkbench
          isDemoMode={source.demoMode}
          storedPlayerCount={playerGoalieData.storedSkaterDataCount}
          storedGoalieCount={playerGoalieData.storedGoalieDataCount}
          storedSeasons={playerGoalieData.seasons}
        />
      </Panel>
    </>
  );
}
