import type * as React from "react"

import { cn } from "@/lib/utils"

interface IrisAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Diameter in pixels. Looks best in the 80–160px range. */
  size?: number
  /** When true, the orb pulses and emits an extra ring + glow. */
  speaking?: boolean
}

/**
 * IrisAvatar — the persona orb. Two concentric rings (rendered only while
 * speaking) sit above an apricot radial-gradient core with a soft glow. The
 * `irisPulse` keyframe is defined in `globals.css`.
 */
function IrisAvatar({ size = 96, speaking = false, className, style, ...props }: IrisAvatarProps) {
  return (
    <div
      data-slot="iris-avatar"
      data-speaking={speaking || undefined}
      className={cn("relative inline-flex items-center justify-center rounded-full", className)}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      {speaking && (
        <>
          <span
            aria-hidden
            className="absolute -inset-2 rounded-full border border-accent/40 iris-pulse"
            style={{ animationDuration: "2s" }}
          />
          <span
            aria-hidden
            className="absolute -inset-1 rounded-full border border-accent/60 iris-pulse"
            style={{ animationDuration: "1.4s" }}
          />
        </>
      )}
      <div
        aria-hidden
        className="rounded-full transition-shadow duration-300 ease-out"
        style={{
          width: size,
          height: size,
          background:
            "radial-gradient(circle at 35% 30%, var(--color-apricot-300), var(--color-apricot-500) 60%, var(--color-apricot-600))",
          boxShadow: speaking ? "0 0 24px rgba(244, 162, 97, 0.5)" : "0 0 12px rgba(244, 162, 97, 0.25)",
        }}
      />
    </div>
  )
}

export { IrisAvatar }
export type { IrisAvatarProps }
