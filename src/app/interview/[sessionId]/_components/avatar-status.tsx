import { getStatusAccentClass, getStatusLabel } from "@/lib/interview-room/phase-labels"
import type { PhaseKind } from "@/lib/interview-room/types"
import { cn } from "@/lib/utils"

interface AvatarStatusProps {
  phase: PhaseKind
}

/**
 * The "Iris · listening" microcopy beneath the centered avatar. The label
 * + accent-class derive from helpers in `phase-labels.ts` so this stays a
 * dumb renderer.
 */
export function AvatarStatus({ phase }: AvatarStatusProps) {
  const label = getStatusLabel(phase)
  const accent = getStatusAccentClass(phase)
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-3">
      Iris
      <span className={cn("ml-2", accent)}>· {label}</span>
    </span>
  )
}
