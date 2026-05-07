# Future Architecture — What I'd Do With More Time

This document describes the production engineering work I'd prioritize after the 4-hour take-home demo. It's organized by value delivered, not feature size. The goal isn't a wish list — it's a prioritized argument for what separates a working demo from a shippable product.

---

## 1. Auth and real session ownership

**Current state:** Sessions are identified by a UUID in the URL. Anyone with the link can interact with or read the session. This is intentional for a take-home, but it has real limits.

**What I'd add:**
- Lightweight auth via [Clerk](https://clerk.com) or NextAuth with a magic-link email flow. No passwords — candidates just enter their email to start.
- `sessions.userId` FK so every session is owned, and the results page at `/sessions/[id]` gates on either ownership or an explicit "share" flag.
- A `tokens` table for expiring "invite links" — a recruiter sends a pre-scoped URL that only opens one specific job, valid for 48h.

**Why this matters architecturally:** Right now, `loadActiveSession()` has no authorization surface — any route that validates the session ID is the full security model. Introducing a userId at that abstraction layer is a one-line change per route, which is exactly what you want. The schema is already ready for it (UUIDs, no hard auth coupling).

---

## 2. Background job queue for evaluation

**Current state:** `POST /api/interview/end` runs the evaluation LLM call synchronously — the client waits up to ~6s while we call OpenAI, write to Postgres, and revalidate the path. This is fine for a demo but fragile in production.

**What I'd add:**
- Move the evaluation into a [Vercel Queue](https://vercel.com/docs/functions/queues) (or Inngest, which has better DX for Next.js).
- `/api/interview/end` marks the session `completing` and enqueues the job immediately, returning 202.
- The results page at `/sessions/[id]` SSRs in a "Finalizing..." state when `status === "completing"`, with a `<meta http-equiv="refresh" content="3">` for graceful recovery without WebSockets.
- The queue handler writes the evaluation and transitions the session to `completed`, then calls `revalidatePath`.

**Why:** Synchronous LLM calls in a route handler are a timeout timebomb. At Vercel's 60s function limit you have headroom, but OpenAI has its own P99 tail latency. A queue makes the failure mode recoverable (dead-letter, retry with backoff) instead of a blank results page. It also decouples the candidate's "thank you" screen from the evaluation compute, which makes the UX feel snappier.

---

## 3. Real-time decision panel via Server-Sent Events

**Current state:** The decision panel (signals, rationale) is updated by the client after each `/api/interview/turn` call resolves. The whole round-trip (STT → turn → TTS start) gates the signal update.

**What I'd add:**
- A `GET /api/interview/stream?sessionId=…` SSE endpoint that watches for new assistant turn rows via Postgres `LISTEN/NOTIFY` or polling.
- The client subscribes on mount. When a new turn is committed server-side, the signal update pushes immediately — independently of whether TTS has started playing.
- This gives a recruiter a live view of the decision panel on a separate screen while the candidate is in the room.

**Why it's an architectural upgrade:** Right now the decision panel and the audio playback share the same promise chain in the client FSM. Decoupling them means signals can be updated the moment they're persisted (step 7 of the engine algorithm), while TTS plays in parallel. It also opens the door to a recruiter dashboard (separate tab, same session) without any polling.

---

## 4. TTS streaming with pre-fetch

**Current state:** TTS is fetched via `GET /api/tts?sessionId=…&turnIndex=…` as a blocking request after the turn resolves. The audio doesn't start until the route responds with the first byte.

**What I'd add:**
- In the turn route, after persisting the assistant turn, **kick off the TTS request in the background** and stream the response into a `Buffer`. Store it as a Vercel Blob or R2 object keyed by `(sessionId, turnIndex)`.
- The TTS route checks the cache first; on a cache hit it streams from blob storage (fast, no ElevenLabs RTT). On miss it falls back to the live ElevenLabs call.
- Pre-fetch the *next* question's TTS speculatively if `isFinal === false` and signals suggest a likely follow-up.

**Why:** ElevenLabs `eleven_flash_v2_5` adds ~300–600ms of latency before first byte. Blob storage serves in <50ms. The candidate experiences zero perceptible gap between the question appearing on screen and audio starting. The speculative pre-fetch is the kind of detail that makes a product feel alive.

---

## 5. Structured logging and distributed tracing

**Current state:** There is no logging or tracing. Debugging a failed session means reading the raw Postgres `meta` JSONB on turns.

**What I'd add:**
- [Pino](https://getpino.io) (structured JSON logger) wired into a Vercel log drain → Axiom or Datadog.
- Every request gets a `requestId` header (generated by middleware); every downstream call (OpenAI, ElevenLabs) gets a `traceId` that correlates to the session.
- A `turns.meta.traceId` column so every assistant turn is linkable to the exact LLM call that generated it, including input/output tokens, latency, and model version.
- OpenTelemetry spans around the three expensive steps: STT, LLM turn, TTS.

**Why:** The moment you have real users, "something felt wrong in my interview" becomes a support ticket. Without tracing, the only signal is "the evaluation score seemed low." With tracing you can replay the exact token budget, spot guardrail overrides, and see which engine output failed schema validation. This is table stakes for any production AI product.

---

## 6. Rate limiting and cost guardrails

**Current state:** None. Anyone who finds a session URL can call `/api/interview/turn` indefinitely.

**What I'd add:**
- [Upstash Redis](https://upstash.com) + `@upstash/ratelimit` in a Next.js middleware layer.
- Per-session limits: max 30 turn calls (already guarded server-side by `HARD_CAP=14`, but rate limiting adds defense-in-depth at the edge).
- Per-IP limits on `/api/stt`: max 60 calls/hour (prevents audio flooding the ElevenLabs quota).
- A Vercel spend alert at 80% of the monthly OpenAI/ElevenLabs budget, wired to PagerDuty or a Slack webhook.
- `sessions.tokenUsage` JSONB column: persist `{ promptTokens, completionTokens, ttsChars }` per turn so cost attribution is queryable per session and per job.

---

## 7. Question pack management

**Current state:** Question packs live as JSON files in `src/data/question-packs/`. Adding a new role or editing a rubric requires a deploy.

**What I'd add:**
- Move packs into a `question_packs` table: `slug`, `jobId` FK, `payload` JSONB. Seed from the existing JSON on first deploy.
- A minimal admin UI at `/admin/packs` (behind a `ADMIN_SECRET` env check, no full auth needed for v1): view, clone, and edit a pack's rubric and question items.
- A `version` integer on packs so in-flight sessions always see the pack they started with (the session row stores `packSlug + packVersion` at creation time).

**Why architecturally:** Right now the question pack slug is stored on the job, but the actual JSON is read from disk at runtime. The `loadResults()` helper already does this lookup. Migrating to a DB-backed pack is a drop-in replacement for that loader — the rest of the system is already abstracted behind the `QuestionPack` Zod type.

---

## 8. Testing pyramid

**Current state:** No tests.

**What I'd add, in priority order:**

1. **Unit tests for pure logic** (Vitest): `computeMetrics()`, `buildSystem()`, `buildUser()`, and all the guardrail logic in `rules.ts`. These are pure functions and trivially testable.
2. **Integration tests for routes** (Vitest + `next-test-api-route-handler`): `/api/stt`, `/api/interview/turn`, `/api/interview/end` against a local Neon branch. The unique-index concurrency test (spec 04's 409 acceptance case) is the one I'd write first — it's the scenario most likely to regress silently.
3. **E2E smoke test** (Playwright): jobs page → start session → three turn round-trips with mocked STT/TTS → end → verify results page renders a score. Run in CI on every PR.

**Architectural note:** The main reason tests are easy to add here is that the code is already well-separated. The engine (`prompt.ts`, `engine.ts`, `rules.ts`) has no Next.js coupling — it's pure functions over typed inputs. That's intentional, and it pays off the moment you write the first test.

---

## 9. Multi-tenant / recruiter workspace (v2 scope)

If this became a real product:

- `organizations` table; jobs, sessions, and packs are scoped to an org.
- Recruiters get a workspace at `/org/[slug]/` with their job catalog, aggregate analytics, and the ability to replay any session.
- Candidates are still URL-only, but the URL embeds a signed `inviteToken` that scopes them to one job and one session.
- Evaluation rubrics become recruiter-configurable through the pack admin UI (item 7 above), with a prompt-preview tool so they can see how rubric changes affect the interviewer's behavior before going live.

---

## Priority order if I had one more week

| # | Item | Why first |
|---|---|---|
| 1 | Auth + session ownership | Turns a demo into a product |
| 2 | Structured logging + tracing | Essential before real users; bugs are invisible without it |
| 3 | Background evaluation queue | Removes the last fragile synchronous LLM call in the request path |
| 4 | Unit + integration tests | Guardrail logic is the highest-regression-risk code; test it first |
| 5 | Rate limiting | Cost and abuse protection before any public URL sharing |
| 6 | TTS pre-fetch/cache | Biggest perceived latency win for zero backend complexity change |
| 7 | Spec 07 (replay/analytics) | High demo value; fully designed, purely additive |
| 8 | Spec 06 (video mode) | Nice UX differentiator; requires the `useMediaStream` refactor |
| 9 | Question pack admin UI | Needed the moment a non-engineer wants to edit a rubric |
| 10 | Multi-tenancy | Only when there are multiple recruiters who need isolation |
