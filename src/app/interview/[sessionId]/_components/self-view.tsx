"use client"

import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react"

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
}

/** Initial tile dimensions; the user can drag (but not yet resize) within the viewport. */
const TILE_W = 240
const TILE_H = 180
const MARGIN = 24

/**
 * Floating self-view tile. Mirrored, muted, never echoes the candidate's own
 * voice — TTS handles the assistant side. Camera frames stay in the browser
 * (no `fetch()` ever touches them). Drag it anywhere with the mouse; it stays
 * inside the viewport.
 */
export function SelfView({ videoTrack, listening }: SelfViewProps) {
  const ref = useRef<HTMLVideoElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null)

  // Default position: bottom-right corner. Computed once on mount so the tile
  // doesn't snap there on every viewport resize.
  useEffect(() => {
    if (pos !== null) return
    if (typeof window === "undefined") return
    setPos({
      x: window.innerWidth - TILE_W - MARGIN,
      y: window.innerHeight - TILE_H - MARGIN - 96, // sit above the bottom controls row
    })
  }, [pos])

  // Bind the track to the <video> element via a single-track MediaStream so we
  // never leak audio out of the candidate side. The wrapper is now always
  // mounted (hidden via `visibility` until we have a `pos`), so the <video>
  // exists on first commit and this effect runs exactly once per `videoTrack`.
  // It MUST NOT depend on `pos` — that would tear down and re-attach the
  // stream on every drag delta and make the camera blink.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = new MediaStream([videoTrack])
    return () => {
      el.srcObject = null
    }
  }, [videoTrack])

  // Keep the tile inside the viewport when the window resizes.
  useEffect(() => {
    const onResize = () => {
      setPos((p) => {
        if (!p) return p
        return clampToViewport(p.x, p.y)
      })
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    // Only respond to primary-button presses; keep right-clicks etc. for the browser.
    if (e.button !== 0) return
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const rect = wrapper.getBoundingClientRect()
    dragRef.current = { offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top }
    wrapper.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    setPos(clampToViewport(e.clientX - drag.offsetX, e.clientY - drag.offsetY))
  }, [])

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null
    const wrapper = wrapperRef.current
    if (wrapper?.hasPointerCapture(e.pointerId)) wrapper.releasePointerCapture(e.pointerId)
  }, [])

  // Always mount the wrapper so the <video> element exists on the first commit
  // and the bind effect can attach the stream once. Until we've measured the
  // viewport we keep it `invisible` to avoid a first-paint flash at (0,0).
  return (
    <div
      ref={wrapperRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ left: pos?.x ?? 0, top: pos?.y ?? 0, width: TILE_W, height: TILE_H }}
      className={cn(
        "fixed z-30 cursor-grab touch-none overflow-hidden rounded-lg border bg-bg-canvas shadow-lg transition-[border-color,box-shadow] duration-200 active:cursor-grabbing",
        listening ? "border-accent shadow-[0_0_24px_rgba(244,162,97,0.35)]" : "border-border-strong",
        !pos && "invisible",
      )}
    >
      <video
        ref={ref}
        autoPlay
        muted
        playsInline
        aria-label="Your camera preview"
        // Mirror the preview — every video-call UI does this; feels native.
        // pointer-events-none so drags on the video bubble to the wrapper.
        className="pointer-events-none h-full w-full -scale-x-100 object-cover"
      />
    </div>
  )
}

function clampToViewport(x: number, y: number): { x: number; y: number } {
  if (typeof window === "undefined") return { x, y }
  const maxX = Math.max(MARGIN, window.innerWidth - TILE_W - MARGIN)
  const maxY = Math.max(MARGIN, window.innerHeight - TILE_H - MARGIN)
  return {
    x: Math.min(Math.max(MARGIN, x), maxX),
    y: Math.min(Math.max(MARGIN, y), maxY),
  }
}
