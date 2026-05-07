/**
 * Final evaluation OpenAI call (spec 05 §"Call").
 *
 * Wraps `openai.responses.parse(...)` with `zodTextFormat(EvaluationSchema)` so
 * callers get a fully validated `Evaluation` object back. Throws on no parsed
 * output — the route maps that to a 502.
 */

import { zodTextFormat } from "openai/helpers/zod"
import { env } from "@/lib/env"
import { openai } from "@/lib/openai"
import { type Evaluation, EvaluationSchema } from "@/types/interview"

export interface EvaluateArgs {
  system: string
  user: string
}

export async function evaluate({ system, user }: EvaluateArgs): Promise<Evaluation> {
  const response = await openai.responses.parse({
    model: env.OPENAI_EVAL_MODEL,
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    text: { format: zodTextFormat(EvaluationSchema, "evaluation") },
  })

  if (!response.output_parsed) {
    throw new Error("Evaluator returned no parsed output")
  }
  return response.output_parsed
}
