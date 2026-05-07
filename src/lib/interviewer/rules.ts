/**
 * Server-side guardrails for the interview engine (spec 04 §"Server guardrails").
 *
 * The model can drift on end-conditions, so the route is the source of truth:
 *   - HARD_CAP: maximum number of normal (question-bearing) assistant turns.
 *               The (HARD_CAP + 1)-th turn is forced to a closing remark so
 *               the candidate always gets to answer their last question.
 *   - MIN_QUESTIONS: minimum assistant turns before we'll allow `isFinal=true`.
 *   - MIN_FOLLOWUPS: minimum follow-up turns required before ending.
 *
 * Constants live here (not in the prompt module) so spec 05's evaluator can
 * import the same numbers without coupling to the prompt text.
 */

/**
 * Maximum number of normal question-bearing assistant turns.
 * Once this many have been persisted, the NEXT turn is forced to a closing
 * remark (isFinal=true) — the candidate is never cut off after a question.
 */
export const HARD_CAP = 10
/** Lower bound on assistant turns before the engine is allowed to end. */
export const MIN_QUESTIONS = 6
/** Soft upper bound surfaced to the model in the prompt as the target range. */
export const TARGET_MAX_QUESTIONS = 8
/** Lower bound on follow-up turns required before ending. */
export const MIN_FOLLOWUPS = 2

export interface GuardrailContext {
  /**
   * Number of assistant turns INCLUDING the one we're about to persist for
   * this engine call (i.e. priorAssistant + 1).
   */
  assistantCount: number
  /**
   * Number of follow-up assistant turns INCLUDING this one if `isFollowUp`.
   */
  followUpCount: number
}

export interface EngineGuardrailInput {
  isFinal: boolean
  isFollowUp: boolean
}

export interface GuardrailDecision {
  /** Final `isFinal` flag after applying server-side rules. */
  isFinal: boolean
  /** True iff the server overrode the model's `isFinal` flag. */
  overridden: boolean
  /** Human-readable reason for an override (debug/log). Undefined if no override. */
  reason?: string
}

/**
 * Pure function that decides the final `isFinal` flag given:
 *   - the engine's proposal (`engineOut.isFinal`)
 *   - running counts (`assistantCount`, `followUpCount`) computed by the route.
 *
 * Rules (in order):
 *   1. assistantCount > HARD_CAP                → force isFinal=true (closing turn).
 *   2. isFinal && assistantCount < MIN_QUESTIONS → force isFinal=false.
 *   3. isFinal && followUpCount < MIN_FOLLOWUPS  → force isFinal=false.
 *   4. otherwise pass through.
 *
 * Note rule 1 uses STRICT greater-than: at exactly HARD_CAP we still let the
 * model produce a normal question so the candidate gets to answer it. The
 * very next turn (HARD_CAP + 1) is the forced closing.
 */
export function applyGuardrails(engineOut: EngineGuardrailInput, ctx: GuardrailContext): GuardrailDecision {
  if (ctx.assistantCount > HARD_CAP) {
    return {
      isFinal: true,
      overridden: !engineOut.isFinal,
      reason: engineOut.isFinal ? undefined : `HARD_CAP (${HARD_CAP}) reached — forcing closing turn`,
    }
  }

  if (engineOut.isFinal && ctx.assistantCount < MIN_QUESTIONS) {
    return {
      isFinal: false,
      overridden: true,
      reason: `assistantCount (${ctx.assistantCount}) < MIN_QUESTIONS (${MIN_QUESTIONS})`,
    }
  }

  if (engineOut.isFinal && ctx.followUpCount < MIN_FOLLOWUPS) {
    return {
      isFinal: false,
      overridden: true,
      reason: `followUpCount (${ctx.followUpCount}) < MIN_FOLLOWUPS (${MIN_FOLLOWUPS})`,
    }
  }

  return { isFinal: engineOut.isFinal, overridden: false }
}
