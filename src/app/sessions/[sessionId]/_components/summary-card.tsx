interface SummaryCardProps {
  summary: string
}

/**
 * Sibling card next to the ScoreHeader on the hero row. Holds the
 * 2–3-sentence calibrated verdict the evaluator emits.
 */
export function SummaryCard({ summary }: SummaryCardProps) {
  return (
    <article className="flex flex-col gap-4 rounded-lg border border-border-default bg-bg-raised p-6">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-3">Summary</span>
      <p className="font-ui text-base leading-relaxed text-fg-2">{summary}</p>
    </article>
  )
}
