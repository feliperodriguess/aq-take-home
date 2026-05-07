# 07 — Replay & Analytics (Stretch Goal #4)

> **Status:** stretch goal. Implement only after specs 00–05 ship and the core voice flow is solid.
> **Design reference:** the handoff doesn't include a history view. Build it in the same editorial vocabulary as `JobsView.jsx` (eyebrow + display-serif headline + apricot full-stop) and reuse score chips from `ResultsView.jsx`.

## Goal
Give a visitor a global view of completed interviews and a richer per-session view, with three concrete deliverables:

1. **`/history`** — a global feed of completed sessions, filterable by role, with a score-trend sparkline.
2. **`/sessions/[sessionId]` enhancement** — a metric strip (duration, talk ratio, topic coverage, follow-up density) **and** an audio-replay affordance on each assistant turn (re-streams TTS via the existing route).
3. **Honest talk-ratio data** — capture candidate utterance duration in the client and persist it to `turns.meta.durationSec`.

Per user direction: **all changes are additive notes; specs 03 and 04 are not edited.** The contract extensions described below are implemented at build time alongside this stretch goal.

## Out of scope
- Per-user accounts, login, "my sessions" filtering. The history page lists everyone's completed sessions globally (per the brainstorming decision — URL-as-credential remains for individual session reads).
- Session search, deletion UI, CSV/JSON export.
- Video replay (we don't store video — see spec 06).
- Candidate audio playback — we don't store candidate audio. Replay is assistant-audio + transcript only.
- A charting library. The score-trend sparkline is hand-rolled SVG; no Recharts/Chart.js.

## Surface

### Route: `GET /history` (Server Component)
Public-read. Search params:
- `role` — optional `jobs.slug`. When present, filters the list and the trend chart.
- `cursor` — optional ISO timestamp for pagination (load more = sessions older than this `endedAt`).

Renders:
1. Editorial header — `Replay & insights.` with "insights" italicized and "." in apricot.
2. Role filter chips: "All", plus one per seeded job. Implemented as `<Link>` to `/history?role=…` — **no client state**.
3. Score-trend sparkline above the list, computed from the filtered set in chronological order.
4. Session cards (newest first), 12 per page.
5. "Load older" link at the bottom (`<Link>` to `?cursor=…`), or nothing if no more.

### Route: `/sessions/[sessionId]` (extension)
Spec 05's results page gains two additions; everything else is unchanged:
- A `<MetricsStrip/>` rendered between `<ScoreHeader/>` and `<CompetencyTable/>`.
- The existing transcript section is rendered with `replayable={true}`, enabling per-assistant-turn play buttons.

### Header link
Add a single "History" link in the top header on `/`, `/sessions/[id]`, and `/history` itself. Skip in `/interview/[id]` to avoid mid-interview distraction.

## Data flow

**No new tables.** Every metric is a pure derivation over existing rows.

```
sessions ⋈ jobs ⋈ evaluations          (one row per completed session)
                  └── turns             (loaded per session for talk-ratio + follow-up density)
                  └── question-pack    (loaded for rubric size in topic coverage)
```

### `src/lib/history-loader.ts`
Single Drizzle query, completed sessions only:

```ts
export type HistoryRow = {
  sessionId: string
  jobSlug: string
  jobTitle: string
  endedAt: Date
  durationSec: number
  overallScore: number
  recommendation: Evaluation["recommendation"]
  talkRatio: number               // 0..1
  topicCoverage: number           // 0..1
}

export async function loadHistory(opts: {
  role?: string
  cursor?: Date
  limit?: number               // default 12
}): Promise<{ rows: HistoryRow[]; nextCursor: Date | null }>
```

The loader does the join, then per-row computes `talkRatio` and `topicCoverage` via the helpers in `src/lib/metrics/compute.ts`. For pagination, return `nextCursor = rows[rows.length - 1].endedAt` when `rows.length === limit`.

> Per-row `turns` aggregation is fine for v1 scale (≤ thousands of rows). If counts grow, denormalize talk-ratio onto `evaluations.payload` at end-of-session — defer until needed.

### `src/lib/metrics/compute.ts`
Pure functions, no IO:

```ts
import { z } from "zod"

export const SessionMetricsSchema = z.object({
  durationSec: z.number().int().nonnegative(),
  talkRatio: z.number().min(0).max(1),         // candidate seconds / total seconds
  topicCoverage: z.number().min(0).max(1),     // covered competencies / rubric size
  followUpDensity: z.number().min(0).max(1),   // follow-up assistant turns / all assistant turns
  questionCount: z.number().int().nonnegative(),
  followUpCount: z.number().int().nonnegative(),
})
export type SessionMetrics = z.infer<typeof SessionMetricsSchema>

export function computeMetrics(input: {
  session: SessionRecord
  turns: TurnRecord[]
  evaluation: Evaluation
  pack: QuestionPack
}): SessionMetrics
```

Definitions (chosen for honesty over flattering numbers):

| Metric | Formula |
|---|---|
| `durationSec` | `(session.endedAt - session.startedAt) / 1000`, floored to int. |
| `talkRatio` | `sumCandidateSec / (sumCandidateSec + sumAssistantSec)`. See "Duration capture" below. |
| `topicCoverage` | `evaluation.perCompetency.filter(c => c.score >= 5).length / pack.rubric.length`. Uses the evaluator's scores (more reliable than the live decision-panel signals). |
| `followUpDensity` | `assistantTurns.filter(t => t.meta?.isFollowUp).length / assistantTurns.length`. Already written by the engine to `turns.meta.isFollowUp` per spec 04. |
| `questionCount` | `assistantTurns.length`. |
| `followUpCount` | numerator of `followUpDensity`. |

### Duration capture (talk-ratio honesty)

The current spec 04 contract for `/api/interview/turn` does **not** include candidate duration. To compute talk-ratio honestly we need it. Two values get persisted into `turns.meta`:

- `meta.durationSec` on **candidate** turns — the wall-clock duration of the candidate's recording.
- `meta.durationSec` on **assistant** turns — the duration of the synthesized TTS audio.

**Candidate duration.** Already captured in the browser by `MicButton` (`MediaRecorder.start()` → `MediaRecorder.stop()` timestamps, ms-precision). Currently dropped on the floor. This stretch goal extends the existing contract by one optional field — purely additive — and the extension lives in this spec, not in spec 04:

```ts
// Additive contract change (implementers apply this when shipping spec 07)
export const TurnRequestSchema = z.object({
  sessionId: z.string().uuid(),
  candidateUtterance: z.string().optional().nullable(),
  candidateDurationSec: z.number().nonnegative().optional().nullable(),  // NEW
})
```

The turn route writes `candidateDurationSec` into the candidate-turn row's `meta.durationSec` when persisting it. Field is optional and backwards-compatible — older clients (or the bootstrap call with `candidateUtterance: null`) simply don't send it and pre-existing turns continue to compute talk-ratio with `0` for missing values.

**Assistant duration.** Two paths, in priority order:
1. The TTS route can opportunistically write a `meta.durationSec` to the assistant turn after streaming finishes, by inspecting `Content-Length` and the chosen MP3 bitrate, OR by buffering and decoding via `decodeAudioData` server-side. Both are awkward; defer.
2. **Estimator (default for v1):** at compute time in `metrics/compute.ts`, estimate assistant duration as `text.length * 0.06` seconds (≈ 1000 chars/min, the rate `eleven_flash_v2_5` produces in our samples). Document this clearly:
   ```ts
   // metrics/compute.ts
   const ASSISTANT_SEC_PER_CHAR = 0.06   // estimate; eleven_flash_v2_5 ≈ 1000 chars/min
   ```
   Replace with the real value if/when we capture it. The estimator is good enough for relative ratios (which is what the bar visualizes); it does **not** claim ms-precision.

If a candidate turn is missing `meta.durationSec` (older row, or the bootstrap turn), fall back to the same estimator-with-words for that row only — `text.split(/\s+/).length * 0.4` seconds. Not perfect, but symmetric with the assistant fallback.

## Page composition

```
src/
  app/
    history/
      page.tsx                    # RSC: parses ?role / ?cursor, calls loadHistory(), renders shell
      _components/
        history-list.tsx          # session cards (server)
        history-card.tsx          # single card (server)
        score-trend-chart.tsx     # client: tiny SVG sparkline
        role-filter.tsx           # server: <Link>s, no state
    sessions/[sessionId]/
      page.tsx                    # extended (per spec 05) to include MetricsStrip + replay
      _components/
        metrics-strip.tsx         # NEW: server component, renders SessionMetrics
        replay-transcript.tsx     # NEW: client wrapper around shared TranscriptList
        _hooks/
          use-replay-player.ts    # NEW: client; one-at-a-time TTS audio coordinator
  components/
    transcript-list.tsx           # existing (lifted in spec 05); gains `replayable?: boolean` prop
  lib/
    metrics/
      compute.ts                  # pure metric helpers
      types.ts                    # SessionMetricsSchema (re-exported)
    history-loader.ts             # paginated query + per-row metrics
```

> Filenames kebab-case per spec 00. Component identifiers exported from each file remain PascalCase.

### `score-trend-chart.tsx`
Plain client component, 100% inline SVG, no chart library:

- Input: `points: { endedAt: Date; overallScore: number }[]` (chronological). The chart receives the **full filtered set**, not the paginated page — the loader exposes a separate `loadHistoryTrend({ role })` helper that returns just `(endedAt, overallScore)` pairs (cap at 200 points). This way the trend stays stable as the user pages through the list.
- Renders an `<svg viewBox="0 0 320 60">` with one `<polyline>` over an `<rect>` background.
- Uses `--color-accent` for the line, `--color-bg-tint` for the area fill, `--color-fg-3` for the y-axis tick at `5/10`.
- Empty state: a muted 1-line "Not enough sessions yet" placeholder.
- ≤ 80 lines of code. If it grows past that, the polyline math is wrong.

### `history-card.tsx`
One row in the feed:
```
┌────────────────────────────────────────────────────────────┐
│  may 2 · 3:14 pm                            ⬤ hire        │
│  Frontend Engineer                                         │
│                                                            │
│  ────────────  7.4 / 10  · 14 questions · 9m 12s          │
│  talk ratio  ▰▰▰▰▰▰▱▱▱▱  62%                              │
│                                                            │
│                                              Replay  →    │
└────────────────────────────────────────────────────────────┘
```

Card is a `<Link>` to `/sessions/[sessionId]`. Hover state uses the card's existing hover variant (spec 00 / shadcn). Apricot accent on the score chip uses the same recommendation→color map as `ResultsView.jsx`.

### `metrics-strip.tsx`
Inserted on `/sessions/[sessionId]` between `<ScoreHeader/>` and `<CompetencyTable/>`. Four pills in a row:

```
┌─────────────┬─────────────┬───────────────┬───────────────────┐
│ Duration    │ Talk ratio  │ Topic coverage│ Follow-up density │
│ 9m 12s      │ 62%         │ 4 / 5  (80%)  │ 3 / 8  (38%)      │
└─────────────┴─────────────┴───────────────┴───────────────────┘
```

The talk-ratio cell includes the same mini bar used in `history-card`. Stack vertically on mobile.

### `replay-transcript.tsx` and `use-replay-player.ts`
Existing `transcript-list.tsx` (lifted in spec 05) receives a new optional prop:

```ts
type TranscriptListProps = {
  turns: TurnView[]
  replayable?: boolean       // NEW; default false
  sessionId?: string         // NEW; required when replayable
}
```

When `replayable` is true, each assistant-role bubble renders a small play button (Phosphor `Play` / `Pause`). All play buttons share one `<audio>` element coordinated by `use-replay-player.ts`:

```ts
export function useReplayPlayer(): {
  playing: number | null
  play: (turnIndex: number, sessionId: string) => void
  stop: () => void
}
```

Behaviour:
- Clicking a play button on turn N: stop any other turn's audio, set `<audio src="/api/tts?sessionId=…&turnIndex=N">`, `audio.play()`.
- Clicking the same turn while it's playing: pause and reset.
- The route used is the existing `/api/tts` from spec 04 — it already streams the synthesized audio for any `(sessionId, turnIndex)` pair. **No backend changes.**
- On `audio.onended`, clear `playing`. On `onerror`, clear and surface a tiny inline "Audio unavailable" beneath that turn (do not toast; replay errors are low-stakes).

Click-to-focus: clicking the bubble body (anywhere except the play button) calls `el.scrollIntoView({ behavior: "smooth", block: "center" })`. Useful when scanning a long interview.

## Privacy / consistency
- `/history` lists role title + score + recommendation + endedAt + duration. **No transcript content** appears on the index. Transcripts only appear when the user follows a card link to `/sessions/[id]`. This keeps the URL-as-credential model from spec 00 mostly intact while honouring the global-feed decision: someone who lands on `/history` cannot read what was said without explicitly opening a session.
- Document this trade-off in the page header subtitle ("Public archive of recent interviews. Open one to read the conversation.") so the choice isn't ambiguous to a visitor.

## Touch points on existing specs

**Additive only — specs 03 and 04 are not edited.** Implementers of this stretch goal apply the following deltas alongside the work in this spec:

| Surface | Spec | Additive change |
|---|---|---|
| `TurnRequest` Zod schema | 01 (used by 03/04) | Add optional `candidateDurationSec: z.number().nonnegative().optional().nullable()`. |
| `mic-button.tsx` callsite | 03 | Capture `(stopTime - startTime) / 1000`, pass alongside the transcript into the turn POST body. |
| `/api/interview/turn` route | 04 | When persisting the candidate turn, write `candidateDurationSec` into `turns.meta.durationSec`. |
| `transcript-list.tsx` | 05 | New optional `replayable` + `sessionId` props (no behaviour change when false). |

All four are backwards-compatible.

## Pagination & caching
- The history page is a Server Component reading from Postgres. Next.js 16 Route Handlers and RSCs are uncached by default — DB reads make them dynamic automatically (spec 00). No `export const dynamic` needed.
- After `/api/interview/end` writes a new evaluation, call `revalidatePath("/history")` in addition to the existing `revalidatePath("/sessions/" + id)` so the new card appears immediately. **Implementer's note:** this is the one line to add inside the existing `end` route logic — no schema or contract change.

## Performance budget
| Step | Target p50 | Hard ceiling |
|---|---|---|
| `/history` SSR (12 rows + per-row metrics) | < 250ms | 800ms |
| `/sessions/[id]` SSR with metrics-strip | < 200ms | 600ms |
| TTS replay time-to-first-byte | identical to spec 00 (< 800ms / 2s) | — |

If `/history` SSR exceeds the ceiling at scale, denormalize talk-ratio onto `evaluations.payload` at end-of-session time (single field add to `EvaluationSchema`, written from `metrics/compute.ts` inside the `end` route). Defer until measured.

## Files

| File | Status | Purpose |
|---|---|---|
| `src/app/history/page.tsx` | NEW | Server component: parses search params, renders shell. |
| `src/app/history/_components/history-list.tsx` | NEW | Server: paginated card list. |
| `src/app/history/_components/history-card.tsx` | NEW | Server: single session card. |
| `src/app/history/_components/score-trend-chart.tsx` | NEW | Client: SVG sparkline. |
| `src/app/history/_components/role-filter.tsx` | NEW | Server: filter chips as `<Link>`s. |
| `src/app/sessions/[sessionId]/_components/metrics-strip.tsx` | NEW | Four-pill metric strip. |
| `src/app/sessions/[sessionId]/_components/replay-transcript.tsx` | NEW | Client wrapper around shared `TranscriptList`. |
| `src/app/sessions/[sessionId]/_components/_hooks/use-replay-player.ts` | NEW | One-at-a-time audio coordinator. |
| `src/lib/metrics/compute.ts` | NEW | Pure metric helpers. |
| `src/lib/metrics/types.ts` | NEW | `SessionMetricsSchema` + type. |
| `src/lib/history-loader.ts` | NEW | Paginated query + per-row metrics. |
| `src/components/transcript-list.tsx` | EXTEND | Optional `replayable` + `sessionId` props. |

## Open questions
- Show a "best score" or "latest score" callout in the history header? Tempting but YAGNI for v1; the sparkline already conveys trend.
- Group cards by week/month? Single chronological list is simpler and reads fine at this scale.

## Acceptance checklist
- [ ] `/history` lists completed sessions globally, newest first, with role + score + recommendation + duration on each card. No transcript content on the index.
- [ ] `?role=<slug>` filter narrows both the card list and the score-trend sparkline.
- [ ] Pagination via `?cursor=<iso>` returns rows older than the cursor; "Load older" disappears when no more rows exist.
- [ ] Score-trend sparkline renders an empty-state placeholder when fewer than 2 sessions match the filter.
- [ ] `/sessions/[sessionId]` shows the four-pill `<MetricsStrip/>` between `<ScoreHeader/>` and `<CompetencyTable/>`.
- [ ] Each assistant turn on `/sessions/[sessionId]` has a working play button that streams TTS via `/api/tts` and respects "one-at-a-time" playback.
- [ ] Talk-ratio uses real candidate duration from `turns.meta.durationSec` when present; falls back to a documented word-rate estimator when missing.
- [ ] After a new interview ends, the new card appears on `/history` without a manual refresh (`revalidatePath("/history")` was called).
- [ ] No new DB tables. No new env vars. The `EvaluationSchema` in `src/types/interview.ts` is unchanged.
- [ ] Files in spec 03 and spec 04 are not edited; the additive contract notes above are applied at implementation time.
