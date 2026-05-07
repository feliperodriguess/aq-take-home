import { Pill, type PillProps } from "@/components/ui/pill"
import type { PhaseKind } from "@/lib/interview-room/types"

interface StatusPillProps {
  phase: PhaseKind
}

const STATUS_BY_PHASE: Record<PhaseKind, { label: string; tone: PillProps["tone"]; dot: boolean }> = {
  idle: { label: "ready", tone: "neutral", dot: true },
  listening: { label: "listening", tone: "pass", dot: true },
  uploading: { label: "transcribing", tone: "info", dot: true },
  thinking: { label: "thinking", tone: "accent", dot: true },
  speaking: { label: "speaking", tone: "accent", dot: true },
  ending: { label: "wrapping up", tone: "warn", dot: true },
  done: { label: "complete", tone: "neutral", dot: false },
  error: { label: "error", tone: "fail", dot: true },
}

export function StatusPill({ phase }: StatusPillProps) {
  const status = STATUS_BY_PHASE[phase]
  return (
    <Pill tone={status.tone} size="sm" dot={status.dot} className="uppercase tracking-[0.12em]">
      {status.label}
    </Pill>
  )
}
