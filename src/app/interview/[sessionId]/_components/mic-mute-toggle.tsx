"use client"

import { MicrophoneIcon, MicrophoneSlashIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

interface MicMuteToggleProps {
  /** True when the mic is muted (soft mute — track stays alive, capture is silenced). */
  muted: boolean
  /** Disable while the FSM has us in a non-interactive phase (speaking/thinking/done). */
  disabled?: boolean
  /** Flip the mute flag — calls `toggleAudioMute` on the parent. */
  onToggle: () => void
}

/**
 * Mic mute/unmute toggle. Sits beside the record (play) button in the bottom-
 * controls row. The underlying audio-track lifecycle is owned by
 * `useMediaStream`; this is a thin renderer.
 *
 * Mirrors `VideoToggle`'s on/off treatment: the enabled (unmuted) state wears
 * the accent chrome, the muted state flattens to neutral. Icon swaps between
 * the filled mic glyph and the slash variant.
 */
export function MicMuteToggle({ muted, disabled, onToggle }: MicMuteToggleProps) {
  const label = muted ? "Unmute microphone" : "Mute microphone"
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={muted}
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex size-[60px] cursor-pointer items-center justify-center rounded-full border transition-all duration-200 ease-out",
        "outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        muted
          ? "border-border-default bg-bg-raised text-fg-2 hover:bg-bg-hover hover:text-fg-1"
          : "border-accent bg-bg-raised text-accent hover:bg-bg-hover",
        disabled && "cursor-not-allowed opacity-50 hover:bg-bg-raised",
      )}
    >
      {muted ? (
        <MicrophoneSlashIcon className="size-5" weight="regular" />
      ) : (
        <MicrophoneIcon className="size-5" weight="fill" />
      )}
    </button>
  )
}
