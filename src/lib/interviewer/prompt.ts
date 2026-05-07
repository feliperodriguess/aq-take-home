/**
 * Prompt construction for the interview engine (spec 04 §"Prompt").
 *
 * Two messages are built:
 *   - `buildSystem`: stable role context, rubric, pack, and output rules.
 *   - `buildUser`:   dynamic transcript + instruction for the next turn.
 *
 * Keep these as pure string builders so they're trivial to unit-test.
 */

import type { Job, Turn } from "@/db/schema"
import { HARD_CAP, MIN_FOLLOWUPS, MIN_QUESTIONS, TARGET_MAX_QUESTIONS } from "@/lib/interviewer/rules"
import type { QuestionPack } from "@/types/interview"

/**
 * One-line schema description embedded in the system prompt as a final
 * reminder. The Structured Outputs JSON schema is enforced separately by
 * `zodTextFormat`, but the model behaves better when the field semantics are
 * also restated in plain English.
 */
export const ENGINE_OUTPUT_SCHEMA_DESCRIPTION = [
  '- "question": exactly one sentence the interviewer says next, conversational tone, no preamble like "Great answer".',
  '- "packItemId": the id from the pack if you used one, otherwise null.',
  '- "isFollowUp": true iff this question references the candidate\'s most recent answer.',
  '- "signals.skillsDetected": only with concrete evidence; cite the candidate turn index in evidenceTurnIndex.',
  '- "signals.topicsCovered": rubric competency names with at least weak evidence.',
  '- "signals.gaps": rubric competency names without evidence yet.',
  '- "signals.rationale": 1–2 sentences on WHY this question is the best next step.',
  '- "isFinal": apply the end criteria. If unsure, false.',
].join("\n")

export interface BuildSystemArgs {
  job: Pick<Job, "title" | "longDescription">
  pack: QuestionPack
  /** Pack item ids the assistant has already drawn from (don't reuse). */
  usedPackIds: readonly string[]
}

/** System prompt: stable role + rubric + pack + output contract. */
export function buildSystem({ job, pack, usedPackIds }: BuildSystemArgs): string {
  const rubricLines = pack.rubric.map((r) => `- ${r.competency} (weight ${r.weight}): ${r.description}`).join("\n")

  const packLines = pack.items
    .map((i) => {
      const hints = i.followUpHints.length ? ` hints: ${i.followUpHints.join(" | ")}` : ""
      return `- id=${i.id} [${i.category}/${i.competency}/${i.difficulty}] "${i.prompt}"${hints}`
    })
    .join("\n")

  const usedList = usedPackIds.length ? usedPackIds.join(", ") : "—"

  return [
    `You are Iris, an AI interviewer for the role: ${job.title}.`,
    `Speak warmly, candidly, and concisely — no filler praise.`,
    ``,
    `Role context:`,
    job.longDescription,
    ``,
    `Your goals:`,
    `- Conduct a focused interview of ${MIN_QUESTIONS} to ${TARGET_MAX_QUESTIONS} questions (hard cap ${HARD_CAP}).`,
    `- Include AT LEAST ${MIN_FOLLOWUPS} follow-up questions that build directly on the candidate's previous answer.`,
    `- Cover each rubric competency with at least one targeted question.`,
    `- End ONLY when (turn_count >= ${MIN_QUESTIONS}) AND (follow_up_count >= ${MIN_FOLLOWUPS}) AND remaining gaps <= 1.`,
    ``,
    `Rubric:`,
    rubricLines,
    ``,
    `Question pack (you MAY pick ONE for non-follow-up turns; do not reuse ids ${usedList}):`,
    packLines,
    ``,
    `Output rules:`,
    ENGINE_OUTPUT_SCHEMA_DESCRIPTION,
  ].join("\n")
}

export interface BuildUserArgs {
  job: Pick<Job, "title">
  pack: QuestionPack
  /** All prior turns ordered by index ascending. */
  turns: readonly Turn[]
}

/** User message: dynamic transcript + tail instruction for the next turn. */
export function buildUser({ turns }: BuildUserArgs): string {
  if (turns.length === 0) {
    return [
      `This is the start of the interview — no prior turns yet.`,
      `Produce the opening question. It must be from the question pack (set packItemId), and isFollowUp must be false.`,
    ].join("\n")
  }

  const lines = turns.map((t) => `[${t.index}] ${t.role}: ${t.text}`).join("\n")

  // The last turn drives "is there an unanswered prompt" logic.
  const last = turns[turns.length - 1]
  const tail =
    last && last.role === "candidate"
      ? `Candidate's most recent reply is at index ${last.index}. Produce the next assistant turn.`
      : `(The previous assistant turn at index ${last?.index ?? 0} is unanswered.) Produce the next assistant turn — likely a gentle re-prompt or a fresh question.`

  return [`Conversation so far:`, lines, ``, tail].join("\n")
}
