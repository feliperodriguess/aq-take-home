# 05 — Session Lifecycle, Final Evaluation, Results Page

> **Design reference:** `iris-ai-ui-handoff/project/interviewer/ResultsView.jsx`. Editorial header ("How it went, with *candor*."), 260px ScoreCard + SummaryCard hero row, two-column Strengths/Concerns, per-rubric competency table, full transcript, and a talk-ratio bar. See CLAUDE.md → "UI handoff".

## Goal
Wrap an interview cleanly: mark the session complete, generate the structured evaluation JSON, and render a results page that shows the full transcript plus the evaluation. This is the candidate's final artifact and the take-home requirement's primary deliverable.

## Out of scope
- Per-turn LLM logic (spec 04).
- Question pack content (spec 01).
- Replay/analytics stretch goal (#4) — explicitly deferred.

## Surface

### Route: `POST /api/interview/end`
Request: `{ sessionId: string }`. Session must be `active` (looked up via `loadActiveSession()` from spec 04). No cookie/auth.

Response: `{ ok: true; redirectTo: "/sessions/<id>" }` on success.

### Page: `/sessions/[sessionId]` (Server Component)
Public-read by URL (no cookie required). Renders:
1. Job header (title, role description).
2. Overall score + recommendation badge.
3. Per-competency breakdown.
4. Strengths / Concerns side-by-side.
5. Full transcript (Q/A turns with index).
6. (Collapsible) Raw evaluation JSON for the take-home rubric.

## Why public-read?
The candidate may want to share the link with others as a learning artifact. There's no PII beyond what they spoke. This matches the take-home spec's "save the session and display, at the end" — visible without an account or auth wall. Consistent with the URL-as-credential model used everywhere else (see spec 00).

## End-of-session flow

```
Client (spec 03) detects isFinal=true → plays final audio → onEnded → POST /api/interview/end
   │
   ▼
/api/interview/end:
  1. loadActiveSession(sessionId). Return 404/410 on miss/ended.
  2. Load all turns for the session, ordered by index.
  3. Sanity check: assistantCount >= MIN_QUESTIONS && followUpCount >= MIN_FOLLOWUPS.
       → If not met, the client called this prematurely. Return 409 unless ?force=true is set
         (manual "End interview" override; logged in meta).
  4. Run final evaluation LLM call (see below). Synchronous — we await it.
  5. Insert evaluations row.
  6. Update sessions.status = "completed", sessions.endedAt = now().
  7. revalidatePath("/sessions/" + id).
  8. Return { ok: true, redirectTo: "/sessions/" + id }.
   │
   ▼
Client navigates to /sessions/[id], which is now fully populated.
```

The route is intentionally synchronous: it costs the candidate ~3–6s of "Wrapping up…" UI, but guarantees the results page never renders an empty/loading evaluation. Async-eval-via-job-queue would be over-engineering for a take-home.

## Final evaluation

### Schema
`EvaluationSchema` from spec 01:
```ts
{
  overallScore: number,            // 0..10
  summary: string,                 // <= 800 chars
  strengths: string[],             // 1..8
  concerns: string[],              // 0..8
  perCompetency: { competency, score, notes }[],
  recommendation: "strong_hire" | "hire" | "lean_hire" | "lean_no_hire" | "no_hire",
}
```

### Prompt

```ts
// src/lib/evaluator/prompt.ts
export function buildEvaluatorSystem({ job, pack }) {
  return [
    `You are a senior hiring manager evaluating an AI-conducted interview for: ${job.title}.`,
    ``,
    `Rubric:`,
    pack.rubric.map(r => `- ${r.competency} (weight ${r.weight}): ${r.description}`).join("\n"),
    ``,
    `Output a structured evaluation with:`,
    `- overallScore on a 0–10 scale, weighted by the rubric weights.`,
    `- summary: a calibrated 2–3 sentence verdict.`,
    `- strengths: short, concrete, evidence-grounded bullets.`,
    `- concerns: short, concrete, evidence-grounded bullets. Empty array is fine if there are none.`,
    `- perCompetency: ONE entry per rubric competency. Score 0–10, notes cite candidate turn indices like "[turn 4]" when possible.`,
    `- recommendation: pick the closest of strong_hire / hire / lean_hire / lean_no_hire / no_hire.`,
    ``,
    `Be honest. A short or evasive interview should not earn a high score.`,
  ].join("\n")
}

export function buildEvaluatorUser({ turns }) {
  return [
    `Full transcript (one line per turn):`,
    turns.map(t => `[${t.index}] ${t.role}: ${t.text}`).join("\n"),
    ``,
    `Produce the evaluation now.`,
  ].join("\n")
}
```

### Call

```ts
// src/lib/evaluator/evaluate.ts
import { zodTextFormat } from "openai/helpers/zod"
import { openai } from "@/lib/openai"
import { EvaluationSchema } from "@/types/interview"

export async function evaluate({ system, user }) {
  const rsp = await openai.responses.parse({
    model: env.OPENAI_EVAL_MODEL ?? "gpt-4.1",
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    text: { format: zodTextFormat(EvaluationSchema, "evaluation") },
  })
  if (!rsp.output_parsed) throw new Error("Evaluator returned no parsed output")
  return rsp.output_parsed
}
```

### Persistence

```ts
const ev = await evaluate({ system, user })
await db.transaction(async tx => {
  await tx.insert(evaluations).values({
    sessionId, overallScore: ev.overallScore, payload: ev,
  })
  await tx.update(sessions)
    .set({ status: "completed", endedAt: new Date() })
    .where(eq(sessions.id, sessionId))
})
```

## Results page composition

```
src/app/sessions/[sessionId]/
  page.tsx                # RSC: loads session+turns+eval, renders shell
  _components/
    ScoreHeader.tsx       # overall score + recommendation badge
    CompetencyTable.tsx   # perCompetency rows
    StrengthsConcerns.tsx # two-column list
    TranscriptList.tsx    # turn-by-turn render (read-only twin of spec 03's component)
    RawJson.tsx           # collapsible <details>; shows EvaluationSchema as JSON
```

```ts
// src/app/sessions/[sessionId]/page.tsx (sketch)
export default async function ResultsPage(_: unknown, ctx: RouteContext<'/sessions/[sessionId]'>) {
  const { sessionId } = await ctx.params
  const data = await loadResults(sessionId)
  if (!data) notFound()
  if (data.session.status !== "completed") {
    return <PendingState session={data.session} />     // rare race: end call still in flight
  }
  return (
    <main className="mx-auto max-w-4xl px-6 py-10 space-y-8">
      <ScoreHeader job={data.job} ev={data.evaluation} />
      <CompetencyTable items={data.evaluation.perCompetency} />
      <StrengthsConcerns ev={data.evaluation} />
      <TranscriptList turns={data.turns} />
      <RawJson ev={data.evaluation} />
    </main>
  )
}
```

`loadResults` lives in `src/lib/results-loader.ts` and joins `sessions`, `jobs`, `turns`, `evaluations` in a single Drizzle query.

### Visual hierarchy
- **ScoreHeader** is the hero — `text-5xl` score with the recommendation as a colored chip (green=hire spectrum, amber=lean, red=no_hire).
- **CompetencyTable** uses a small bar visualization per row (Tailwind `bg-primary` filled to `score/10`).
- **TranscriptList** uses the same bubble style as the live transcript (component reuse from spec 03 by lifting `Transcript` into a shared `_components/`).
- **RawJson** sits at the bottom inside `<details>` so reviewers (the take-home grader) can verify the JSON evaluation requirement at a glance.

## Edge cases
- **Pending state** (session ended but evaluation row missing): render a small "Finalizing…" UI with a 1-second auto-refresh. Should be virtually unreachable since the end route is synchronous.
- **Force-end** before MIN thresholds: the evaluator still runs but the system prompt should mention "interview ended early". We pass an extra flag in the user message: `Note: this interview was ended early by the candidate after N turns.` so the model calibrates accordingly.
- **No evaluation row** (DB inconsistency): 404 the page rather than rendering broken data.
- **Multiple end calls**: idempotent — second call sees `status !== "active"`, returns 409, client follows redirect anyway.

## Files
```
src/
  app/
    sessions/[sessionId]/
      page.tsx
      _components/                 # score-header.tsx, competency-table.tsx, strengths-concerns.tsx, raw-json.tsx
    api/interview/end/route.ts
  lib/
    evaluator/
      prompt.ts                    # buildEvaluatorSystem, buildEvaluatorUser
      evaluate.ts                  # evaluate()
    results-loader.ts              # loadResults(sessionId)
  components/
    transcript-list.tsx            # shared TranscriptList lifted out of interview/_components
```

> All filenames kebab-case (per spec 00). Component identifiers exported from each file remain PascalCase.

## Open questions
- Show audio playback of the assistant turns on the results page? Cool but stretch goal #4 (replay) — defer.
- Show the decision panel signals from each assistant turn on results? Useful to explain the score; lightweight to add — include as a collapsible "Decision trail" section if time permits. Mark optional.

## Acceptance checklist
- [ ] `/api/interview/end` returns 409 when called before MIN thresholds without `?force=true`.
- [ ] `/api/interview/end` is synchronous: by the time it returns 200, `evaluations` row exists and `sessions.status === "completed"`.
- [ ] Concurrent end calls don't insert duplicate evaluations (unique index on `evaluations.session_id`).
- [ ] `/sessions/[id]` renders the full transcript + structured evaluation for a completed session.
- [ ] `/sessions/[id]` returns 404 for non-existent sessions and a "Finalizing…" pending state for active ones.
- [ ] Raw evaluation JSON is visible (collapsible) on the results page — satisfies the take-home's "JSON evaluation" requirement directly.
- [ ] Recommendation chip color matches the recommendation (visual sanity).
