/**
 * POST /api/interview/turn — the interview orchestrator (spec 04).
 *
 * Algorithm:
 *   1. Validate body. Load active session (404/410). Load all prior turns.
 *   2. If `candidateUtterance` is present, persist it as a candidate turn.
 *      The unique `(session_id, index)` index acts as the lock against
 *      double-submits — the second concurrent call hits 23505 → 409.
 *   3. Reload turns (so the engine sees the new candidate turn).
 *   4. Call OpenAI Structured Outputs via `runEngine`.
 *   5. Apply server-side guardrails (HARD_CAP / MIN_QUESTIONS / MIN_FOLLOWUPS).
 *   6. Persist the assistant turn with full meta in a transaction.
 *   7. Return `TurnResponseSchema`-shaped JSON.
 */

import { NextResponse } from "next/server"
import { db } from "@/db/drizzle"
import { type Turn, turns } from "@/db/schema"
import { runEngine } from "@/lib/interviewer/engine"
import { applyGuardrails } from "@/lib/interviewer/rules"
import { loadActiveSession, loadTurns } from "@/lib/session"
import { type EngineOutput, TurnRequestSchema, type TurnResponse } from "@/types/interview"

function errorJson(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status })
}

/** Postgres unique-violation SQLSTATE — emitted by Neon HTTP driver as `code: "23505"`. */
function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const code = (err as { code?: unknown }).code
  if (code === "23505") return true
  // Some drivers nest the error.
  const cause = (err as { cause?: unknown }).cause
  if (cause && typeof cause === "object" && (cause as { code?: unknown }).code === "23505") return true
  return false
}

export async function POST(req: Request): Promise<NextResponse> {
  // 1. Body validation
  let body: unknown
  try {
    body = await req.json()
  } catch (err) {
    return errorJson(400, "bad_json", err instanceof Error ? err.message : "Invalid JSON")
  }
  const parsed = TurnRequestSchema.safeParse(body)
  if (!parsed.success) {
    return errorJson(400, "invalid_body", parsed.error.message)
  }
  const { sessionId, candidateUtterance } = parsed.data

  // 2. Load session (active only)
  const loaded = await loadActiveSession(sessionId)
  if (loaded === null) return errorJson(404, "session_not_found", "Unknown sessionId")
  if (loaded === "ended") return errorJson(410, "session_ended", "Session is no longer active")
  const { session, job, pack } = loaded

  // 3. Snapshot prior turns to compute next index
  let priorTurns = await loadTurns(session.id)
  const nextIndex = priorTurns.length

  // 4. Persist candidate turn first (if present)
  const utteranceText = candidateUtterance?.trim()
  if (utteranceText) {
    try {
      await db.insert(turns).values({
        sessionId: session.id,
        role: "candidate",
        index: nextIndex,
        text: utteranceText,
      })
    } catch (err) {
      if (isUniqueViolation(err)) {
        return errorJson(409, "concurrent_turn", "Another submission won the race for this turn index")
      }
      const message = err instanceof Error ? err.message : "Failed to persist candidate turn"
      return errorJson(500, "db_error", message)
    }

    // Reload turns so the engine sees the candidate's new utterance.
    priorTurns = await loadTurns(session.id)
  }

  const assistantTurnIndex = priorTurns.length // index for the upcoming assistant turn

  // 5. Engine call
  let engineOut: EngineOutput
  try {
    engineOut = await runEngine({ session, job, pack, turns: priorTurns })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Engine call failed"
    return errorJson(502, "engine_upstream", message)
  }

  // 6. Server-side guardrails
  const priorAssistantCount = priorTurns.filter((t) => t.role === "assistant").length
  const priorFollowUpCount = priorTurns.filter((t) => t.role === "assistant" && getMetaIsFollowUp(t)).length

  const assistantCount = priorAssistantCount + 1 // including the one we're about to persist
  const followUpCount = priorFollowUpCount + (engineOut.isFollowUp ? 1 : 0)

  // Also: if the model claims a packItemId we've already used, null it out.
  const usedPackIds = new Set(
    priorTurns
      .filter((t) => t.role === "assistant")
      .map((t) => getMetaPackItemId(t))
      .filter((id): id is string => typeof id === "string"),
  )
  const sanitizedPackItemId =
    engineOut.packItemId && !usedPackIds.has(engineOut.packItemId) ? engineOut.packItemId : null

  const guardrail = applyGuardrails(
    { isFinal: engineOut.isFinal, isFollowUp: engineOut.isFollowUp },
    { assistantCount, followUpCount },
  )
  const finalIsFinal = guardrail.isFinal

  // Server-side text fallback: if the guardrail had to OVERRIDE the model's
  // isFinal=false (i.e. the cap fired and the model was still asking
  // questions), the persisted text is almost certainly a question. Swap it
  // for a deterministic closing remark so the candidate doesn't get cut off
  // mid-question. The prompt already nudges the model to produce a closing
  // when it knows the cap is imminent — this is the belt-and-suspenders.
  const finalQuestion = guardrail.overridden && finalIsFinal ? CLOSING_FALLBACK_TEXT : engineOut.question

  // 7. Persist assistant turn
  try {
    await db.insert(turns).values({
      sessionId: session.id,
      role: "assistant",
      index: assistantTurnIndex,
      text: finalQuestion,
      meta: {
        signals: engineOut.signals,
        packItemId: sanitizedPackItemId,
        rationale: engineOut.signals.rationale,
        isFollowUp: engineOut.isFollowUp,
        isFinal: finalIsFinal,
        guardrailOverridden: guardrail.overridden,
        guardrailReason: guardrail.reason ?? null,
        // Preserve the model's original output for debugging — the persisted
        // `text` may have been overridden above.
        modelOutput: engineOut,
        textOverridden: finalQuestion !== engineOut.question,
      },
    })
  } catch (err) {
    if (isUniqueViolation(err)) {
      return errorJson(409, "concurrent_turn", "Another assistant turn was persisted at this index")
    }
    const message = err instanceof Error ? err.message : "Failed to persist assistant turn"
    return errorJson(500, "db_error", message)
  }

  // 8. Build response
  const response: TurnResponse = {
    turnIndex: assistantTurnIndex,
    question: finalQuestion,
    packItemId: sanitizedPackItemId,
    signals: engineOut.signals,
    isFinal: finalIsFinal,
    rationale: engineOut.signals.rationale,
  }
  return NextResponse.json(response, { status: 200 })
}

/**
 * Deterministic closing line used when the model ignores the wrap-up hint
 * and produces another question past the cap. Kept short so the TTS lands
 * cleanly.
 */
const CLOSING_FALLBACK_TEXT =
  "Thanks so much for walking me through all of that. I have everything I need. We'll be in touch."

// ─── meta helpers ───────────────────────────────────────────────────────────
//
// Turn `meta` is stored as `jsonb` (untyped). We narrow defensively here so a
// hand-written or legacy row never crashes the route.

function getMetaIsFollowUp(turn: Turn): boolean {
  const meta = turn.meta
  if (!meta || typeof meta !== "object") return false
  return (meta as { isFollowUp?: unknown }).isFollowUp === true
}

function getMetaPackItemId(turn: Turn): string | null {
  const meta = turn.meta
  if (!meta || typeof meta !== "object") return null
  const value = (meta as { packItemId?: unknown }).packItemId
  return typeof value === "string" && value.length > 0 ? value : null
}
