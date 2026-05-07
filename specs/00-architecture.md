# 00 — Architecture

## Goal
Single-source-of-truth for the AI Interviewer Platform. Locks the stack, conventions, env vars, deployment target, and the cross-cutting contracts that the other five specs depend on. Every other spec links back here.

## Out of scope
- Feature behaviour (covered in 02–05).
- Schema details (covered in 01).
- Stretch goals beyond #1 (decision panel) and #2 (question packs).

## Product summary
A web app where a candidate picks a job, enters an Interview Room, and has a fully voice-driven conversation with an AI interviewer. The interviewer asks ≥6 questions, including ≥2 follow-ups grounded in the candidate's prior answers. After the interview, the user sees the full transcript plus a structured JSON evaluation. A live "decision panel" shows rubric signals and rationale; questions are seeded from per-role question packs.

**Brand:** the product is "Iris". Editorial dark theme with apricot accent; mixed Inter / Instrument Serif / JetBrains Mono typography. Full design system + per-view mockups live at `/Users/felipe/dev/afterquery/iris-ai-ui-handoff/`. Read CLAUDE.md → "UI handoff" before any UI work.

## Stack (locked)
| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16.2.5** (App Router, RSC) | Already scaffolded. Read `node_modules/next/dist/docs/` — Next 16 has breaking changes vs training data (async `params`, `RouteContext` helper, Cache Components). |
| Runtime | Node.js (default) for all `/api/*` and Server Actions | ElevenLabs SDK needs Node `Buffer`/streams; do not use Edge runtime. |
| UI | React 19, Tailwind v4, shadcn (Base UI under the hood), Phosphor icons | Already installed. |
| DB | **Neon Postgres + Drizzle ORM** | Already scaffolded. Serverless driver (`@neondatabase/serverless`). |
| LLM | **OpenAI** via `openai` v6 (Responses API + `zodTextFormat`) | User decision. Structured Outputs for next-question + evaluation. |
| Voice (STT + TTS) | **ElevenLabs** `@elevenlabs/elevenlabs-js` — Scribe v2 for STT, `eleven_flash_v2_5` for TTS | One vendor, one SDK, one API key. STT via `speechToText.convert(...)`; TTS streams MP3 to `<audio>`. |
| Validation | Zod v4 (already installed) | Schema in `src/lib/env.ts` pattern; reuse for API contracts. |
| Lint/format | Biome | Already configured. |
| Deploy | **Vercel** | Neon + Vercel-native. Function timeout 60s default — interview turn must complete well under that. |

## Identity & sessions
- **No auth, no cookies.** A session is identified solely by an opaque `sessionId` (UUID v4) embedded in the URL (`/interview/[sessionId]`).
- All `/api/interview/*` routes accept `sessionId` in the body/query, look up the row, and verify `status === "active"` (for turn route) or `status === "active"` else 410 (for end route). No token check.
- Trade-off: anyone with the URL can interact with the session. Acceptable for a 4-hour take-home demo. The URL is unguessable (UUID v4 = 122 bits of entropy).
- Results page `/sessions/[id]` is also URL-only public-read. See spec 05.

## High-level request flow
```
[Home /] ── click job ──► startSessionAction (Server Action)
                              ↳ inserts session row, redirect()
                                   ↓
[Interview Room /interview/:id]
  ├─ MediaRecorder (push-to-talk)
  │     └─ POST /api/stt (audio/webm bytes) ──► ElevenLabs Scribe ──► { transcript, isEmpty }
  ├─ POST /api/interview/turn { sessionId, candidateUtterance? }
  │     └─ persist user turn, build prompt, openai.responses.parse(),
  │        persist assistant turn + signals, return { question, signals, rationale, isFinal, turnIndex }
  ├─ GET /api/tts?sessionId=…&turnIndex=…  ──► ElevenLabs TTS ──► audio/mpeg (streamed)
  └─ on isFinal: POST /api/interview/end ──► generates evaluation, redirects to /sessions/:id
[Results /sessions/:id] ── transcript + evaluation JSON
```

## File layout (target)
```
src/
  app/
    page.tsx                    # jobs list (RSC) — spec 02
    interview/[sessionId]/
      page.tsx                  # interview room shell (RSC) — spec 03
      _components/              # client components (mic, panel, transcript, audio)
    sessions/[sessionId]/
      page.tsx                  # results page (RSC) — spec 05
      _components/              # ScoreHeader, CompetencyTable, etc.
    api/
      stt/route.ts              # POST audio → transcript — spec 04
      tts/route.ts              # GET text-of-turn → mp3 stream — spec 04
      interview/turn/route.ts   # POST next-question orchestration — spec 04
      interview/end/route.ts    # POST finalize + evaluation — spec 05
  actions/
    start-session.ts            # Server Action — spec 02
  components/
    transcript.tsx              # shared between live + results — spec 03/05
    ui/                         # shadcn primitives
  db/
    schema.ts                   # spec 01
    seed.ts                     # spec 01
    migrations/
  data/
    question-packs/             # JSON files per role — spec 01
  lib/
    env.ts                      # extend with new keys (this spec)
    session.ts                  # loadSession(id) helper — spec 04
    openai.ts elevenlabs.ts
    interviewer/{prompt,engine,rules}.ts   # spec 04
    evaluator/{prompt,evaluate}.ts         # spec 05
  types/                        # shared zod schemas (turn, signals, evaluation, engine)
specs/                          # this directory
```

**Filename convention:** all source files use **kebab-case** (`job-card.tsx`, `mic-button.tsx`, `start-session.ts`). React component identifiers stay PascalCase inside the file (`export function JobCard()`); only the filename is kebab-case.

## Cross-cutting contracts
All API request/response shapes are defined as Zod schemas in `src/types/` and re-exported from each route file. No untyped JSON over the wire. Public contracts are owned by the spec that owns the route, but the names live here for parallel work:

| Schema | Defined in spec | Used by spec |
|---|---|---|
| `Job`, `JobSummary` (Drizzle inferred) | 01 | 02, 03 |
| `QuestionPack` | 01 | 04, 05 |
| `SessionRecord`, `TurnRecord` (Drizzle inferred) | 01 | 02, 03, 04, 05 |
| `SttResponse` | 04 | 03 |
| `TtsRequest` (query params; response is `audio/mpeg`) | 04 | 03 |
| `TurnRequest`, `TurnResponse`, `Signals` | 01 (Zod), 04 (route) | 03, 04 |
| `EngineOutput` (richer than `TurnResponse`, internal) | 04 | 04 |
| `EndRequest`, `Evaluation` | 01 (Zod), 05 (route) | 03, 05 |

## Environment variables
Extend `src/lib/env.ts`:
```ts
DATABASE_URL              // existing
OPENAI_API_KEY            // sk-...
OPENAI_INTERVIEW_MODEL    // optional, default "gpt-4.1"
OPENAI_EVAL_MODEL         // optional, default "gpt-4.1"
ELEVENLABS_API_KEY        // used for both STT (Scribe v2) and TTS (eleven_flash_v2_5)
ELEVENLABS_VOICE_ID       // default voice (e.g., "JBFqnCBsd6RMkjVDRZzb")
NODE_ENV                  // existing
```
All keys server-only. Update `.env.example` with placeholders.

## Next.js 16 conventions to respect
- Route params are **async**: `export async function GET(req, ctx: RouteContext<'/api/foo/[id]'>) { const { id } = await ctx.params }`.
- Route Handlers are uncached by default; do **not** add `export const dynamic`. Reading the request body or DB makes the route dynamic automatically.
- No Edge runtime — explicit `export const runtime = 'nodejs'` is fine but unnecessary.
- Server Components by default. Mark `'use client'` only on `_components/` that need browser APIs (MediaRecorder, audio element, useState).
- Use `revalidatePath('/sessions/' + id)` after writing the final evaluation.
- `cookies()` and `headers()` are async — `await cookies()` etc.

## Performance budget
| Step | Target p50 | Hard ceiling |
|---|---|---|
| STT round-trip (5–15s utterance) | < 1.5s | 3s |
| LLM next-question turn | < 2.5s | 5s |
| TTS time-to-first-byte | < 800ms | 2s |
| End-of-session evaluation | < 4s | 8s |

Do not block the UI — show a "thinking…" state in the decision panel during turn calls.

## Error model
All API routes return `{ error: { code: string, message: string } }` with appropriate HTTP status. The client surfaces a toast and (for STT/TTS) lets the candidate retry the same turn without losing prior transcript. Status codes used:

| Status | Meaning |
|---|---|
| 400 | Invalid request body / query |
| 404 | Session/turn not found |
| 409 | Concurrent submit (unique-violation on `(session_id, index)`) or end called before thresholds without `?force=true` |
| 410 | Session already completed |
| 413 | Audio body too large (>20MB) |
| 415 | Unsupported audio mime type |
| 502 | Upstream provider failure (OpenAI/ElevenLabs) |
| 504 | Upstream timeout |

## Deployment
- **Vercel**, single project. `pnpm build` does **not** run migrations — `pnpm db:migrate` is run manually against the production Neon branch before each deploy.
- Set all env vars in Vercel project settings; mark all keys "Sensitive".
- A single Neon project with two branches: `main` (prod) and `dev` (local). Local `.env.local` points at `dev`.
- Vercel function defaults are sufficient (Node runtime, 60s timeout). The interview turn route has p99 < 5s; well under the limit.

## Parallelization plan (for the implementation phase)
Three waves once specs are approved. Each wave's items can run concurrently:

**Wave 1 — foundation**
- 01: schema + migrations + seed + question pack JSON
- env.ts extensions + lib clients (`openai.ts`, `elevenlabs.ts`)
- 03 UI shell with mocked APIs (component skeletons + state machine)

**Wave 2 — depends on Wave 1**
- 02: jobs page + Server Action
- 04: STT + TTS + turn route
- 03: wire UI to real APIs

**Wave 3 — depends on Wave 2**
- 05: end route + results page
- Polish, deploy

## Open questions
- None blocking. Voice ID is configurable via env; default to a generic English voice.

## Acceptance checklist
- [ ] `src/lib/env.ts` extended with all new keys, app fails fast on missing values.
- [ ] `.env.example` lists all keys with placeholder values.
- [ ] `pnpm build` succeeds with placeholder env values that satisfy Zod schema.
- [ ] All other specs reference this file for stack/contracts/env without contradiction.
