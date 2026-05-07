/**
 * History list loader for `/history`. One Drizzle query joins sessions ↔
 * jobs ↔ evaluations and counts assistant turns per session in the same shot.
 * Rows are enriched with the slug-based company preset so the view layer
 * stays presentational.
 *
 * No filtering by user / status — single-tenant demo, all sessions surface.
 */

import { desc, eq, sql } from "drizzle-orm"

import { db } from "@/db/drizzle"
import type { Session } from "@/db/schema"
import { evaluations, jobs, sessions, turns } from "@/db/schema"
import { presetForSlug } from "@/lib/jobs-presentation"

export interface HistoryRow {
  sessionId: string
  status: Session["status"]
  startedAt: Date
  endedAt: Date | null
  jobSlug: string
  jobTitle: string
  company: string
  /** Null for sessions without an evaluations row (active, abandoned, or pre-eval race). */
  overallScore: number | null
  /** Count of assistant turns asked so far — the "N Q" detail pill. */
  questionCount: number
}

export async function loadHistory(): Promise<HistoryRow[]> {
  const rows = await db
    .select({
      sessionId: sessions.id,
      status: sessions.status,
      startedAt: sessions.startedAt,
      endedAt: sessions.endedAt,
      jobSlug: jobs.slug,
      jobTitle: jobs.title,
      overallScore: evaluations.overallScore,
      questionCount: sql<number>`count(${turns.id}) filter (where ${turns.role} = 'assistant')`.mapWith(Number),
    })
    .from(sessions)
    .innerJoin(jobs, eq(sessions.jobId, jobs.id))
    .leftJoin(evaluations, eq(evaluations.sessionId, sessions.id))
    .leftJoin(turns, eq(turns.sessionId, sessions.id))
    .groupBy(sessions.id, jobs.id, evaluations.id)
    .orderBy(desc(sessions.startedAt))

  return rows.map((row) => ({
    ...row,
    company: presetForSlug(row.jobSlug).company,
  }))
}

/**
 * Where each row links. `active` resumes the room (the interview page
 * rehydrates initialTurns and only redirects on `completed`); the other
 * statuses go to the results page.
 */
export function linkForRow(row: Pick<HistoryRow, "sessionId" | "status">): string {
  if (row.status === "active") return `/interview/${row.sessionId}`
  return `/sessions/${row.sessionId}`
}
