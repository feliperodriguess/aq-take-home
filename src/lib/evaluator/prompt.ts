/**
 * Prompt builders for the final evaluation LLM call (spec 05 §"Prompt").
 *
 * These produce the `system` and `user` strings handed to
 * `openai.responses.parse(...)` together with `EvaluationSchema` as the
 * Structured Output format. The schemas (overallScore 0–10, summary <=800
 * chars, strengths 1–8, concerns 0–8, perCompetency one-per-rubric, recommendation
 * enum) are described inline so the model knows the contract.
 */

import type { Job, Turn } from "@/db/schema"
import type { QuestionPack } from "@/types/interview"

export interface BuildEvaluatorSystemArgs {
  job: Job
  pack: QuestionPack
}

export function buildEvaluatorSystem({ job, pack }: BuildEvaluatorSystemArgs): string {
  const rubricLines = pack.rubric.map((r) => `- ${r.competency} (weight ${r.weight}): ${r.description}`).join("\n")

  return [
    `You are a senior hiring manager evaluating an AI-conducted interview for: ${job.title}.`,
    "",
    `Role context: ${job.shortDescription}`,
    "",
    "Rubric (one entry per competency):",
    rubricLines,
    "",
    "Output a structured evaluation matching the provided JSON schema, with:",
    "- overallScore: a number on a 0–10 scale, weighted by the rubric weights above.",
    "- summary: a calibrated 2–3 sentence verdict (max 800 characters).",
    "- strengths: 1–8 short, concrete, evidence-grounded bullets.",
    "- concerns: 0–8 short, concrete, evidence-grounded bullets. Empty array is fine if there are none.",
    "- perCompetency: ONE entry per rubric competency above. Each entry has",
    '  { competency, score (0–10), notes }. Cite candidate turn indices like "[turn 4]" in notes when possible.',
    "- recommendation: pick the closest of strong_hire / hire / lean_hire / lean_no_hire / no_hire.",
    "",
    "Be honest. A short, evasive, or off-topic interview should not earn a high score.",
  ].join("\n")
}

export interface BuildEvaluatorUserArgs {
  turns: readonly Turn[]
  /** True when the candidate ended the session before hitting MIN thresholds. */
  endedEarly?: boolean
}

export function buildEvaluatorUser({ turns, endedEarly }: BuildEvaluatorUserArgs): string {
  const transcript =
    turns.length === 0 ? "(no turns recorded)" : turns.map((t) => `[turn ${t.index}] ${t.role}: ${t.text}`).join("\n")

  const lines = ["Full transcript (one line per turn):", transcript, ""]

  if (endedEarly) {
    lines.push(
      `Note: this interview was ended early by the candidate after ${turns.length} turns; calibrate the evaluation accordingly (a thin transcript should not earn a high score).`,
      "",
    )
  }

  lines.push("Produce the evaluation now.")
  return lines.join("\n")
}
