import { CaretRight } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"

import { Pill } from "@/components/ui/pill"
import { formatRelativeDate } from "@/lib/format-date"
import type { HistoryRow as HistoryRowData } from "@/lib/history-loader"
import { linkForRow } from "@/lib/history-loader"
import { cn } from "@/lib/utils"

interface HistoryRowProps {
  row: HistoryRowData
}

/**
 * Single history list row. Editorial card with title + company + date on the
 * left, status + detail pills + chevron on the right. Whole row is a Link to
 * the right destination per `linkForRow`.
 */
export function HistoryRow({ row }: HistoryRowProps) {
  const status = statusPresentation(row.status)
  const detail = detailPresentation(row)

  return (
    <Link
      href={linkForRow(row)}
      className={cn(
        // Flex-wrap keeps the row on a single line when the viewport has
        // room, then breaks the meta items onto subsequent lines on narrow
        // screens (mobile, side-by-side previews) instead of clipping past
        // the card's right edge.
        "flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[10px]",
        "border border-border-default bg-bg-raised px-5 py-4 transition-colors",
        "hover:bg-bg-hover hover:border-border-strong",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
      )}
    >
      <span className="min-w-0 flex-1 basis-[160px] font-ui text-[14px] font-medium leading-[1.3] text-fg-1">
        {row.jobTitle}
      </span>
      <span className="font-mono text-[12px] leading-none text-fg-3">{row.company}</span>
      <span className="font-mono text-[11px] uppercase leading-none tracking-[0.04em] text-fg-4">
        {formatRelativeDate(row.startedAt)}
      </span>
      <Pill tone={status.tone} dot size="sm">
        {status.label}
      </Pill>
      {detail ? (
        <Pill tone={detail.tone} size="sm">
          {detail.label}
        </Pill>
      ) : null}
      <CaretRight size={14} weight="bold" className="ml-auto shrink-0 text-fg-3" />
    </Link>
  )
}

/* ---------------- Helpers ---------------- */

type Tone = "neutral" | "accent" | "info" | "pass" | "fail" | "warn"

function statusPresentation(status: HistoryRowData["status"]): { tone: Tone; label: string } {
  if (status === "completed") return { tone: "pass", label: "Completed" }
  if (status === "active") return { tone: "info", label: "In progress" }
  return { tone: "fail", label: "Abandoned" }
}

function detailPresentation(row: HistoryRowData): { tone: Tone; label: string } | null {
  if (row.status === "completed") {
    if (row.overallScore != null) {
      return { tone: "accent", label: String(Math.round(row.overallScore * 10)) }
    }
    return row.questionCount > 0 ? { tone: "neutral", label: `${row.questionCount} Q` } : null
  }
  if (row.status === "active") {
    return { tone: "neutral", label: row.questionCount > 0 ? "Resume →" : "Resume" }
  }
  // abandoned
  return row.questionCount > 0 ? { tone: "neutral", label: `${row.questionCount} Q` } : null
}
