"use client"

import { MicrophoneIcon, MicrophoneSlashIcon, SpinnerIcon } from "@phosphor-icons/react"
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
  onStart: () => void
  onStop: (audio: Blob) => void
  /** Surfaced when permission denied or device errors. Parent renders the alert UI. */
  onError: (message: string) => void
}

export function MicButton({ listening, disabled, busy, onStart, onStop, onError }: MicButtonProps) {
  const { toggle } = useMic({ listening, disabled, busy, onStart, onStop, onError })
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
        "relative inline-flex size-20 items-center justify-center rounded-full border transition-all duration-200 ease-out",
        "outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        listening
          ? "bg-accent text-accent-fg border-transparent shadow-[0_0_32px_rgba(244,162,97,0.5)]"
          : "bg-bg-raised text-fg-1 border-border-default hover:bg-bg-hover",
        (disabled || busy) && "cursor-not-allowed opacity-60",
        pressing && !disabled && !busy && "translate-y-px",
      )}
    >
      {listening && <span aria-hidden className="iris-pulse absolute inset-0 rounded-full border border-accent/60" />}
      {busy ? (
        <SpinnerIcon className="size-7 animate-spin" />
      ) : listening ? (
        <MicrophoneSlashIcon className="size-7" weight="fill" />
      ) : (
        <MicrophoneIcon className="size-7" weight="fill" />
      )}
    </button>
  )
}
