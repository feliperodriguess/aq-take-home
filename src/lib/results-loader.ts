/**
 * Results bundle loader for /sessions/[sessionId] (spec 05).
 *
 * Joins sessions ↔ jobs in one Drizzle query, then loads turns + evaluation.
 * The evaluation row is read separately (it may not exist yet for an active
 * session). Payload is defensively re-validated against `EvaluationSchema` so
 * a hand-written / drifted row never crashes the page — we log + return null
 * for the parsed evaluation but still surface the stored overallScore.
 */

import { asc, eq } from "drizzle-orm"
import { loadPack } from "@/data/question-packs"
import { db } from "@/db/drizzle"
import type { Job, Session, Turn } from "@/db/schema"
import { evaluations, jobs, sessions, turns as turnsTable } from "@/db/schema"
import { type Evaluation, EvaluationSchema, type QuestionPack } from "@/types/interview"

export interface ResultsBundle {
  session: Session
  job: Job
  pack: QuestionPack
  turns: Turn[]
  /** Null while session is still active or evaluation row missing. */
  evaluation: Evaluation | null
  evaluationOverallScore: number | null
}

export async function loadResults(sessionId: string): Promise<ResultsBundle | null> {
  // Single-shot join for session + job.
  const sessionRows = await db
    .select({ session: sessions, job: jobs })
    .from(sessions)
    .innerJoin(jobs, eq(sessions.jobId, jobs.id))
    .where(eq(sessions.id, sessionId))
    .limit(1)

  const sessionRow = sessionRows[0]
  if (!sessionRow) return null

  const pack = loadPack(sessionRow.job.questionPackSlug)

  // Turns ordered by index ascending (transcript display order).
  const turns = await db
    .select()
    .from(turnsTable)
    .where(eq(turnsTable.sessionId, sessionId))
    .orderBy(asc(turnsTable.index))

  // Evaluation may be absent (active session, or a race-window between insert
  // and update). We read both the row's overallScore + payload independently.
  const evalRows = await db.select().from(evaluations).where(eq(evaluations.sessionId, sessionId)).limit(1)

  let evaluation: Evaluation | null = null
  let evaluationOverallScore: number | null = null

  const evalRow = evalRows[0]
  if (evalRow) {
    evaluationOverallScore = evalRow.overallScore
    const parsed = EvaluationSchema.safeParse(evalRow.payload)
    if (parsed.success) {
      evaluation = parsed.data
    } else {
      // Defensive: schema drift or corrupt write. Surface score only.
      console.error(
        `loadResults: evaluations.payload failed schema parse for session ${sessionId}:`,
        parsed.error.message,
      )
    }
  }

  return {
    session: sessionRow.session,
    job: sessionRow.job,
    pack,
    turns,
    evaluation,
    evaluationOverallScore,
  }
}
