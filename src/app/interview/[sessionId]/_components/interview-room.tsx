"use client"

import { useCallback, useReducer } from "react"

import { IrisAvatar } from "@/components/brand/iris-avatar"
import { Logo } from "@/components/brand/logo"
import { Toaster } from "@/components/ui/sonner"
import { getMicCaption, isBusy, isListening, isMicDisabled } from "@/lib/interview-room/phase-labels"
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
import { MicMuteToggle } from "./mic-mute-toggle"
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

  const runner = useInterviewRunner({ sessionId, state, dispatch })

  const phaseKind = state.phase.kind
  const audioUrl = state.phase.kind === "speaking" ? state.phase.audioUrl : null
  const hasTurns = state.turns.length > 0
  const listening = isListening(phaseKind)

  const handleVideoToggle = useCallback(() => {
    if (videoOn) media.disableVideo()
    else void media.enableVideo()
  }, [media, videoOn])

  // Body rows respect the decision panel; the top bar always spans the
  // full viewport so the right cluster sits flush with the right edge.
  const bodyPadRight = state.decisionOpen ? "lg:pr-[340px]" : ""

  return (
    <div className="fixed inset-0 grid grid-rows-[60px_1fr_88px] overflow-hidden bg-bg-canvas text-fg-1">
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
          <PanelToggle open={state.decisionOpen} onToggle={() => dispatch({ type: "TOGGLE_DECISION" })} />
          <EndButton disabled={phaseKind === "ending" || phaseKind === "done"} onConfirm={runner.handleManualEnd} />
        </div>
      </div>

      {/* ─── Center hero ─── */}
      <div
        className={cn(
          "relative flex flex-col items-center justify-between gap-6 overflow-hidden px-6 pt-8 pb-4",
          bodyPadRight,
        )}
      >
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
      <div
        className={cn(
          "grid grid-cols-[1fr_auto_1fr] items-center gap-6 border-t border-border-subtle bg-bg-canvas px-6",
          bodyPadRight,
        )}
      >
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
              // Muting the mic also disables the record button: starting a
              // turn while muted would just capture silence and confuse STT.
              disabled={isMicDisabled(phaseKind) || media.audioMuted}
              busy={isBusy(phaseKind)}
              hasTurns={hasTurns}
              audioTrack={media.audioTrack}
              enableAudio={media.enableAudio}
              onStart={runner.handleMicStart}
              onStop={runner.handleAudio}
              onError={runner.handleMicError}
            />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <MicMuteToggle
              muted={media.audioMuted}
              // Don't let the user mute mid-recording — that would corrupt
              // the turn. The button stays clickable in every other phase.
              disabled={listening}
              onToggle={media.toggleAudioMute}
            />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <VideoToggle on={videoOn} disabled={videoBlocked} onToggle={handleVideoToggle} />
            {videoBlocked && (
              <span className="max-w-[180px] truncate text-center font-mono text-[10px] uppercase tracking-[0.16em] text-fail">
                {media.permissionError?.reason ?? "Camera blocked"}
              </span>
            )}
          </div>
        </div>
        <span className="hidden justify-self-end pr-6 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-4 sm:block">
          {answersCaption(state.turns)}
        </span>
      </div>

      {media.videoTrack && <SelfView videoTrack={media.videoTrack} listening={listening} />}

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
