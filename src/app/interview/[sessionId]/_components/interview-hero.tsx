import type { Dispatch } from "react"

import type { RoomAction } from "@/lib/interview-room/reducer"
import type { DisplayTurn, Phase } from "@/lib/interview-room/types"

interface InterviewHeroProps {
  phase: Phase
  turns: DisplayTurn[]
  dispatch: Dispatch<RoomAction>
}

/**
 * Hero copy beneath the avatar. Each phase has its own block; we read
 * top-to-bottom and return the first match — no nested ternaries.
 */
export function InterviewHero({ phase, turns, dispatch }: InterviewHeroProps) {
  if (phase.kind === "error") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="font-display text-3xl text-fg-1">
          Something interrupted us<span className="text-accent">.</span>
        </p>
        <p className="max-w-md font-ui text-sm text-fg-3">{phase.message}</p>
        <button
          type="button"
          onClick={() => dispatch({ type: "DISMISS_ERROR" })}
          className="mt-2 inline-flex h-9 items-center rounded-md border border-border-default bg-bg-raised px-4 font-ui text-sm text-fg-1 hover:bg-bg-hover"
        >
          Try again
        </button>
      </div>
    )
  }

  if (phase.kind === "thinking") {
    return (
      <p className="iris-pulse text-center font-display text-4xl italic text-fg-2">
        Reasoning<span className="text-accent">…</span>
      </p>
    )
  }

  if (phase.kind === "idle" && turns.length === 0) {
    return (
      <div className="max-w-2xl text-center">
        <p className="text-balance font-display text-4xl text-fg-1">
          Click play when you're <span className="italic">ready</span>
          <span className="text-accent">.</span>
        </p>
        <p className="mt-4 font-ui text-sm text-fg-3">
          Iris will ask around 10 questions and follow up where it matters.
        </p>
      </div>
    )
  }

  if (phase.kind === "ending" || phase.kind === "done") {
    return (
      <div className="max-w-md text-center">
        <p className="font-display text-4xl text-fg-1">
          That's all I have. <span className="italic-accent">Thank you.</span>
        </p>
        <p className="iris-pulse mt-4 font-ui text-sm text-fg-3">Wrapping up your evaluation…</p>
      </div>
    )
  }

  const lastAssistantTurn = [...turns].reverse().find((t) => t.role === "assistant")
  if (lastAssistantTurn) {
    return (
      <p
        key={lastAssistantTurn.index}
        className="iris-fade-in max-w-2xl text-balance text-center font-display text-4xl italic text-fg-1"
      >
        “{lastAssistantTurn.text}”
      </p>
    )
  }

  return null
}
