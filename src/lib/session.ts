/**
 * Session lookup helpers shared by the interview routes (spec 04 §"Session lookup").
 *
 * No cookie/token check — the session URL itself is the credential (per spec 00).
 * Each helper returns plain typed data; routes decide HTTP status codes.
 */

import { asc, eq } from "drizzle-orm"
import { loadPack, type QuestionPack } from "@/data/question-packs"
import { db } from "@/db/drizzle"
import type { Job, Session, Turn } from "@/db/schema"
import { jobs, sessions, turns } from "@/db/schema"

export interface LoadedSession {
  session: Session
  job: Job
  pack: QuestionPack
}

/**
 * Joins sessions ↔ jobs, then loads the JSON question pack via `loadPack`.
 * Returns `null` when the session id doesn't exist.
 */
export async function loadSession(sessionId: string): Promise<LoadedSession | null> {
  const rows = await db
    .select({ session: sessions, job: jobs })
    .from(sessions)
    .innerJoin(jobs, eq(sessions.jobId, jobs.id))
    .where(eq(sessions.id, sessionId))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  const pack = loadPack(row.job.questionPackSlug)
  return { session: row.session, job: row.job, pack }
}

/**
 * Like `loadSession` but distinguishes "ended" from "missing" so callers can
 * map to 404 vs 410. Returns:
 *   - `null` → session not found (HTTP 404)
 *   - `"ended"` → session exists but is not active (HTTP 410)
 *   - `LoadedSession` → ready for mutation
 */
export async function loadActiveSession(sessionId: string): Promise<LoadedSession | "ended" | null> {
  const loaded = await loadSession(sessionId)
  if (!loaded) return null
  if (loaded.session.status !== "active") return "ended"
  return loaded
}

/** Loads every turn for a session, ordered by `index` ascending. */
export async function loadTurns(sessionId: string): Promise<Turn[]> {
  return db.select().from(turns).where(eq(turns.sessionId, sessionId)).orderBy(asc(turns.index))
}
