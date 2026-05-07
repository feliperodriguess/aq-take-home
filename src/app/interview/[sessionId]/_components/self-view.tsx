"use client"

import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

interface SelfViewProps {
  /**
   * Live video track from `useMediaStream`. We bind it via a single-track
   * `MediaStream` rather than the composite stream so React Compiler — which
   * memoizes on prop identity — actually sees the track flip.
   */
  videoTrack: MediaStreamTrack
  /** Whether the room FSM is currently in the listening phase. Adds an accent ring. */
  listening: boolean
  /** Shifts the tile left by the decision-panel width when the panel is open on lg+ screens. */
  decisionOpen: boolean
}

/**
 * Floating self-view tile. Mirrored, muted, never echoes the candidate's own
 * voice — TTS handles the assistant side. Camera frames stay in the browser
 * (no `fetch()` ever touches them). Mounting/unmounting is gated by the parent
 * on a boolean — never read mutable `MediaStream` track lists at render time.
 */
export function SelfView({ videoTrack, listening, decisionOpen }: SelfViewProps) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Wrap the track in a fresh single-track stream — the <video> element only
    // ever renders this track, no audio leaks in.
    el.srcObject = new MediaStream([videoTrack])
    return () => {
      el.srcObject = null
    }
  }, [videoTrack])

  return (
    <div
      className={cn(
        "fixed bottom-28 right-6 z-30 h-[135px] w-[180px] overflow-hidden rounded-lg border bg-bg-canvas shadow-lg transition-[border-color,box-shadow,right] duration-200",
        listening ? "border-accent shadow-[0_0_24px_rgba(244,162,97,0.35)]" : "border-border-strong",
        decisionOpen && "lg:right-[calc(1.5rem+340px)]",
      )}
    >
      <video
        ref={ref}
        autoPlay
        muted
        playsInline
        aria-label="Your camera preview"
        // Mirror the preview — every video-call UI does this; feels native.
        className="h-full w-full -scale-x-100 object-cover"
      />
    </div>
  )
}
