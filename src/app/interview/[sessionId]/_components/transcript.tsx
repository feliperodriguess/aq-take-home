"use client"

import { useEffect, useRef } from "react"

import type { DisplayTurn } from "@/lib/interview-room/types"
import { cn } from "@/lib/utils"

interface TranscriptProps {
  turns: DisplayTurn[]
  /** Restrict to the last N turns. Pass `null` for the full list. */
  limit?: number | null
  /** Visual hint when an assistant turn is currently speaking. */
  className?: string
}

export function Transcript({ turns, limit = 3, className }: TranscriptProps) {
  const ref = useRef<HTMLDivElement>(null)

  const visible = limit == null ? turns : turns.slice(-limit)

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to bottom whenever turn count changes
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [turns.length, visible.length])

  if (visible.length === 0) {
    return (
      <div className={cn("flex w-full justify-center font-mono text-[12px] text-fg-4 tracking-[0.04em]", className)}>
        Transcript will appear here as you speak…
      </div>
    )
  }

  return (
    <div ref={ref} className={cn("flex w-full max-w-3xl flex-col gap-3 overflow-y-auto px-2", className)}>
      {visible.map((turn) => (
        <TranscriptLine key={`${turn.index}-${turn.role}`} turn={turn} />
      ))}
    </div>
  )
}

function TranscriptLine({ turn }: { turn: DisplayTurn }) {
  const isAssistant = turn.role === "assistant"
  return (
    <div className="grid grid-cols-[64px_1fr] items-baseline gap-3.5">
      <span
        className={cn(
          "font-mono text-[10px] uppercase tracking-[0.12em] leading-tight",
          isAssistant ? "text-accent" : "text-fg-3",
          turn.status === "playing" && "iris-pulse",
        )}
      >
        {isAssistant ? "Iris" : "You"}
      </span>
      <span
        className={cn(
          "font-ui text-[13px] leading-[1.55]",
          isAssistant ? "text-fg-2 italic" : "text-fg-1",
          turn.status === "pending" && "text-fg-3 italic",
        )}
      >
        {turn.text}
      </span>
    </div>
  )
}
