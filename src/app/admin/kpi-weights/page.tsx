import { requireAdminUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/data";
import { getPlayerGoalieWeightEditorData } from "@/lib/player-goalie-data";
import { KpiWeightsEditor } from "@/components/admin/kpi-weights-editor";
import { PlayerGoalieKpiWeightsEditor } from "@/components/admin/player-goalie-kpi-weights-editor";
import { DemoBanner } from "@/components/ui/demo-banner";
import { PageHero } from "@/components/ui/page-hero";
import { Panel } from "@/components/ui/panel";

export default async function KpiWeightsPage() {
  await requireAdminUser();

  const [source, playerGoalieWeights] = await Promise.all([
    getDashboardData(),
    getPlayerGoalieWeightEditorData(),
  ]);

  return (
    <>
      <PageHero
        eyebrow="KPI Weight Settings"
        title="Tune the scoring model without rebuilding the dashboard."
        description="Adjust KPI categories, weights, and scoring direction from one admin-only screen. The team score recalculates from the saved weight table."
      />
      <DemoBanner isDemoMode={source.demoMode} />
      <Panel
        eyebrow="Weight Editor"
        title="Live KPI weight controls"
        description="Each KPI keeps its own weight, category, and direction so the score model stays flexible."
      >
        <KpiWeightsEditor weights={source.weights} isDemoMode={source.demoMode} />
      </Panel>
      <Panel
        eyebrow="Player + Goalie Weight Editor"
        title="Player-goalie KPI customization"
        description="Adjust the stored skater and goalie KPI models from the same admin page. These edits save to the player_metric_weights and goalie_metric_weights tables so the model stays changeable later."
      >
        <div className="space-y-8">
          <PlayerGoalieKpiWeightsEditor
            title="Skater KPI weights"
            description="Forward and Defense metric weights currently stored in Supabase."
            weights={playerGoalieWeights.skaterWeights}
            isDemoMode={playerGoalieWeights.isDemoMode}
          />
          <PlayerGoalieKpiWeightsEditor
            title="Goalie KPI weights"
            description="Goalie metric weights currently stored in Supabase."
            weights={playerGoalieWeights.goalieWeights}
            isDemoMode={playerGoalieWeights.isDemoMode}
          />
        </div>
      </Panel>
    </>
  );
}
