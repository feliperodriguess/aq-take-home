/**
 * Interview engine — wraps the OpenAI Responses API call and returns a
 * validated `EngineOutput` (spec 04 §"OpenAI call").
 *
 * Verified against `openai@6` SDK shape:
 *   - `openai.responses.parse({ model, input, text: { format: zodTextFormat(...) } })`
 *   - response.output_parsed: `EngineOutput | null`
 */

import { zodTextFormat } from "openai/helpers/zod"
import type { Job, Session, Turn } from "@/db/schema"
import { env } from "@/lib/env"
import { buildSystem, buildUser } from "@/lib/interviewer/prompt"
import { openai } from "@/lib/openai"
import { type EngineOutput, EngineOutputSchema, type QuestionPack } from "@/types/interview"

export interface RunEngineArgs {
  session: Session
  job: Job
  pack: QuestionPack
  /** All prior turns ordered by index ascending. */
  turns: readonly Turn[]
}

/**
 * Calls OpenAI Structured Outputs and returns the parsed engine output.
 * Throws if the SDK returns no parsed output (schema mismatch / refusal).
 */
export async function runEngine({ job, pack, turns }: RunEngineArgs): Promise<EngineOutput> {
  // Collect every pack id that's been used so far so we tell the model not to repeat.
  const usedPackIds = collectUsedPackIds(turns)

  const systemPrompt = buildSystem({ job, pack, usedPackIds })
  const userPrompt = buildUser({ job, pack, turns })

  const response = await openai.responses.parse({
    model: env.OPENAI_INTERVIEW_MODEL,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    text: { format: zodTextFormat(EngineOutputSchema, "engine_output") },
  })

  if (!response.output_parsed) {
    throw new Error("OpenAI returned no parsed engine output")
  }

  return response.output_parsed
}

/**
 * Pulls `meta.packItemId` off every assistant turn whose meta is shaped
 * `{ packItemId: string | null }`. Resilient to legacy/missing meta.
 */
function collectUsedPackIds(turns: readonly Turn[]): readonly string[] {
  const ids: string[] = []
  for (const turn of turns) {
    if (turn.role !== "assistant") continue
    const meta = turn.meta
    if (!meta || typeof meta !== "object") continue
    const packItemId = (meta as { packItemId?: unknown }).packItemId
    if (typeof packItemId === "string" && packItemId.length > 0) {
      ids.push(packItemId)
    }
  }
  return ids
}
