"use client"

import { useCallback, useEffect, useRef } from "react"

const MIME_PREFERENCE = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"] as const

/** Picks the first MediaRecorder-supported mime; falls back to default. */
function pickMime(): string {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return "audio/webm"
  for (const mime of MIME_PREFERENCE) {
    if (MediaRecorder.isTypeSupported(mime)) return mime
  }
  return ""
}

interface UseMicArgs {
  /** Whether the parent FSM has us in the listening phase. */
  listening: boolean
  /** Whether interactions should be ignored (parent says so). */
  disabled?: boolean
  /** Whether a network round-trip is in flight; ignore toggles. */
  busy?: boolean
  /**
   * Whether the conversation has turns yet. The very first click is a
   * "bootstrap" — it asks the engine for turn 0 and must NOT start a
   * recorder (otherwise the recorder is left orphaned and blocks every
   * subsequent press because `recorderRef.current` is still set).
   */
  hasTurns: boolean
  /** Live audio track from the shared `useMediaStream` hook (null until enabled). */
  audioTrack: MediaStreamTrack | null
  /** Lazily request mic permission. Called on the first start before any track exists. */
  enableAudio: () => Promise<void>
  /** Fires when the recorder successfully starts. */
  onStart: () => void
  /** Fires once with the captured audio Blob when recording stops. */
  onStop: (audio: Blob) => void
  /** Fires on permission denial / device error. */
  onError: (message: string) => void
}

interface UseMicReturn {
  /** Toggle the recorder. Bind to the button's onClick. */
  toggle: () => void
}

/**
 * Push-to-talk recorder. Audio track lifecycle is owned by `useMediaStream`
 * (so the camera and mic share one `MediaStream` and we never double-prompt).
 * This hook only owns the per-utterance `MediaRecorder` and the Space hotkey.
 *
 * The recorder is rebuilt on every utterance against a fresh single-track
 * `MediaStream([audioTrack])` — that's the simplest way to start/stop chunks
 * without ever re-stopping the underlying mic track.
 */
export function useMic({
  listening,
  disabled,
  busy,
  hasTurns,
  audioTrack,
  enableAudio,
  onStart,
  onStop,
  onError,
}: UseMicArgs): UseMicReturn {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Keep the freshest audioTrack accessible from the start() callback without
  // re-creating the callback (which would churn the Space-key effect below).
  const audioTrackRef = useRef(audioTrack)
  useEffect(() => {
    audioTrackRef.current = audioTrack
  }, [audioTrack])

  const stop = useCallback(() => {
    const rec = recorderRef.current
    if (!rec) return
    if (rec.state !== "inactive") rec.stop()
  }, [])

  const start = useCallback(async () => {
    if (recorderRef.current) return
    try {
      if (!audioTrackRef.current) {
        await enableAudio()
      }
      const track = audioTrackRef.current
      if (!track) throw new Error("Microphone unavailable")
      const mime = pickMime()
      const recStream = new MediaStream([track])
      const rec = mime ? new MediaRecorder(recStream, { mimeType: mime }) : new MediaRecorder(recStream)
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const type = rec.mimeType || mime || "audio/webm"
        const blob = new Blob(chunksRef.current, { type })
        chunksRef.current = []
        recorderRef.current = null
        onStop(blob)
      }
      recorderRef.current = rec
      rec.start()
      onStart()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't access your microphone"
      onError(msg)
    }
  }, [enableAudio, onStart, onStop, onError])

  const toggle = useCallback(() => {
    if (disabled || busy) return
    if (listening) {
      stop()
      return
    }
    if (!hasTurns) {
      // Bootstrap path: don't open a MediaRecorder yet. The parent will
      // request turn 0 on `onStart`; recording begins on the next click,
      // once the FSM has actually advanced past idle.
      // Pre-prompt for mic permission in the background so the next press
      // is instant (no permission dialog mid-conversation).
      void enableAudio().catch(() => {
        // enableAudio surfaces its own error via the parent's error path.
      })
      onStart()
      return
    }
    void start()
  }, [disabled, busy, listening, hasTurns, enableAudio, onStart, start, stop])

  // Space toggles for keyboard a11y, but only when nothing form-y is focused.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase()
      if (tag === "input" || tag === "textarea" || tag === "select") return
      e.preventDefault()
      toggle()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toggle])

  // Cleanup on unmount: kill the recorder if it's still running. The audio
  // track itself is owned by useMediaStream and torn down there.
  useEffect(() => {
    return () => {
      const rec = recorderRef.current
      if (rec && rec.state !== "inactive") rec.stop()
    }
  }, [])

  return { toggle }
}
