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
 * Owns every browser-side concern of the push-to-talk mic:
 *  - `getUserMedia` + `MediaRecorder` lifecycle
 *  - mime-type negotiation
 *  - global Space keybinding (skipped when typing in form fields)
 *  - cleanup on unmount (stops tracks + tears down recorder)
 *
 * The component using this hook stays a near-pure renderer.
 */
export function useMic({ listening, disabled, busy, onStart, onStop, onError }: UseMicArgs): UseMicReturn {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const stop = useCallback(() => {
    const rec = recorderRef.current
    if (!rec) return
    if (rec.state !== "inactive") rec.stop()
  }, [])

  const start = useCallback(async () => {
    if (recorderRef.current) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = pickMime()
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const type = rec.mimeType || mime || "audio/webm"
        const blob = new Blob(chunksRef.current, { type })
        chunksRef.current = []
        recorderRef.current = null
        streamRef.current?.getTracks().forEach((t) => {
          t.stop()
        })
        streamRef.current = null
        onStop(blob)
      }
      recorderRef.current = rec
      rec.start()
      onStart()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't access your microphone"
      onError(msg)
    }
  }, [onStart, onStop, onError])

  const toggle = useCallback(() => {
    if (disabled || busy) return
    if (listening) stop()
    else void start()
  }, [disabled, busy, listening, start, stop])

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

  // Cleanup on unmount: kill the stream + recorder regardless of state.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => {
        t.stop()
      })
      const rec = recorderRef.current
      if (rec && rec.state !== "inactive") rec.stop()
    }
  }, [])

  return { toggle }
}
