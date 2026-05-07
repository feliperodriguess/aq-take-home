"use server"

import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { z } from "zod"

import { db } from "@/db/drizzle"
import { jobs, sessions } from "@/db/schema"

const InputSchema = z.object({ jobId: z.string().uuid() })

/**
 * Validates the submitted job id, confirms the job exists, inserts a fresh
 * session row, and redirects the caller to the interview room. Errors bubble
 * to the nearest `error.tsx` boundary.
 */
export async function startSessionAction(formData: FormData) {
  const { jobId } = InputSchema.parse({ jobId: formData.get("jobId") })

  const [job] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, jobId)).limit(1)
  if (!job) throw new Error("Unknown job")

  const [session] = await db.insert(sessions).values({ jobId }).returning({ id: sessions.id })
  if (!session) throw new Error("Failed to create session")

  redirect(`/interview/${session.id}`)
}
