# 04 — Backend Routes (STT, TTS, Interview Engine)

## Goal
Implement the three server endpoints that power the Interview Room: `POST /api/stt`, `POST/GET /api/tts`, and `POST /api/interview/turn`. The turn route is the LLM "brain" — it builds the prompt, calls OpenAI Structured Outputs, persists turns, and returns the next question + decision-panel signals.

## Out of scope
- The `/api/interview/end` route + final evaluation (spec 05).
- Question pack *content* (spec 01).
- Client-side state (spec 03).

## Shared concerns

### Runtime
All routes run on the Node runtime (default). Do not export `runtime: 'edge'` — the ElevenLabs SDK depends on Node primitives.

### Session lookup (no cookie auth)
Every route reads `sessionId` from the body or query, looks up the session row by ID, and verifies its state. There is no cookie or token check (see spec 00 — URL is the credential).

```ts
// src/lib/session.ts
import { eq } from "drizzle-orm"
import { db } from "@/db/drizzle"
import { sessions } from "@/db/schema"

export async function loadSession(sessionId: string) {
  const [row] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1)
  return row ?? null
}

export async function loadActiveSession(sessionId: string) {
  const row = await loadSession(sessionId)
  if (!row) return { error: { status: 404 as const, code: "session_not_found" } }
  if (row.status !== "active") return { error: { status: 410 as const, code: "session_ended" } }
  return { session: row }
}
```

### Error envelope
```ts
{ error: { code: string; message: string } }
```
HTTP status maps cleanly: 400 invalid input, 404 session not found, 409 conflict (duplicate index), 410 session ended, 415 unsupported audio mime, 502 upstream provider failure, 504 upstream timeout, 500 anything else.

### Clients (singletons)

```ts
// src/lib/openai.ts
import OpenAI from "openai"
export const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })

// src/lib/elevenlabs.ts
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js"
export const elevenlabs = new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY })
```

Use Node `globalThis` caching pattern in dev to survive HMR (mirror `src/db/drizzle.ts` if it already does this).

---

## `POST /api/stt`

### Contract
Request: raw audio bytes in the body. `Content-Type` is one of `audio/webm`, `audio/webm;codecs=opus`, `audio/mp4`, `audio/mpeg`, `audio/wav`. Validate; otherwise 415.

Response: `{ transcript: string; isEmpty: boolean }`. `isEmpty=true` when Scribe returns no speech.

### Implementation

```ts
// src/app/api/stt/route.ts
import { NextResponse } from "next/server"
import { elevenlabs } from "@/lib/elevenlabs"

const ALLOWED = new Set([
  "audio/webm", "audio/webm;codecs=opus", "audio/mp4", "audio/mpeg", "audio/wav",
])

export async function POST(req: Request) {
  const ctype = req.headers.get("content-type") ?? ""
  if (!ALLOWED.has(ctype)) {
    return errorResponse(415, "unsupported_media_type", `Got ${ctype}`)
  }

  const buf = Buffer.from(await req.arrayBuffer())
  if (buf.byteLength === 0) return errorResponse(400, "empty_body", "No audio bytes")
  if (buf.byteLength > 20 * 1024 * 1024) return errorResponse(413, "too_large", "20MB cap")

  // ElevenLabs SDK accepts a Blob/File for the `file` field. Wrap the buffer.
  const file = new Blob([buf], { type: ctype })

  const r = await elevenlabs.speechToText.convert({
    file,
    modelId: "scribe_v2",
    languageCode: "en",
  })

  const transcript = (r.text ?? "").trim()
  return NextResponse.json({
    transcript,
    isEmpty: transcript.length === 0,
  })
}
```

### Notes
- ElevenLabs **Scribe v2** consolidates STT to the same vendor as TTS — one SDK, one API key (see spec 00).
- We send raw bytes via the SDK's `file` parameter (Blob). The SDK handles multipart upload internally.
- The session is **not** validated here — STT is a thin transcription utility, not a session-mutating call. Any holder of the URL can transcribe; that's no worse than them holding the session URL itself.
- For a low-latency path later, swap to `speechToText.realtime.connect(...)` (WebSocket); not in scope for v1.

---

## `GET /api/tts`

`GET` (not POST) so the browser `<audio>` tag can use the URL directly. Idempotent and cacheable in principle, though we don't enable caching for v1.

### Contract
Query: `?sessionId=<uuid>&turnIndex=<int>`. Server looks up the assistant turn at that index in that session, validates the session cookie, then streams ElevenLabs audio.

Response: `Content-Type: audio/mpeg`, body is the streaming ElevenLabs response.

### Why look up text server-side instead of accepting `?text=…`?
1. Avoids URL-length limits on long questions.
2. Prevents anyone with a leaked URL from generating arbitrary TTS on our budget.
3. Locks the audio to a real assistant turn — replay scenarios stay consistent.

### Implementation

```ts
// src/app/api/tts/route.ts
import { NextResponse } from "next/server"
import { z } from "zod"
import { eq, and } from "drizzle-orm"
import { db } from "@/db/drizzle"
import { turns, sessions } from "@/db/schema"
import { elevenlabs } from "@/lib/elevenlabs"
import { loadSession } from "@/lib/session"
import { env } from "@/lib/env"

const Q = z.object({
  sessionId: z.string().uuid(),
  turnIndex: z.coerce.number().int().nonnegative(),
})

export async function GET(req: Request) {
  const url = new URL(req.url)
  const parsed = Q.safeParse({
    sessionId: url.searchParams.get("sessionId"),
    turnIndex: url.searchParams.get("turnIndex"),
  })
  if (!parsed.success) return errorResponse(400, "bad_query", "sessionId+turnIndex required")

  const session = await loadSession(parsed.data.sessionId)
  if (!session) return errorResponse(404, "session_not_found", "")

  const [turn] = await db.select({ text: turns.text, role: turns.role })
    .from(turns)
    .where(and(eq(turns.sessionId, session.id), eq(turns.index, parsed.data.turnIndex)))
    .limit(1)
  if (!turn || turn.role !== "assistant") return errorResponse(404, "no_turn", "")

  const audio = await elevenlabs.textToSpeech.convert(env.ELEVENLABS_VOICE_ID, {
    text: turn.text,
    modelId: "eleven_flash_v2_5",
    outputFormat: "mp3_44100_128",
  })

  // SDK returns an async iterable / Web ReadableStream. Pipe it through.
  return new Response(audio as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  })
}
```

If the `audio` value isn't directly a `ReadableStream`, wrap it: convert the async iterable into a `ReadableStream` via `new ReadableStream({ async pull(controller) { … } })`. Verify against the SDK return shape during implementation.

---

## `POST /api/interview/turn`

The orchestrator. Single most important route in the app.

### Contract

Request:
```ts
{
  sessionId: string,                     // uuid
  candidateUtterance?: string | null,    // null/absent on the very first call
}
```

Response: `TurnResponseSchema` from spec 01:
```ts
{
  question: string,
  packItemId: string | null,
  signals: Signals,
  isFinal: boolean,
  turnIndex: number,                     // index of the assistant turn that was just persisted
}
```

### Algorithm

```
1. Validate body. loadActiveSession(sessionId). Load job, pack, all prior turns (ordered).
2. If candidateUtterance is non-empty, persist it as a candidate turn at next index inside a transaction.
   - Use INSERT with the unique (session_id, index) index as the lock.
3. Build the OpenAI input from: job, pack (filtered to unused items where possible), prior transcript.
4. Call openai.responses.parse({ model, input, text: { format: zodTextFormat(EngineOutputSchema, "turn") } }).
5. Validate engine output. If validation fails, retry once with a reminder; on 2nd failure, fall back to a deterministic next pack item.
6. Apply server-side guardrails:
   - If assistantTurnCount >= 14, force isFinal=true regardless of model output.
   - If isFinal=true but assistantTurnCount < 6 OR followUpCount < 2, override to false.
   - If isFinal=true but a pack item id is included that we already used, set packItemId=null.
7. Persist the assistant turn in a transaction with meta = { signals, packItemId, rationale, isFollowUp }.
8. Return TurnResponse.
```

### Engine output schema (separate from `TurnResponse`)

The model emits a slightly richer shape internally; the route mediates.

```ts
// src/types/engine.ts
import { z } from "zod"
export const EngineOutputSchema = z.object({
  question: z.string().min(1).max(600),
  packItemId: z.string().nullable(),    // null when the model invented a follow-up
  isFollowUp: z.boolean(),
  signals: SignalsSchema,
  isFinal: z.boolean(),
})
```

### Prompt

Compose two messages: a system message with stable role+rubric+rules, and a user message with the dynamic transcript.

```ts
// src/lib/interviewer/prompt.ts
export function buildSystem({ job, pack, usedPackIds }: …) {
  return [
    `You are an AI interviewer for the role: ${job.title}.`,
    `Role context:\n${job.longDescription}`,
    ``,
    `Your goals:`,
    `- Conduct a focused interview of 6 to 10 questions.`,
    `- Include AT LEAST 2 follow-up questions that build directly on the candidate's previous answer.`,
    `- Cover each rubric competency with at least one targeted question.`,
    `- End ONLY when (turn_count >= 6) AND (follow_up_count >= 2) AND remaining gaps <= 1.`,
    ``,
    `Rubric:`,
    pack.rubric.map(r => `- ${r.competency} (weight ${r.weight}): ${r.description}`).join("\n"),
    ``,
    `Question pack (you MAY pick ONE for non-follow-up turns; do not reuse ids ${usedPackIds.join(", ") || "—"}):`,
    pack.items.map(i =>
      `- id=${i.id} [${i.category}/${i.competency}/${i.difficulty}] "${i.prompt}"  hints: ${i.followUpHints.join(" | ")}`
    ).join("\n"),
    ``,
    `Output rules:`,
    `- "question": exactly one sentence the interviewer says next, conversational tone, no preamble like "Great answer".`,
    `- "packItemId": the id from the pack if you used one, otherwise null.`,
    `- "isFollowUp": true iff this question references the candidate's most recent answer.`,
    `- "signals": honest reflection of evidence in the transcript so far.`,
    `  • skillsDetected: only with concrete evidence; cite the candidate turn index in evidenceTurnIndex.`,
    `  • topicsCovered: rubric competency names with at least weak evidence.`,
    `  • gaps: rubric competency names without evidence yet.`,
    `  • rationale: 1–2 sentences on WHY this question is the best next step.`,
    `- "isFinal": apply the end criteria above. If unsure, false.`,
  ].join("\n")
}

export function buildUser({ priorTurns, candidateUtterance }: …) {
  if (priorTurns.length === 0 && !candidateUtterance) {
    return `This is the start of the interview. Produce the opening question.`
  }
  const lines = priorTurns.map(t => `[${t.index}] ${t.role}: ${t.text}`).join("\n")
  const tail = candidateUtterance
    ? `Candidate's most recent reply (just transcribed): "${candidateUtterance}"`
    : `(No new candidate utterance — the previous assistant turn is unanswered.)`
  return `Conversation so far:\n${lines}\n\n${tail}\n\nProduce the next assistant turn.`
}
```

### OpenAI call

```ts
// src/lib/interviewer/engine.ts
import { zodTextFormat } from "openai/helpers/zod"
import { openai } from "@/lib/openai"
import { EngineOutputSchema } from "@/types/engine"

export async function runInterviewerTurn(args: { systemPrompt: string; userPrompt: string }) {
  const rsp = await openai.responses.parse({
    model: "gpt-4.1",        // or "gpt-5-mini" if available — keep it configurable
    input: [
      { role: "system", content: args.systemPrompt },
      { role: "user", content: args.userPrompt },
    ],
    text: { format: zodTextFormat(EngineOutputSchema, "interviewer_turn") },
  })
  if (!rsp.output_parsed) throw new Error("OpenAI returned no parsed output")
  return rsp.output_parsed
}
```

> `EngineOutputSchema` (and `SignalsSchema`) **must** mark every optional field as `.optional().nullable()` per OpenAI Structured Outputs requirements (already true in spec 01).

### Server guardrails (rationale)

The model can drift. The route is the source of truth for end-conditions:

```ts
const assistantCount = priorTurns.filter(t => t.role === "assistant").length + 1
const followUpCount = priorTurns.filter(
  t => t.role === "assistant" && (t.meta as any)?.isFollowUp
).length + (engineOut.isFollowUp ? 1 : 0)

let isFinal = engineOut.isFinal
if (assistantCount >= 14) isFinal = true
if (isFinal && (assistantCount < 6 || followUpCount < 2)) isFinal = false
```

Document these constants in one place (`src/lib/interviewer/rules.ts`) so spec 05's evaluator imports them.

### Persistence (transactional)

```ts
await db.transaction(async tx => {
  if (candidateUtterance) {
    await tx.insert(turns).values({
      sessionId, role: "candidate", index: nextCandidateIndex, text: candidateUtterance,
    })
  }
  await tx.insert(turns).values({
    sessionId, role: "assistant", index: nextAssistantIndex, text: engineOut.question,
    meta: {
      signals: engineOut.signals,
      packItemId: engineOut.packItemId,
      rationale: engineOut.signals.rationale,
      isFollowUp: engineOut.isFollowUp,
      modelOutput: engineOut, // full record for debugging
    },
  })
})
```

The unique `(session_id, index)` index serializes concurrent turn submissions: the second concurrent call hits a unique-violation, the route returns `409 conflict`, and the client retries.

### Files

```
src/
  app/api/
    stt/route.ts
    tts/route.ts
    interview/turn/route.ts
  lib/
    session.ts                        # loadSession(), loadActiveSession()
    openai.ts elevenlabs.ts
    interviewer/
      prompt.ts                       # buildSystem, buildUser
      engine.ts                       # runInterviewerTurn
      rules.ts                        # MIN_QUESTIONS=6, MIN_FOLLOWUPS=2, HARD_CAP=14
  types/
    engine.ts                         # EngineOutputSchema
```

## Open questions
- Choice of OpenAI model: default to `gpt-4.1` (stable Responses API + Structured Outputs). Keep model id in `env` so we can switch to `gpt-5` / `gpt-5-mini` without redeploys. **Action:** add `OPENAI_INTERVIEW_MODEL` env var with default `"gpt-4.1"`.
- Streaming partial assistant text? Skip — Structured Outputs streaming is messy and our latency budget is fine.
- Rate limiting per session? Skip for take-home; the cookie + session row is enough friction.

## Acceptance checklist
- [ ] `/api/stt` round-trips a 5s WebM blob to ElevenLabs Scribe v2 and returns a non-empty transcript.
- [ ] `/api/stt` rejects unsupported mime types with 415.
- [ ] `/api/tts?sessionId=…&turnIndex=…` streams MP3 audio that plays in `<audio>` without buffering errors.
- [ ] `/api/tts` returns 404 when the index doesn't refer to an assistant turn.
- [ ] `/api/interview/turn` produces a valid `TurnResponse` on the very first call (no prior utterance).
- [ ] Concurrent double-submit returns 409 from the second request, not duplicate turns.
- [ ] Engine never returns `isFinal=true` before MIN_QUESTIONS + MIN_FOLLOWUPS thresholds.
- [ ] Engine forces `isFinal=true` at HARD_CAP regardless of model output.
- [ ] Each assistant turn's `meta` contains `signals`, `packItemId`, `isFollowUp`, and the raw model output.
