import { SiteHeader } from "@/app/_components/site-header"
import { AccentLine } from "@/components/ui/accent-line"
import type { HistoryRow as HistoryRowData } from "@/lib/history-loader"

import { HistoryRow } from "./history-row"

interface HistoryViewProps {
  rows: HistoryRowData[]
}

/**
 * History view — editorial list of every past + ongoing session, newest
 * first. Sticky chrome is shared with `/`; layout is the narrower 880px
 * column from the handoff so individual rows read as cards rather than a
 * full-width table.
 */
export function HistoryView({ rows }: HistoryViewProps) {
  return (
    <>
      <SiteHeader />
      <main className="relative mx-auto w-full max-w-[880px] px-10 pt-12 pb-20">
        <div className="iris-fade-in mb-10 flex flex-col gap-[18px]">
          <div className="inline-flex items-center gap-3">
            <span className="eyebrow">
              History · {rows.length} {rows.length === 1 ? "session" : "sessions"}
            </span>
            <AccentLine width={36} className="max-w-[120px]" />
          </div>
          <h1 className="m-0 font-display text-[48px] leading-[1.05] text-fg-1">
            Your past <span className="italic-accent">debriefs</span>
            <span className="text-accent">.</span>
          </h1>
        </div>

        {rows.length > 0 ? (
          <ul className="iris-stagger flex list-none flex-col gap-3 p-0">
            {rows.map((row) => (
              <li key={row.sessionId}>
                <HistoryRow row={row} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-[10px] border border-dashed border-border-default p-12 text-center font-ui text-sm text-fg-3">
            No sessions yet. Pick a role to start your first interview.
          </div>
        )}
      </main>
    </>
  )
}
