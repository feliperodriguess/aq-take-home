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
  /** Lazily request mic permission and add the audio track. No-op if already enabled. */
  enableAudio: () => Promise<void>
  /** Lazily request camera permission and add the video track. No-op if already enabled. */
  enableVideo: () => Promise<void>
  /** Stop the camera track immediately (the OS indicator turns off) and remove it from the stream. */
  disableVideo: () => void
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
  const [permissionError, setPermissionError] = useState<MediaPermissionError | null>(null)
  // Refs mirror the latest state so the unmount cleanup can stop tracks
  // without re-running on every track change.
  const audioRef = useRef<MediaStreamTrack | null>(null)
  const videoRef = useRef<MediaStreamTrack | null>(null)
  audioRef.current = audioTrack
  videoRef.current = videoTrack

  const enableAudio = useCallback(async () => {
    if (audioRef.current) return
    try {
      const captured = await navigator.mediaDevices.getUserMedia({ audio: true })
      const track = captured.getAudioTracks()[0]
      if (!track) throw new Error("No audio track returned")
      setAudioTrack(track)
      setPermissionError((prev) => (prev?.kind === "audio" ? null : prev))
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Couldn't access your microphone"
      setPermissionError({ kind: "audio", reason })
      throw err
    }
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
    enableAudio,
    enableVideo,
    disableVideo,
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
