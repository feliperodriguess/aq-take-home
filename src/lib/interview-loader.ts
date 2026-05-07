/**
 * Server-side helper that hydrates everything needed to render an interview
 * (the room in spec 03 *and* the results page in spec 05).
 *
 * Returns `null` when the session id doesn't exist so callers can map to
 * `notFound()`.
 */

import type { Job, Session, Turn } from "@/db/schema"
import { loadSession, loadTurns } from "@/lib/session"

export interface LoadedInterview {
  session: Session
  job: Job
  turns: Turn[]
}

export async function loadInterview(sessionId: string): Promise<LoadedInterview | null> {
  const loaded = await loadSession(sessionId)
  if (!loaded) return null
  const turns = await loadTurns(sessionId)
  return { session: loaded.session, job: loaded.job, turns }
}
