import { Fragment } from "react"

import { AccentLine } from "@/components/ui/accent-line"
import type { Evaluation } from "@/types/interview"

interface CompetencyTableProps {
  items: Evaluation["perCompetency"]
}

/**
 * Editorial per-rubric breakdown — NOT a `<table>`. Each row: large display
 * competency name, mono score on the right, slim accent-progress bar beneath
 * the score, italic notes underneath the row, and an AccentLine separator.
 */
export function CompetencyTable({ items }: CompetencyTableProps) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-3">Competencies</span>
        <AccentLine width={32} className="max-w-[160px]" />
      </div>

      {items.length === 0 ? (
        <p className="font-ui text-sm italic text-fg-3">No rubric breakdown available.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {items.map((row, i) => {
            const pct = Math.max(0, Math.min(100, row.score * 10))
            return (
              <Fragment key={`${row.competency}-${i}`}>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className="font-display text-2xl text-fg-1">{row.competency}</h3>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="font-mono text-xs text-fg-2 tabular-nums">{row.score.toFixed(1)} / 10</span>
                      <div className="h-1 w-32 overflow-hidden rounded-full bg-border-default">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                  {row.notes ? <p className="font-ui text-sm italic leading-relaxed text-fg-3">{row.notes}</p> : null}
                </div>
                {i < items.length - 1 && <AccentLine width={32} className="max-w-full" />}
              </Fragment>
            )
          })}
        </div>
      )}
    </section>
  )
}
