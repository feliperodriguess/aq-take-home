# 03 — Interview Room UI

> **Design reference:** `iris-ai-ui-handoff/project/interviewer/InterviewRoom.jsx`.
> ⚠️ **The handoff layout supersedes the side-panel ASCII sketch below.** The actual design is **centered**: a pulsing apricot orb (`<IrisAvatar speaking />`) in the middle, the current question rendered large in display-serif beneath, recent transcript turns immediately below the question, and the decision panel as a **collapsible right rail** (toggleable). Top bar has persona name + role + timer + end button; bottom has mic / video / end controls.
> Keep the FSM, API contracts, and behaviour from this spec — only the visual composition differs.

## Goal
Build the candidate-facing experience at `/interview/[sessionId]`: voice-driven turn-taking, live transcript, and the "decision panel" (stretch goal #1) showing rubric signals and the interviewer's rationale.

## Out of scope
- LLM/STT/TTS server logic (spec 04).
- Final evaluation page (spec 05).
- Pack content (spec 01).

## Layout

Two-column on desktop (`lg:grid-cols-[1fr_360px]`), single-column stacked on mobile.

```
┌──────────────────────────────────────────────┬─────────────────────┐
│  ROLE: Frontend Engineer            [End ▸]  │  DECISION PANEL     │
│  ────────────────────────────────────────    │  ─────────────────  │
│                                              │  Skills detected    │
│   ●  AI    "Tell me about a time you…"       │   • React  0.8     │
│        ↳ playing audio waveform              │   • A11y   0.4     │
│                                              │                     │
│   ◐  You   (transcribing…)                   │  Topics covered     │
│            "I'd start by mapping the…"       │   ✓ component       │
│                                              │     design          │
│                                              │  Gaps               │
│  ──────────────────────────────────────      │   • performance     │
│                                              │   • testing         │
│  [ 🎙  Hold to talk  ]   "ready"             │                     │
│                                              │  Why next question  │
│                                              │   "Probe perf since │
│                                              │    candidate hasn't │
│                                              │    discussed it"    │
└──────────────────────────────────────────────┴─────────────────────┘
```

## Page composition

```
src/app/interview/[sessionId]/
  page.tsx                  # RSC: validates session, hydrates initial data, renders shell
  _components/
    interview-room.tsx      # 'use client' — top-level orchestrator (state machine)
    transcript.tsx          # renders turn list, auto-scrolls
    mic-button.tsx          # MediaRecorder wrapper
    decision-panel.tsx      # signals + rationale
    assistant-audio.tsx     # hidden <audio>, plays TTS
    status-pill.tsx         # "ready / listening / thinking / speaking"
```

> Filenames are kebab-case (per spec 00); component identifiers exported from each file remain PascalCase (e.g., `export function InterviewRoom()`).

### Server boundary
`page.tsx` (RSC) does:
1. Read `sessionId` from `await params`.
2. Look up the session by ID. If missing → `notFound()`. If `status === "completed"` → `redirect("/sessions/" + sessionId)`.
3. Load the job (`title`, `longDescription`) and any existing turns (in case of reload mid-interview).
4. Render `<InterviewRoom>` with initial props.

```ts
// page.tsx (sketch)
import { notFound, redirect } from "next/navigation"
import { loadInterview } from "@/lib/interview-loader"

export default async function InterviewPage(
  _: unknown,
  ctx: RouteContext<'/interview/[sessionId]'>,
) {
  const { sessionId } = await ctx.params
  const data = await loadInterview(sessionId)
  if (!data) notFound()
  if (data.session.status === "completed") redirect(`/sessions/${sessionId}`)
  return <InterviewRoom initial={data} />
}
```

`loadInterview` lives in `src/lib/interview-loader.ts` and is reused by spec 05's results page.

## Client state machine

`InterviewRoom` owns a single reducer-style state. Only one transition path through the loop.

```
            ┌─────────────┐
            │    idle     │ ← also entered on first mount when assistant turn 0 hasn't been requested yet
            └──────┬──────┘
   click "talk"    │
            ┌──────▼──────┐
            │  listening  │ ← MediaRecorder collecting audio
            └──────┬──────┘
   click "stop"    │
            ┌──────▼──────┐
            │ uploading   │ → POST /api/stt
            └──────┬──────┘
                   │ on transcript
            ┌──────▼──────┐
            │  thinking   │ → POST /api/interview/turn
            └──────┬──────┘
       on response │
            ┌──────▼──────┐
            │  speaking   │ → <audio src="/api/tts?turnId=…"> playing
            └──────┬──────┘
   on `ended`      │
                   ├─── if response.isFinal → done → POST /api/interview/end → router.push("/sessions/:id")
                   └─── else → idle (loop)
```

`error` is a transient overlay state that captures the last action so the user can retry without losing transcript.

```ts
type Phase =
  | { kind: "idle" }
  | { kind: "listening" }
  | { kind: "uploading"; audio: Blob }
  | { kind: "thinking" }
  | { kind: "speaking"; question: string; audioUrl: string }
  | { kind: "done" }
  | { kind: "error"; message: string; retry: () => void }
```

A small `useReducer` in `InterviewRoom` handles transitions; child components consume slices via context or props.

## Push-to-talk: `MicButton`

- Permission requested lazily on first click (`navigator.mediaDevices.getUserMedia({ audio: true })`).
- Uses `MediaRecorder` with `mimeType: "audio/webm;codecs=opus"` if supported, falling back to default.
- Records into chunks; on stop, concatenates into a single `Blob` and emits it.
- Visual: large round button with phosphor `Microphone` icon. Hold-to-talk OR click-to-toggle — implement **click-to-toggle** for simpler keyboard accessibility (Space toggles).
- Spinner overlay when phase is `uploading`/`thinking`. Disabled when phase is `speaking`/`done`.

```ts
// MicButton.tsx (sketch)
const start = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const rec = new MediaRecorder(stream, { mimeType: pickMime() })
  const chunks: Blob[] = []
  rec.ondataavailable = e => chunks.push(e.data)
  rec.onstop = () => {
    onUtterance(new Blob(chunks, { type: rec.mimeType }))
    stream.getTracks().forEach(t => t.stop())
  }
  rec.start()
  recRef.current = rec
}
```

`pickMime()` chooses the first `MediaRecorder.isTypeSupported(...)` from `["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]`. Pass the actual `mimeType` upstream so the STT route can read it.

## STT call

Send the `Blob` as the request body with `Content-Type: blob.type`. The route returns `{ transcript, durationSec }` (defined in spec 04).

```ts
const res = await fetch("/api/stt", {
  method: "POST",
  headers: { "Content-Type": audio.type || "audio/webm" },
  body: audio,
})
```

If the transcript is empty (no speech detected), surface a friendly toast — "Couldn't hear you, try again" — and return to `idle` without persisting a turn.

## Turn call

```ts
const res = await fetch("/api/interview/turn", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ sessionId, candidateUtterance: transcript }),
})
const { question, signals, isFinal, turnIndex } = TurnResponseSchema.parse(await res.json())
```

On success:
1. Append the candidate turn (user said `transcript`) and the assistant turn (text `question`) to local state.
2. Push `signals` into the decision panel.
3. Transition to `speaking` with `audioUrl = /api/tts?turnIndex=${turnIndex}&sessionId=${sessionId}` (no body — server looks up the turn text).

## TTS playback: `AssistantAudio`

```tsx
<audio
  ref={audioRef}
  src={audioUrl}
  autoPlay
  onEnded={onSpeakEnd}
  onError={onSpeakError}
/>
```

- Use a *route URL* (not a blob URL) so the browser can stream MP3 progressively. The route in spec 04 sets `Content-Type: audio/mpeg` and proxies the ElevenLabs stream.
- **Autoplay caveat:** browsers block autoplay until the page has had user interaction. The first turn's audio is requested *after* the user has clicked the mic button (turn 0 is bootstrapped on mic click — see "Bootstrapping" below), so autoplay is permitted.
- If `onError` fires (mid-stream issue, codec hiccup), fall back to fetching the URL as a blob, creating an object URL, and reassigning `src`.

## Bootstrapping (turn 0)

When the page mounts and there are no prior turns, we don't immediately call the LLM. Instead the UI shows a "Click the mic when you're ready" prompt. On the **first** mic click we hit `/api/interview/turn` with `candidateUtterance: null`, which makes the engine produce the opening question. This guarantees the user has interacted before any audio plays (autoplay-safe) and gives them control over when the interview starts.

## Transcript

`Transcript` renders an array of `{ index, role, text, status }` items. Items with `status: "playing"` get a subtle pulsing indicator on the assistant bubble. New items auto-scroll into view (`scrollIntoView({ behavior: "smooth", block: "end" })` on the bottom anchor).

Show the candidate's text as it arrives from STT (no incremental display — STT is one-shot). Optimistically show "Transcribing…" placeholder during `uploading`.

## Decision panel

Pure render of the most recent `Signals` plus a "thinking" indicator when phase ∈ `{uploading, thinking}`.

Sections:
- **Skills detected** — chips with confidence rendered as a thin progress bar; sorted by confidence desc.
- **Topics covered** — checked items keyed by topic id (resolved against the rubric for nicer labels).
- **Gaps** — chips, muted styling.
- **Why next question** — italic blockquote with `signals.rationale`.

When `phase.kind === "thinking"` overlay the rationale section with a "Reasoning…" pulse. Keep prior signals visible underneath for continuity.

## End-of-interview

When a turn response has `isFinal: true`:
1. Play the final assistant audio as normal (it'll be the closing remark).
2. On `onEnded`, POST `/api/interview/end` with `{ sessionId }`.
3. On 200 response, `router.push("/sessions/" + sessionId)` — Next.js Server Component will render the results page.
4. While the end call is in flight (1–8s for evaluation generation), show a full-screen overlay: "Wrapping up…" with a subtle progress indicator.

There is also a manual "End interview" button in the header that triggers the same flow at any point. Confirms first via shadcn dialog.

## Error UX
- STT empty: toast, return to `idle`.
- Turn call 5xx: toast with "Retry", phase → `error`. The retry rebuilds the request from local state (the candidate turn is **not** re-recorded; we kept the transcript).
- Turn call 410 (session ended): redirect to results.
- TTS failure: skip audio, advance to next turn (transcript still shows the question).
- Mic permission denied: full-page error with "Open browser settings" link.

## Styling notes
- Tailwind v4 + shadcn (Base UI). Use the existing `src/components/ui/button.tsx` and add `card`, `dialog`, `toast` via `pnpm dlx shadcn add`.
- Phosphor icons (`@phosphor-icons/react`): `Microphone`, `MicrophoneSlash`, `SpinnerGap`, `CheckCircle`.
- The decision panel has its own subtle border + slightly different background to read as "system view, not chat".

## Open questions
- Show interim STT transcript? ElevenLabs has a realtime Scribe WebSocket (`speechToText.realtime.connect`) — out of scope for v1. Just show "Transcribing…" while the prerecorded `convert()` round-trips.
- Do we visualize mic input level during `listening`? Nice-to-have via Web Audio `AnalyserNode`. Ship without if time-constrained.

## Acceptance checklist
- [ ] Page 404s on a non-existent session id and redirects to results when status is `completed`.
- [ ] First mic click triggers turn 0 (no auto-talking before user interaction).
- [ ] Push-to-talk records audio, uploads to `/api/stt`, and surfaces transcript.
- [ ] Decision panel updates on every turn response and shows a "thinking" state.
- [ ] TTS audio autoplays without browser block on the first turn.
- [ ] `isFinal: true` triggers a smooth handoff to `/sessions/[id]`.
- [ ] Refreshing mid-interview restores the transcript from DB and resumes from `idle`.
- [ ] Mic permission denial renders an actionable error, not a stuck spinner.
