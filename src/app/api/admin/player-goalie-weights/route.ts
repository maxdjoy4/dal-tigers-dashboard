import { NextResponse } from "next/server";
import { z } from "zod";

import { isCurrentUserAdmin } from "@/lib/auth";
import { hasSupabaseServiceRole } from "@/lib/env";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

const payloadSchema = z.object({
  weights: z.array(
    z.object({
      id: z.string(),
      sourceTable: z.enum(["player_metric_weights", "goalie_metric_weights"]),
      category: z.string().min(1),
      direction: z.enum([
        "higher_is_better",
        "lower_is_better",
        "context_dependent",
      ]),
      metricWeightInCategoryPct: z.number(),
      finalWeightPct: z.number(),
      includeInV1Score: z.boolean(),
    }),
  ),
});

export async function PATCH(request: Request) {
  const body = await request.json();
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid player-goalie weight payload." },
      { status: 400 },
    );
  }

  if (!hasSupabaseServiceRole()) {
    return NextResponse.json({
      message:
        "Demo mode: player-goalie KPI changes were updated locally in the UI but not persisted because Supabase is not configured.",
    });
  }

  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) {
    return NextResponse.json(
      { message: "Only admin users can update player-goalie KPI weights." },
      { status: 401 },
    );
  }

  const supabase = createServiceSupabaseClient();

  const updates = await Promise.all(
    parsed.data.weights.map((weight) =>
      supabase
        .from(weight.sourceTable)
        .update({
          category: weight.category,
          direction: weight.direction,
          metric_weight_in_category_pct: weight.metricWeightInCategoryPct,
          final_weight_pct: weight.finalWeightPct,
          include_in_v1_score: weight.includeInV1Score,
        })
        .eq("metric_weight_id", weight.id),
    ),
  );

  const failedUpdate = updates.find((update) => update.error);
  if (failedUpdate?.error) {
    return NextResponse.json(
      { message: failedUpdate.error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    message: "Player-goalie KPI weights saved to Supabase.",
  });
}
