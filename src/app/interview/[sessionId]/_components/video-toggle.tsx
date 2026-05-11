"use client"

import { VideoCameraIcon, VideoCameraSlashIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

interface VideoToggleProps {
  /** Whether the camera track is currently live. */
  on: boolean
  /** Disabled when the parent FSM has us in a non-interactive phase, or permission is denied. */
  disabled?: boolean
  /** Toggle handler — calls `enableVideo` / `disableVideo` on the parent. */
  onToggle: () => void
}

/**
 * Camera on/off button. Sits next to the mic in the bottom-controls row. The
 * underlying camera lifecycle is owned by `useMediaStream`; this component is
 * a near-pure renderer that flips an icon and forwards a click.
 */
export function VideoToggle({ on, disabled, onToggle }: VideoToggleProps) {
  const label = on ? "Turn off camera" : "Turn on camera"
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex size-[60px] cursor-pointer items-center justify-center rounded-full border transition-all duration-200 ease-out",
        "outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        on
          ? "border-accent bg-bg-raised text-accent hover:bg-bg-hover"
          : "border-border-default bg-bg-raised text-fg-2 hover:bg-bg-hover hover:text-fg-1",
        disabled && "cursor-not-allowed opacity-50 hover:bg-bg-raised",
      )}
    >
      {on ? (
        <VideoCameraIcon className="size-5" weight="fill" />
      ) : (
        <VideoCameraSlashIcon className="size-5" weight="regular" />
      )}
    </button>
  )
}
