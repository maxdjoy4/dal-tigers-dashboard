import { NextResponse } from "next/server";
import { z } from "zod";

import { isCurrentUserAdmin } from "@/lib/auth";
import { hasSupabaseServiceRole } from "@/lib/env";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

const payloadSchema = z.object({
  weights: z.array(
    z.object({
      id: z.string(),
      category: z.enum(["offense", "defense", "special_teams"]),
      direction: z.enum(["higher_is_better", "lower_is_better"]),
      weight: z.number(),
      rValue: z.number(),
    }),
  ),
});

export async function PATCH(request: Request) {
  const body = await request.json();
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid KPI weight payload." },
      { status: 400 },
    );
  }

  if (!hasSupabaseServiceRole()) {
    return NextResponse.json({
      message:
        "Demo mode: KPI changes were updated locally in the UI but not persisted because Supabase is not configured.",
    });
  }

  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) {
    return NextResponse.json(
      { message: "Only admin users can update KPI weights." },
      { status: 401 },
    );
  }

  const supabase = createServiceSupabaseClient();

  const updates = await Promise.all(
    parsed.data.weights.map((weight) =>
      supabase
        .from("kpi_weights")
        .update({
          category: weight.category,
          direction: weight.direction,
          weight: weight.weight,
          r_value: weight.rValue,
        })
        .eq("id", weight.id),
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
    message: "KPI weights saved to Supabase.",
  });
}
