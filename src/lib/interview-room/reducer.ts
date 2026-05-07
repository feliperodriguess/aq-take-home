/**
 * The interview-room reducer. Pure: every transition is a switch arm and
 * never reads from React state outside `state`. Co-located with the room's
 * types so the FSM is one import for consumers.
 */

import type { Signals } from "@/types/interview"

import type { DisplayTurn, RoomState } from "./types"

export type RoomAction =
  | { type: "TICK" }
  | { type: "TOGGLE_DECISION" }
  | { type: "TOGGLE_FULL_TRANSCRIPT" }
  | { type: "MIC_START" }
  | { type: "MIC_STOP" }
  /** Bootstrap path: the user kicked off turn 0; show the spinner until /turn responds. */
  | { type: "BEGIN_BOOTSTRAP" }
  | { type: "STT_DONE"; transcript: string; candidateIndex: number }
  | {
      type: "TURN_DONE"
      assistantTurn: DisplayTurn
      signals: Signals
      audioUrl: string
      isFinal: boolean
    }
  | { type: "AUDIO_END" }
  | { type: "AUDIO_ERROR"; message: string }
  | { type: "BEGIN_END" }
  | { type: "DONE" }
  | { type: "ERROR"; message: string }
  | { type: "DISMISS_ERROR" }
  | { type: "MARK_PLAYING"; index: number }

/** Builds the initial state from the (possibly empty) hydration payload. */
export function getInitialRoomState(initialTurns: DisplayTurn[]): RoomState {
  return {
    phase: { kind: "idle" },
    turns: initialTurns,
    signals: null,
    elapsedSec: 0,
    decisionOpen: true,
    fullTranscriptOpen: false,
  }
}

export function roomReducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case "TICK":
      return { ...state, elapsedSec: state.elapsedSec + 1 }
    case "TOGGLE_DECISION":
      return { ...state, decisionOpen: !state.decisionOpen }
    case "TOGGLE_FULL_TRANSCRIPT":
      return { ...state, fullTranscriptOpen: !state.fullTranscriptOpen }
    case "MIC_START":
      return { ...state, phase: { kind: "listening" } }
    case "MIC_STOP":
      return { ...state, phase: { kind: "uploading" } }
    case "BEGIN_BOOTSTRAP":
      // Reuse the `thinking` phase so the existing busy/disabled wiring on
      // the mic button (and the "iris is thinking…" microcopy) lights up
      // immediately while we wait for /turn to respond with question 0.
      return { ...state, phase: { kind: "thinking" } }
    case "STT_DONE": {
      const turn: DisplayTurn = {
        index: action.candidateIndex,
        role: "candidate",
        text: action.transcript,
        status: "done",
      }
      return {
        ...state,
        phase: { kind: "thinking" },
        turns: [...state.turns, turn],
      }
    }
    case "TURN_DONE": {
      const updatedTurns = [...state.turns, { ...action.assistantTurn, status: "playing" as const }]
      return {
        ...state,
        phase: {
          kind: "speaking",
          question: action.assistantTurn.text,
          audioUrl: action.audioUrl,
          isFinal: action.isFinal,
        },
        signals: action.signals,
        turns: updatedTurns,
      }
    }
    case "MARK_PLAYING": {
      return {
        ...state,
        turns: state.turns.map((t) =>
          t.role === "assistant" ? { ...t, status: t.index === action.index ? "playing" : "done" } : t,
        ),
      }
    }
    case "AUDIO_END":
    case "AUDIO_ERROR": {
      // In both cases the assistant has finished talking (or we're treating it
      // as finished). Mark any "playing" bubble as done; advance the FSM.
      const cleared = state.turns.map((t) => (t.status === "playing" ? { ...t, status: "done" as const } : t))
      const wasFinal = state.phase.kind === "speaking" && state.phase.isFinal
      return {
        ...state,
        turns: cleared,
        phase: wasFinal ? { kind: "ending" } : { kind: "idle" },
      }
    }
    case "BEGIN_END":
      return { ...state, phase: { kind: "ending" } }
    case "DONE":
      return { ...state, phase: { kind: "done" } }
    case "ERROR":
      return { ...state, phase: { kind: "error", message: action.message } }
    case "DISMISS_ERROR":
      return { ...state, phase: { kind: "idle" } }
    default:
      return state
  }
}
