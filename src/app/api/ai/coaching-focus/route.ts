import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import {
  resolveCoachingFocusBriefFromPayload,
  type CoachingFocusEvidenceBundle,
} from "@/lib/coaching-focus-ai";
import { hasSupabaseEnv } from "@/lib/env";

const recommendationArray = z.array(z.string());

const evidenceBundleSchema = z.object({
  season: z.string(),
  snapshotId: z.string().nullable(),
  uploadId: z.string().nullable(),
  teamPriorities: z.array(z.object({
    priorityId: z.string(),
    priorityTitle: z.string(),
    priorityScore: z.number(),
    priorityLevel: z.string(),
    teamMetricsUsed: z.array(z.string()),
    playerMetricsUsed: z.array(z.string()),
    goalieMetricsUsed: z.array(z.string()),
    weaknessSeverity: z.number(),
    teamModelImportance: z.number(),
    playerPatternSupport: z.number(),
    reliabilityScore: z.number(),
    confidenceLabel: z.string(),
    generatedDrillTheme: z.string(),
    generatedVideoCue: z.string(),
    generatedKpiFollowUp: z.array(z.string()),
  })),
  microPriorities: z.array(z.object({
    microPriorityId: z.string(),
    microPriorityTitle: z.string(),
    microPriorityScore: z.number(),
    linkedTeamPriority: z.string(),
    microSkillCategory: z.string(),
    playerMetricsUsed: z.array(z.string()),
    groupPatternCount: z.number(),
    fixabilityScore: z.number(),
    skillSpecificityScore: z.number(),
    reliabilityScore: z.number(),
    confidenceLabel: z.string(),
    generatedPracticeRep: z.string(),
    generatedVideoCue: z.string(),
    generatedKpiFollowUp: z.array(z.string()),
  })),
  warnings: z.array(z.string()),
});

const teamRecommendationSchema = z.object({
  rank: z.number().int(),
  title: z.string(),
  priorityLevel: z.string(),
  coachingDiagnosis: z.string(),
  whyItMatters: z.string(),
  compareNote: z.string().nullable(),
  keyNumbers: recommendationArray,
  playersGroupsConnected: recommendationArray,
  teamPracticeTheme: z.string(),
  teamVideoCue: z.string(),
  kpiFollowUp: recommendationArray,
  dataConfidence: z.enum([
    "High confidence",
    "Moderate confidence",
    "Low confidence",
    "Data limited",
  ]),
});

const microRecommendationSchema = z.object({
  rank: z.number().int(),
  title: z.string(),
  individualTacticDiagnosis: z.string(),
  whyItMatters: z.string(),
  compareNote: z.string().nullable(),
  keyNumbers: recommendationArray,
  skillDetailToCoach: recommendationArray,
  videoClipsToPull: z.string(),
  practiceRepIdea: z.string(),
  kpiFollowUp: recommendationArray,
  dataConfidence: z.enum([
    "High confidence",
    "Moderate confidence",
    "Low confidence",
    "Data limited",
  ]),
});

const payloadSchema = z.object({
  season: z.string(),
  snapshotId: z.string().nullable(),
  uploadId: z.string().nullable(),
  forceRegenerate: z.boolean().optional(),
  evidenceBundle: evidenceBundleSchema,
  fallbackTeamPriorities: z.array(teamRecommendationSchema).length(3),
  fallbackMicroPriorities: z.array(microRecommendationSchema).length(3),
  fallbackStaffNote: z.object({
    title: z.string(),
    body: z.string(),
  }),
});

export async function POST(request: Request) {
  if (hasSupabaseEnv()) {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { message: "Sign in before generating an AI coaching brief." },
        { status: 401 },
      );
    }
  }

  const raw = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid coaching focus payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const user = hasSupabaseEnv() ? await getCurrentUser() : null;
  const brief = await resolveCoachingFocusBriefFromPayload({
    payload: {
      season: parsed.data.season,
      snapshotId: parsed.data.snapshotId,
      uploadId: parsed.data.uploadId,
      evidenceBundle:
        parsed.data.evidenceBundle as unknown as CoachingFocusEvidenceBundle,
      fallbackTeamPriorities: parsed.data.fallbackTeamPriorities,
      fallbackMicroPriorities: parsed.data.fallbackMicroPriorities,
      fallbackStaffNote: parsed.data.fallbackStaffNote,
    },
    forceRegenerate: parsed.data.forceRegenerate,
    createdBy: user?.id ?? null,
  });

  return NextResponse.json(brief);
}
