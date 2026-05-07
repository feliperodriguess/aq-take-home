"use client"

import { useCallback, useReducer, useState } from "react"

import { IrisAvatar } from "@/components/brand/iris-avatar"
import { Logo } from "@/components/brand/logo"
import { Toaster } from "@/components/ui/sonner"
import { formatElapsed, getMicCaption, isBusy, isListening, isMicDisabled } from "@/lib/interview-room/phase-labels"
import { getInitialRoomState, roomReducer } from "@/lib/interview-room/reducer"
import type { DisplayTurn, TurnRole } from "@/lib/interview-room/types"
import { cn } from "@/lib/utils"

import { useElapsedTimer } from "../_hooks/use-elapsed-timer"
import { useInterviewRunner } from "../_hooks/use-interview-runner"
import { useMediaStream } from "../_hooks/use-media-stream"
import { AssistantAudio } from "./assistant-audio"
import { AvatarStatus } from "./avatar-status"
import { DecisionPanel } from "./decision-panel"
import { EndButton } from "./end-button"
import { HomeLink } from "./home-link"
import { InterviewHero } from "./interview-hero"
import { MicButton } from "./mic-button"
import { PanelToggle } from "./panel-toggle"
import { SelfView } from "./self-view"
import { StatusPill } from "./status-pill"
import { Transcript } from "./transcript"
import { VideoToggle } from "./video-toggle"

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

  const media = useMediaStream()
  const videoOn = media.videoTrack !== null
  const videoBlocked = media.permissionError?.kind === "video"
  const [videoTouched, setVideoTouched] = useState(false)

  const runner = useInterviewRunner({ sessionId, state, dispatch })

  const phaseKind = state.phase.kind
  const audioUrl = state.phase.kind === "speaking" ? state.phase.audioUrl : null
  const hasTurns = state.turns.length > 0
  const listening = isListening(phaseKind)

  const handleVideoToggle = useCallback(() => {
    setVideoTouched(true)
    if (videoOn) media.disableVideo()
    else void media.enableVideo()
  }, [media, videoOn])

  const cameraCaption = getCameraCaption({
    blocked: videoBlocked,
    blockedReason: videoBlocked ? media.permissionError?.reason : undefined,
    on: videoOn,
    touched: videoTouched,
  })

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
          <HomeLink interviewActive={hasTurns && phaseKind !== "done"} />
          <span aria-hidden className="hidden h-5 w-px bg-border-subtle sm:block" />
          <Logo size="sm" />
          <div className="hidden flex-col leading-tight sm:flex">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-3">Iris</span>
            <span className="font-ui text-[12px] text-fg-2">{job.title}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill phase={phaseKind} />
          <span className="font-mono text-[12px] tabular-nums text-fg-2">{formatElapsed(state.elapsedSec)}</span>
          <PanelToggle open={state.decisionOpen} onToggle={() => dispatch({ type: "TOGGLE_DECISION" })} />
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
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 border-t border-border-subtle bg-bg-canvas px-6">
        <div className="flex items-center gap-2.5 justify-self-start">
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              listening && "bg-pass",
              phaseKind === "speaking" && "bg-accent iris-pulse",
              phaseKind === "thinking" && "bg-accent iris-pulse",
              phaseKind === "uploading" && "bg-info",
              phaseKind === "idle" && "bg-fg-4",
              (phaseKind === "ending" || phaseKind === "done") && "bg-fg-4",
              phaseKind === "error" && "bg-fail",
            )}
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-3">
            {getMicCaption(phaseKind, hasTurns)}
          </span>
        </div>
        <div className="flex items-center gap-5 justify-self-center">
          <div className="flex flex-col items-center gap-1.5">
            <MicButton
              listening={listening}
              disabled={isMicDisabled(phaseKind)}
              busy={isBusy(phaseKind)}
              audioTrack={media.audioTrack}
              enableAudio={media.enableAudio}
              onStart={runner.handleMicStart}
              onStop={runner.handleAudio}
              onError={runner.handleMicError}
            />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <VideoToggle on={videoOn} disabled={videoBlocked} onToggle={handleVideoToggle} />
            <span
              className={cn(
                "max-w-[140px] truncate text-center font-mono text-[10px] uppercase tracking-[0.16em]",
                videoBlocked ? "text-fail" : "text-fg-4",
              )}
            >
              {cameraCaption}
            </span>
          </div>
        </div>
        <span className="hidden justify-self-end font-mono text-[10px] uppercase tracking-[0.12em] text-fg-4 sm:block">
          {answersCaption(state.turns)}
        </span>
      </div>

      {media.videoTrack && (
        <SelfView videoTrack={media.videoTrack} listening={listening} decisionOpen={state.decisionOpen} />
      )}

      <DecisionPanel signals={state.signals} phase={phaseKind} open={state.decisionOpen} />

      <AssistantAudio audioUrl={audioUrl} onEnded={runner.onAudioEnded} onError={runner.onAudioError} />
      <Toaster />
    </div>
  )
}

function answersCaption(turns: DisplayTurn[]): string {
  const count = turns.filter((t) => t.role === "candidate" && t.status === "done").length
  if (count === 0) return ""
  if (count === 1) return "1 answer"
  return `${count} answers`
}

function getCameraCaption({
  blocked,
  blockedReason,
  on,
  touched,
}: {
  blocked: boolean
  blockedReason: string | undefined
  on: boolean
  touched: boolean
}): string {
  if (blocked) return blockedReason ?? "Camera blocked"
  if (!touched) return ""
  if (on) return "Camera on"
  return "Camera off"
}
