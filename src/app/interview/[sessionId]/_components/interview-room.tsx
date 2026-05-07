"use client"

import { useReducer } from "react"

import { IrisAvatar } from "@/components/brand/iris-avatar"
import { Logo } from "@/components/brand/logo"
import { Toaster } from "@/components/ui/sonner"
import { formatElapsed, getMicCaption, isBusy, isListening, isMicDisabled } from "@/lib/interview-room/phase-labels"
import { getInitialRoomState, roomReducer } from "@/lib/interview-room/reducer"
import type { DisplayTurn, TurnRole } from "@/lib/interview-room/types"
import { cn } from "@/lib/utils"

import { useElapsedTimer } from "../_hooks/use-elapsed-timer"
import { useInterviewRunner } from "../_hooks/use-interview-runner"
import { AssistantAudio } from "./assistant-audio"
import { AvatarStatus } from "./avatar-status"
import { DecisionPanel } from "./decision-panel"
import { EndButton } from "./end-button"
import { InterviewHero } from "./interview-hero"
import { MicButton } from "./mic-button"
import { StatusPill } from "./status-pill"
import { Transcript } from "./transcript"

interface InterviewRoomProps {
  sessionId: string
  job: { id: string; title: string }
  initialTurns: { index: number; role: TurnRole; text: string }[]
}

export function InterviewRoom({ sessionId, job, initialTurns }: InterviewRoomProps) {
  const initialDisplayTurns: DisplayTurn[] = initialTurns.map((t) => ({
    index: t.index,
    role: t.role,
    text: t.text,
    status: "done",
  }))

  const [state, dispatch] = useReducer(roomReducer, initialDisplayTurns, getInitialRoomState)

  useElapsedTimer(dispatch)

  const runner = useInterviewRunner({ sessionId, state, dispatch })

  const phaseKind = state.phase.kind
  const audioUrl = state.phase.kind === "speaking" ? state.phase.audioUrl : null
  const hasTurns = state.turns.length > 0

  return (
    <div
      className={cn(
        "fixed inset-0 grid grid-rows-[60px_1fr_88px] overflow-hidden bg-bg-canvas text-fg-1",
        state.decisionOpen && "lg:pr-[340px]",
      )}
    >
      {/* ─── Top bar ─── */}
      <div className="flex items-center justify-between border-b border-border-subtle px-6">
        <div className="flex items-center gap-4">
          <Logo size="sm" />
          <div className="hidden flex-col leading-tight sm:flex">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-3">Iris</span>
            <span className="font-ui text-[12px] text-fg-2">{job.title}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill phase={phaseKind} />
          <span className="font-mono text-[12px] tabular-nums text-fg-2">{formatElapsed(state.elapsedSec)}</span>
          <EndButton disabled={phaseKind === "ending" || phaseKind === "done"} onConfirm={runner.handleManualEnd} />
        </div>
      </div>

      {/* ─── Center hero ─── */}
      <div className="relative flex flex-col items-center justify-between gap-6 overflow-hidden px-6 pt-8 pb-4">
        <div className="flex flex-1 flex-col items-center justify-center gap-8">
          <IrisAvatar speaking={phaseKind === "speaking"} size={140} />
          <AvatarStatus phase={phaseKind} />
          <InterviewHero phase={state.phase} turns={state.turns} dispatch={dispatch} />
        </div>

        {hasTurns && (
          <div className="flex w-full flex-col items-center gap-3 border-t border-border-subtle pt-4">
            <Transcript
              turns={state.turns}
              limit={state.fullTranscriptOpen ? null : 3}
              className={state.fullTranscriptOpen ? "max-h-48" : "max-h-32"}
            />
            {state.turns.length > 3 && (
              <button
                type="button"
                onClick={() => dispatch({ type: "TOGGLE_FULL_TRANSCRIPT" })}
                className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-3 hover:text-fg-1"
              >
                {state.fullTranscriptOpen ? "Show recent only" : "Show full transcript"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── Bottom controls ─── */}
      <div className="flex items-center justify-center gap-4 border-t border-border-subtle bg-bg-canvas px-6">
        <div className="flex flex-col items-center gap-1">
          <MicButton
            listening={isListening(phaseKind)}
            disabled={isMicDisabled(phaseKind)}
            busy={isBusy(phaseKind)}
            onStart={runner.handleMicStart}
            onStop={runner.handleAudio}
            onError={runner.handleMicError}
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-4">
            {getMicCaption(phaseKind, hasTurns)}
          </span>
        </div>
      </div>

      <DecisionPanel
        signals={state.signals}
        phase={phaseKind}
        open={state.decisionOpen}
        onToggle={() => dispatch({ type: "TOGGLE_DECISION" })}
      />

      <AssistantAudio audioUrl={audioUrl} onEnded={runner.onAudioEnded} onError={runner.onAudioError} />
      <Toaster />
    </div>
  )
}
