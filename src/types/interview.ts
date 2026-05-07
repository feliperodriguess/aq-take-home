/**
 * Shared Zod schemas + inferred TypeScript types for the AI Interviewer Platform.
 *
 * Conventions (per spec 01 §"OpenAI Structured Outputs caveat" and spec 04):
 * - Every optional field that participates in an OpenAI Structured Output MUST be
 *   `.optional().nullable()` (the Responses API rejects bare `.optional()`).
 * - Schemas live here so route handlers (specs 04/05) and components (specs 03/05)
 *   import the same source of truth — no untyped JSON over the wire.
 */

import { z } from "zod"

// ─── Decision-panel signals (spec 01) ────────────────────────────────────────

export const SignalsSchema = z.object({
  /** Skills the model believes are demonstrated, with confidence in [0,1]. */
  skillsDetected: z.array(
    z.object({
      skill: z.string(),
      confidence: z.number().min(0).max(1),
      /** Index of the candidate turn that supplied evidence; null if unspecific. */
      evidenceTurnIndex: z.number().int().nonnegative().optional().nullable(),
    }),
  ),
  /** Pack rubric competency names with at least weak evidence. */
  topicsCovered: z.array(z.string()),
  /** Pack rubric competency names without evidence yet. */
  gaps: z.array(z.string()),
  /** Why the model picked THIS next question. Surfaced verbatim in the panel. */
  rationale: z.string().min(1).max(500),
})
export type Signals = z.infer<typeof SignalsSchema>

// ─── Turn API contracts (spec 04) ────────────────────────────────────────────

export const TurnRequestSchema = z.object({
  sessionId: z.string().uuid(),
  /** Empty/undefined on the very first call — engine asks the opening question. */
  candidateUtterance: z.string().optional().nullable(),
})
export type TurnRequest = z.infer<typeof TurnRequestSchema>

export const TurnResponseSchema = z.object({
  /** Index of the assistant turn that was just persisted. */
  turnIndex: z.number().int().nonnegative(),
  /** Assistant's next question text. */
  question: z.string(),
  /** Pack item id if this turn was sourced from the pack; null for follow-ups. */
  packItemId: z.string().nullable(),
  signals: SignalsSchema,
  /** True iff engine + server guardrails agree the interview is complete. */
  isFinal: z.boolean(),
  /** 1–2 sentence justification surfaced in the decision panel. */
  rationale: z.string(),
})
export type TurnResponse = z.infer<typeof TurnResponseSchema>

// ─── OpenAI Structured Output for the interviewer engine (spec 04) ───────────
//
// NOTE: Spec 04 names this `EngineOutputSchema` and uses the field names
// `question`, `packItemId`, `isFollowUp`, `signals`, `isFinal` — those names
// are referenced verbatim by `src/lib/interviewer/engine.ts` and the prompt.
// We follow spec 04 here. The Wave-1 task description's alternate names
// (`nextQuestion`, `proposedIsFinal`, `rationale` at top level) are not used.

export const EngineOutputSchema = z.object({
  /** Exactly one sentence the interviewer says next. */
  question: z.string().min(1).max(600),
  /** Id from the pack if used; null for invented follow-ups. */
  packItemId: z.string().nullable(),
  /** True iff the question references the candidate's most recent answer. */
  isFollowUp: z.boolean(),
  signals: SignalsSchema,
  /** Engine's proposal for end-of-interview; route applies hard guardrails. */
  isFinal: z.boolean(),
})
export type EngineOutput = z.infer<typeof EngineOutputSchema>

// ─── Question pack (spec 01) ─────────────────────────────────────────────────

export const QuestionPackSchema = z.object({
  slug: z.string(),
  role: z.string(),
  rubric: z
    .array(
      z.object({
        competency: z.string(),
        weight: z.number().min(0).max(1),
        description: z.string(),
      }),
    )
    .min(3),
  items: z
    .array(
      z.object({
        id: z.string(),
        category: z.enum(["behavioral", "technical"]),
        competency: z.string(),
        prompt: z.string(),
        followUpHints: z.array(z.string()).default([]),
        difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
      }),
    )
    .min(8),
})
export type QuestionPack = z.infer<typeof QuestionPackSchema>

// ─── Final evaluation (spec 05) ──────────────────────────────────────────────

export const EvaluationSchema = z.object({
  overallScore: z.number().min(0).max(10),
  summary: z.string().min(1).max(800),
  strengths: z.array(z.string().min(1)).min(1).max(8),
  concerns: z.array(z.string().min(1)).max(8),
  perCompetency: z
    .array(
      z.object({
        competency: z.string(),
        score: z.number().min(0).max(10),
        notes: z.string(),
      }),
    )
    .max(10),
  recommendation: z.enum(["strong_hire", "hire", "lean_hire", "lean_no_hire", "no_hire"]),
})
export type Evaluation = z.infer<typeof EvaluationSchema>

// ─── STT route response (spec 04) ────────────────────────────────────────────

export const SttResponseSchema = z.object({
  transcript: z.string(),
  /** Total speech duration the provider reported, in seconds (0 when unknown). */
  durationSec: z.number().min(0),
})
export type SttResponse = z.infer<typeof SttResponseSchema>
