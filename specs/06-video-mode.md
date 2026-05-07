# 06 — Video Mode (Stretch Goal #3)

> **Status:** stretch goal. Implement only after specs 00–05 ship and the core voice flow is solid.
> **Design reference:** the handoff's `InterviewRoom.jsx` already gestures at a video toggle in the bottom-controls row. This spec defines the actual behaviour.

## Goal
Add an **opt-in candidate self-view** to `/interview/[sessionId]` so the room reads like a video call. The interview itself is unchanged — voice in, voice out, decision panel, FSM, contracts. Video is purely the interface/UX layer (per the take-home wording).

## Out of scope
- Recording or storing candidate video. Nothing leaves the browser.
- Picture-in-picture, background blur, virtual backgrounds, multi-camera.
- Pre-room device-check page (camera/mic preview screen). Overkill for a stretch goal.
- Video replay on the results page — covered by spec 07's stance on "no candidate audio/video stored."
- Server / DB / schema changes. Zero.

## Constraints
- **No persistence.** Camera frames stay in the browser; we never `fetch()` them anywhere. This sidesteps PII storage, blob storage cost, and migration work.
- **Voice-first.** Toggling video off must never affect mic capture or any in-flight turn.
- **One `getUserMedia` owner.** The current `mic-button.tsx` (spec 03) calls `getUserMedia({ audio: true })` directly. If we add a separate camera call, two `MediaStream`s end up fighting over device permissions and we get inconsistent track lifecycles. This spec consolidates ownership into a single hook (see Architecture).

## Architecture

```
src/app/interview/[sessionId]/_components/
  interview-room.tsx        # existing — gains <SelfView/> + <VideoToggle/> in the layout
  mic-button.tsx            # existing — refactored to read audio off the shared hook
  self-view.tsx             # NEW — small <video> tile, bottom-right of the room
  video-toggle.tsx          # NEW — bottom-controls button, paired with the mic
  _hooks/
    use-media-stream.ts     # NEW — owns the room's MediaStream lifecycle
```

> Filenames are kebab-case per spec 00; exported component identifiers stay PascalCase (`export function SelfView()`).

### `use-media-stream.ts`
Single source of truth for the room's media tracks. Owns one `MediaStream` reference and adds/removes tracks as the user toggles audio/video.

```ts
// _hooks/use-media-stream.ts (sketch)
export type MediaStreamApi = {
  audioTrack: MediaStreamTrack | null
  videoTrack: MediaStreamTrack | null
  stream: MediaStream | null            // composite, for elements that want both
  enableAudio: () => Promise<void>      // called by mic-button on first record start
  enableVideo: () => Promise<void>      // called by video-toggle
  disableVideo: () => void              // stops + removes the video track
  permissionError: { kind: "audio" | "video"; reason: string } | null
}

export function useMediaStream(): MediaStreamApi { /* ... */ }
```

Implementation notes:
- `enableAudio` / `enableVideo` each call `getUserMedia` for **only** the constraint they own (`{ audio: true }` or `{ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" } }`), then `addTrack` the result onto the shared `MediaStream`. This avoids re-prompting permission for an already-granted device.
- `disableVideo` calls `track.stop()` on the video track and removes it from the stream — the camera light goes off immediately. **This is a UX requirement, not just bookkeeping.**
- On unmount, stop every track. The component must not leave hot tracks behind on navigation.
- `permissionError` is set on `NotAllowedError` / `NotFoundError` from `getUserMedia` and surfaced in the matching UI (mic button or video toggle).

### `mic-button.tsx` refactor
The current `mic-button.tsx` (per spec 03) calls `getUserMedia` itself. Replace that with `const { audioTrack, enableAudio } = useMediaStream()`; on click, ensure `audioTrack` exists (`await enableAudio()` if not), then build a fresh `MediaRecorder(new MediaStream([audioTrack]), { mimeType: pickMime() })` for the utterance. The audio track stays alive across utterances — only the recorder is per-utterance.

This is a **behaviour-preserving refactor**, not a feature change. Mic-only sessions behave identically.

### `self-view.tsx`
```tsx
export function SelfView({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  if (!stream) return null
  return (
    <div className="fixed bottom-24 right-6 w-[180px] h-[135px] rounded-lg overflow-hidden border border-border-strong bg-bg-canvas shadow-lg">
      <video ref={ref} autoPlay muted playsInline className="w-full h-full object-cover" />
    </div>
  )
}
```

- Floats bottom-right of the room at `180×135` (4:3). Position is `fixed` so it survives layout shifts in the centered-orb composition.
- `muted` is mandatory (we already get audio out via TTS; we are not echoing the candidate's own voice).
- `playsInline` is needed for iOS Safari.
- Subtle accent ring while phase is `listening` (read from the existing FSM context — `ring-2 ring-accent`). Plain border otherwise.
- Slot is rendered by `InterviewRoom`, not by `MicButton`, so layout stays cleanly separated.

### `video-toggle.tsx`
A `Button` (variant `ghost`, `size lg`) using Phosphor icons:
- Off → `VideoCamera` icon, "Turn on camera" tooltip.
- On  → `VideoCameraSlash` icon, "Turn off camera" tooltip.
- Disabled → muted color, "Camera blocked — check site settings" tooltip; clicking is a no-op.

Sits next to the mic button in the bottom controls row (left of the End button per the handoff's layout). Clicking toggles `enableVideo` / `disableVideo`.

## Client state
No FSM change. Video is **orthogonal** client state, lifted to `InterviewRoom` and pulled from `useMediaStream`:

```ts
const media = useMediaStream()
const videoOn = media.videoTrack !== null
```

The decision-panel, transcript, and turn flow do not branch on `videoOn` anywhere. The only places it appears are:
1. `<SelfView stream={media.stream} />` (renders nothing when off).
2. `<VideoToggle on={videoOn} onToggle={...} disabled={!!media.permissionError && media.permissionError.kind === "video"} />`.

## Permissions
- Camera permission is requested **lazily** on first `enableVideo` call. We do not ask for camera as part of the room's initial mount — the room must be usable mic-only without ever touching the camera prompt.
- On `NotAllowedError`: `permissionError.kind = "video"`, the toggle disables itself, and a one-line muted explanation appears underneath the controls row ("Camera blocked — check your browser's site settings"). Mic flow is unaffected.
- On `NotFoundError` (no camera attached): same disabled-toggle treatment with text "No camera detected".
- Mic permission errors continue to be handled by `mic-button.tsx` exactly as in spec 03 — this spec doesn't redesign that path.

## Layout

The handoff's centered composition is preserved: pulsing apricot orb in the middle, current question in display-serif beneath, transcript and decision panel as side rails. The additions are:

```
                    ┌─────── Top bar (unchanged) ────────┐
                    │  Iris  ·  Frontend Engineer   ⏱   ✕ │
                    └────────────────────────────────────┘

                              ●  (orb, centered)
                          "Tell me about a time you…"
                              (transcript below)

                                                       ┌─────────┐
                                                       │ self-   │ ← <SelfView/>
                                                       │ view    │   floats here
                                                       │         │
                                                       └─────────┘

                    ┌── 🎙 ──── 🎥 ──── ✕ ──────────────┐
                    │   mic   video    end              │  ← <VideoToggle/>
                    └────────────────────────────────────┘
```

Room idle state gets a single muted hint near the controls: "Camera optional · click 🎥 to turn it on". Hint hides once the user has interacted with the video toggle (success or failure).

## Performance
- 640×480 / 30fps default; the browser will negotiate down on low-end devices. We never re-encode or copy frames.
- Camera CPU is the user's machine, not the server. No effect on Vercel function budget (spec 00).
- No effect on STT/LLM/TTS p50s. Audio path is identical to spec 03.

## Touch points on existing specs
**Additive only — spec 03 is not edited.** Implementers of this stretch goal should be aware that the changes above land entirely in `src/app/interview/[sessionId]/_components/` and a new `_hooks/` sibling. The `MicButton` refactor preserves its existing public API (`onUtterance(blob)`); only the internals change.

## Files

| File | Status | Purpose |
|---|---|---|
| `src/app/interview/[sessionId]/_components/self-view.tsx` | NEW | Floating self-view tile. |
| `src/app/interview/[sessionId]/_components/video-toggle.tsx` | NEW | Bottom-controls camera button. |
| `src/app/interview/[sessionId]/_components/_hooks/use-media-stream.ts` | NEW | Single owner of `MediaStream`. |
| `src/app/interview/[sessionId]/_components/mic-button.tsx` | REFACTOR | Consumes shared audio track from the hook. Public API unchanged. |
| `src/app/interview/[sessionId]/_components/interview-room.tsx` | EXTEND | Renders `<SelfView/>` and `<VideoToggle/>` in the existing slots. |

## Open questions
- Mirror the self-view (CSS `transform: scaleX(-1)`)? Most video-call UIs do — feels natural. Default **yes**, no env switch.
- Show the candidate's name beside the self-view? We don't collect a name in v1, so skip.

## Acceptance checklist
- [ ] Camera permission is **not** requested on room mount; only on first toggle-on.
- [ ] Mic-only sessions render and complete identically to spec 03 (no regressions).
- [ ] Toggling video off stops the camera track immediately — the OS camera indicator turns off.
- [ ] Self-view is muted (`<video muted playsInline>`) and never echoes the candidate's voice.
- [ ] Permission denial disables the toggle and surfaces a one-line message; the mic and turn flow continue working.
- [ ] No camera frames are uploaded to any endpoint (verified via network tab — `/api/stt`, `/api/interview/turn`, `/api/tts`, `/api/interview/end` are the only outbound calls).
- [ ] Navigating away from the room stops every track (no lingering camera/mic indicator).
- [ ] No DB schema, migration, or env-var change.
