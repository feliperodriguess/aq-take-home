import type { Turn } from "@/db/schema"

interface TalkRatioBarProps {
  turns: Turn[]
}

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length
}

/**
 * Cheap-but-load-bearing stat: share of words from candidate vs assistant.
 * Apricot for Iris, fg-2 for "You". Stays small (under 80 lines), so the math
 * lives inline.
 */
export function TalkRatioBar({ turns }: TalkRatioBarProps) {
  let assistantWords = 0
  let candidateWords = 0
  for (const t of turns) {
    const n = countWords(t.text)
    if (t.role === "assistant") assistantWords += n
    else candidateWords += n
  }
  const total = assistantWords + candidateWords
  const youPct = total === 0 ? 0 : (candidateWords / total) * 100
  const irisPct = total === 0 ? 0 : (assistantWords / total) * 100

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border-default bg-bg-raised p-6">
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-3">Talk ratio</span>
        <span className="font-mono text-[11px] text-fg-3 tabular-nums">{total} words</span>
      </div>

      <div className="flex justify-between text-xs">
        <span className="font-mono uppercase tracking-[0.06em] text-fg-2">You</span>
        <span className="font-mono uppercase tracking-[0.06em] text-accent">Iris</span>
      </div>

      <div
        className="flex h-2 overflow-hidden rounded-full bg-border-default"
        role="img"
        aria-label={`Candidate ${Math.round(youPct)}% · Iris ${Math.round(irisPct)}%`}
      >
        <div className="h-full bg-fg-2 transition-[width] duration-500" style={{ width: `${youPct}%` }} />
        <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${irisPct}%` }} />
      </div>

      <div className="flex justify-between text-xs">
        <span className="font-mono text-fg-3 tabular-nums">{Math.round(youPct)}%</span>
        <span className="font-mono text-fg-3 tabular-nums">{Math.round(irisPct)}%</span>
      </div>
    </section>
  )
}
