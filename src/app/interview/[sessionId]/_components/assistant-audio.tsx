"use client"

import { useEffect, useRef, useState } from "react"

interface AssistantAudioProps {
  /** When non-null, autoplay this URL. Reset to null to silence. */
  audioUrl: string | null
  onEnded: () => void
  onError: (message: string) => void
}

/**
 * Hidden <audio> playing TTS. We start with the route URL (streaming MP3),
 * and on `error` fall back to fetching as a Blob and feeding an object URL.
 */
export function AssistantAudio({ audioUrl, onEnded, onError }: AssistantAudioProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)
  const triedFallbackRef = useRef(false)

  // Reset fallback state whenever the parent points at a new URL.
  // biome-ignore lint/correctness/useExhaustiveDependencies: audioUrl is the trigger; we deliberately do not read it inside.
  useEffect(() => {
    triedFallbackRef.current = false
    setFallbackUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }, [audioUrl])

  // Best-effort cleanup on unmount.
  useEffect(() => {
    return () => {
      if (fallbackUrl) URL.revokeObjectURL(fallbackUrl)
    }
  }, [fallbackUrl])

  if (!audioUrl) return null
  const src = fallbackUrl ?? audioUrl

  return (
    // biome-ignore lint/a11y/useMediaCaption: dynamic TTS audio without a transcript track; the on-screen transcript is the caption surface.
    <audio
      ref={audioRef}
      src={src}
      autoPlay
      onEnded={onEnded}
      onError={async () => {
        if (triedFallbackRef.current || !audioUrl) {
          onError("Audio playback failed")
          return
        }
        triedFallbackRef.current = true
        try {
          const res = await fetch(audioUrl)
          if (!res.ok) throw new Error(`TTS HTTP ${res.status}`)
          const blob = await res.blob()
          setFallbackUrl(URL.createObjectURL(blob))
        } catch (err) {
          onError(err instanceof Error ? err.message : "Audio playback failed")
        }
      }}
    />
  )
}
