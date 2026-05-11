import { Fragment } from "react"

import { AccentLine } from "@/components/ui/accent-line"
import type { Turn } from "@/db/schema"

interface TranscriptListProps {
  turns: Turn[]
}

/**
 * Full read-only conversation. Mono eyebrow role label per turn (accent for
 * Iris, fg-3 for the candidate), serif-flavoured ui body text, AccentLine
 * separator between turns. Empty state is a small italic line.
 */
export function TranscriptList({ turns }: TranscriptListProps) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-3xl text-fg-1">Conversation</h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-fg-3">
          {turns.length} {turns.length === 1 ? "turn" : "turns"}
        </span>
      </div>

      {turns.length === 0 ? (
        <p className="font-ui text-sm italic text-fg-3">No turns recorded.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {turns.map((turn, i) => {
            const isAssistant = turn.role === "assistant"
            return (
              <Fragment key={turn.id}>
                <article className="grid grid-cols-[80px_1fr] gap-4">
                  <span
                    className={`font-mono text-[10px] uppercase leading-relaxed tracking-[0.16em] ${
                      isAssistant ? "text-accent" : "text-fg-3"
                    }`}
                  >
                    {isAssistant ? "Iris" : "You"}
                  </span>
                  <p className="font-ui text-base leading-relaxed text-fg-2">{turn.text}</p>
                </article>
                {i < turns.length - 1 && <AccentLine width={24} className="max-w-full opacity-70" />}
              </Fragment>
            )
          })}
        </div>
      )}
    </section>
  )
}
