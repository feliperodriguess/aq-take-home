"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type MediaPermissionError = {
  kind: "audio" | "video"
  reason: string
}

export interface MediaStreamApi {
  /** Live audio track (`null` until `enableAudio` succeeds). */
  audioTrack: MediaStreamTrack | null
  /** Live video track (`null` until `enableVideo` succeeds, again `null` after `disableVideo`). */
  videoTrack: MediaStreamTrack | null
  /**
   * Soft mute flag. When true, the audio track's `enabled` is set to `false`
   * (Zoom-style mute — captured audio is silenced without releasing the
   * device). The mic-button consults this and refuses to start a new turn
   * while muted so the user never accidentally records silence.
   */
  audioMuted: boolean
  /**
   * Lazily request mic permission and add the audio track. Returns the
   * obtained track so callers can use it within the same async tick — the
   * `audioTrack` state and `audioRef` don't update synchronously, so reading
   * either right after `await enableAudio()` would still see `null`.
   * No-op if already enabled (returns the existing track).
   */
  enableAudio: () => Promise<MediaStreamTrack>
  /** Lazily request camera permission and add the video track. No-op if already enabled. */
  enableVideo: () => Promise<void>
  /** Stop the camera track immediately (the OS indicator turns off) and remove it from the stream. */
  disableVideo: () => void
  /** Flip the soft-mute flag; if an audio track exists, propagate to `track.enabled`. */
  toggleAudioMute: () => void
  /** Latest permission/device error, if any. Cleared when the corresponding device successfully enables. */
  permissionError: MediaPermissionError | null
}

/**
 * Single owner of the interview room's media tracks. The mic-button and the
 * self-view both read tracks off this hook so we never end up with two
 * `getUserMedia` calls fighting over device permissions.
 *
 * Audio is enabled by `mic-button.tsx` on the first record-start. Video is
 * enabled lazily by `video-toggle.tsx`; we never prompt for camera on mount.
 *
 * The hook returns the **tracks themselves** rather than a composite
 * `MediaStream` — React Compiler memoizes on prop identity, and a track flip
 * (track ↔ null) changes identity, while a `MediaStream` whose tracks were
 * mutated does not. Consumers that need a stream wrap their track in a fresh
 * single-track `MediaStream(...)` at the use site.
 *
 * On unmount every track is stopped — the OS camera/mic indicator must be off
 * the moment the user navigates away from the room.
 */
export function useMediaStream(): MediaStreamApi {
  const [audioTrack, setAudioTrack] = useState<MediaStreamTrack | null>(null)
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null)
  const [audioMuted, setAudioMuted] = useState(false)
  const [permissionError, setPermissionError] = useState<MediaPermissionError | null>(null)
  // Refs mirror the latest state so the unmount cleanup can stop tracks
  // without re-running on every track change.
  const audioRef = useRef<MediaStreamTrack | null>(null)
  const videoRef = useRef<MediaStreamTrack | null>(null)
  audioRef.current = audioTrack
  videoRef.current = videoTrack

  const enableAudio = useCallback(async (): Promise<MediaStreamTrack> => {
    if (audioRef.current) return audioRef.current
    try {
      const captured = await navigator.mediaDevices.getUserMedia({ audio: true })
      const track = captured.getAudioTracks()[0]
      if (!track) throw new Error("No audio track returned")
      // Honour any prior mute toggle made before the track existed.
      track.enabled = !audioMuted
      // Update the ref synchronously so a same-tick re-entry sees the new
      // track; React state still drives renders.
      audioRef.current = track
      setAudioTrack(track)
      setPermissionError((prev) => (prev?.kind === "audio" ? null : prev))
      return track
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Couldn't access your microphone"
      setPermissionError({ kind: "audio", reason })
      throw err
    }
  }, [audioMuted])

  const toggleAudioMute = useCallback(() => {
    setAudioMuted((prev) => {
      const next = !prev
      const track = audioRef.current
      if (track) track.enabled = !next
      return next
    })
  }, [])

  const enableVideo = useCallback(async () => {
    if (videoRef.current) return
    try {
      const captured = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      })
      const track = captured.getVideoTracks()[0]
      if (!track) throw new Error("No video track returned")
      // If the user yanks the camera permission (or the device disappears),
      // make sure the toggle visibly flips back to "off".
      track.onended = () => setVideoTrack(null)
      setVideoTrack(track)
      setPermissionError((prev) => (prev?.kind === "video" ? null : prev))
    } catch (err) {
      const reason = errorReason(err)
      setPermissionError({ kind: "video", reason })
    }
  }, [])

  const disableVideo = useCallback(() => {
    const track = videoRef.current
    if (!track) return
    track.onended = null
    track.stop()
    setVideoTrack(null)
  }, [])

  // Hard cleanup on unmount: stop every track regardless of state.
  useEffect(() => {
    return () => {
      for (const track of [audioRef.current, videoRef.current]) {
        if (!track) continue
        track.onended = null
        track.stop()
      }
    }
  }, [])

  return {
    audioTrack,
    videoTrack,
    audioMuted,
    enableAudio,
    enableVideo,
    disableVideo,
    toggleAudioMute,
    permissionError,
  }
}

/** Map common `getUserMedia` rejection names to a human-friendly reason. */
function errorReason(err: unknown): string {
  if (!(err instanceof Error)) return "Couldn't access the camera"
  if (err.name === "NotAllowedError") return "Camera blocked — check your browser's site settings"
  if (err.name === "NotFoundError") return "No camera detected"
  if (err.name === "NotReadableError") return "Camera is in use by another app"
  return err.message || "Couldn't access the camera"
}
