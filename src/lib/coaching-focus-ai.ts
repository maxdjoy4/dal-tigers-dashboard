import { createHash } from "node:crypto";

import { z } from "zod";

import {
  buildRecommendationEvidenceBundle,
  generateMicroPriorityCard,
  generateStaffNoteData,
  generateTeamPriorityCard,
  type CoachingFocusMicroRecommendation,
  type CoachingFocusPageModel,
  type CoachingFocusStaffNoteData,
  type CoachingFocusTeamRecommendation,
} from "@/lib/coaching-focus";
import { hasOpenAIApiKey, hasSupabaseServiceRole, requireOpenAIApiKey } from "@/lib/env";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

const DEFAULT_MODEL = process.env.OPENAI_COACHING_FOCUS_MODEL || "gpt-4o-mini";

const aiOutputSchema = z.object({
  team_priorities: z.array(
    z.object({
      rank: z.number().int(),
      title: z.string(),
      priority_level: z.string(),
      coaching_diagnosis: z.string(),
      why_it_matters: z.string(),
      key_numbers: z.array(z.string()),
      team_practice_theme: z.string(),
      team_video_cue: z.string(),
      kpi_follow_up: z.array(z.string()),
      data_confidence: z.string(),
    }),
  ).length(3),
  micro_priorities: z.array(
    z.object({
      rank: z.number().int(),
      title: z.string(),
      individual_tactic_diagnosis: z.string(),
      why_it_matters: z.string(),
      key_numbers: z.array(z.string()),
      skill_detail_to_coach: z.array(z.string()),
      video_clips_to_pull: z.string(),
      practice_rep_idea: z.string(),
      kpi_follow_up: z.array(z.string()),
      data_confidence: z.string(),
    }),
  ).length(3),
  staff_note: z.object({
    title: z.string(),
    body: z.string(),
  }),
});

export interface CoachingFocusEvidenceBundle {
  season: string;
  snapshotId: string | null;
  uploadId: string | null;
  teamPriorities: ReturnType<typeof buildRecommendationEvidenceBundle>["teamPriorities"];
  microPriorities: ReturnType<typeof buildRecommendationEvidenceBundle>["microPriorities"];
  warnings: string[];
}

export interface StoredCoachingFocusBrief {
  season: string;
  evidenceHash: string;
  teamPriorities: CoachingFocusTeamRecommendation[];
  microPriorities: CoachingFocusMicroRecommendation[];
  staffNote: CoachingFocusStaffNoteData;
  generatedAt: string | null;
  modelUsed: string | null;
  fallbackUsed: boolean;
  evidenceBundle: Record<string, unknown> | null;
  aiOutput: Record<string, unknown> | null;
}

export interface CoachingFocusBriefPayload {
  season: string;
  snapshotId: string | null;
  uploadId: string | null;
  evidenceBundle: CoachingFocusEvidenceBundle;
  fallbackTeamPriorities: CoachingFocusTeamRecommendation[];
  fallbackMicroPriorities: CoachingFocusMicroRecommendation[];
  fallbackStaffNote: CoachingFocusStaffNoteData;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashEvidenceBundle(bundle: CoachingFocusEvidenceBundle) {
  return createHash("sha256").update(stableStringify(bundle)).digest("hex");
}

function isMissingRelationError(error: unknown) {
  return (
    error !== null &&
    typeof error === "object" &&
    (("code" in error &&
      ["42P01", "PGRST205"].includes(String((error as { code?: unknown }).code))) ||
      ("message" in error &&
        String((error as { message?: unknown }).message).includes("Could not find the table")))
  );
}

export function buildCoachingFocusEvidenceBundle(params: {
  season: string;
  snapshotId: string | null;
  uploadId: string | null;
  model: CoachingFocusPageModel;
}) {
  return {
    season: params.season,
    snapshotId: params.snapshotId,
    uploadId: params.uploadId,
    teamPriorities: buildRecommendationEvidenceBundle({
      teamCandidates: params.model.teamPriorities,
      individualCandidates: params.model.microPriorities,
    }).teamPriorities,
    microPriorities: buildRecommendationEvidenceBundle({
      teamCandidates: params.model.teamPriorities,
      individualCandidates: params.model.microPriorities,
    }).microPriorities,
    warnings: params.model.warnings,
  } satisfies CoachingFocusEvidenceBundle;
}

function buildFallbackBrief(model: CoachingFocusPageModel, evidenceHash: string): StoredCoachingFocusBrief {
  const teamPriorities = model.teamPriorities.map((priority, index) =>
    generateTeamPriorityCard(priority, index + 1),
  );
  const microPriorities = model.microPriorities.map((priority, index) =>
    generateMicroPriorityCard(priority, index + 1),
  );
  return {
    season: "",
    evidenceHash,
    teamPriorities,
    microPriorities,
    staffNote: generateStaffNoteData(model.staffNote),
    generatedAt: null,
    modelUsed: null,
    fallbackUsed: true,
    evidenceBundle: null,
    aiOutput: null,
  };
}

function buildFallbackBriefFromPayload(
  payload: CoachingFocusBriefPayload,
  evidenceHash: string,
): StoredCoachingFocusBrief {
  return {
    season: payload.season,
    evidenceHash,
    teamPriorities: payload.fallbackTeamPriorities,
    microPriorities: payload.fallbackMicroPriorities,
    staffNote: payload.fallbackStaffNote,
    generatedAt: null,
    modelUsed: null,
    fallbackUsed: true,
    evidenceBundle: payload.evidenceBundle as unknown as Record<string, unknown>,
    aiOutput: null,
  };
}

async function loadCachedBrief(evidenceHash: string) {
  if (!hasSupabaseServiceRole()) {
    return null;
  }

  try {
    const supabase = createServiceSupabaseClient();
    const { data, error } = await supabase
      .from("coaching_focus_briefs")
      .select(
        "season, evidence_hash, generated_at, model_used, fallback_used, team_priorities_json, micro_priorities_json, staff_note_json, evidence_bundle_json, ai_output_json",
      )
      .eq("evidence_hash", evidenceHash)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingRelationError(error)) {
        return null;
      }
      throw error;
    }

    if (!data) {
      return null;
    }

    return {
      season: String(data.season ?? ""),
      evidenceHash: String(data.evidence_hash ?? evidenceHash),
      teamPriorities: (data.team_priorities_json as CoachingFocusTeamRecommendation[]) ?? [],
      microPriorities: (data.micro_priorities_json as CoachingFocusMicroRecommendation[]) ?? [],
      staffNote: (data.staff_note_json as CoachingFocusStaffNoteData) ?? {
        title: "Staff Note",
        body: "",
      },
      generatedAt: data.generated_at ? String(data.generated_at) : null,
      modelUsed: data.model_used ? String(data.model_used) : null,
      fallbackUsed: Boolean(data.fallback_used),
      evidenceBundle: (data.evidence_bundle_json as Record<string, unknown> | null) ?? null,
      aiOutput: (data.ai_output_json as Record<string, unknown> | null) ?? null,
    } satisfies StoredCoachingFocusBrief;
  } catch {
    return null;
  }
}

async function saveBrief(params: {
  season: string;
  uploadId: string | null;
  snapshotId: string | null;
  createdBy: string | null;
  evidenceHash: string;
  brief: StoredCoachingFocusBrief;
}) {
  if (!hasSupabaseServiceRole()) {
    return;
  }

  try {
    const supabase = createServiceSupabaseClient();
    await supabase.from("coaching_focus_briefs").insert({
      season: params.season,
      upload_id: params.uploadId,
      snapshot_id: params.snapshotId,
      generated_at: new Date().toISOString(),
      model_used: params.brief.modelUsed,
      evidence_hash: params.evidenceHash,
      team_priorities_json: params.brief.teamPriorities,
      micro_priorities_json: params.brief.microPriorities,
      staff_note_json: params.brief.staffNote,
      data_confidence: params.brief.teamPriorities[0]?.dataConfidence ?? "Moderate confidence",
      created_by: params.createdBy,
      evidence_bundle_json: params.brief.evidenceBundle,
      ai_output_json: params.brief.aiOutput,
      fallback_used: params.brief.fallbackUsed,
    });
  } catch (error) {
    if (!isMissingRelationError(error)) {
      throw error;
    }
  }
}

async function callOpenAIForBrief(bundle: CoachingFocusEvidenceBundle) {
  const apiKey = requireOpenAIApiKey();
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.4,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "coaching_focus_brief",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              team_priorities: {
                type: "array",
                minItems: 3,
                maxItems: 3,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    rank: { type: "integer" },
                    title: { type: "string" },
                    priority_level: { type: "string" },
                    coaching_diagnosis: { type: "string" },
                    why_it_matters: { type: "string" },
                    key_numbers: { type: "array", items: { type: "string" } },
                    team_practice_theme: { type: "string" },
                    team_video_cue: { type: "string" },
                    kpi_follow_up: { type: "array", items: { type: "string" } },
                    data_confidence: { type: "string" },
                  },
                  required: [
                    "rank",
                    "title",
                    "priority_level",
                    "coaching_diagnosis",
                    "why_it_matters",
                    "key_numbers",
                    "team_practice_theme",
                    "team_video_cue",
                    "kpi_follow_up",
                    "data_confidence",
                  ],
                },
              },
              micro_priorities: {
                type: "array",
                minItems: 3,
                maxItems: 3,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    rank: { type: "integer" },
                    title: { type: "string" },
                    individual_tactic_diagnosis: { type: "string" },
                    why_it_matters: { type: "string" },
                    key_numbers: { type: "array", items: { type: "string" } },
                    skill_detail_to_coach: { type: "array", items: { type: "string" } },
                    video_clips_to_pull: { type: "string" },
                    practice_rep_idea: { type: "string" },
                    kpi_follow_up: { type: "array", items: { type: "string" } },
                    data_confidence: { type: "string" },
                  },
                  required: [
                    "rank",
                    "title",
                    "individual_tactic_diagnosis",
                    "why_it_matters",
                    "key_numbers",
                    "skill_detail_to_coach",
                    "video_clips_to_pull",
                    "practice_rep_idea",
                    "kpi_follow_up",
                    "data_confidence",
                  ],
                },
              },
              staff_note: {
                type: "object",
                additionalProperties: false,
                properties: {
                  title: { type: "string" },
                  body: { type: "string" },
                },
                required: ["title", "body"],
              },
            },
            required: ["team_priorities", "micro_priorities", "staff_note"],
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            "You are an elite women's hockey performance analyst and assistant coach. You turn calculated team/player/goalie evidence into practical coaching recommendations. You must only use the evidence provided. Do not invent numbers, players, trends, or causes. Write in concise, coach-facing language. Separate macro team priorities from micro skill details. Do not discuss line combinations, archetypes, or player criticism on the main page. Return JSON only.",
        },
        {
          role: "user",
          content: `Generate the Coaching Focus page recommendations from this evidence bundle. Return JSON only. Create exactly three team priorities, exactly three micro priorities, and one staff note. Make the recommendations specific, practical, and grounded in the evidence. Run a redundancy check before finalizing so the three team priorities are distinct and the three micro priorities are distinct.\n\n${JSON.stringify(bundle)}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with ${response.status}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI response did not include structured content.");
  }
  return aiOutputSchema.parse(JSON.parse(content));
}

function mergeAiWithEvidence(params: {
  model: CoachingFocusPageModel;
  parsed: z.infer<typeof aiOutputSchema>;
  evidenceHash: string;
  evidenceBundle: CoachingFocusEvidenceBundle;
}): StoredCoachingFocusBrief {
  const teamPriorities = params.model.teamPriorities.map((priority, index) => {
    const ai = params.parsed.team_priorities[index];
    const base = generateTeamPriorityCard(priority, index + 1);
    return {
      ...base,
      title: ai?.title || base.title,
      coachingDiagnosis: ai?.coaching_diagnosis || base.coachingDiagnosis,
      whyItMatters: ai?.why_it_matters || base.whyItMatters,
      teamPracticeTheme: ai?.team_practice_theme || base.teamPracticeTheme,
      teamVideoCue: ai?.team_video_cue || base.teamVideoCue,
    } satisfies CoachingFocusTeamRecommendation;
  });

  const microPriorities = params.model.microPriorities.map((priority, index) => {
    const ai = params.parsed.micro_priorities[index];
    const base = generateMicroPriorityCard(priority, index + 1);
    return {
      ...base,
      title: ai?.title || base.title,
      individualTacticDiagnosis:
        ai?.individual_tactic_diagnosis || base.individualTacticDiagnosis,
      whyItMatters: ai?.why_it_matters || base.whyItMatters,
      skillDetailToCoach: ai?.skill_detail_to_coach || base.skillDetailToCoach,
      videoClipsToPull: ai?.video_clips_to_pull || base.videoClipsToPull,
      practiceRepIdea: ai?.practice_rep_idea || base.practiceRepIdea,
    } satisfies CoachingFocusMicroRecommendation;
  });

  return {
    season: params.evidenceBundle.season,
    evidenceHash: params.evidenceHash,
    teamPriorities,
    microPriorities,
    staffNote: params.parsed.staff_note,
    generatedAt: new Date().toISOString(),
    modelUsed: DEFAULT_MODEL,
    fallbackUsed: false,
    evidenceBundle: params.evidenceBundle as unknown as Record<string, unknown>,
    aiOutput: params.parsed as unknown as Record<string, unknown>,
  };
}

export async function resolveCoachingFocusBrief(params: {
  season: string;
  snapshotId: string | null;
  uploadId: string | null;
  model: CoachingFocusPageModel;
  forceRegenerate?: boolean;
  createdBy?: string | null;
}) {
  const evidenceBundle = buildCoachingFocusEvidenceBundle({
    season: params.season,
    snapshotId: params.snapshotId,
    uploadId: params.uploadId,
    model: params.model,
  });
  const evidenceHash = hashEvidenceBundle(evidenceBundle);
  const cached = !params.forceRegenerate ? await loadCachedBrief(evidenceHash) : null;
  if (cached) {
    return cached;
  }

  const fallback = buildFallbackBrief(params.model, evidenceHash);
  fallback.season = params.season;
  fallback.evidenceBundle = evidenceBundle as unknown as Record<string, unknown>;

  if (!hasOpenAIApiKey()) {
    return {
      ...fallback,
      aiOutput: null,
    };
  }

  try {
    const parsed = await callOpenAIForBrief(evidenceBundle);
    const brief = mergeAiWithEvidence({
      model: params.model,
      parsed,
      evidenceHash,
      evidenceBundle,
    });
    await saveBrief({
      season: params.season,
      uploadId: params.uploadId,
      snapshotId: params.snapshotId,
      createdBy: params.createdBy ?? null,
      evidenceHash,
      brief,
    });
    return brief;
  } catch {
    const failedBrief = {
      ...fallback,
      aiOutput: {
        note: "AI summary unavailable; showing calculation-based fallback.",
      },
    };
    await saveBrief({
      season: params.season,
      uploadId: params.uploadId,
      snapshotId: params.snapshotId,
      createdBy: params.createdBy ?? null,
      evidenceHash,
      brief: failedBrief,
    });
    return failedBrief;
  }
}

export async function resolveCoachingFocusBriefFromPayload(params: {
  payload: CoachingFocusBriefPayload;
  forceRegenerate?: boolean;
  createdBy?: string | null;
}) {
  const evidenceHash = hashEvidenceBundle(params.payload.evidenceBundle);
  const cached = !params.forceRegenerate ? await loadCachedBrief(evidenceHash) : null;
  if (cached) {
    return cached;
  }

  const fallback = buildFallbackBriefFromPayload(params.payload, evidenceHash);

  if (!hasOpenAIApiKey()) {
    return fallback;
  }

  try {
    const parsed = await callOpenAIForBrief(params.payload.evidenceBundle);
    const brief: StoredCoachingFocusBrief = {
      season: params.payload.season,
      evidenceHash,
      teamPriorities: params.payload.fallbackTeamPriorities.map((priority, index) => ({
        ...priority,
        rank: index + 1,
        title: parsed.team_priorities[index]?.title || priority.title,
        coachingDiagnosis:
          parsed.team_priorities[index]?.coaching_diagnosis || priority.coachingDiagnosis,
        whyItMatters:
          parsed.team_priorities[index]?.why_it_matters || priority.whyItMatters,
        teamPracticeTheme:
          parsed.team_priorities[index]?.team_practice_theme || priority.teamPracticeTheme,
        teamVideoCue:
          parsed.team_priorities[index]?.team_video_cue || priority.teamVideoCue,
      })),
      microPriorities: params.payload.fallbackMicroPriorities.map((priority, index) => ({
        ...priority,
        rank: index + 1,
        title: parsed.micro_priorities[index]?.title || priority.title,
        individualTacticDiagnosis:
          parsed.micro_priorities[index]?.individual_tactic_diagnosis ||
          priority.individualTacticDiagnosis,
        whyItMatters:
          parsed.micro_priorities[index]?.why_it_matters || priority.whyItMatters,
        skillDetailToCoach:
          parsed.micro_priorities[index]?.skill_detail_to_coach || priority.skillDetailToCoach,
        videoClipsToPull:
          parsed.micro_priorities[index]?.video_clips_to_pull || priority.videoClipsToPull,
        practiceRepIdea:
          parsed.micro_priorities[index]?.practice_rep_idea || priority.practiceRepIdea,
      })),
      staffNote: parsed.staff_note,
      generatedAt: new Date().toISOString(),
      modelUsed: DEFAULT_MODEL,
      fallbackUsed: false,
      evidenceBundle: params.payload.evidenceBundle as unknown as Record<string, unknown>,
      aiOutput: parsed as unknown as Record<string, unknown>,
    };
    await saveBrief({
      season: params.payload.season,
      uploadId: params.payload.uploadId,
      snapshotId: params.payload.snapshotId,
      createdBy: params.createdBy ?? null,
      evidenceHash,
      brief,
    });
    return brief;
  } catch {
    const failedBrief = {
      ...fallback,
      aiOutput: {
        note: "AI summary unavailable; showing calculation-based fallback.",
      },
    };
    await saveBrief({
      season: params.payload.season,
      uploadId: params.payload.uploadId,
      snapshotId: params.payload.snapshotId,
      createdBy: params.createdBy ?? null,
      evidenceHash,
      brief: failedBrief,
    });
    return failedBrief;
  }
}
