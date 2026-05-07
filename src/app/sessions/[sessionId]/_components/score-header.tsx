import { Pill, type PillProps } from "@/components/ui/pill"
import type { Evaluation } from "@/types/interview"

interface ScoreHeaderProps {
  score: number
  recommendation: Evaluation["recommendation"]
}

const RECOMMENDATION_TONE: Record<Evaluation["recommendation"], NonNullable<PillProps["tone"]>> = {
  strong_hire: "pass",
  hire: "pass",
  lean_hire: "info",
  lean_no_hire: "warn",
  no_hire: "fail",
}

const RECOMMENDATION_LABEL: Record<Evaluation["recommendation"], string> = {
  strong_hire: "Strong hire",
  hire: "Hire",
  lean_hire: "Lean hire",
  lean_no_hire: "Lean no hire",
  no_hire: "No hire",
}

/**
 * Hero score card. ~260px wide on lg+, full-width on mobile. Mono eyebrow,
 * giant display-serif score, "/ 10" mono suffix, recommendation pill beneath.
 */
export function ScoreHeader({ score, recommendation }: ScoreHeaderProps) {
  const tone = RECOMMENDATION_TONE[recommendation]
  const label = RECOMMENDATION_LABEL[recommendation]
  const formatted = score.toFixed(1)

  return (
    <article className="flex flex-col justify-between gap-6 rounded-lg border border-border-default bg-bg-raised p-6">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-3">Overall</span>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-7xl leading-none tracking-[-0.04em] text-fg-1">{formatted}</span>
        <span className="font-mono text-sm text-fg-3">/ 10</span>
      </div>
      <Pill tone={tone} dot>
        {label}
      </Pill>
    </article>
  )
}
