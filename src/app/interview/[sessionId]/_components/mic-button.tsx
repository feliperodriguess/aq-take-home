"use client"

import { PlayIcon, SpinnerIcon, StopIcon } from "@phosphor-icons/react"
import { useState } from "react"

import { cn } from "@/lib/utils"

import { useMic } from "../_hooks/use-mic"

interface MicButtonProps {
  /** Whether the button is currently capturing audio. Driven by the parent FSM. */
  listening: boolean
  /** Disable while uploading/thinking/speaking/done — parent decides. */
  disabled?: boolean
  /** Show a spinner overlay during round-trip work. */
  busy?: boolean
  /**
   * Whether any turn exists yet. The first click bootstraps turn 0 and must
   * NOT start a recorder; only subsequent clicks open the mic.
   */
  hasTurns: boolean
  /** Live audio track from the shared `useMediaStream` hook. */
  audioTrack: MediaStreamTrack | null
  /** Lazily prompt for mic permission before recording the first utterance. */
  enableAudio: () => Promise<void>
  onStart: () => void
  onStop: (audio: Blob) => void
  /** Surfaced when permission denied or device errors. Parent renders the alert UI. */
  onError: (message: string) => void
}

export function MicButton({
  listening,
  disabled,
  busy,
  hasTurns,
  audioTrack,
  enableAudio,
  onStart,
  onStop,
  onError,
}: MicButtonProps) {
  const { toggle } = useMic({
    listening,
    disabled,
    busy,
    hasTurns,
    audioTrack,
    enableAudio,
    onStart,
    onStop,
    onError,
  })
  // Local visual: tiny "pressed" translate so the button feels physical.
  const [pressing, setPressing] = useState(false)

  return (
    <button
      type="button"
      onMouseDown={() => setPressing(true)}
      onMouseUp={() => setPressing(false)}
      onMouseLeave={() => setPressing(false)}
      onClick={toggle}
      disabled={disabled || busy}
      aria-pressed={listening}
      aria-label={listening ? "Stop talking" : "Start talking"}
      className={cn(
        "relative inline-flex size-[60px] items-center justify-center rounded-full border transition-all duration-200 ease-out",
        "outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        listening
          ? "bg-accent text-accent-fg border-transparent shadow-[0_0_36px_rgba(244,162,97,0.55)]"
          : "bg-bg-raised text-fg-1 border-border-default hover:bg-bg-hover hover:border-border-strong",
        (disabled || busy) && "cursor-not-allowed opacity-60",
        pressing && !disabled && !busy && "translate-y-px",
      )}
    >
      {listening && <span aria-hidden className="iris-pulse absolute inset-0 rounded-full border border-accent/60" />}
      {busy ? (
        <SpinnerIcon className="size-5 animate-spin" />
      ) : listening ? (
        // While recording, the click stops the utterance — show a "stop"
        // square. The earlier MicrophoneSlash glyph read as "mic disabled"
        // which is the opposite of the actual state (mic is hot).
        <StopIcon className="size-5" weight="fill" />
      ) : (
        // Pre-record state ("tap to begin" / "tap to talk") — a play
        // triangle communicates "press to start" better than a static mic.
        <PlayIcon className="size-5" weight="fill" />
      )}
    </button>
  )
}
