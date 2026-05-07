/**
 * POST /api/interview/end — finalize an active interview (spec 05).
 *
 * Algorithm:
 *   1. Validate body. Accept `force` either in the body or as `?force=true`.
 *   2. loadActiveSession (404 missing / 410 already ended).
 *   3. Load all turns ordered by index.
 *   4. Compute assistantCount + followUpCount; unless force=true and the
 *      thresholds are unmet → 409.
 *   5. Build evaluator prompt + call OpenAI. Upstream failure → 502.
 *   6. Insert evaluations row + update sessions to "completed". Unique
 *      session_id index dedupes concurrent end calls (23505 → noop).
 *   7. revalidatePath('/sessions/<id>') and return { ok, redirectTo }.
 *
 * Note (no-transaction caveat): neon-http does not support `db.transaction`,
 * so the two writes are sequenced as awaits. The unique index on
 * `evaluations.session_id` is the dedupe lock; on 23505 we treat it as a
 * concurrent end and proceed to mark the session completed (idempotent).
 */

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/db/drizzle"
import { evaluations, sessions, type Turn } from "@/db/schema"
import { evaluate } from "@/lib/evaluator/evaluate"
import { buildEvaluatorSystem, buildEvaluatorUser } from "@/lib/evaluator/prompt"
import { MIN_FOLLOWUPS, MIN_QUESTIONS } from "@/lib/interviewer/rules"
import { loadActiveSession, loadTurns } from "@/lib/session"
import type { Evaluation } from "@/types/interview"

const EndRequestSchema = z.object({
  sessionId: z.string().uuid(),
  force: z.boolean().optional(),
})

function errorJson(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status })
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const code = (err as { code?: unknown }).code
  if (code === "23505") return true
  const cause = (err as { cause?: unknown }).cause
  if (cause && typeof cause === "object" && (cause as { code?: unknown }).code === "23505") return true
  return false
}

function getMetaIsFollowUp(turn: Turn): boolean {
  const meta = turn.meta
  if (!meta || typeof meta !== "object") return false
  return (meta as { isFollowUp?: unknown }).isFollowUp === true
}

export async function POST(req: Request): Promise<NextResponse> {
  // 1. Body + query validation
  let body: unknown
  try {
    body = await req.json()
  } catch (err) {
    return errorJson(400, "bad_json", err instanceof Error ? err.message : "Invalid JSON")
  }
  const parsed = EndRequestSchema.safeParse(body)
  if (!parsed.success) {
    return errorJson(400, "invalid_body", parsed.error.message)
  }

  const url = new URL(req.url)
  const queryForce = url.searchParams.get("force") === "true"
  const force = parsed.data.force === true || queryForce
  const { sessionId } = parsed.data

  // 2. Load active session
  const loaded = await loadActiveSession(sessionId)
  if (loaded === null) return errorJson(404, "session_not_found", "Unknown sessionId")
  if (loaded === "ended") return errorJson(410, "session_ended", "Session is no longer active")
  const { session, job, pack } = loaded

  // 3. Load turns ordered by index
  const turns = await loadTurns(session.id)
  const assistantTurns = turns.filter((t) => t.role === "assistant")
  const assistantCount = assistantTurns.length
  const followUpCount = assistantTurns.filter(getMetaIsFollowUp).length

  // 4. Threshold check (skip when force=true)
  const belowThresholds = assistantCount < MIN_QUESTIONS || followUpCount < MIN_FOLLOWUPS
  if (!force && belowThresholds) {
    return errorJson(
      409,
      "below_thresholds",
      "Interview hasn't met the minimum question/follow-up threshold. Pass force=true to override.",
    )
  }
  const endedEarly = force && belowThresholds

  // 5. Build prompt + call evaluator (synchronous)
  const system = buildEvaluatorSystem({ job, pack })
  const user = buildEvaluatorUser({ turns, endedEarly })

  let ev: Evaluation
  try {
    ev = await evaluate({ system, user })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Evaluator call failed"
    return errorJson(502, "evaluator_upstream", message)
  }

  // 6. Persist — neon-http has no transactions; sequenced awaits + unique index dedupe.
  try {
    await db.insert(evaluations).values({
      sessionId: session.id,
      overallScore: ev.overallScore,
      payload: ev,
    })
  } catch (err) {
    if (!isUniqueViolation(err)) {
      const message = err instanceof Error ? err.message : "Failed to persist evaluation"
      return errorJson(500, "db_error", message)
    }
    // Concurrent end already wrote the evaluation — fall through and mark completed.
  }

  try {
    await db.update(sessions).set({ status: "completed", endedAt: new Date() }).where(eq(sessions.id, session.id))
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to mark session completed"
    return errorJson(500, "db_error", message)
  }

  // 7. Revalidate and respond
  revalidatePath(`/sessions/${session.id}`)
  return NextResponse.json({ ok: true, redirectTo: `/sessions/${session.id}` }, { status: 200 })
}
